import type { ColumnDefaultValueEditorProps } from "@/components/data-schema/fields/data-schema-column-editor.types"
import { isVectorColumnType } from "@/components/data-schema/fields/data-schema-column-utils"
import EnumArrayDefaultValueEditor from "@/components/data-schema/fields/enum-array-default-value-editor"
import EnumDefaultValueEditor from "@/components/data-schema/fields/enum-default-value-editor"
import FloatDefaultValueEditor from "@/components/data-schema/fields/float-default-value-editor"
import IntegerDefaultValueEditor from "@/components/data-schema/fields/integer-default-value-editor"
import JsonDefaultValueEditor from "@/components/data-schema/fields/json-default-value-editor"
import RangeDefaultValueEditor from "@/components/data-schema/fields/range-default-value-editor"
import RefDefaultValueEditor from "@/components/data-schema/fields/ref-default-value-editor"
import StringDefaultValueEditor from "@/components/data-schema/fields/string-default-value-editor"
import TextDefaultValueEditor from "@/components/data-schema/fields/text-default-value-editor"
import VectorDefaultValueEditor from "@/components/data-schema/fields/vector-default-value-editor"
import { ColumnType } from "@/enums/column-type"
import { type FC } from "react"
import ArrayRefDefaultValueEditor from "./array-ref-default-value-editor"
import BooleanDefaultValueEditor from "./boolean-default-value-editor"
import ColorDefaultValueEditor from "./color-default-value-editor"
const ColumnDefaultValueEditor: FC<ColumnDefaultValueEditorProps> = (props) => {
  const {
    control,
    columnType,
    disabled,
    enumValues,
    fieldPrefix,
    maxValue,
    minValue,
    onAddEnumArrayDefaultValue,
    onRemoveEnumArrayDefaultValue,
    refTableId,
    requiredValue,
    stepValue,
  } = props
  const typedProps = {
    control,
    columnType,
    disabled,
    enumValues,
    fieldPrefix,
    maxValue,
    minValue,
    refTableId,
    requiredValue,
    stepValue,
  }
  if (isVectorColumnType(columnType)) {
    return <VectorDefaultValueEditor {...typedProps} />
  }
  if (columnType === ColumnType.ENUM_ARRAY) {
    return (
      <EnumArrayDefaultValueEditor
        control={control}
        disabled={disabled}
        enumValues={enumValues}
        fieldPrefix={fieldPrefix}
        onAddEnumArrayDefaultValue={onAddEnumArrayDefaultValue}
        onRemoveEnumArrayDefaultValue={onRemoveEnumArrayDefaultValue}
      />
    )
  }
  if (columnType === ColumnType.ARRAY_REF) {
    return <ArrayRefDefaultValueEditor {...typedProps} />
  }
  if (columnType === ColumnType.BOOLEAN) {
    return <BooleanDefaultValueEditor {...typedProps} />
  }
  if (columnType === ColumnType.COLOR) {
    return <ColorDefaultValueEditor {...typedProps} />
  }
  if (columnType === ColumnType.INTEGER) {
    return <IntegerDefaultValueEditor {...typedProps} />
  }
  if (columnType === ColumnType.DECIMAL) {
    return <FloatDefaultValueEditor {...typedProps} />
  }
  if (columnType === ColumnType.RANGE) {
    return <RangeDefaultValueEditor {...typedProps} />
  }
  if (columnType === ColumnType.TEXT) {
    return <TextDefaultValueEditor {...typedProps} />
  }
  if (columnType === ColumnType.JSON) {
    return <JsonDefaultValueEditor {...typedProps} />
  }
  if (columnType === ColumnType.ENUM) {
    return <EnumDefaultValueEditor {...typedProps} />
  }
  if (columnType === ColumnType.REF) {
    return <RefDefaultValueEditor {...typedProps} />
  }
  return <StringDefaultValueEditor {...typedProps} />
}
export default ColumnDefaultValueEditor
