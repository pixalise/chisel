import { type ChangeEvent, type FC, useEffect, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { type DataColumnDefinition } from "../../../../../shared/schemas";
import { ColumnType } from "../../../../../shared/types";
import AssetRefCellEditor from "./asset-ref-cell-editor/asset-ref-cell-editor";
import AssetRefCellValue from "./asset-ref-cell-value";

const cellEditorClassName = "h-7 min-w-24 border border-border bg-background px-1.5 font-mono text-[0.7rem] shadow-sm";
const vectorComponentLabels = ["x", "y", "z", "w"];

export interface CellValueProps {
  column: DataColumnDefinition;
  value: unknown;
}

export interface CellEditorProps {
  column: DataColumnDefinition;
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
  return type === ColumnType.cellMask || type === ColumnType.heightField || type === ColumnType.transform3 || type === ColumnType.json;
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

function cellMaskSummary(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    return "0 cells";
  }
  const mask = value as { cells?: unknown; height?: unknown; width?: unknown };
  const cells = Array.isArray(mask.cells) ? mask.cells.length : 0;
  const width = typeof mask.width === "number" ? mask.width : "?";
  const height = typeof mask.height === "number" ? mask.height : "?";
  return `${cells} cells (${width} x ${height})`;
}

function heightFieldSummary(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    return "0 heights";
  }
  const field = value as { cornerHeight?: unknown; cornerWidth?: unknown; height?: unknown; values?: unknown; width?: unknown };
  const values = Array.isArray(field.values) ? field.values.length : 0;
  const width = typeof field.width === "number" ? field.width : "?";
  const height = typeof field.height === "number" ? field.height : "?";
  const cornerWidth = typeof field.cornerWidth === "number" ? field.cornerWidth : "?";
  const cornerHeight = typeof field.cornerHeight === "number" ? field.cornerHeight : "?";
  return `${values} heights (${width} x ${height} cells, ${cornerWidth} x ${cornerHeight} corners)`;
}

function transform3Summary(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    return "pos 0,0,0 rot 0,0,0 scale 1,1,1";
  }
  const transform = value as { position?: unknown; rotationDegrees?: unknown; scale?: unknown };
  const position = Array.isArray(transform.position) ? transform.position.join(", ") : "0, 0, 0";
  const rotation = Array.isArray(transform.rotationDegrees) ? transform.rotationDegrees.join(", ") : "0, 0, 0";
  const scale = Array.isArray(transform.scale) ? transform.scale.join(", ") : "1, 1, 1";
  return `pos ${position} | rot ${rotation} | scale ${scale}`;
}

export const CellValue: FC<CellValueProps> = (props) => {
  const { column, value } = props;

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

  if (column.type === ColumnType.cellMask) {
    return <span className="font-mono">{cellMaskSummary(value)}</span>;
  }

  if (column.type === ColumnType.heightField) {
    return <span className="font-mono">{heightFieldSummary(value)}</span>;
  }

  if (column.type === ColumnType.transform3) {
    return <span className="font-mono">{transform3Summary(value)}</span>;
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
  const { column, value, onCommit } = props;
  const [draft, setDraft] = useState(textValue(value));

  useEffect(() => {
    setDraft(textValue(value));
  }, [column.id, value]);

  if (column.type === ColumnType.boolean) {
    return <Checkbox checked={value === true} onCheckedChange={(checked) => onCommit(checked === true)} />;
  }

  if (column.type === ColumnType.enum && column.possibleValues?.length) {
    return (
      <Select value={textValue(value)} onValueChange={(nextValue) => onCommit(nextValue)}>
        <SelectTrigger className={cellEditorClassName}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
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
