import { type FC } from "react";
import { Badge } from "@/components/ui/badge";
import type { DataColumnDefinition } from "../../../../../shared/schemas";

interface ArrayRefCellValueProps {
  column: DataColumnDefinition;
  tables: Array<{ id: string; name: string; rows?: Array<{ id: string; slug: string }> }>;
  value: unknown;
}

const ArrayRefCellValue: FC<ArrayRefCellValueProps> = (props) => {
  const { column, tables, value } = props;
  const values = Array.isArray(value) ? value.map(String) : [];
  const targetTable = tables.find((entry) => entry.id === column.refTableId);
  const targetSlugs = new Set((targetTable?.rows ?? []).map((row) => row.slug));

  return (
    <span className="flex flex-wrap gap-1">
      {values.map((entry) => (
        <Badge className="font-mono text-[0.65rem]" key={entry} variant={targetSlugs.has(entry) ? "secondary" : "destructive"}>
          {entry}
        </Badge>
      ))}
    </span>
  );
};

export default ArrayRefCellValue;
