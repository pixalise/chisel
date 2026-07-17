import { type FC, useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { nanoid } from "nanoid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type DataColumnDefinition, type DataTableRow } from "../../../../../shared/schemas";
import { ColumnType } from "../../../../../shared/types";
import { CellEditor, CellValue } from "./data-table-cells";
import { tableTabKey, type TableTabEntry } from "./table-tabs/table-tab";

export interface DataTableProps {
  table: TableTabEntry | null;
}

interface EditorRow {
  id: string;
  values: Record<string, unknown>;
}

function cloneValue(value: unknown): unknown {
  if (typeof value === "object" && value !== null) {
    return JSON.parse(JSON.stringify(value)) as unknown;
  }
  return value;
}

function defaultValueForColumn(column: DataColumnDefinition): unknown {
  return cloneValue(column.defaultValue);
}

function defaultValueForNewRow(column: DataColumnDefinition): unknown {
  if (column.type === ColumnType.id) {
    return nanoid();
  }
  return defaultValueForColumn(column);
}

function tableRows(table: TableTabEntry): DataTableRow[] {
  if ("rows" in table) {
    return table.rows;
  }
  return [];
}

function isSystemTable(table: TableTabEntry): boolean {
  return "isSystemTable" in table && table.isSystemTable;
}

function canMutateRows(table: TableTabEntry): boolean {
  return !isSystemTable(table);
}

function createEditorRow(columns: DataColumnDefinition[]): EditorRow {
  return {
    id: nanoid(),
    values: Object.fromEntries(columns.map((column) => [column.id, defaultValueForNewRow(column)]))
  };
}

function rowsFromTable(table: TableTabEntry, columns: DataColumnDefinition[]): EditorRow[] {
  return tableRows(table).map((row) => ({
    id: row.id,
    values: Object.fromEntries(
      columns.map((column) => {
        const value = row.values.find((item) => item.columnId === column.id);
        return [column.id, value?.value ?? defaultValueForNewRow(column)];
      })
    )
  }));
}

function cellValue(row: EditorRow, column: DataColumnDefinition): unknown {
  return row.values[column.id] ?? defaultValueForColumn(column);
}

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function comparableValue(value: unknown): string {
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

function vectorLengthForColumnType(type: ColumnType): number {
  if (type === ColumnType.vector2) {
    return 2;
  }
  if (type === ColumnType.vector3) {
    return 3;
  }
  if (type === ColumnType.vector4) {
    return 4;
  }
  return 0;
}

function isVectorColumnType(type: ColumnType): boolean {
  return vectorLengthForColumnType(type) > 0;
}

function isRefColumnType(type: ColumnType): boolean {
  return type === ColumnType.ref;
}

function validateCell(column: DataColumnDefinition, value: unknown, rows: EditorRow[], rowId: string): string[] {
  const errors: string[] = [];

  if (column.required && isEmptyValue(value)) {
    errors.push(`${column.name} is required`);
  }

  if (column.maxChars && typeof value === "string" && value.length > column.maxChars) {
    errors.push(`${column.name} must be at most ${column.maxChars} characters`);
  }

  if (column.type === ColumnType.integer || column.type === ColumnType.decimal || column.type === ColumnType.range) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      errors.push(`${column.name} must be numeric`);
    }
    if (column.type === ColumnType.integer && !Number.isInteger(numericValue)) {
      errors.push(`${column.name} must be an integer`);
    }
    if (typeof column.min === "number" && numericValue < column.min) {
      errors.push(`${column.name} must be at least ${column.min}`);
    }
    if (typeof column.max === "number" && numericValue > column.max) {
      errors.push(`${column.name} must be at most ${column.max}`);
    }
  }

  if (column.type === ColumnType.enum && column.possibleValues?.length && !column.possibleValues.includes(String(value))) {
    errors.push(`${column.name} must match an allowed value`);
  }

  if (isRefColumnType(column.type) && typeof value !== "string") {
    errors.push(`${column.name} must be a reference string`);
  }

  if (column.type === ColumnType.enumArray) {
    if (!Array.isArray(value)) {
      errors.push(`${column.name} must be an array`);
    } else {
      const enumValues = column.possibleValues ?? [];
      const invalidValues = value.filter((entry) => typeof entry !== "string" || (enumValues.length > 0 && !enumValues.includes(entry)));
      if (invalidValues.length > 0) {
        errors.push(`${column.name} has invalid enum values`);
      }
      if (typeof column.max === "number" && value.length > column.max) {
        errors.push(`${column.name} must have at most ${column.max} values`);
      }
    }
  }

  if (isVectorColumnType(column.type)) {
    if (!Array.isArray(value) || value.length !== vectorLengthForColumnType(column.type)) {
      errors.push(`${column.name} must be a ${column.type}`);
    } else {
      const invalidValues = value.filter((entry) => typeof entry !== "number" || !Number.isFinite(entry));
      if (invalidValues.length > 0) {
        errors.push(`${column.name} must contain numbers`);
      }
      const min = column.min;
      const max = column.max;
      if (typeof min === "number" && value.some((entry) => Number(entry) < min)) {
        errors.push(`${column.name} values must be at least ${min}`);
      }
      if (typeof max === "number" && value.some((entry) => Number(entry) > max)) {
        errors.push(`${column.name} values must be at most ${max}`);
      }
    }
  }

  if (column.unique && !isEmptyValue(value)) {
    const duplicate = rows.some((row) => row.id !== rowId && comparableValue(row.values[column.id]) === comparableValue(value));
    if (duplicate) {
      errors.push(`${column.name} must be unique`);
    }
  }

  return errors;
}

function validateRow(row: EditorRow, columns: DataColumnDefinition[], rows: EditorRow[]): string[] {
  return columns.flatMap((column) => validateCell(column, cellValue(row, column), rows, row.id));
}

function tableStoragePath(table: TableTabEntry): string {
  if (!isSystemTable(table)) {
    return ".chisel/tables/user/<table_id>.json";
  }
  return ".chisel/tables/system/<table_id>.json";
}

function columnValueLabel(value: unknown): string {
  if (typeof value === "undefined") {
    return "-";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function columnDetailRows(column: DataColumnDefinition): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ["id", column.id],
    ["type", column.type],
    ["required", column.required ? "yes" : "no"],
    ["unique", column.unique ? "yes" : "no"],
    ["default", columnValueLabel(column.defaultValue)]
  ];

  if (typeof column.min === "number") {
    rows.push(["min", String(column.min)]);
  }
  if (typeof column.max === "number") {
    rows.push(["max", String(column.max)]);
  }
  if (typeof column.step === "number") {
    rows.push(["step", String(column.step)]);
  }
  if (typeof column.maxChars === "number") {
    rows.push(["max chars", String(column.maxChars)]);
  }
  if (column.possibleValues?.length) {
    rows.push(["values", column.possibleValues.join(", ")]);
  }
  if (column.assetCategory) {
    rows.push(["asset category", column.assetCategory]);
  }

  return rows;
}

const ColumnHeader: FC<{ column: DataColumnDefinition }> = (props) => {
  const { column } = props;

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("font-medium", column.required && "text-destructive")}>{column.name}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="text-muted-foreground hover:text-foreground" type="button">
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-80 bg-popover text-popover-foreground">
          <div className="space-y-1.5">
            <strong className="block text-xs">{column.name}</strong>
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-[0.65rem]">
              {columnDetailRows(column).map(([label, value]) => (
                <div className="contents" key={label}>
                  <span className="text-muted-foreground">{label}</span>
                  <span className="break-words">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

function columnWidthClassName(column: DataColumnDefinition): string {
  if (column.type === ColumnType.boolean) {
    return "min-w-16";
  }
  if (column.type === ColumnType.integer || column.type === ColumnType.decimal) {
    return "min-w-28";
  }
  if (column.type === ColumnType.range) {
    return "min-w-80";
  }
  if (column.type === ColumnType.enum) {
    return "min-w-36";
  }
  if (column.type === ColumnType.enumArray) {
    return "min-w-56";
  }
  if (column.type === ColumnType.color) {
    return "min-w-44";
  }
  if (column.type === ColumnType.vector2) {
    return "min-w-44";
  }
  if (column.type === ColumnType.vector3) {
    return "min-w-60";
  }
  if (column.type === ColumnType.vector4) {
    return "min-w-80";
  }
  if (column.type === ColumnType.text || column.type === ColumnType.json) {
    return "min-w-64";
  }
  return "min-w-40";
}

const DataTable: FC<DataTableProps> = (props) => {
  const { table } = props;
  const [rows, setRows] = useState<EditorRow[]>([]);
  const [unlockedRows, setUnlockedRows] = useState<Set<string>>(() => new Set());
  const columns = useMemo(() => table?.columns ?? [], [table]);
  const tableKey = table ? tableTabKey(table) : "";
  const canMutateTableRows = table ? canMutateRows(table) : false;

  useEffect(() => {
    if (!table) {
      setRows([]);
      setUnlockedRows(new Set());
      return;
    }

    setRows(rowsFromTable(table, columns));
    setUnlockedRows(new Set());
  }, [columns, table, tableKey]);

  function addRow(): void {
    if (!canMutateTableRows) {
      return;
    }

    const nextRow = createEditorRow(columns);
    setRows((current) => [...current, nextRow]);
    setUnlockedRows((current) => new Set([...current, nextRow.id]));
  }

  function deleteRow(rowId: string): void {
    if (!canMutateTableRows) {
      return;
    }

    setRows((current) => current.filter((row) => row.id !== rowId));
    setUnlockedRows((current) => {
      const next = new Set(current);
      next.delete(rowId);
      return next;
    });
  }

  function toggleRowLock(rowId: string): void {
    if (!canMutateTableRows) {
      return;
    }

    setUnlockedRows((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }

  function updateCell(rowId: string, columnId: string, value: unknown): void {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) {
          return row;
        }
        return {
          ...row,
          values: {
            ...row.values,
            [columnId]: value
          }
        };
      })
    );
  }

  if (!table) {
    return <div className="flex min-h-64 items-center justify-center p-4 text-sm text-muted-foreground">No table selected.</div>;
  }

  return (
    <div className="flex min-h-64 flex-1 flex-col">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <strong className="block truncate text-sm">{table.name}</strong>
            {isSystemTable(table) && <Badge variant="outline">Locked schema</Badge>}
          </div>
          <span className="block truncate text-xs text-muted-foreground">{table.description}</span>
        </div>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {rows.length} rows / {columns.length} columns
        </span>
      </div>

      {columns.length === 0 ? (
        <div className="flex min-h-64 items-center justify-center p-4 text-sm text-muted-foreground">This table has no columns.</div>
      ) : (
        <>
          <ScrollArea className="min-h-0 min-w-0 flex-1">
            <TooltipProvider delayDuration={120}>
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12" />
                    <TableHead className="w-20">Edit</TableHead>
                    {columns.map((column) => (
                      <TableHead key={column.id} className={cn("whitespace-nowrap", columnWidthClassName(column))}>
                        <ColumnHeader column={column} />
                      </TableHead>
                    ))}
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const editable = canMutateTableRows && unlockedRows.has(row.id);
                    const errors = validateRow(row, columns, rows);

                    return (
                      <TableRow className={cn(editable && "bg-accent/25 hover:bg-accent/35")} key={row.id}>
                        <TableCell>
                          {errors.length > 0 && (
                            <Badge title={errors.join("\n")} variant="destructive">
                              !
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {canMutateTableRows && (
                            <Button onClick={() => toggleRowLock(row.id)} size="sm" type="button" variant="ghost">
                              {editable ? "Lock" : "Unlock"}
                            </Button>
                          )}
                          {!canMutateTableRows && <Badge variant="outline">Locked</Badge>}
                        </TableCell>
                        {columns.map((column) => (
                          <TableCell className={cn("whitespace-nowrap", columnWidthClassName(column))} key={column.id}>
                            {editable ? (
                              <CellEditor
                                column={column}
                                value={cellValue(row, column)}
                                onCommit={(value) => updateCell(row.id, column.id, value)}
                              />
                            ) : (
                              <CellValue column={column} value={cellValue(row, column)} />
                            )}
                          </TableCell>
                        ))}
                        <TableCell>
                          {editable && canMutateTableRows && (
                            <Button onClick={() => deleteRow(row.id)} size="sm" type="button" variant="ghost">
                              Delete
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {canMutateTableRows && (
                    <TableRow className="cursor-pointer" onClick={addRow}>
                      <TableCell />
                      <TableCell>
                        <Badge variant="secondary">+</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" colSpan={columns.length + 1}>
                        Add row
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TooltipProvider>
          </ScrollArea>
          <div className="flex items-center justify-between gap-3 border-t border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            <span>
              {rows.length} rows / {columns.length} columns
            </span>
            <span className="font-mono">{tableStoragePath(table)}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default DataTable;
