export type { Asset } from "./schemas";

export interface FileMetadata {
  sourcePath: string;
  fileName: string;
  stem: string;
  extension: string;
  sizeBytes: number;
  createdAt: string;
  modifiedAt: string;
  isImage: boolean;
  format?: string;
  width?: number;
  height?: number;
}

export enum AssetCategoryEnum {
  terrainTexture = "TERRAIN_TEXTURE",
  hdri = "HDRI",
  uiIcon = "UI_ICON",
  mesh = "MESH",
  image = "IMAGE",
  audio = "AUDIO",
  font = "FONT",
  data = "DATA",
  other = "OTHER"
}
export const assetCategoryLabelMap: Record<AssetCategoryEnum, string> = {
  [AssetCategoryEnum.terrainTexture]: "Terrain Texture",
  [AssetCategoryEnum.hdri]: "HDRI",
  [AssetCategoryEnum.uiIcon]: "UI Icon",
  [AssetCategoryEnum.mesh]: "Mesh",
  [AssetCategoryEnum.image]: "Image",
  [AssetCategoryEnum.audio]: "Audio",
  [AssetCategoryEnum.font]: "Font",
  [AssetCategoryEnum.data]: "Data",
  [AssetCategoryEnum.other]: "Other"
};

const terrainTextureExtensions = new Set(["exr", "gppt", "tga", "tif", "tiff"]);
const hdriExtensions = new Set(["exr", "hdr"]);
const meshExtensions = new Set(["blend", "dae", "fbx", "glb", "gltf", "obj"]);
const audioExtensions = new Set(["flac", "m4a", "mp3", "ogg", "wav"]);

export function isAudioExtension(extension: string): boolean {
  return audioExtensions.has(extension.toLowerCase());
}

export function isTerrainTextureExtension(extension: string): boolean {
  return terrainTextureExtensions.has(extension.toLowerCase());
}

export function isHdriExtension(extension: string): boolean {
  return hdriExtensions.has(extension.toLowerCase());
}

export function isMeshExtension(extension: string): boolean {
  return meshExtensions.has(extension.toLowerCase());
}

export const assetCategoryOptionValues = Object.values(AssetCategoryEnum).map((category) => ({
  label: assetCategoryLabelMap[category],
  value: category
}));

export type AssetCategory = `${AssetCategoryEnum}`;

export enum InputKeyEnum {
  KeyA = "KEY_A",
  KeyB = "KEY_B",
  KeyC = "KEY_C",
  KeyD = "KEY_D",
  KeyE = "KEY_E",
  KeyF = "KEY_F",
  KeyG = "KEY_G",
  KeyH = "KEY_H",
  KeyI = "KEY_I",
  KeyJ = "KEY_J",
  KeyK = "KEY_K",
  KeyL = "KEY_L",
  KeyM = "KEY_M",
  KeyN = "KEY_N",
  KeyO = "KEY_O",
  KeyP = "KEY_P",
  KeyQ = "KEY_Q",
  KeyR = "KEY_R",
  KeyS = "KEY_S",
  KeyT = "KEY_T",
  KeyU = "KEY_U",
  KeyV = "KEY_V",
  KeyW = "KEY_W",
  KeyX = "KEY_X",
  KeyY = "KEY_Y",
  KeyZ = "KEY_Z",
  Key0 = "KEY_0",
  Key1 = "KEY_1",
  Key2 = "KEY_2",
  Key3 = "KEY_3",
  Key4 = "KEY_4",
  Key5 = "KEY_5",
  Key6 = "KEY_6",
  Key7 = "KEY_7",
  Key8 = "KEY_8",
  Key9 = "KEY_9",
  KeyF1 = "KEY_F1",
  KeyF2 = "KEY_F2",
  KeyF3 = "KEY_F3",
  KeyF4 = "KEY_F4",
  KeyF5 = "KEY_F5",
  KeyF6 = "KEY_F6",
  KeyF7 = "KEY_F7",
  KeyF8 = "KEY_F8",
  KeyF9 = "KEY_F9",
  KeyF10 = "KEY_F10",
  KeyF11 = "KEY_F11",
  KeyF12 = "KEY_F12",
  KeyEscape = "KEY_ESCAPE",
  KeySpace = "KEY_SPACE",
  KeyShift = "KEY_SHIFT",
  KeyCtrl = "KEY_CTRL",
  KeyAlt = "KEY_ALT",
  KeyTab = "KEY_TAB",
  KeyEnter = "KEY_ENTER",
  KeyBackspace = "KEY_BACKSPACE",
  KeyUp = "KEY_UP",
  KeyDown = "KEY_DOWN",
  KeyLeft = "KEY_LEFT",
  KeyRight = "KEY_RIGHT",
  KeyMinus = "KEY_MINUS",
  KeyEqual = "KEY_EQUAL",
  KeyKpAdd = "KEY_KP_ADD",
  KeyKpSubtract = "KEY_KP_SUBTRACT",
  MouseButtonLeft = "MOUSE_BUTTON_LEFT",
  MouseButtonRight = "MOUSE_BUTTON_RIGHT",
  MouseButtonMiddle = "MOUSE_BUTTON_MIDDLE",
  MouseButtonWheelUp = "MOUSE_BUTTON_WHEEL_UP",
  MouseButtonWheelDown = "MOUSE_BUTTON_WHEEL_DOWN"
}

export enum ColumnType {
  string = "string",
  text = "text",
  integer = "integer",
  decimal = "decimal",
  range = "range",
  boolean = "boolean",
  enum = "enum",
  enumArray = "enumArray",
  assetRef = "assetRef",
  translationRef = "translationRef",
  ref = "ref",
  color = "color",
  vector2 = "vector2",
  vector3 = "vector3",
  vector4 = "vector4",
  json = "json"
}
