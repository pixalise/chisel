import type { ColumnTypedDefaultValueEditorProps } from "@/components/data-schema/fields/data-schema-column-editor.types"
import { colorDefaultValue } from "@/components/data-schema/fields/data-schema-column-utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type FC } from "react"
import { Controller } from "react-hook-form"
const ColorDefaultValueEditor: FC<ColumnTypedDefaultValueEditorProps> = (props) => {
  const { control, disabled, fieldPrefix } = props
  return (
    <Controller
      control={control}
      name={`${fieldPrefix}.defaultValue`}
      render={(input1) => {
        const { field } = input1
        return (
          <div className="space-y-1.5">
            <Label>Default value</Label>
            <Input
              className="h-9 p-1"
              disabled={disabled}
              type="color"
              value={colorDefaultValue(field.value)}
              onBlur={field.onBlur}
              onChange={(event) => field.onChange(event.target.value)}
            />
          </div>
        )
      }}
    />
  )
}
export default ColorDefaultValueEditor
