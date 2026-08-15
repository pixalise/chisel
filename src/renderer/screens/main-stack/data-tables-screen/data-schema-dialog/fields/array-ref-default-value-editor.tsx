import { type FC } from "react";
import { X } from "lucide-react";
import { Controller } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useListTablesQuery from "@/hooks/use-list-tables-query";
import type { ColumnTypedDefaultValueEditorProps } from "./data-schema-column-editor.types";

const addReferenceValue = "__add_array_ref_default_value__";

const ArrayRefDefaultValueEditor: FC<ColumnTypedDefaultValueEditorProps> = (props) => {
  const { control, disabled, fieldPrefix, refTableId } = props;
  const { tables } = useListTablesQuery();
  const targetTableId = typeof refTableId === "string" ? refTableId : "";
  const targetTable = tables.find((entry) => entry.id === targetTableId);
  const targetRows = targetTable?.rows ?? [];

  return (
    <Controller
      control={control}
      name={`${fieldPrefix}.defaultValue`}
      render={({ field }) => {
        const selectedValues = Array.isArray(field.value) ? [...new Set(field.value.map(String))] : [];
        const availableRows = targetRows.filter((row) => !selectedValues.includes(row.slug));

        return (
          <div className="space-y-1.5">
            <Label>Default references</Label>
            <Select
              disabled={disabled || !targetTable || availableRows.length === 0}
              value={addReferenceValue}
              onValueChange={(value) => {
                if (value !== addReferenceValue && !selectedValues.includes(value)) field.onChange([...selectedValues, value]);
              }}
            >
              <SelectTrigger onBlur={field.onBlur}>
                <SelectValue placeholder={targetTable ? `Add ${targetTable.name} row` : "Choose target table first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem disabled value={addReferenceValue}>
                  Add reference
                </SelectItem>
                {availableRows.map((row) => (
                  <SelectItem key={row.id} value={row.slug}>
                    {row.slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {selectedValues.map((value) => {
                const exists = targetRows.some((row) => row.slug === value);
                return (
                  <Badge className="gap-1 font-mono text-[0.65rem]" key={value} variant={exists ? "secondary" : "destructive"}>
                    {value}
                    <button
                      aria-label={`Remove ${value}`}
                      disabled={disabled}
                      onClick={() => field.onChange(selectedValues.filter((entry) => entry !== value))}
                      type="button"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          </div>
        );
      }}
    />
  );
};

export default ArrayRefDefaultValueEditor;
