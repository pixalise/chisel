import { type FC } from "react";
import { Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useListTablesQuery from "@/hooks/use-list-tables-query";
import type { ColumnFieldEditorProps } from "./data-schema-column-editor.types";

const missingTargetValue = "__missing_ref_target__";

const RefTableTargetEditor: FC<ColumnFieldEditorProps> = (props) => {
  const { control, disabled, fieldPrefix } = props;
  const { tables } = useListTablesQuery();

  return (
    <Controller
      control={control}
      name={`${fieldPrefix}.refTableId`}
      render={({ field }) => (
        <div className="space-y-1.5">
          <Label>Reference target table</Label>
          <Select
            disabled={disabled}
            value={typeof field.value === "string" ? field.value : missingTargetValue}
            onValueChange={(value) => field.onChange(value === missingTargetValue ? undefined : value)}
          >
            <SelectTrigger onBlur={field.onBlur}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={missingTargetValue}>Choose target table</SelectItem>
              {tables.map((table) => (
                <SelectItem key={table.id} value={table.id}>
                  {table.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    />
  );
};

export default RefTableTargetEditor;
