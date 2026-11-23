import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import sharp from "sharp"
import { readPackedTexturePackage } from "./texture-package"

interface MipLevel {
  width: number
  height: number
  pixels: Uint8Array
}
const execute = promisify(execFile)
function linear(value: number): number {
  if (value <= 0.04045) {
    return value / 12.92
  }
  return Math.pow((value + 0.055) / 1.055, 2.4)
}
function srgb(value: number): number {
  if (value <= 0.0031308) {
    return value * 12.92
  }
  return 1.055 * Math.pow(value, 1 / 2.4) - 0.055
}
export function nextMip(source: MipLevel, surface: boolean): MipLevel {
  const width = Math.max(1, Math.floor(source.width / 2))
  const height = Math.max(1, Math.floor(source.height / 2))
  const pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const left = (x * source.width) / width
      const right = ((x + 1) * source.width) / width
      const top = (y * source.height) / height
      const bottom = ((y + 1) * source.height) / height
      const sum = [0, 0, 0, 0]
      const normal = [0, 0, 0]
      let total = 0
      for (let sy = Math.floor(top); sy < Math.ceil(bottom); sy++) {
        for (let sx = Math.floor(left); sx < Math.ceil(right); sx++) {
          const weight =
            (Math.min(right, sx + 1) - Math.max(left, sx)) *
            (Math.min(bottom, sy + 1) - Math.max(top, sy))
          const index = (sy * source.width + sx) * 4
          const value = Array.from(
            source.pixels.slice(index, index + 4),
            (channel) => channel / 255
          )
          if (surface) {
            const nx = value[0] * 2 - 1
            const ny = value[2] * 2 - 1
            const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
            const length = Math.hypot(nx, ny, nz)
            normal[0] += (nx / length) * weight
            normal[1] += (ny / length) * weight
            normal[2] += (nz / length) * weight
          } else {
            for (let channel = 0; channel < 3; channel++) {
              value[channel] = linear(value[channel])
            }
          }
          for (let channel = 0; channel < 4; channel++) {
            sum[channel] += value[channel] * weight
          }
          total += weight
        }
      }
      for (let channel = 0; channel < 4; channel++) {
        sum[channel] /= total
      }
      if (surface) {
        const length = Math.hypot(...normal)
        if (length === 0) {
          normal[2] = 1
        }
        const denominator = Math.hypot(...normal)
        sum[0] = (normal[0] / denominator) * 0.5 + 0.5
        sum[2] = (normal[1] / denominator) * 0.5 + 0.5
      } else {
        for (let channel = 0; channel < 3; channel++) {
          sum[channel] = srgb(sum[channel])
        }
      }
      for (let channel = 0; channel < 4; channel++) {
        pixels[(y * width + x) * 4 + channel] = Math.max(
          0,
          Math.min(255, Math.floor(sum[channel] * 255 + 0.5))
        )
      }
    }
  }
  return { width, height, pixels }
}
function ktxHeader(width: number, height: number, levels: number, compressed: boolean): Buffer {
  const header = Buffer.alloc(64)
  Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x31, 0x31, 0xbb, 13, 10, 26, 10]).copy(header)
  let type = 0x1401
  let format = 0x1908
  let internal = 0x8058
  if (compressed) {
    type = 0
    format = 0
    internal = 0x8e8c
  }
  const fields = [0x04030201, type, 1, format, internal, 0x1908, width, height, 0, 0, 1, levels, 0]
  fields.forEach((value, index) => header.writeUInt32LE(value, 12 + index * 4))
  return header
}
function chunk(data: Uint8Array): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32LE(data.length)
  return Buffer.concat([length, data])
}
async function compressMip(level: MipLevel, scratch: string, compiler: string): Promise<Buffer> {
  // Encode complete 4x4 blocks with replicated edges. Never ask texturec to filter
  // packed channels or to decode its sub-block mips back into RGBA.
  const width = Math.ceil(level.width / 4) * 4
  const height = Math.ceil(level.height / 4) * 4
  const pixels = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const source =
        (Math.min(y, level.height - 1) * level.width + Math.min(x, level.width - 1)) * 4
      pixels.set(level.pixels.subarray(source, source + 4), (y * width + x) * 4)
    }
  }
  const input = path.join(scratch, "input.ktx")
  const output = path.join(scratch, "output.ktx")
  await fs.writeFile(input, Buffer.concat([ktxHeader(width, height, 1, false), chunk(pixels)]))
  await execute(compiler, ["-f", input, "-o", output, "-t", "BC7", "--linear"], { timeout: 600000 })
  const encoded = await fs.readFile(output)
  const expected = width * height
  if (
    encoded.length < 68 ||
    encoded.readUInt32LE(28) !== 0x8e8c ||
    encoded.readUInt32LE(56) !== 1
  ) {
    throw new Error("Texture compiler did not produce a single BC7 KTX mip.")
  }
  const offset = 64 + encoded.readUInt32LE(60)
  if (encoded.readUInt32LE(offset) !== expected || encoded.length !== offset + 4 + expected) {
    throw new Error("Texture compiler returned an invalid BC7 payload length.")
  }
  return encoded.subarray(offset + 4)
}
export async function prepareZoraTextures(
  data: Buffer,
  directory: string,
  slug: string,
  compiler: string
): Promise<void> {
  const packed = readPackedTexturePackage(data)
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "mrak-bc7-"))
  try {
    const sources = [packed.albedoMetallic, packed.surface]
    for (let index = 0; index < sources.length; index++) {
      const decoded = await sharp(sources[index], { ignoreIcc: true, failOn: "warning" })
        .raw()
        .toBuffer()
      let level: MipLevel = { width: packed.width, height: packed.height, pixels: decoded }
      const mips: Buffer[] = []
      while (true) {
        mips.push(chunk(await compressMip(level, scratch, compiler)))
        if (level.width === 1 && level.height === 1) {
          break
        }
        level = nextMip(level, index === 1)
      }
      await fs.writeFile(
        path.join(directory, `${slug}_T${index + 1}.ktx`),
        Buffer.concat([ktxHeader(packed.width, packed.height, mips.length, true), ...mips])
      )
    }
  } finally {
    await fs.rm(scratch, { recursive: true, force: true })
  }
}
