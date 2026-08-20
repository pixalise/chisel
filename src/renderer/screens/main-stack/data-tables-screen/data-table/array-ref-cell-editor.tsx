import { type FC } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DataColumnDefinition } from "../../../../../shared/schemas";

const addReferenceValue = "__add_array_ref_value__";

interface ArrayRefCellEditorProps {
  column: DataColumnDefinition;
  onCommit: (value: unknown) => void;
  tables: Array<{ id: string; name: string; rows?: Array<{ id: string; slug: string }> }>;
  value: unknown;
}

const ArrayRefCellEditor: FC<ArrayRefCellEditorProps> = (props) => {
  const { column, onCommit, tables, value } = props;
  const selectedValues = Array.isArray(value) ? [...new Set(value.map(String))] : [];
  const targetTable = tables.find((entry) => entry.id === column.refTableId);
  const targetRows = targetTable?.rows ?? [];
  const targetSlugs = new Set(targetRows.map((row) => row.slug));
  const availableRows = targetRows.filter((row) => !selectedValues.includes(row.slug));

  return (
    <div className="flex min-w-64 flex-col gap-1">
      <Select
        disabled={!targetTable || availableRows.length === 0}
        value={addReferenceValue}
        onValueChange={(nextValue) => {
          if (nextValue !== addReferenceValue && !selectedValues.includes(nextValue)) onCommit([...selectedValues, nextValue]);
        }}
      >
        <SelectTrigger className="h-7 min-w-24 border border-border bg-background px-1.5 font-mono text-[0.7rem] shadow-sm">
          <SelectValue placeholder={targetTable ? `Add ${targetTable.name} row` : "Missing target table"} />
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
        {selectedValues.map((entry) => (
          <Badge className="gap-1 font-mono text-[0.65rem]" key={entry} variant={targetSlugs.has(entry) ? "secondary" : "destructive"}>
            {entry}
            <button
              aria-label={`Remove ${entry}`}
              onClick={() => onCommit(selectedValues.filter((valueEntry) => valueEntry !== entry))}
              type="button"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
};

export default ArrayRefCellEditor;
