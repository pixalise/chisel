import { useId, type ReactNode } from "react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isNil } from "lodash";

export interface ControlledImageInputProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  label: string;
  name: FieldPath<TFieldValues>;
  onPathChange?: (path: string) => void;
}

function ControlledImageInput<TFieldValues extends FieldValues>(props: ControlledImageInputProps<TFieldValues>): ReactNode {
  const { control, label, name, onPathChange } = props;
  const id = useId();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const fieldError = fieldState.error;
        const hasError = !isNil(fieldError);

        return (
          <Field data-invalid={fieldState.invalid || hasError}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Input
              ref={field.ref}
              accept=".png,image/png"
              aria-invalid={fieldState.invalid || hasError}
              id={id}
              name={field.name}
              type="file"
              onBlur={field.onBlur}
              onChange={(event) => {
                const file = event.target.files?.item(0);
                const path = file ? window.electron.getPathForFile(file) : "";
                field.onChange(path);
                onPathChange?.(path);
              }}
            />
            {hasError && <FieldError errors={[fieldError]} />}
          </Field>
        );
      }}
    />
  );
}

export default ControlledImageInput;
