import { type FC } from "react";
import { X } from "lucide-react";
import { Controller } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EnumArrayDefaultValueEditorProps } from "./data-schema-column-editor.types";

const EnumArrayDefaultValueEditor: FC<EnumArrayDefaultValueEditorProps> = (props) => {
  const { control, disabled, enumValues, fieldPrefix, onAddEnumArrayDefaultValue, onRemoveEnumArrayDefaultValue } = props;

  return (
    <Controller
      control={control}
      name={`${fieldPrefix}.defaultValue`}
      render={({ field }) => {
        const selectedValues = Array.isArray(field.value)
          ? field.value.map(String).filter((entry) => enumValues.length === 0 || enumValues.includes(entry))
          : [];
        const availableValues = enumValues.filter((value) => !selectedValues.includes(value));

        return (
          <div className="space-y-1.5">
            <Label>Default values</Label>
            {enumValues.length > 0 && (
              <Select value="__add_enum_array_value__" onValueChange={onAddEnumArrayDefaultValue}>
                <SelectTrigger disabled={disabled || availableValues.length === 0} onBlur={field.onBlur}>
                  <SelectValue placeholder="Add default value" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem disabled value="__add_enum_array_value__">
                    Add default value
                  </SelectItem>
                  {availableValues.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {enumValues.length === 0 && <Input disabled placeholder="Add possible values first" value="" />}
            <div className="flex flex-wrap gap-1">
              {selectedValues.map((value) => (
                <Badge className="gap-1" key={value} variant="secondary">
                  {value}
                  <button disabled={disabled} onClick={() => onRemoveEnumArrayDefaultValue(value)} type="button">
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        );
      }}
    />
  );
};

export default EnumArrayDefaultValueEditor;
