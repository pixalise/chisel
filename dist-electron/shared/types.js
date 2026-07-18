"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColumnType = exports.InputKeyEnum = exports.assetCategoryOptionValues = exports.assetCategoryLabelMap = exports.AssetCategoryEnum = void 0;
exports.isTerrainTextureExtension = isTerrainTextureExtension;
var AssetCategoryEnum;
(function (AssetCategoryEnum) {
    AssetCategoryEnum["terrainTexture"] = "terrain_texture";
    AssetCategoryEnum["image"] = "image";
    AssetCategoryEnum["audio"] = "audio";
    AssetCategoryEnum["font"] = "font";
    AssetCategoryEnum["data"] = "data";
    AssetCategoryEnum["other"] = "other";
})(AssetCategoryEnum || (exports.AssetCategoryEnum = AssetCategoryEnum = {}));
exports.assetCategoryLabelMap = {
    [AssetCategoryEnum.terrainTexture]: "Terrain Texture",
    [AssetCategoryEnum.image]: "Image",
    [AssetCategoryEnum.audio]: "Audio",
    [AssetCategoryEnum.font]: "Font",
    [AssetCategoryEnum.data]: "Data",
    [AssetCategoryEnum.other]: "Other"
};
const terrainTextureExtensions = new Set(["exr", "gppt", "tga", "tif", "tiff"]);
function isTerrainTextureExtension(extension) {
    return terrainTextureExtensions.has(extension.toLowerCase());
}
exports.assetCategoryOptionValues = Object.values(AssetCategoryEnum).map((category) => ({
    label: exports.assetCategoryLabelMap[category],
    value: category
}));
var InputKeyEnum;
(function (InputKeyEnum) {
    InputKeyEnum["KeyA"] = "KEY_A";
    InputKeyEnum["KeyB"] = "KEY_B";
    InputKeyEnum["KeyC"] = "KEY_C";
    InputKeyEnum["KeyD"] = "KEY_D";
    InputKeyEnum["KeyE"] = "KEY_E";
    InputKeyEnum["KeyF"] = "KEY_F";
    InputKeyEnum["KeyG"] = "KEY_G";
    InputKeyEnum["KeyH"] = "KEY_H";
    InputKeyEnum["KeyI"] = "KEY_I";
    InputKeyEnum["KeyJ"] = "KEY_J";
    InputKeyEnum["KeyK"] = "KEY_K";
    InputKeyEnum["KeyL"] = "KEY_L";
    InputKeyEnum["KeyM"] = "KEY_M";
    InputKeyEnum["KeyN"] = "KEY_N";
    InputKeyEnum["KeyO"] = "KEY_O";
    InputKeyEnum["KeyP"] = "KEY_P";
    InputKeyEnum["KeyQ"] = "KEY_Q";
    InputKeyEnum["KeyR"] = "KEY_R";
    InputKeyEnum["KeyS"] = "KEY_S";
    InputKeyEnum["KeyT"] = "KEY_T";
    InputKeyEnum["KeyU"] = "KEY_U";
    InputKeyEnum["KeyV"] = "KEY_V";
    InputKeyEnum["KeyW"] = "KEY_W";
    InputKeyEnum["KeyX"] = "KEY_X";
    InputKeyEnum["KeyY"] = "KEY_Y";
    InputKeyEnum["KeyZ"] = "KEY_Z";
    InputKeyEnum["Key0"] = "KEY_0";
    InputKeyEnum["Key1"] = "KEY_1";
    InputKeyEnum["Key2"] = "KEY_2";
    InputKeyEnum["Key3"] = "KEY_3";
    InputKeyEnum["Key4"] = "KEY_4";
    InputKeyEnum["Key5"] = "KEY_5";
    InputKeyEnum["Key6"] = "KEY_6";
    InputKeyEnum["Key7"] = "KEY_7";
    InputKeyEnum["Key8"] = "KEY_8";
    InputKeyEnum["Key9"] = "KEY_9";
    InputKeyEnum["KeyF1"] = "KEY_F1";
    InputKeyEnum["KeyF2"] = "KEY_F2";
    InputKeyEnum["KeyF3"] = "KEY_F3";
    InputKeyEnum["KeyF4"] = "KEY_F4";
    InputKeyEnum["KeyF5"] = "KEY_F5";
    InputKeyEnum["KeyF6"] = "KEY_F6";
    InputKeyEnum["KeyF7"] = "KEY_F7";
    InputKeyEnum["KeyF8"] = "KEY_F8";
    InputKeyEnum["KeyF9"] = "KEY_F9";
    InputKeyEnum["KeyF10"] = "KEY_F10";
    InputKeyEnum["KeyF11"] = "KEY_F11";
    InputKeyEnum["KeyF12"] = "KEY_F12";
    InputKeyEnum["KeyEscape"] = "KEY_ESCAPE";
    InputKeyEnum["KeySpace"] = "KEY_SPACE";
    InputKeyEnum["KeyShift"] = "KEY_SHIFT";
    InputKeyEnum["KeyCtrl"] = "KEY_CTRL";
    InputKeyEnum["KeyAlt"] = "KEY_ALT";
    InputKeyEnum["KeyTab"] = "KEY_TAB";
    InputKeyEnum["KeyEnter"] = "KEY_ENTER";
    InputKeyEnum["KeyBackspace"] = "KEY_BACKSPACE";
    InputKeyEnum["KeyUp"] = "KEY_UP";
    InputKeyEnum["KeyDown"] = "KEY_DOWN";
    InputKeyEnum["KeyLeft"] = "KEY_LEFT";
    InputKeyEnum["KeyRight"] = "KEY_RIGHT";
    InputKeyEnum["KeyMinus"] = "KEY_MINUS";
    InputKeyEnum["KeyEqual"] = "KEY_EQUAL";
    InputKeyEnum["KeyKpAdd"] = "KEY_KP_ADD";
    InputKeyEnum["KeyKpSubtract"] = "KEY_KP_SUBTRACT";
    InputKeyEnum["MouseButtonLeft"] = "MOUSE_BUTTON_LEFT";
    InputKeyEnum["MouseButtonRight"] = "MOUSE_BUTTON_RIGHT";
    InputKeyEnum["MouseButtonMiddle"] = "MOUSE_BUTTON_MIDDLE";
    InputKeyEnum["MouseButtonWheelUp"] = "MOUSE_BUTTON_WHEEL_UP";
    InputKeyEnum["MouseButtonWheelDown"] = "MOUSE_BUTTON_WHEEL_DOWN";
})(InputKeyEnum || (exports.InputKeyEnum = InputKeyEnum = {}));
var ColumnType;
(function (ColumnType) {
    ColumnType["string"] = "string";
    ColumnType["text"] = "text";
    ColumnType["integer"] = "integer";
    ColumnType["decimal"] = "decimal";
    ColumnType["range"] = "range";
    ColumnType["boolean"] = "boolean";
    ColumnType["enum"] = "enum";
    ColumnType["enumArray"] = "enumArray";
    ColumnType["assetRef"] = "assetRef";
    ColumnType["ref"] = "ref";
    ColumnType["color"] = "color";
    ColumnType["vector2"] = "vector2";
    ColumnType["vector3"] = "vector3";
    ColumnType["vector4"] = "vector4";
    ColumnType["json"] = "json";
})(ColumnType || (exports.ColumnType = ColumnType = {}));
