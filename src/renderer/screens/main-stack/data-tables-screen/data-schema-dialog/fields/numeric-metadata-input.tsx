import { type FC } from "react";
import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NumericMetadataInputProps } from "./data-schema-column-editor.types";

const NumericMetadataInput: FC<NumericMetadataInputProps> = (props) => {
  const { control, disabled, fieldPrefix, integer, label, name } = props;

  return (
    <Controller
      control={control}
      name={`${fieldPrefix}.${name}`}
      render={({ field }) => (
        <div className="space-y-1.5">
          <Label>{label}</Label>
          <Input
            disabled={disabled}
            min={name === "step" ? Number.MIN_VALUE : undefined}
            type="number"
            value={typeof field.value === "number" ? field.value : ""}
            onBlur={field.onBlur}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) {
                field.onChange(undefined);
                return;
              }
              const parsed = integer ? Number.parseInt(value, 10) : Number(value);
              field.onChange(Number.isFinite(parsed) ? parsed : undefined);
            }}
          />
        </div>
      )}
    />
  );
};

export default NumericMetadataInput;
