import { useId, type ComponentProps, type ReactNode } from "react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isNil } from "lodash";
import { normalizeUpperSnakeCaseInput } from "../../../shared/asset-paths";

export interface ControlledSlugInputProps<TFieldValues extends FieldValues> extends Omit<
  ComponentProps<typeof Input>,
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
            <Input
              {...inputProps}
              ref={field.ref}
              aria-invalid={fieldState.invalid || hasError}
              className={inputProps.className}
              id={id}
              name={field.name}
              value={value}
              onBlur={field.onBlur}
              onChange={(event) => field.onChange(normalizeUpperSnakeCaseInput(event.target.value))}
            />
            {hasError && <FieldError errors={[fieldError]} />}
          </Field>
        );
      }}
    />
  );
}

export default ControlledSlugInput;
