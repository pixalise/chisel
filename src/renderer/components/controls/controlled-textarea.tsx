import { useId, type ComponentProps, type ReactNode } from "react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { isNil } from "lodash";

export interface ControlledTextareaProps<TFieldValues extends FieldValues> extends Omit<
  ComponentProps<typeof Textarea>,
  "defaultValue" | "name" | "onBlur" | "onChange" | "ref" | "value"
> {
  control: Control<TFieldValues>;
  description?: string;
  label: string;
  name: string;
}

function ControlledTextarea<TFieldValues extends FieldValues>(props: ControlledTextareaProps<TFieldValues>): ReactNode {
  const { control, description, id: explicitId, label, name, ...textareaProps } = props;
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
            <Textarea
              {...textareaProps}
              ref={field.ref}
              aria-invalid={fieldState.invalid || hasError}
              id={id}
              name={field.name}
              value={value}
              onBlur={field.onBlur}
              onChange={field.onChange}
            />
            {description && <FieldDescription>{description}</FieldDescription>}
            {hasError && <FieldError errors={[fieldError]} />}
          </Field>
        );
      }}
    />
  );
}

export default ControlledTextarea;
