import { type FC } from "react";
import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ColumnTypedDefaultValueEditorProps } from "./data-schema-column-editor.types";
import { numericBound, rangeStep, updateVectorDefaultValue, vectorComponentLabels, vectorDefaultValues } from "./data-schema-column-utils";

const VectorDefaultValueEditor: FC<ColumnTypedDefaultValueEditorProps> = (props) => {
  const { control, columnType, disabled, enumValues, fieldPrefix, maxValue, minValue, stepValue } = props;

  return (
    <Controller
      control={control}
      name={`${fieldPrefix}.defaultValue`}
      render={({ field }) => {
        const values = vectorDefaultValues(columnType, enumValues, minValue, field.value);

        return (
          <div className="space-y-1.5">
            <Label>Default value</Label>
            <div className="grid grid-cols-2 gap-2">
              {values.map((value, valueIndex) => (
                <div className="space-y-1" key={vectorComponentLabels[valueIndex]}>
                  <Label className="font-mono text-[0.65rem] uppercase text-muted-foreground">{vectorComponentLabels[valueIndex]}</Label>
                  <Input
                    disabled={disabled}
                    max={numericBound(maxValue)}
                    min={numericBound(minValue)}
                    step={rangeStep(stepValue)}
                    type="number"
                    value={String(value)}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(updateVectorDefaultValue(values, valueIndex, event.target.value))}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      }}
    />
  );
};

export default VectorDefaultValueEditor;
