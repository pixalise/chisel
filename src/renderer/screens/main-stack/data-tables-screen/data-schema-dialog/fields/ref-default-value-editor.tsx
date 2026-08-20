import { type FC } from "react";
import { Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useListTablesQuery from "@/hooks/use-list-tables-query";
import type { ColumnTypedDefaultValueEditorProps } from "./data-schema-column-editor.types";

const emptyRefValue = "__empty_ref_default_value__";
const chooseRefValue = "__choose_ref_default_value__";

const RefDefaultValueEditor: FC<ColumnTypedDefaultValueEditorProps> = (props) => {
  const { control, disabled, fieldPrefix, refTableId, requiredValue } = props;
  const { tables } = useListTablesQuery();
  const targetTableId = typeof refTableId === "string" ? refTableId : "";
  const targetTable = tables.find((entry) => entry.id === targetTableId);
  const targetRows = targetTable?.rows ?? [];
  const isRequired = requiredValue === true;

  return (
    <Controller
      control={control}
      name={`${fieldPrefix}.defaultValue`}
      render={({ field }) => {
        const slug = typeof field.value === "string" ? field.value : "";
        const selectedRow = targetRows.find((entry) => entry.slug === slug);
        const selectValue = slug || (isRequired ? chooseRefValue : emptyRefValue);

        return (
          <div className="space-y-1.5">
            <Label>Default value</Label>
            <Select
              disabled={disabled}
              value={selectValue}
              onValueChange={(nextValue) => {
                if (nextValue === chooseRefValue) {
                  return;
                }
                field.onChange(nextValue === emptyRefValue ? "" : nextValue);
              }}
            >
              <SelectTrigger onBlur={field.onBlur}>
                <SelectValue placeholder={targetTable ? `Choose ${targetTable.name}` : "Choose reference"} />
              </SelectTrigger>
              <SelectContent>
                {isRequired && !slug && (
                  <SelectItem disabled value={chooseRefValue}>
                    Choose {targetTable?.name ?? "reference"}
                  </SelectItem>
                )}
                {!isRequired && <SelectItem value={emptyRefValue}>None</SelectItem>}
                {slug && !selectedRow && (
                  <SelectItem disabled value={slug}>
                    Missing: {slug}
                  </SelectItem>
                )}
                {targetRows.map((row) => (
                  <SelectItem key={row.id} value={row.slug}>
                    {row.slug}
                  </SelectItem>
                ))}
                {targetTable && targetRows.length === 0 && (
                  <SelectItem disabled value="__no_ref_default_rows__">
                    No rows in {targetTable.name}
                  </SelectItem>
                )}
                {!targetTable && (
                  <SelectItem disabled value="__missing_ref_default_table__">
                    Missing target table
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        );
      }}
    />
  );
};

export default RefDefaultValueEditor;
