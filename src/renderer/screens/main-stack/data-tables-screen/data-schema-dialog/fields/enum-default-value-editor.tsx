import { type FC } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ControlledSelectInput from "@/components/controls/controlled-select-input";
import type { ColumnTypedDefaultValueEditorProps } from "./data-schema-column-editor.types";

const EnumDefaultValueEditor: FC<ColumnTypedDefaultValueEditorProps> = (props) => {
  const { control, disabled, enumValues, fieldPrefix } = props;
  const enumDefaultOptions = enumValues.map((value) => ({
    label: value,
    value
  }));

  if (enumDefaultOptions.length > 0) {
    return (
      <ControlledSelectInput
        control={control}
        disabled={disabled}
        label="Default value"
        name={`${fieldPrefix}.defaultValue`}
        options={enumDefaultOptions}
        placeholder="Select default value"
      />
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>Default value</Label>
      <Input disabled placeholder="Add possible values first" value="" />
    </div>
  );
};

export default EnumDefaultValueEditor;
