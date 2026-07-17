import { type FC } from "react";
import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { ColumnTypedDefaultValueEditorProps } from "./data-schema-column-editor.types";
import { numericDefaultText, parseNumericDefault, rangeDefaultNumber, rangeMax, rangeMin, rangeStep } from "./data-schema-column-utils";

const RangeDefaultValueEditor: FC<ColumnTypedDefaultValueEditorProps> = (props) => {
  const { control, columnType, disabled, enumValues, fieldPrefix, maxValue, minValue, stepValue } = props;

  return (
    <Controller
      control={control}
      name={`${fieldPrefix}.defaultValue`}
      render={({ field }) => {
        const rangeValue = rangeDefaultNumber(field.value, minValue);

        return (
          <div className="space-y-1.5">
            <Label>Default value</Label>
            <div className="grid grid-cols-[1fr_7rem] items-center gap-2">
              <Slider
                disabled={disabled}
                max={rangeMax(maxValue)}
                min={rangeMin(minValue)}
                step={rangeStep(stepValue)}
                value={[rangeValue]}
                onBlur={field.onBlur}
                onValueChange={(value) => field.onChange(value[0])}
              />
              <Input
                disabled={disabled}
                max={rangeMax(maxValue)}
                min={rangeMin(minValue)}
                step={rangeStep(stepValue)}
                type="number"
                value={numericDefaultText(field.value)}
                onBlur={field.onBlur}
                onChange={(event) => field.onChange(parseNumericDefault(columnType, enumValues, minValue, event.target.value))}
              />
            </div>
          </div>
        );
      }}
    />
  );
};

export default RangeDefaultValueEditor;
