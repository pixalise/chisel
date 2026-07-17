import { type FC } from "react";
import { Controller } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { ColumnFieldEditorProps } from "./data-schema-column-editor.types";

const ColumnFlagsEditor: FC<ColumnFieldEditorProps> = (props) => {
  const { control, disabled, fieldPrefix } = props;

  return (
    <div className="grid grid-cols-2 gap-2 max-[640px]:grid-cols-1">
      <Controller
        control={control}
        name={`${fieldPrefix}.required`}
        render={({ field }) => (
          <Label className="flex items-center gap-2 border border-border p-2">
            <Checkbox
              checked={Boolean(field.value)}
              disabled={disabled}
              onBlur={field.onBlur}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
            Required
          </Label>
        )}
      />

      <Controller
        control={control}
        name={`${fieldPrefix}.unique`}
        render={({ field }) => (
          <Label className="flex items-center gap-2 border border-border p-2">
            <Checkbox
              checked={Boolean(field.value)}
              disabled={disabled}
              onBlur={field.onBlur}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
            Unique
          </Label>
        )}
      />
    </div>
  );
};

export default ColumnFlagsEditor;
