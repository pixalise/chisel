// Zora PBR v1. Channel and binary contracts are defined in TEXTURE_FORMAT.md.
export const PACKED_TEXTURE_EXTENSION = "zpbr"
const MAGIC = "ZPBR"
const VERSION = 1
const HEADER_SIZE = 24
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

export interface PackedTexturePackage {
  width: number
  height: number
  albedoMetallic: Buffer
  surface: Buffer
}

function validatePng(payload: Buffer, width: number, height: number): void {
  if (
    payload.length < 33 ||
    !payload.subarray(0, 8).equals(PNG_SIGNATURE) ||
    payload.readUInt32BE(8) !== 13 ||
    payload.subarray(12, 16).toString("ascii") !== "IHDR" ||
    payload.readUInt32BE(16) !== width ||
    payload.readUInt32BE(20) !== height ||
    payload[24] !== 8 ||
    payload[25] !== 6
  ) {
    throw new Error("ZPBR payload must be an RGBA8 PNG matching the package dimensions.")
  }
}

export function readPackedTexturePackage(buffer: Buffer): PackedTexturePackage {
  if (buffer.length < HEADER_SIZE || buffer.subarray(0, 4).toString("ascii") !== MAGIC) {
    throw new Error("File is not a ZPBR texture package.")
  }
  if (buffer.readUInt32LE(4) !== VERSION) {
    throw new Error(`Unsupported ZPBR version: ${buffer.readUInt32LE(4)}`)
  }
  const width = buffer.readUInt32LE(8)
  const height = buffer.readUInt32LE(12)
  const albedoLength = buffer.readUInt32LE(16)
  const surfaceLength = buffer.readUInt32LE(20)
  if (width === 0 || height === 0) {
    throw new Error("ZPBR dimensions must be positive.")
  }
  if (
    albedoLength === 0 ||
    surfaceLength === 0 ||
    HEADER_SIZE + albedoLength + surfaceLength !== buffer.length
  ) {
    throw new Error("ZPBR payload lengths do not match the file size.")
  }
  const albedoMetallic = buffer.subarray(HEADER_SIZE, HEADER_SIZE + albedoLength)
  const surface = buffer.subarray(HEADER_SIZE + albedoLength)
  validatePng(albedoMetallic, width, height)
  validatePng(surface, width, height)
  return { width, height, albedoMetallic, surface }
}

export function writePackedTexturePackage(input: PackedTexturePackage): Buffer {
  const { width, height, albedoMetallic, surface } = input
  const header = Buffer.alloc(HEADER_SIZE)
  header.write(MAGIC, 0, "ascii")
  header.writeUInt32LE(VERSION, 4)
  header.writeUInt32LE(width, 8)
  header.writeUInt32LE(height, 12)
  header.writeUInt32LE(albedoMetallic.length, 16)
  header.writeUInt32LE(surface.length, 20)
  const result = Buffer.concat([header, albedoMetallic, surface])
  readPackedTexturePackage(result)
  return result
}
