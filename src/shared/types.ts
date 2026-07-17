export type { Asset } from "./schemas";

export type NormalZChannel = "red" | "green" | "blue" | "alpha";

export interface AssetPreviewResult {
  dataUrl: string;
  width: number;
  height: number;
}

export interface TerrainTexturePreviewResult {
  baseDataUrl: string;
  height: number;
  surfaceDataUrl: string;
  width: number;
}

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

export type GraphitePreviewStatus = "stopped" | "starting" | "running" | "error";
export type GraphitePreviewViewPreset = "default" | "stamp" | "level" | "biome" | "foliage";
export type GraphitePreviewViewMode = "terrain" | "stamp_bounds" | "sim" | "overlays" | "prefabs" | "all";
export type GraphitePreviewSettingsMode = "default" | "splat";

export interface GraphitePreviewCameraConfig {
  distance: number;
  fovDegrees: number;
  pitchDegrees: number;
  target: [number, number, number];
  yawDegrees: number;
}

export interface GraphitePreviewStampConfig {
  affectedDomains: string[];
  blockerMask: string[];
  debugName: string;
  id: string;
  position: [number, number];
  priority: number;
  radius: number;
  rotationDegrees: number;
  seed: number;
  shape: string;
  size: [number, number];
  surfaceOverride?: string;
  traversalCostDelta: number;
}

export interface GraphitePreviewTerrainStampConfig {
  anchorHeightMeters: number;
  blendMode: "add" | "replace";
  cellSizeMeters: number;
  height: number;
  heightValuesMeters: number[];
  id: string;
  influenceValues: number[];
  pivotMeters: [number, number];
  position: [number, number];
  priority: number;
  rotationDegrees: number;
  scale: number;
  verticalStrength: number;
  width: number;
}

export interface GraphitePreviewTerrainOverlayLayerConfig {
  assetId: string;
  albedoSaturation: number;
  albedoTint: [number, number, number];
  albedoTintStrength: number;
  heightInfluence: number;
  order: number;
  terrainTexture: string;
  textureOffset: [number, number];
  textureRotationDegrees: number;
  textureScale: [number, number];
  weight: number;
}

export interface GraphitePreviewTerrainOverlayConfig {
  algorithm: "height_patch_blend";
  bleed: number;
  cellSizeMeters: number;
  debugName: string;
  edgeJitter: number;
  edgeBreakup: number;
  enabled: boolean;
  heightBlendWidth: number;
  footprintCells: Array<[number, number]>;
  heightSharpness: number;
  id: string;
  opacity: number;
  layers: GraphitePreviewTerrainOverlayLayerConfig[];
  patchScale: number;
  roughnessBias: number;
  seed: number;
  size: [number, number];
  textureScale: number;
  wetnessBias: number;
}

export interface GraphitePreviewTerrainConfig {
  chunkCount: [number, number];
  chunkWorldSize: number;
  editableCellCount: [number, number];
  paddingCells: number;
  settingsControlled?: boolean;
  slotSize: number;
}

export type GraphitePreviewTerrainSamplingMode = "repeat" | "stochastic" | "wang";

export interface GraphitePreviewSettingsConfig {
  ambientColor: [number, number, number];
  ambientIntensity: number;
  chunkCount: [number, number];
  chunkWorldSize: number;
  contrast: number;
  exposure: number;
  hdriIntensity: number;
  hdriPath: string;
  reflectionIntensity: number;
  seed: number;
  sunColor: [number, number, number];
  sunDirection: [number, number, number];
  sunIntensity: number;
}

export interface GraphitePreviewHdriOption {
  id: string;
  label: string;
  path: string;
}

export interface GraphitePreviewSettingsState {
  hdriOptions: GraphitePreviewHdriOption[];
  previewState: GraphitePreviewState;
  settings: GraphitePreviewSettingsConfig;
  settingsMode: GraphitePreviewSettingsMode;
}

export interface GraphitePreviewTerrainBiomeVariantConfig {
  albedoMultiplier: [number, number, number];
  albedoSaturation: number;
  albedoTint: [number, number, number];
  albedoTintStrength: number;
  id: number;
  normalStrength: number;
  roughnessMultiplier: number;
  terrainTexture: string;
  heightBlendStrength: number;
  textureOffset: [number, number];
  textureScale: [number, number];
  wetness: number;
  zoneEnd: number;
  zoneStart: number;
  zoneWeight: number;
}

export interface GraphitePreviewTerrainBiomeConfig {
  heightBlendWidth: number;
  id: number;
  key: string;
  macroTintStrength: number;
  macroScale: number;
  macroStrength: number;
  name: string;
  samplingMode: GraphitePreviewTerrainSamplingMode;
  samplingOffsetScale: number;
  samplingScale: number;
  samplingBlendWidth: number;
  uvScale: number;
  variantCount: number;
  variants: GraphitePreviewTerrainBiomeVariantConfig[];
  zoneBlendWidth: number;
  zoneContrast: number;
  zoneEdgeBreakup: number;
  zoneNoiseScale: number;
  zoneSeed: number;
}

export interface GraphitePreviewOptionsConfig {
  gridEnabled: boolean;
  viewMode: GraphitePreviewViewMode;
}

export interface GraphitePreviewSnapshotConfig {
  camera: GraphitePreviewCameraConfig;
  debugName: string;
  kind: string;
  previewOptions?: GraphitePreviewOptionsConfig;
  previewSettings?: GraphitePreviewSettingsConfig;
  schemaVersion: number;
  snapshotVersion: number;
  stamps?: GraphitePreviewStampConfig[];
  terrainStamps?: GraphitePreviewTerrainStampConfig[];
  terrainBiome?: GraphitePreviewTerrainBiomeConfig;
  terrainOverlays?: GraphitePreviewTerrainOverlayConfig[];
  terrainPreview?: GraphitePreviewTerrainConfig;
}

export interface GraphitePreviewStartInput {
  previewOptions?: GraphitePreviewOptionsConfig;
  projectPath: string;
  settingsMode?: GraphitePreviewSettingsMode;
  showSettingsWindow?: boolean;
  snapshot?: GraphitePreviewSnapshotConfig;
  snapshotKind?: string;
}

export interface GraphitePreviewUpdateOptionsInput {
  previewOptions: GraphitePreviewOptionsConfig;
}

export interface GraphitePreviewUpdateSnapshotInput {
  snapshot: GraphitePreviewSnapshotConfig;
}

export interface GraphitePreviewResetViewInput {
  camera: GraphitePreviewCameraConfig;
  preset: GraphitePreviewViewPreset;
}

export interface GraphitePreviewUpdateSettingsInput {
  settings: GraphitePreviewSettingsConfig;
}

export interface GraphitePreviewState {
  executablePath?: string;
  message: string;
  pid?: number;
  running: boolean;
  status: GraphitePreviewStatus;
}

export interface GraphitePreviewEvent extends GraphitePreviewState {
  generation?: number;
  snapshotKind?: string;
  type: "started" | "ready" | "log" | "error" | "closed";
}

export enum AssetTypeEnum {
  terrain = "terrain",
  terrainTexture = "terrain_texture",
  texture = "texture",
  material = "material",
  shader = "shader",
  config = "config",
  ui = "ui",
  audio = "audio",
  font = "font",
  data = "data",
  other = "other"
}
export const assetTypeEnumLabelMap: Record<AssetTypeEnum, string> = {
  [AssetTypeEnum.terrain]: "Terrain",
  [AssetTypeEnum.terrainTexture]: "Terrain Texture",
  [AssetTypeEnum.texture]: "Texture",
  [AssetTypeEnum.material]: "Material",
  [AssetTypeEnum.shader]: "Shader",
  [AssetTypeEnum.config]: "Config",
  [AssetTypeEnum.ui]: "UI",
  [AssetTypeEnum.audio]: "Audio",
  [AssetTypeEnum.font]: "Font",
  [AssetTypeEnum.data]: "Data",
  [AssetTypeEnum.other]: "Other"
};

export const assetTypeOptionValues = Object.values(AssetTypeEnum).map((type) => ({
  label: assetTypeEnumLabelMap[type],
  value: type
}));

export type AssetType = `${AssetTypeEnum}`;

export enum InputKeyEnum {
  A = "A",
  B = "B",
  C = "C",
  D = "D",
  E = "E",
  F = "F",
  G = "G",
  H = "H",
  I = "I",
  J = "J",
  K = "K",
  L = "L",
  M = "M",
  N = "N",
  O = "O",
  P = "P",
  Q = "Q",
  R = "R",
  S = "S",
  T = "T",
  U = "U",
  V = "V",
  W = "W",
  X = "X",
  Y = "Y",
  Z = "Z",
  Digit0 = "0",
  Digit1 = "1",
  Digit2 = "2",
  Digit3 = "3",
  Digit4 = "4",
  Digit5 = "5",
  Digit6 = "6",
  Digit7 = "7",
  Digit8 = "8",
  Digit9 = "9",
  F1 = "F1",
  F2 = "F2",
  F3 = "F3",
  F4 = "F4",
  F5 = "F5",
  F6 = "F6",
  F7 = "F7",
  F8 = "F8",
  F9 = "F9",
  F10 = "F10",
  F11 = "F11",
  F12 = "F12",
  F13 = "F13",
  F14 = "F14",
  F15 = "F15",
  F16 = "F16",
  F17 = "F17",
  F18 = "F18",
  F19 = "F19",
  F20 = "F20",
  F21 = "F21",
  F22 = "F22",
  F23 = "F23",
  F24 = "F24",
  Return = "Return",
  Escape = "Escape",
  Backspace = "Backspace",
  Tab = "Tab",
  Space = "Space",
  Minus = "-",
  Equal = "=",
  BracketLeft = "[",
  BracketRight = "]",
  Backslash = "\\",
  Hash = "#",
  Semicolon = ";",
  Quote = "'",
  Backquote = "`",
  Comma = ",",
  Period = ".",
  Slash = "/",
  CapsLock = "CapsLock",
  PrintScreen = "PrintScreen",
  ScrollLock = "ScrollLock",
  Pause = "Pause",
  Insert = "Insert",
  Home = "Home",
  PageUp = "PageUp",
  Delete = "Delete",
  End = "End",
  PageDown = "PageDown",
  Right = "Right",
  Left = "Left",
  Down = "Down",
  Up = "Up",
  Numlock = "Numlock",
  KeypadDivide = "Keypad /",
  KeypadMultiply = "Keypad *",
  KeypadMinus = "Keypad -",
  KeypadPlus = "Keypad +",
  KeypadEnter = "Keypad Enter",
  Keypad0 = "Keypad 0",
  Keypad1 = "Keypad 1",
  Keypad2 = "Keypad 2",
  Keypad3 = "Keypad 3",
  Keypad4 = "Keypad 4",
  Keypad5 = "Keypad 5",
  Keypad6 = "Keypad 6",
  Keypad7 = "Keypad 7",
  Keypad8 = "Keypad 8",
  Keypad9 = "Keypad 9",
  KeypadPeriod = "Keypad .",
  KeypadEqual = "Keypad =",
  KeypadComma = "Keypad ,",
  KeypadEqualAs400 = "Keypad = (AS400)",
  Keypad00 = "Keypad 00",
  Keypad000 = "Keypad 000",
  ThousandsSeparator = "ThousandsSeparator",
  DecimalSeparator = "DecimalSeparator",
  CurrencyUnit = "CurrencyUnit",
  CurrencySubUnit = "CurrencySubUnit",
  KeypadLeftParen = "Keypad (",
  KeypadRightParen = "Keypad )",
  KeypadLeftBrace = "Keypad {",
  KeypadRightBrace = "Keypad }",
  KeypadTab = "Keypad Tab",
  KeypadBackspace = "Keypad Backspace",
  KeypadA = "Keypad A",
  KeypadB = "Keypad B",
  KeypadC = "Keypad C",
  KeypadD = "Keypad D",
  KeypadE = "Keypad E",
  KeypadF = "Keypad F",
  KeypadXor = "Keypad XOR",
  KeypadPower = "Keypad ^",
  KeypadPercent = "Keypad %",
  KeypadLess = "Keypad <",
  KeypadGreater = "Keypad >",
  KeypadAmpersand = "Keypad &",
  KeypadDoubleAmpersand = "Keypad &&",
  KeypadPipe = "Keypad |",
  KeypadDoublePipe = "Keypad ||",
  KeypadColon = "Keypad :",
  KeypadHash = "Keypad #",
  KeypadSpace = "Keypad Space",
  KeypadAt = "Keypad @",
  KeypadExclamation = "Keypad !",
  KeypadMemStore = "Keypad MemStore",
  KeypadMemRecall = "Keypad MemRecall",
  KeypadMemClear = "Keypad MemClear",
  KeypadMemAdd = "Keypad MemAdd",
  KeypadMemSubtract = "Keypad MemSubtract",
  KeypadMemMultiply = "Keypad MemMultiply",
  KeypadMemDivide = "Keypad MemDivide",
  KeypadPlusMinus = "Keypad +/-",
  KeypadClear = "Keypad Clear",
  KeypadClearEntry = "Keypad ClearEntry",
  KeypadBinary = "Keypad Binary",
  KeypadOctal = "Keypad Octal",
  KeypadDecimal = "Keypad Decimal",
  KeypadHexadecimal = "Keypad Hexadecimal",
  NonUSBackslash = "NonUSBackslash",
  Application = "Application",
  Power = "Power",
  Execute = "Execute",
  Help = "Help",
  Menu = "Menu",
  Select = "Select",
  Stop = "Stop",
  Again = "Again",
  Undo = "Undo",
  Cut = "Cut",
  Copy = "Copy",
  Paste = "Paste",
  Find = "Find",
  Mute = "Mute",
  VolumeUp = "VolumeUp",
  VolumeDown = "VolumeDown",
  International1 = "International 1",
  International2 = "International 2",
  International3 = "International 3",
  International4 = "International 4",
  International5 = "International 5",
  International6 = "International 6",
  International7 = "International 7",
  International8 = "International 8",
  International9 = "International 9",
  Language1 = "Language 1",
  Language2 = "Language 2",
  Language3 = "Language 3",
  Language4 = "Language 4",
  Language5 = "Language 5",
  Language6 = "Language 6",
  Language7 = "Language 7",
  Language8 = "Language 8",
  Language9 = "Language 9",
  AltErase = "AltErase",
  SysReq = "SysReq",
  Cancel = "Cancel",
  Clear = "Clear",
  Prior = "Prior",
  Separator = "Separator",
  Out = "Out",
  Oper = "Oper",
  ClearAgain = "Clear / Again",
  CrSel = "CrSel",
  ExSel = "ExSel",
  LeftCtrl = "Left Ctrl",
  LeftShift = "Left Shift",
  LeftAlt = "Left Alt",
  LeftGui = "Left GUI",
  RightCtrl = "Right Ctrl",
  RightShift = "Right Shift",
  RightAlt = "Right Alt",
  RightGui = "Right GUI",
  ModeSwitch = "ModeSwitch",
  Sleep = "Sleep",
  Wake = "Wake",
  ChannelUp = "ChannelUp",
  ChannelDown = "ChannelDown",
  MediaPlay = "MediaPlay",
  MediaPause = "MediaPause",
  MediaRecord = "MediaRecord",
  MediaFastForward = "MediaFastForward",
  MediaRewind = "MediaRewind",
  MediaTrackNext = "MediaTrackNext",
  MediaTrackPrevious = "MediaTrackPrevious",
  MediaStop = "MediaStop",
  Eject = "Eject",
  MediaPlayPause = "MediaPlayPause",
  MediaSelect = "MediaSelect",
  AcNew = "AC New",
  AcOpen = "AC Open",
  AcClose = "AC Close",
  AcExit = "AC Exit",
  AcSave = "AC Save",
  AcPrint = "AC Print",
  AcProperties = "AC Properties",
  AcSearch = "AC Search",
  AcHome = "AC Home",
  AcBack = "AC Back",
  AcForward = "AC Forward",
  AcStop = "AC Stop",
  AcRefresh = "AC Refresh",
  AcBookmarks = "AC Bookmarks",
  SoftLeft = "SoftLeft",
  SoftRight = "SoftRight",
  Call = "Call",
  EndCall = "EndCall",
  MouseLeft = "MouseLeft",
  MouseRight = "MouseRight",
  MouseMiddle = "MouseMiddle",
  WheelUp = "WheelUp",
  WheelDown = "WheelDown"
}

export enum ColumnType {
  id = "id",
  string = "string",
  text = "text",
  integer = "integer",
  decimal = "decimal",
  range = "range",
  boolean = "boolean",
  enum = "enum",
  enumArray = "enumArray",
  assetRef = "assetRef",
  ref = "ref",
  color = "color",
  vector2 = "vector2",
  vector3 = "vector3",
  vector4 = "vector4",
  cellMask = "cell_mask",
  heightField = "height_field",
  transform3 = "transform3",
  terrainLayerRef = "terrain_layer_ref",
  stampMaskRef = "stamp_mask_ref",
  heightFieldRef = "height_field_ref",
  json = "json"
}
