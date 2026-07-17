import { type FC } from "react";
import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ColumnTypedDefaultValueEditorProps } from "./data-schema-column-editor.types";
import { numericBound, numericDefaultText, parseNumericDefault } from "./data-schema-column-utils";

const IntegerDefaultValueEditor: FC<ColumnTypedDefaultValueEditorProps> = (props) => {
  const { control, columnType, disabled, enumValues, fieldPrefix, maxValue, minValue } = props;

  return (
    <Controller
      control={control}
      name={`${fieldPrefix}.defaultValue`}
      render={({ field }) => (
        <div className="space-y-1.5">
          <Label>Default value</Label>
          <Input
            disabled={disabled}
            max={numericBound(maxValue)}
            min={numericBound(minValue)}
            step={1}
            type="number"
            value={numericDefaultText(field.value)}
            onBlur={field.onBlur}
            onChange={(event) => field.onChange(parseNumericDefault(columnType, enumValues, minValue, event.target.value, true))}
          />
        </div>
      )}
    />
  );
};

export default IntegerDefaultValueEditor;
