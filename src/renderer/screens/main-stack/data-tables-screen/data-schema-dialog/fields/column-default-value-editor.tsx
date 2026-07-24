import { type FC } from "react";
import { ColumnType } from "../../../../../../shared/types";
import BooleanDefaultValueEditor from "./boolean-default-value-editor";
import ColorDefaultValueEditor from "./color-default-value-editor";
import type { ColumnDefaultValueEditorProps } from "./data-schema-column-editor.types";
import EnumArrayDefaultValueEditor from "./enum-array-default-value-editor";
import EnumDefaultValueEditor from "./enum-default-value-editor";
import FloatDefaultValueEditor from "./float-default-value-editor";
import IntegerDefaultValueEditor from "./integer-default-value-editor";
import JsonDefaultValueEditor from "./json-default-value-editor";
import RangeDefaultValueEditor from "./range-default-value-editor";
import RefDefaultValueEditor from "./ref-default-value-editor";
import StringDefaultValueEditor from "./string-default-value-editor";
import TextDefaultValueEditor from "./text-default-value-editor";
import VectorDefaultValueEditor from "./vector-default-value-editor";
import { isVectorColumnType } from "./data-schema-column-utils";

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
    stepValue
  } = props;
  const typedProps = { control, columnType, disabled, enumValues, fieldPrefix, maxValue, minValue, refTableId, requiredValue, stepValue };

  if (isVectorColumnType(columnType)) {
    return <VectorDefaultValueEditor {...typedProps} />;
  }
  if (columnType === ColumnType.enumArray) {
    return (
      <EnumArrayDefaultValueEditor
        control={control}
        disabled={disabled}
        enumValues={enumValues}
        fieldPrefix={fieldPrefix}
        onAddEnumArrayDefaultValue={onAddEnumArrayDefaultValue}
        onRemoveEnumArrayDefaultValue={onRemoveEnumArrayDefaultValue}
      />
    );
  }
  if (columnType === ColumnType.boolean) {
    return <BooleanDefaultValueEditor {...typedProps} />;
  }
  if (columnType === ColumnType.color) {
    return <ColorDefaultValueEditor {...typedProps} />;
  }
  if (columnType === ColumnType.integer) {
    return <IntegerDefaultValueEditor {...typedProps} />;
  }
  if (columnType === ColumnType.decimal) {
    return <FloatDefaultValueEditor {...typedProps} />;
  }
  if (columnType === ColumnType.range) {
    return <RangeDefaultValueEditor {...typedProps} />;
  }
  if (columnType === ColumnType.text) {
    return <TextDefaultValueEditor {...typedProps} />;
  }
  if (columnType === ColumnType.json) {
    return <JsonDefaultValueEditor {...typedProps} />;
  }
  if (columnType === ColumnType.enum) {
    return <EnumDefaultValueEditor {...typedProps} />;
  }
  if (columnType === ColumnType.ref) {
    return <RefDefaultValueEditor {...typedProps} />;
  }
  return <StringDefaultValueEditor {...typedProps} />;
};

export default ColumnDefaultValueEditor;
