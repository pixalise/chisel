import { type ChangeEvent, type FC, useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import useLocalizationQuery from "@/hooks/use-localization-query";
import { cn } from "@/lib/utils";
import { type DataColumnDefinition } from "../../../../../shared/schemas";
import { ColumnType } from "../../../../../shared/types";
import AssetRefCellEditor from "./asset-ref-cell-editor/asset-ref-cell-editor";
import AssetRefCellValue from "./asset-ref-cell-value";
import ArrayRefCellEditor from "./array-ref-cell-editor";
import ArrayRefCellValue from "./array-ref-cell-value";

const cellEditorClassName = "h-7 min-w-24 border border-border bg-background px-1.5 font-mono text-[0.7rem] shadow-sm";
const emptyEnumValue = "__empty_enum_value__";
const emptyRefValue = "__empty_ref_value__";
const chooseRefValue = "__choose_ref_value__";
const vectorComponentLabels = ["x", "y", "z", "w"];

interface RefTableOption {
  id: string;
  name: string;
  rows?: Array<{ id: string; slug: string }>;
}

export interface CellValueProps {
  column: DataColumnDefinition;
  tables: RefTableOption[];
  value: unknown;
}

export interface CellEditorProps {
  column: DataColumnDefinition;
  tables: RefTableOption[];
  value: unknown;
  onCommit: (value: unknown) => void;
}

function defaultValueForColumn(column: DataColumnDefinition): unknown {
  if (typeof column.defaultValue === "object" && column.defaultValue !== null) {
    return JSON.parse(JSON.stringify(column.defaultValue)) as unknown;
  }
  return column.defaultValue;
}

function textValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "undefined" || value === null) {
    return "";
  }
  return JSON.stringify(value);
}

function jsonValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function parseNumericValue(value: string, column: DataColumnDefinition): number {
  const parsed = column.type === ColumnType.integer ? Number.parseInt(value, 10) : Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return Number(defaultValueForColumn(column));
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

function isStructuredColumnType(type: ColumnType): boolean {
  return type === ColumnType.json;
}

function vectorValues(value: unknown, column: DataColumnDefinition): number[] {
  const vectorLength = vectorLengthForColumnType(column.type);
  const fallback = defaultValueForColumn(column);
  const fallbackValues = Array.isArray(fallback) ? fallback.map(Number) : Array.from({ length: vectorLength }, () => 0);
  if (!Array.isArray(value)) {
    return fallbackValues;
  }
  const values = value.slice(0, vectorLength).map(Number);
  if (values.length !== vectorLength || values.some((entry) => !Number.isFinite(entry))) {
    return fallbackValues;
  }
  return values;
}

function vectorEditorWidthClassName(type: ColumnType): string {
  if (type === ColumnType.vector2) {
    return "min-w-40";
  }
  if (type === ColumnType.vector3) {
    return "min-w-56";
  }
  if (type === ColumnType.vector4) {
    return "min-w-72";
  }
  return "min-w-40";
}

function rangeLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function tableRows(table: RefTableOption | undefined): Array<{ id: string; slug: string }> {
  return table?.rows ?? [];
}

export const CellValue: FC<CellValueProps> = (props) => {
  const { column, tables, value } = props;

  if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
    return <span className="text-muted-foreground/65">-</span>;
  }

  if (column.type === ColumnType.boolean) {
    return <span className="font-mono">{value ? "true" : "false"}</span>;
  }

  if (column.type === ColumnType.integer || column.type === ColumnType.decimal || column.type === ColumnType.range) {
    return <span className="font-mono">{String(value)}</span>;
  }

  if (column.type === ColumnType.enum) {
    return <Badge variant="secondary">{String(value)}</Badge>;
  }

  if (column.type === ColumnType.assetRef) {
    return <AssetRefCellValue value={value} />;
  }

  if (column.type === ColumnType.translationRef) {
    return <TranslationRefCellValue value={value} />;
  }

  if (column.type === ColumnType.ref) {
    return <RefCellValue column={column} tables={tables} value={value} />;
  }

  if (column.type === ColumnType.arrayRef) {
    return <ArrayRefCellValue column={column} tables={tables} value={value} />;
  }

  if (column.type === ColumnType.color) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono">
        <Input className="h-5 w-7 p-0" disabled type="color" value={String(value)} />
        {String(value)}
      </span>
    );
  }

  if (isVectorColumnType(column.type)) {
    return <span className="font-mono">{vectorValues(value, column).join(", ")}</span>;
  }

  if (Array.isArray(value)) {
    return (
      <span className="flex flex-wrap gap-1">
        {value.map((entry, index) => (
          <Badge className="font-mono text-[0.65rem]" key={`${String(entry)}-${index}`} variant="secondary">
            {String(entry)}
          </Badge>
        ))}
      </span>
    );
  }

  return <span>{textValue(value)}</span>;
};

export const CellEditor: FC<CellEditorProps> = (props) => {
  const { column, tables, value, onCommit } = props;
  const [draft, setDraft] = useState(textValue(value));

  useEffect(() => {
    setDraft(textValue(value));
  }, [column.id, value]);

  if (column.type === ColumnType.boolean) {
    return <Checkbox checked={value === true} onCheckedChange={(checked) => onCommit(checked === true)} />;
  }

  if (column.type === ColumnType.enum && column.possibleValues?.length) {
    const enumValue = textValue(value);
    const selectValue = !column.required && enumValue === "" ? emptyEnumValue : enumValue;

    return (
      <Select value={selectValue} onValueChange={(nextValue) => onCommit(nextValue === emptyEnumValue ? "" : nextValue)}>
        <SelectTrigger className={cellEditorClassName}>
          <SelectValue placeholder={column.required ? undefined : "None"} />
        </SelectTrigger>
        <SelectContent>
          {!column.required && <SelectItem value={emptyEnumValue}>None</SelectItem>}
          {column.possibleValues.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (column.type === ColumnType.enumArray) {
    const selectedValues = Array.isArray(value) ? value.map(String) : [];
    const enumValues = column.possibleValues ?? [];
    const availableValues = enumValues.filter((option) => !selectedValues.includes(option));

    return (
      <div className="flex min-w-52 flex-col gap-1">
        <Select
          value="__add_enum_array_value__"
          onValueChange={(nextValue) => {
            if (nextValue === "__add_enum_array_value__" || selectedValues.includes(nextValue)) {
              return;
            }
            onCommit([...selectedValues, nextValue]);
          }}
        >
          <SelectTrigger className={cellEditorClassName} disabled={availableValues.length === 0}>
            <SelectValue placeholder="Add value" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem disabled value="__add_enum_array_value__">
              Add value
            </SelectItem>
            {availableValues.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-1">
          {selectedValues.map((entry) => (
            <Badge className="gap-1 font-mono text-[0.65rem]" key={entry} variant="secondary">
              {entry}
              <button onClick={() => onCommit(selectedValues.filter((valueEntry) => valueEntry !== entry))} type="button">
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>
    );
  }

  if (column.type === ColumnType.color) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          className="h-7 w-9 border border-border bg-background p-1 shadow-sm"
          type="color"
          value={textValue(value) || String(defaultValueForColumn(column))}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onCommit(event.target.value)}
        />
        <Input
          className={cellEditorClassName}
          value={draft}
          onBlur={() => onCommit(draft)}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
        />
      </div>
    );
  }

  if (column.type === ColumnType.assetRef) {
    return <AssetRefCellEditor column={column} value={value} onCommit={onCommit} />;
  }

  if (column.type === ColumnType.translationRef) {
    return <TranslationRefCellEditor column={column} tables={tables} value={value} onCommit={onCommit} />;
  }

  if (column.type === ColumnType.ref) {
    return <RefCellEditor column={column} tables={tables} value={value} onCommit={onCommit} />;
  }

  if (column.type === ColumnType.arrayRef) {
    return <ArrayRefCellEditor column={column} tables={tables} value={value} onCommit={onCommit} />;
  }

  if (isStructuredColumnType(column.type)) {
    return (
      <Textarea
        className="min-h-16 min-w-52 border-border bg-background font-mono text-xs shadow-sm"
        value={jsonValue(value)}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          try {
            onCommit(JSON.parse(event.target.value) as unknown);
          } catch {
            onCommit(event.target.value);
          }
        }}
      />
    );
  }

  if (isVectorColumnType(column.type)) {
    const values = vectorValues(value, column);

    return (
      <div className={cn("flex items-center gap-1.5", vectorEditorWidthClassName(column.type))}>
        {values.map((entry, index) => (
          <div className="flex items-center gap-1" key={vectorComponentLabels[index]}>
            <span className="font-mono text-[0.6rem] uppercase text-muted-foreground">{vectorComponentLabels[index]}</span>
            <Input
              className={cn(cellEditorClassName, "w-14 min-w-0")}
              max={column.max}
              min={column.min}
              step={column.step ?? "any"}
              type="number"
              value={String(entry)}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const parsed = Number(event.target.value);
                const nextValues = [...values];
                nextValues[index] = Number.isFinite(parsed) ? parsed : entry;
                onCommit(nextValues);
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (column.type === ColumnType.range) {
    const min = column.min ?? 0;
    const max = column.max ?? 1;
    const step = column.step ?? 0.01;
    const numericValue = Number(value);
    const currentValue = Number.isFinite(numericValue) ? numericValue : Number(defaultValueForColumn(column));

    return (
      <div className="grid min-w-72 gap-1">
        <div className="flex items-center justify-between font-mono text-[0.6rem] uppercase text-muted-foreground">
          <span>min {rangeLabel(min)}</span>
          <span>max {rangeLabel(max)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Slider
            className="min-w-40 flex-1"
            aria-label={`${column.name} slider`}
            max={max}
            min={min}
            rangeClassName="!rounded-full bg-primary/90"
            step={step}
            thumbClassName="h-4 w-4 !rounded-full border-2 border-background bg-primary shadow-[0_0_0_1px_var(--border)]"
            trackClassName="h-2 !rounded-full border border-border bg-input"
            value={[currentValue]}
            onValueChange={(nextValue) => {
              const next = nextValue[0] ?? min;
              setDraft(String(next));
              onCommit(next);
            }}
          />
          <Input
            className={cn(cellEditorClassName, "w-16 min-w-0")}
            max={max}
            min={min}
            step={step}
            type="number"
            value={draft}
            onBlur={() => onCommit(parseNumericValue(draft, column))}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />
        </div>
      </div>
    );
  }

  if (column.type === ColumnType.integer || column.type === ColumnType.decimal) {
    return (
      <Input
        className={cellEditorClassName}
        max={column.max}
        min={column.min}
        step={column.type === ColumnType.integer ? 1 : "any"}
        type="number"
        value={draft}
        onBlur={() => onCommit(parseNumericValue(draft, column))}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
    );
  }

  return (
    <Input
      className={cellEditorClassName}
      maxLength={column.maxChars}
      value={draft}
      onBlur={() => onCommit(draft)}
      onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
};

const TranslationRefCellValue: FC<{ value: unknown }> = (props) => {
  const { value } = props;
  const { localization } = useLocalizationQuery();
  const keyPath = typeof value === "string" ? value : "";
  const key = localization.keys.find((entry) => entry.path === keyPath);

  if (!keyPath) {
    return <span className="text-muted-foreground/65">-</span>;
  }

  return (
    <span className="flex items-center gap-1.5">
      <Badge variant={key ? "secondary" : "outline"}>{key ? "translation" : "missing"}</Badge>
      <span className="font-mono text-xs">{keyPath}</span>
    </span>
  );
};

const RefCellValue: FC<CellValueProps> = (props) => {
  const { column, tables, value } = props;
  const slug = typeof value === "string" ? value : "";
  const targetTable = tables.find((entry) => entry.id === column.refTableId);
  const targetRow = tableRows(targetTable).find((entry) => entry.slug === slug);

  if (!slug) {
    return <span className="text-muted-foreground/65">-</span>;
  }

  return (
    <span className="flex items-center gap-1.5">
      <Badge variant={targetRow ? "secondary" : "outline"}>{targetRow ? (targetTable?.name ?? "ref") : "missing"}</Badge>
      <span className="font-mono text-xs">{slug}</span>
    </span>
  );
};

const RefCellEditor: FC<CellEditorProps> = (props) => {
  const { column, tables, value, onCommit } = props;
  const slug = typeof value === "string" ? value : "";
  const targetTable = tables.find((entry) => entry.id === column.refTableId);
  const targetRows = tableRows(targetTable);
  const selectedRow = targetRows.find((entry) => entry.slug === slug);
  const selectValue = slug || (column.required ? chooseRefValue : emptyRefValue);

  return (
    <Select
      value={selectValue}
      onValueChange={(nextValue) => {
        if (nextValue === chooseRefValue) {
          return;
        }
        onCommit(nextValue === emptyRefValue ? "" : nextValue);
      }}
    >
      <SelectTrigger className={cellEditorClassName}>
        <SelectValue placeholder={targetTable ? `Choose ${targetTable.name}` : "Choose reference"} />
      </SelectTrigger>
      <SelectContent>
        {column.required && !slug && (
          <SelectItem disabled value={chooseRefValue}>
            Choose {targetTable?.name ?? "reference"}
          </SelectItem>
        )}
        {!column.required && <SelectItem value={emptyRefValue}>None</SelectItem>}
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
          <SelectItem disabled value="__no_ref_rows__">
            No rows in {targetTable.name}
          </SelectItem>
        )}
        {!targetTable && (
          <SelectItem disabled value="__missing_ref_table__">
            Missing target table
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
};

const TranslationRefCellEditor: FC<CellEditorProps> = (props) => {
  const { column, value, onCommit } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { localization } = useLocalizationQuery();
  const keyPath = typeof value === "string" ? value : "";
  const selectedKey = localization.keys.find((entry) => entry.path === keyPath);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredKeys = localization.keys.filter((key) => {
    if (!normalizedQuery) {
      return true;
    }
    return (
      key.path.toLowerCase().includes(normalizedQuery) ||
      (key.description ?? "").toLowerCase().includes(normalizedQuery) ||
      (key.values[localization.defaultLocale] ?? "").toLowerCase().includes(normalizedQuery)
    );
  });

  return (
    <div className="flex min-w-64 items-center gap-1.5">
      <Button
        className="h-7 w-full justify-start px-2 font-mono text-[0.7rem]"
        onClick={() => setIsOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        {selectedKey ? selectedKey.path : keyPath || "Choose translation"}
      </Button>
      {keyPath && (
        <Button className="h-7 px-2" onClick={() => onCommit("")} size="sm" type="button" variant="ghost">
          Clear
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pick Translation</DialogTitle>
            <DialogDescription>Showing localization keys for {column.name}.</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 border border-input bg-background px-2">
            <Search className="size-4 text-muted-foreground" />
            <Input
              className="border-0 px-0 shadow-none focus-visible:ring-0"
              placeholder="Search by key, description, or default text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <ScrollArea className="max-h-80 border border-border">
            <div className="divide-y divide-border">
              {filteredKeys.map((key) => (
                <button
                  className={cn(
                    "flex w-full items-center justify-between gap-3 p-2 text-left hover:bg-muted",
                    key.path === keyPath && "bg-accent/35"
                  )}
                  key={key.path}
                  onClick={() => {
                    onCommit(key.path);
                    setIsOpen(false);
                  }}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-sm font-medium">{key.path}</span>
                    {key.values[localization.defaultLocale] && (
                      <span className="block truncate text-xs text-muted-foreground">{key.values[localization.defaultLocale]}</span>
                    )}
                    {key.description && <span className="block truncate text-xs text-muted-foreground">{key.description}</span>}
                  </span>
                  <Badge className="shrink-0" variant="outline">
                    {localization.defaultLocale}
                  </Badge>
                </button>
              ))}
              {filteredKeys.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No matching translations.</div>}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};
