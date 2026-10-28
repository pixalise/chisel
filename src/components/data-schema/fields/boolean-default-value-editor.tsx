import type { ColumnTypedDefaultValueEditorProps } from "@/components/data-schema/fields/data-schema-column-editor.types"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { type FC } from "react"
import { Controller } from "react-hook-form"
const BooleanDefaultValueEditor: FC<ColumnTypedDefaultValueEditorProps> = (props) => {
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
            <Label className="flex items-center gap-2 border border-border p-2">
              <Checkbox
                checked={field.value === true}
                disabled={disabled}
                onBlur={field.onBlur}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
              Enabled by default
            </Label>
          </div>
        )
      }}
    />
  )
}
export default BooleanDefaultValueEditor
