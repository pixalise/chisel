import { type FC } from "react";
import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ColumnFieldEditorProps } from "./data-schema-column-editor.types";

const ColumnNameEditor: FC<ColumnFieldEditorProps> = (props) => {
  const { control, disabled, fieldPrefix } = props;

  return (
    <Controller
      control={control}
      name={`${fieldPrefix}.name`}
      render={({ field }) => (
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input
            disabled={disabled}
            value={typeof field.value === "string" ? field.value : ""}
            onBlur={field.onBlur}
            onChange={(event) => field.onChange(event.target.value.toLowerCase())}
          />
        </div>
      )}
    />
  );
};

export default ColumnNameEditor;
