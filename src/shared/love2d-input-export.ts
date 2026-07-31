import { snakeCase } from "lodash";
import type { AnyDataTable, DataColumnDefinition, DataTableRow } from "./schemas";
import { ColumnType } from "./types";

const INPUT_BINDINGS_TABLE_ID = "input_bindings";
const INPUT_BINDINGS_COLUMN_NAME = "bindings";

export interface Love2dInputExportFile {
  content: string;
  path: string;
}

const keyNamesByBinding: Readonly<Record<string, string[]>> = {
  KEY_0: ["0"],
  KEY_1: ["1"],
  KEY_2: ["2"],
  KEY_3: ["3"],
  KEY_4: ["4"],
  KEY_5: ["5"],
  KEY_6: ["6"],
  KEY_7: ["7"],
  KEY_8: ["8"],
  KEY_9: ["9"],
  KEY_ALT: ["lalt", "ralt"],
  KEY_BACKSPACE: ["backspace"],
  KEY_CTRL: ["lctrl", "rctrl"],
  KEY_DOWN: ["down"],
  KEY_ENTER: ["return", "kpenter"],
  KEY_EQUAL: ["="],
  KEY_ESCAPE: ["escape"],
  KEY_F1: ["f1"],
  KEY_F2: ["f2"],
  KEY_F3: ["f3"],
  KEY_F4: ["f4"],
  KEY_F5: ["f5"],
  KEY_F6: ["f6"],
  KEY_F7: ["f7"],
  KEY_F8: ["f8"],
  KEY_F9: ["f9"],
  KEY_F10: ["f10"],
  KEY_F11: ["f11"],
  KEY_F12: ["f12"],
  KEY_KP_ADD: ["kp+"],
  KEY_KP_SUBTRACT: ["kp-"],
  KEY_LEFT: ["left"],
  KEY_MINUS: ["-"],
  KEY_RIGHT: ["right"],
  KEY_SHIFT: ["lshift", "rshift"],
  KEY_SPACE: ["space"],
  KEY_TAB: ["tab"],
  KEY_UP: ["up"]
};

const mouseButtonsByBinding: Readonly<Record<string, number>> = {
  MOUSE_BUTTON_LEFT: 1,
  MOUSE_BUTTON_RIGHT: 2,
  MOUSE_BUTTON_MIDDLE: 3
};

const wheelDirectionsByBinding: Readonly<Record<string, number>> = {
  MOUSE_BUTTON_WHEEL_UP: 1,
  MOUSE_BUTTON_WHEEL_DOWN: -1
};

function luaString(value: string): string {
  let result = '"';
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (character === "\\") {
      result += "\\\\";
    } else if (character === '"') {
      result += '\\"';
    } else if (character === "\n") {
      result += "\\n";
    } else if (character === "\r") {
      result += "\\r";
    } else if (character === "\t") {
      result += "\\t";
    } else if (character === "\b") {
      result += "\\b";
    } else if (character === "\f") {
      result += "\\f";
    } else if (typeof codePoint === "number" && (codePoint < 32 || codePoint === 127)) {
      result += `\\${codePoint.toString().padStart(3, "0")}`;
    } else {
      result += character;
    }
  }
  return `${result}"`;
}

function luaArray(values: string[]): string {
  return `{ ${values.join(", ")} }`;
}

function columnValue(row: DataTableRow, column: DataColumnDefinition): unknown {
  return row.values.find((entry) => entry.columnId === column.id)?.value ?? column.defaultValue;
}

function bindingColumn(table: AnyDataTable): DataColumnDefinition {
  const column = table.columns.find((entry) => entry.name === INPUT_BINDINGS_COLUMN_NAME);
  if (!column || column.type !== ColumnType.enumArray) {
    throw new Error(`LÖVE input export requires an enumArray column named "${INPUT_BINDINGS_COLUMN_NAME}".`);
  }
  return column;
}

function rowBindings(row: DataTableRow, column: DataColumnDefinition): string[] {
  const value = columnValue(row, column);
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`LÖVE input action "${row.slug}" has invalid bindings.`);
  }
  return value;
}

function keyboardKeys(binding: string): string[] | undefined {
  const letter = /^KEY_([A-Z])$/.exec(binding)?.[1];
  if (letter) {
    return [letter.toLowerCase()];
  }
  return keyNamesByBinding[binding];
}

function inputArrays(table: AnyDataTable): { keyboard: string[]; mouse: string[]; wheel: string[] } {
  const column = bindingColumn(table);
  const keyboard: string[] = [];
  const mouse: string[] = [];
  const wheel: string[] = [];

  for (const row of table.rows) {
    const keyboardBindings: string[] = [];
    const mouseBindings: string[] = [];
    const wheelBindings: string[] = [];

    for (const binding of rowBindings(row, column)) {
      const keys = keyboardKeys(binding);
      const mouseButton = mouseButtonsByBinding[binding];
      const wheelDirection = wheelDirectionsByBinding[binding];

      if (keys) {
        keyboardBindings.push(...keys.map(luaString));
      } else if (typeof mouseButton === "number") {
        mouseBindings.push(String(mouseButton));
      } else if (typeof wheelDirection === "number") {
        wheelBindings.push(String(wheelDirection));
      } else {
        throw new Error(`Unsupported LÖVE input binding "${binding}" on action "${row.slug}".`);
      }
    }

    keyboard.push(luaArray(keyboardBindings));
    mouse.push(luaArray(mouseBindings));
    wheel.push(luaArray(wheelBindings));
  }

  return { keyboard, mouse, wheel };
}

export function renderLove2dInputExport(tables: AnyDataTable[], exportRoot: string): Love2dInputExportFile[] {
  const inputTable = tables.find((table) => table.id === INPUT_BINDINGS_TABLE_ID);
  if (!inputTable) {
    return [];
  }

  const actions = inputTable.rows.map((row) => luaString(snakeCase(row.slug)));
  const bindings = inputArrays(inputTable);
  const inputTableModule = `${exportRoot.replaceAll("/", ".")}.tables.input_bindings`;

  return [
    {
      path: `${exportRoot}/input.lua`,
      content: `-- Generated by Chisel. Do not edit.\nlocal definitions = require(${luaString(inputTableModule)})\n\nlocal input = {\n\tID = definitions.ID,\n\tACTION_NAMES = ${luaArray(actions)},\n}\n\nlocal keyBindings = { ${bindings.keyboard.join(", ")} }\nlocal mouseBindings = { ${bindings.mouse.join(", ")} }\nlocal wheelBindings = { ${bindings.wheel.join(", ")} }\nlocal justPressedKeys = {}\nlocal justReleasedKeys = {}\nlocal justPressedMouseButtons = {}\nlocal justReleasedMouseButtons = {}\nlocal wheelDelta = 0\n\nlocal function actionIndex(action)\n\tif type(action) ~= "number" or action % 1 ~= 0 or action < 1 or action > definitions.COUNT then\n\t\terror("Invalid Chisel input action: " .. tostring(action), 3)\n\tend\n\treturn action\nend\n\nlocal function requireLoveInput()\n\tif not love or not love.keyboard or not love.mouse then\n\t\terror("Chisel input queries require the LÖVE keyboard and mouse modules.", 3)\n\tend\nend\n\nlocal function hasKeyState(keys, states)\n\tfor _, key in ipairs(keys) do\n\t\tif states[key] then\n\t\t\treturn true\n\t\tend\n\tend\n\treturn false\nend\n\nlocal function hasMouseState(buttons, states)\n\tfor _, button in ipairs(buttons) do\n\t\tif states[button] then\n\t\t\treturn true\n\t\tend\n\tend\n\treturn false\nend\n\nlocal function hasWheelState(directions)\n\tfor _, direction in ipairs(directions) do\n\t\tif direction > 0 and wheelDelta > 0 then\n\t\t\treturn true\n\t\telseif direction < 0 and wheelDelta < 0 then\n\t\t\treturn true\n\t\tend\n\tend\n\treturn false\nend\n\nfunction input.actionName(action)\n\treturn input.ACTION_NAMES[actionIndex(action)]\nend\n\nfunction input.getActionStrength(action)\n\tif input.isActionPressed(action) then\n\t\treturn 1\n\tend\n\treturn 0\nend\n\nfunction input.isActionPressed(action)\n\tlocal index = actionIndex(action)\n\trequireLoveInput()\n\tfor _, key in ipairs(keyBindings[index]) do\n\t\tif love.keyboard.isDown(key) then\n\t\t\treturn true\n\t\tend\n\tend\n\tfor _, button in ipairs(mouseBindings[index]) do\n\t\tif love.mouse.isDown(button) then\n\t\t\treturn true\n\t\tend\n\tend\n\treturn hasWheelState(wheelBindings[index])\nend\n\nfunction input.isActionJustPressed(action)\n\tlocal index = actionIndex(action)\n\treturn hasKeyState(keyBindings[index], justPressedKeys)\n\t\tor hasMouseState(mouseBindings[index], justPressedMouseButtons)\n\t\tor hasWheelState(wheelBindings[index])\nend\n\nfunction input.isActionJustReleased(action)\n\tlocal index = actionIndex(action)\n\treturn hasKeyState(keyBindings[index], justReleasedKeys)\n\t\tor hasMouseState(mouseBindings[index], justReleasedMouseButtons)\nend\n\nfunction input.keypressed(key, _scanCode, isRepeat)\n\tif not isRepeat then\n\t\tjustPressedKeys[key] = true\n\tend\nend\n\nfunction input.keyreleased(key)\n\tjustReleasedKeys[key] = true\nend\n\nfunction input.mousepressed(_x, _y, button)\n\tjustPressedMouseButtons[button] = true\nend\n\nfunction input.mousereleased(_x, _y, button)\n\tjustReleasedMouseButtons[button] = true\nend\n\nfunction input.wheelmoved(_deltaX, deltaY)\n\twheelDelta = wheelDelta + deltaY\nend\n\nfunction input.endFrame()\n\tjustPressedKeys = {}\n\tjustReleasedKeys = {}\n\tjustPressedMouseButtons = {}\n\tjustReleasedMouseButtons = {}\n\twheelDelta = 0\nend\n\nreturn input\n`
    }
  ];
}
