import { type FC } from "react";
import { Controller } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isNil } from "lodash";
import type { ColumnTypedDefaultValueEditorProps } from "./data-schema-column-editor.types";

const emptyEnumDefaultValue = "__empty_enum_default_value__";

const EnumDefaultValueEditor: FC<ColumnTypedDefaultValueEditorProps> = (props) => {
  const { control, disabled, enumValues, fieldPrefix, requiredValue } = props;
  const isRequired = requiredValue !== false;
  const enumDefaultOptions = enumValues.map((value) => ({
    label: value,
    value
  }));

  if (!isRequired || enumDefaultOptions.length > 0) {
    return (
      <Controller
        control={control}
        name={`${fieldPrefix}.defaultValue`}
        render={({ field, fieldState }) => {
          const fieldError = fieldState.error;
          const hasError = !isNil(fieldError);
          const value = typeof field.value === "string" ? field.value : "";
          const selectValue = !isRequired && value === "" ? emptyEnumDefaultValue : value;

          return (
            <Field data-invalid={fieldState.invalid || hasError}>
              <FieldLabel>Default value</FieldLabel>
              <Select
                disabled={disabled}
                name={field.name}
                value={selectValue}
                onValueChange={(nextValue) => field.onChange(nextValue === emptyEnumDefaultValue ? "" : nextValue)}
              >
                <SelectTrigger ref={field.ref} aria-invalid={fieldState.invalid || hasError} onBlur={field.onBlur}>
                  <SelectValue placeholder="Select default value" />
                </SelectTrigger>
                <SelectContent>
                  {!isRequired && <SelectItem value={emptyEnumDefaultValue}>None</SelectItem>}
                  {enumDefaultOptions.map((option) => (
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

  return (
    <div className="space-y-1.5">
      <Label>Default value</Label>
      <Input disabled placeholder="Add possible values first" value="" />
    </div>
  );
};

export default EnumDefaultValueEditor;
