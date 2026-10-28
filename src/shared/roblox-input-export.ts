import { ColumnType } from "../enums/column-type"
import { InputKeyEnum } from "../enums/input-key-enum"
import { LUAU_HEADER, luauValue, type LuauExportFile } from "./luau-serialization"
import type { AnyDataTable } from "./schemas"
const names: Record<string, string[]> = {
  KEY_0: ["Zero"],
  KEY_1: ["One"],
  KEY_2: ["Two"],
  KEY_3: ["Three"],
  KEY_4: ["Four"],
  KEY_5: ["Five"],
  KEY_6: ["Six"],
  KEY_7: ["Seven"],
  KEY_8: ["Eight"],
  KEY_9: ["Nine"],
  KEY_ESCAPE: ["Escape"],
  KEY_SPACE: ["Space"],
  KEY_SHIFT: ["LeftShift", "RightShift"],
  KEY_CTRL: ["LeftControl", "RightControl"],
  KEY_ALT: ["LeftAlt", "RightAlt"],
  KEY_TAB: ["Tab"],
  KEY_ENTER: ["Return", "KeypadEnter"],
  KEY_BACKSPACE: ["Backspace"],
  KEY_UP: ["Up"],
  KEY_DOWN: ["Down"],
  KEY_LEFT: ["Left"],
  KEY_RIGHT: ["Right"],
  KEY_MINUS: ["Minus"],
  KEY_EQUAL: ["Equals"],
  KEY_KP_ADD: ["KeypadPlus"],
  KEY_KP_SUBTRACT: ["KeypadMinus"],
  MOUSE_BUTTON_LEFT: ["MouseButton1"],
  MOUSE_BUTTON_RIGHT: ["MouseButton2"],
  MOUSE_BUTTON_MIDDLE: ["MouseButton3"],
  MOUSE_BUTTON_WHEEL_UP: ["WheelUp"],
  MOUSE_BUTTON_WHEEL_DOWN: ["WheelDown"],
}
export function robloxInputNames(binding: string): string[] {
  if (!Object.values(InputKeyEnum).includes(binding as InputKeyEnum)) {
    throw new Error(`Unknown Roblox input binding: ${binding}`)
  }
  const simple = /^KEY_([A-Z]|F[0-9]+)$/.exec(binding)
  if (simple) {
    return [simple[1]]
  }
  const result = names[binding]
  if (!result) {
    throw new Error(`Unsupported Roblox input binding: ${binding}`)
  }
  return result
}
export function renderRobloxInput(tables: AnyDataTable[], root: string): LuauExportFile[] {
  const table = tables.find((entry) => entry.id === "input_bindings")
  if (!table) {
    return []
  }
  const column = table.columns.find((entry) => entry.name === "bindings")
  if (!column || column.type !== ColumnType.ENUM_ARRAY) {
    throw new Error("Roblox input requires an enumArray bindings column.")
  }
  const bindings = table.rows.map((row) => {
    const values =
      row.values.find((entry) => entry.columnId === column.id)?.value ?? column.defaultValue
    if (!Array.isArray(values) || values.some((entry) => typeof entry !== "string")) {
      throw new Error(`Invalid bindings for ${row.slug}`)
    }
    if (values.length === 0) {
      throw new Error(`Input action ${row.slug} must have at least one binding.`)
    }
    return values.flatMap((value) => robloxInputNames(value as string))
  })
  return [
    {
      path: `${root}/input.luau`,
      content: `${LUAU_HEADER}
local definitions = require(script.Parent.tables.input_bindings)
local bindings: { { string } } = ${luauValue(bindings)} :: any
local input = { ID = definitions.ID }

function input.new()
    assert(game:GetService("RunService"):IsClient(), "Chisel input requires a Roblox client")
    local service = game:GetService("UserInputService")
    local held: { [string]: boolean } = {}
    local pressed: { [number]: boolean } = {}
    local justPressed: { [number]: boolean } = {}
    local justReleased: { [number]: boolean } = {}
    local connections: { RBXScriptConnection } = {}
    local destroyed = false
    local controller = {}

    local function check(action: number): number
        assert(not destroyed, "Chisel input has been destroyed")
        assert(action % 1 == 0 and action >= 1 and action <= definitions.COUNT, "Invalid Chisel input action")
        return action
    end

    local function refresh()
        for action, keys in bindings do
            local active = false
            for _, key in keys do if held[key] then active = true; break end end
            if active and not pressed[action] then justPressed[action] = true end
            if not active and pressed[action] then justReleased[action] = true end
            pressed[action] = active
        end
    end

    local function token(event: InputObject): string
        if event.UserInputType == Enum.UserInputType.Keyboard then return event.KeyCode.Name end
        return event.UserInputType.Name
    end

    table.insert(connections, service.InputBegan:Connect(function(event: InputObject, processed: boolean)
        if processed or service:GetFocusedTextBox() then return end
        held[token(event)] = true
        refresh()
    end))
    table.insert(connections, service.InputEnded:Connect(function(event: InputObject)
        held[token(event)] = nil
        refresh()
    end))
    table.insert(connections, service.InputChanged:Connect(function(event: InputObject, processed: boolean)
        if processed or service:GetFocusedTextBox() or event.UserInputType ~= Enum.UserInputType.MouseWheel then return end
        if event.Position.Z > 0 then held.WheelUp = true end
        if event.Position.Z < 0 then held.WheelDown = true end
        refresh()
    end))
    local function clearHeld()
        table.clear(held)
        refresh()
    end
    table.insert(connections, service.WindowFocusReleased:Connect(clearHeld))
    table.insert(connections, service.TextBoxFocused:Connect(clearHeld))

    function controller.actionName(action: number): string
        return definitions.SLUGS[check(action)]
    end
    function controller.isActionPressed(action: number): boolean
        return pressed[check(action)] == true
    end
    function controller.isActionJustPressed(action: number): boolean
        return justPressed[check(action)] == true
    end
    function controller.isActionJustReleased(action: number): boolean
        return justReleased[check(action)] == true
    end
    function controller.getActionStrength(action: number): number
        return if controller.isActionPressed(action) then 1 else 0
    end
    function controller.endFrame()
        assert(not destroyed, "Chisel input has been destroyed")
        table.clear(justPressed)
        table.clear(justReleased)
        held.WheelUp = nil
        held.WheelDown = nil
        refresh()
    end
    function controller.destroy()
        assert(not destroyed, "Chisel input has been destroyed")
        for _, connection in connections do connection:Disconnect() end
        table.clear(connections)
        table.clear(held)
        destroyed = true
    end
    return table.freeze(controller)
end

return table.freeze(input)
`,
    },
  ]
}
