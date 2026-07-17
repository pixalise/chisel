import { type FC } from "react";
import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ColumnTypedDefaultValueEditorProps } from "./data-schema-column-editor.types";
import { defaultValueText, parseDefaultValue } from "./data-schema-column-utils";

const StringDefaultValueEditor: FC<ColumnTypedDefaultValueEditorProps> = (props) => {
  const { control, columnType, disabled, enumValues, fieldPrefix, minValue } = props;

  return (
    <Controller
      control={control}
      name={`${fieldPrefix}.defaultValue`}
      render={({ field }) => (
        <div className="space-y-1.5">
          <Label>Default value</Label>
          <Input
            disabled={disabled}
            value={defaultValueText(columnType, enumValues, minValue, field.value)}
            onBlur={field.onBlur}
            onChange={(event) => field.onChange(parseDefaultValue(columnType, enumValues, minValue, event.target.value))}
          />
        </div>
      )}
    />
  );
};

export default StringDefaultValueEditor;
