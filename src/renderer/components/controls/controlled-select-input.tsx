import { useId, type ReactNode } from "react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isNil } from "lodash";

export interface ControlledSelectOption {
  label: string;
  value: string;
}

export interface ControlledSelectInputProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  disabled?: boolean;
  label: string;
  name: FieldPath<TFieldValues>;
  options: ControlledSelectOption[];
  placeholder?: string;
}

function ControlledSelectInput<TFieldValues extends FieldValues>(props: ControlledSelectInputProps<TFieldValues>): ReactNode {
  const { control, disabled, label, name, options, placeholder } = props;
  const id = useId();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const fieldError = fieldState.error;
        const hasError = !isNil(fieldError);
        const value = typeof field.value === "string" ? field.value : "";

        return (
          <Field data-invalid={fieldState.invalid || hasError}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Select disabled={disabled} name={field.name} value={value} onValueChange={field.onChange}>
              <SelectTrigger ref={field.ref} aria-invalid={fieldState.invalid || hasError} id={id} onBlur={field.onBlur}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasError && <FieldError errors={[fieldError]} />}
          </Field>
        );
      }}
    />
  );
}

export default ControlledSelectInput;
