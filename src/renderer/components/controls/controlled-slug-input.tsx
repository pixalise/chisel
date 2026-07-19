import { useId, type ComponentProps, type ReactNode } from "react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { isNil } from "lodash";
import SlugInput from "./slug-input";

export interface ControlledSlugInputProps<TFieldValues extends FieldValues> extends Omit<
  ComponentProps<typeof SlugInput>,
  "defaultValue" | "name" | "onBlur" | "onChange" | "ref" | "value"
> {
  control: Control<TFieldValues>;
  label: string;
  name: string;
}

function ControlledSlugInput<TFieldValues extends FieldValues>(props: ControlledSlugInputProps<TFieldValues>): ReactNode {
  const { control, id: explicitId, label, name, ...inputProps } = props;
  const generatedId = useId();
  const id = explicitId ?? generatedId;

  return (
    <Controller
      control={control}
      name={name as FieldPath<TFieldValues>}
      render={({ field, fieldState }) => {
        const fieldError = fieldState.error;
        const hasError = !isNil(fieldError);
        const value = typeof field.value === "string" ? field.value : "";

        return (
          <Field data-invalid={fieldState.invalid || hasError}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <SlugInput
              {...inputProps}
              ref={field.ref}
              aria-invalid={fieldState.invalid || hasError}
              className={inputProps.className}
              id={id}
              name={field.name}
              value={value}
              onBlur={field.onBlur}
              onChange={field.onChange}
            />
            {hasError && <FieldError errors={[fieldError]} />}
          </Field>
        );
      }}
    />
  );
}

export default ControlledSlugInput;
