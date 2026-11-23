import { describe, expect, it } from "vitest"
import { nextMip } from "./zora-textures"
describe("packed PBR mip filtering", () => {
  it("matches Zora's linear-albedo and unpremultiplied-alpha golden cases", () => {
    expect(
      Array.from(
        nextMip(
          { width: 2, height: 1, pixels: new Uint8Array([0, 0, 0, 0, 255, 255, 255, 255]) },
          false
        ).pixels
      )
    ).toEqual([188, 188, 188, 128])
    expect(
      Array.from(
        nextMip(
          {
            width: 3,
            height: 1,
            pixels: new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255]),
          },
          false
        ).pixels
      )
    ).toEqual([156, 156, 156, 85])
  })
  it("normalizes packed normals while averaging scalar channels", () => {
    expect(
      Array.from(
        nextMip(
          { width: 2, height: 1, pixels: new Uint8Array([204, 0, 128, 0, 51, 255, 128, 255]) },
          true
        ).pixels
      )
    ).toEqual([128, 128, 128, 128])
  })
})

import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import sharp from "sharp"
import { prepareZoraTextures } from "./zora-textures"
import { writePackedTexturePackage } from "./texture-package"
it.skipIf(!process.env.MRAK_TEXTUREC && !process.env.MRAK_ZORA_ROOT)(
  "compresses odd-sized maps and every tiny mip without changing logical dimensions",
  async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mrak-prepared-"))
    try {
      const png = await sharp({
        create: {
          width: 7,
          height: 5,
          channels: 4,
          background: { r: 128, g: 140, b: 128, alpha: 0.5 },
        },
      })
        .png()
        .toBuffer()
      const packed = writePackedTexturePackage({
        width: 7,
        height: 5,
        albedoMetallic: png,
        surface: png,
      })
      let compiler = process.env.MRAK_TEXTUREC
      if (!compiler) {
        let platform = "linux"
        if (process.platform === "darwin") {
          platform = "osx"
        }
        compiler = path.join(
          process.env.MRAK_ZORA_ROOT ?? "",
          "vcpkg_installed",
          `${process.arch}-${platform}`,
          "tools/bgfx/texturec"
        )
      }
      await prepareZoraTextures(packed, directory, "ODD", compiler)
      for (const name of ["ODD_T1.ktx", "ODD_T2.ktx"]) {
        const data = await fs.readFile(path.join(directory, name))
        expect(data.readUInt32LE(28)).toBe(0x8e8c)
        expect(data.readUInt32LE(36)).toBe(7)
        expect(data.readUInt32LE(40)).toBe(5)
        expect(data.readUInt32LE(56)).toBe(3)
        let offset = 64
        for (const expected of [64, 16, 16]) {
          expect(data.readUInt32LE(offset)).toBe(expected)
          offset += expected + 4
        }
        expect(offset).toBe(data.length)
      }
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  },
  30000
)
