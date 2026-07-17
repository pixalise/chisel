import { type FC } from "react";
import ControlledSelectInput from "@/components/controls/controlled-select-input";
import type { ColumnFieldEditorProps } from "./data-schema-column-editor.types";
import { columnTypeOptions } from "./data-schema-column-utils";

const ColumnTypeEditor: FC<ColumnFieldEditorProps> = (props) => {
  const { control, disabled, fieldPrefix } = props;

  return (
    <ControlledSelectInput control={control} disabled={disabled} label="Type" name={`${fieldPrefix}.type`} options={columnTypeOptions} />
  );
};

export default ColumnTypeEditor;
