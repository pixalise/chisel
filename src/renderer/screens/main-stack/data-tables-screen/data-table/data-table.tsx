import { type FC, useEffect, useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import { nanoid } from "nanoid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { INPUT_BINDINGS_TABLE_ID } from "@/constants/system-tables";
import useSaveTableRowsMutation from "@/hooks/use-save-table-rows-mutation";
import { cn } from "@/lib/utils";
import { normalizeConstantCaseInput } from "../../../../../shared/asset-paths";
import { dataTableRowSchema, rowSlugSchema, type DataColumnDefinition, type DataTableRow } from "../../../../../shared/schemas";
import { ColumnType } from "../../../../../shared/types";
import { CellEditor, CellValue } from "./data-table-cells";
import { tableTabKey, type TableTabEntry } from "./table-tabs/table-tab";

export interface DataTableProps {
  table: TableTabEntry | null;
}

interface EditorRow {
  id: string;
  slug: string;
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
  return !isSystemTable(table) || table.id === INPUT_BINDINGS_TABLE_ID;
}

function nextDefaultSlug(rows: EditorRow[]): string {
  const existingSlugs = new Set(rows.map((row) => row.slug));
  if (!existingSlugs.has("NEW_ROW")) {
    return "NEW_ROW";
  }
  for (let index = 2; index < Number.MAX_SAFE_INTEGER; index += 1) {
    const slug = `NEW_ROW_${index}`;
    if (!existingSlugs.has(slug)) {
      return slug;
    }
  }
  return `NEW_ROW_${nanoid()
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()}`;
}

function normalizeSlugInput(value: string): string {
  return normalizeConstantCaseInput(value);
}

function createEditorRow(columns: DataColumnDefinition[], rows: EditorRow[]): EditorRow {
  return {
    id: nanoid(),
    slug: nextDefaultSlug(rows),
    values: Object.fromEntries(columns.map((column) => [column.id, defaultValueForNewRow(column)]))
  };
}

function rowsFromTable(table: TableTabEntry, columns: DataColumnDefinition[]): EditorRow[] {
  return tableRows(table).map((row) => ({
    id: row.id,
    slug: row.slug,
    values: Object.fromEntries(
      columns.map((column) => {
        const value = row.values.find((item) => item.columnId === column.id);
        return [column.id, value?.value ?? defaultValueForNewRow(column)];
      })
    )
  }));
}

function tableRowFromEditorRow(row: EditorRow, columns: DataColumnDefinition[]): DataTableRow {
  return dataTableRowSchema.parse({
    id: row.id,
    slug: row.slug,
    values: columns.map((column) => ({
      columnId: column.id,
      type: column.type,
      value: cellValue(row, column)
    }))
  });
}

function tableRowsFromEditorRows(rows: EditorRow[], columns: DataColumnDefinition[]): DataTableRow[] {
  return rows.map((row) => tableRowFromEditorRow(row, columns));
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
  const errors: string[] = [];
  const slugParse = rowSlugSchema.safeParse(row.slug);
  if (!slugParse.success) {
    errors.push(slugParse.error.issues[0]?.message ?? "Slug must be CONSTANT_CASE");
  }
  const duplicateSlug = rows.some((entry) => entry.id !== row.id && entry.slug === row.slug);
  if (duplicateSlug) {
    errors.push("Slug must be unique");
  }
  return [...errors, ...columns.flatMap((column) => validateCell(column, cellValue(row, column), rows, row.id))];
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
  const columnSignature = useMemo(() => JSON.stringify(columns), [columns]);
  const tableRef = useRef<TableTabEntry | null>(table);
  const columnsRef = useRef<DataColumnDefinition[]>(columns);
  const { isSaveTableRowsLoading, saveTableRows } = useSaveTableRowsMutation();
  const tableKey = table ? tableTabKey(table) : "";
  const canMutateTableRows = table ? canMutateRows(table) : false;

  useEffect(() => {
    tableRef.current = table;
    columnsRef.current = columns;
  });

  useEffect(() => {
    const currentTable = tableRef.current;
    const currentColumns = columnsRef.current;

    if (!currentTable) {
      setRows([]);
      setUnlockedRows(new Set());
      return;
    }

    setRows(rowsFromTable(currentTable, currentColumns));
    setUnlockedRows(new Set());
  }, [columnSignature, tableKey]);

  function persistRows(nextRows: EditorRow[]): void {
    if (!table || !canMutateTableRows) {
      return;
    }
    if (nextRows.some((row) => validateRow(row, columns, nextRows).length > 0)) {
      return;
    }

    void saveTableRows({
      rows: tableRowsFromEditorRows(nextRows, columns),
      tableId: table.id
    });
  }

  function addRow(): void {
    if (!canMutateTableRows) {
      return;
    }

    const nextRow = createEditorRow(columns, rows);
    const nextRows = [...rows, nextRow];
    setRows(nextRows);
    setUnlockedRows((current) => new Set([...current, nextRow.id]));
    persistRows(nextRows);
  }

  function deleteRow(rowId: string): void {
    if (!canMutateTableRows) {
      return;
    }

    const nextRows = rows.filter((row) => row.id !== rowId);
    setRows(nextRows);
    setUnlockedRows((current) => {
      const next = new Set(current);
      next.delete(rowId);
      return next;
    });
    persistRows(nextRows);
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
    const nextRows = rows.map((row) => {
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
    });
    setRows(nextRows);
    persistRows(nextRows);
  }

  function updateSlug(rowId: string, value: string): void {
    const nextRows = rows.map((row) => {
      if (row.id !== rowId) {
        return row;
      }
      return {
        ...row,
        slug: normalizeSlugInput(value)
      };
    });
    setRows(nextRows);
    persistRows(nextRows);
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

      <ScrollArea className="min-h-0 min-w-0 flex-1">
        <TooltipProvider delayDuration={120}>
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12" />
                <TableHead className="w-20">Edit</TableHead>
                <TableHead className="min-w-44 whitespace-nowrap">Slug</TableHead>
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
                    <TableCell className="min-w-44 whitespace-nowrap">
                      {editable ? (
                        <Input
                          className="h-7 min-w-36 border border-border bg-background px-1.5 font-mono text-[0.7rem] shadow-sm"
                          value={row.slug}
                          onChange={(event) => updateSlug(row.id, event.target.value)}
                        />
                      ) : (
                        <span className="font-mono">{row.slug}</span>
                      )}
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
                  <TableCell className="text-sm text-muted-foreground" colSpan={columns.length + 2}>
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
        <span className="font-mono">{isSaveTableRowsLoading ? "Saving..." : tableStoragePath(table)}</span>
      </div>
    </div>
  );
};

export default DataTable;
