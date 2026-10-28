import ControlledSelectInput from "@/components/controls/controlled-select-input"
import type { ColumnFieldEditorProps } from "@/components/data-schema/fields/data-schema-column-editor.types"
import { columnTypeOptions } from "@/components/data-schema/fields/data-schema-column-utils"
import { type FC } from "react"
const ColumnTypeEditor: FC<ColumnFieldEditorProps> = (props) => {
  const { control, disabled, fieldPrefix } = props
  return (
    <ControlledSelectInput
      control={control}
      disabled={disabled}
      label="Type"
      name={`${fieldPrefix}.type`}
      options={columnTypeOptions}
    />
  )
}
export default ColumnTypeEditor
