import { AssetCategoryEnum } from "../enums/asset-category-enum"
export type { Asset } from "./schemas"
export interface FileMetadata {
  sourcePath: string
  fileName: string
  stem: string
  extension: string
  sizeBytes: number
  createdAt: string
  modifiedAt: string
  isImage: boolean
  format?: string
  width?: number
  height?: number
}
export const assetCategoryLabelMap: Record<AssetCategoryEnum, string> = {
  [AssetCategoryEnum.TILESET]: "Tileset",
  [AssetCategoryEnum.TERRAIN_TEXTURE]: "Terrain Texture",
  [AssetCategoryEnum.HDRI]: "HDRI",
  [AssetCategoryEnum.UI]: "UI",
  [AssetCategoryEnum.MESH]: "Mesh",
  [AssetCategoryEnum.IMAGE]: "Image",
  [AssetCategoryEnum.AUDIO]: "Audio",
  [AssetCategoryEnum.FONT]: "Font",
  [AssetCategoryEnum.SHADER]: "Shader",
  [AssetCategoryEnum.DATA]: "Data",
  [AssetCategoryEnum.OTHER]: "Other",
}
const terrainTextureExtensions = new Set(["exr", "tga", "tif", "tiff"])
const hdriExtensions = new Set(["exr", "hdr"])
const meshExtensions = new Set(["blend", "dae", "fbx", "glb", "gltf", "obj"])
const audioExtensions = new Set(["flac", "m4a", "mp3", "ogg", "wav"])
const fontExtensions = new Set(["otf", "ttf", "woff", "woff2"])
const shaderExtensions = new Set(["glsl"])
const imageExtensions = new Set(["avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "webp"])
export function isAudioExtension(extension: string): boolean {
  return audioExtensions.has(extension.toLowerCase())
}
export function isShaderExtension(extension: string): boolean {
  return shaderExtensions.has(extension.toLowerCase())
}
export function isFontExtension(extension: string): boolean {
  return fontExtensions.has(extension.toLowerCase())
}
export function isImageExtension(extension: string): boolean {
  return imageExtensions.has(extension.toLowerCase())
}
export function isTerrainTextureExtension(extension: string): boolean {
  return terrainTextureExtensions.has(extension.toLowerCase())
}
export function isHdriExtension(extension: string): boolean {
  return hdriExtensions.has(extension.toLowerCase())
}
export function isMeshExtension(extension: string): boolean {
  return meshExtensions.has(extension.toLowerCase())
}
export function isAssetExtensionAllowed(category: AssetCategoryEnum, extension: string): boolean {
  const normalizedExtension = extension.replace(/^\./, "")
  if (category === AssetCategoryEnum.TILESET) {
    return normalizedExtension.toLowerCase() === "png"
  }
  if (category === AssetCategoryEnum.UI || category === AssetCategoryEnum.IMAGE) {
    return isImageExtension(normalizedExtension)
  }
  if (category === AssetCategoryEnum.AUDIO) {
    return isAudioExtension(normalizedExtension)
  }
  if (category === AssetCategoryEnum.FONT) {
    return isFontExtension(normalizedExtension)
  }
  if (category === AssetCategoryEnum.SHADER) {
    return isShaderExtension(normalizedExtension)
  }
  if (category === AssetCategoryEnum.HDRI) {
    return isHdriExtension(normalizedExtension)
  }
  if (category === AssetCategoryEnum.MESH) {
    return isMeshExtension(normalizedExtension)
  }
  if (category === AssetCategoryEnum.TERRAIN_TEXTURE) {
    return isTerrainTextureExtension(normalizedExtension)
  }
  return true
}
export const assetCategoryOptionValues = Object.values(AssetCategoryEnum).map((category) => ({
  label: assetCategoryLabelMap[category],
  value: category,
}))
