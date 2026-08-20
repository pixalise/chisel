import type { Control, FieldValues, UseFormSetValue } from "react-hook-form";
import type { ColumnType } from "../../../../../../shared/types";

export interface DataSchemaColumnEditorProps {
  control: Control<FieldValues>;
  disabled?: boolean;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
  setValue: UseFormSetValue<FieldValues>;
}

export interface ColumnFieldEditorProps {
  control: Control<FieldValues>;
  disabled?: boolean;
  fieldPrefix: string;
}

export interface NumericMetadataInputProps extends ColumnFieldEditorProps {
  integer?: boolean;
  label: string;
  name: string;
}

export interface ColumnDefaultValueEditorProps {
  control: Control<FieldValues>;
  columnType: ColumnType;
  disabled?: boolean;
  enumValues: string[];
  fieldPrefix: string;
  maxValue: unknown;
  minValue: unknown;
  onAddEnumArrayDefaultValue: (value: string) => void;
  onRemoveEnumArrayDefaultValue: (value: string) => void;
  refTableId: unknown;
  requiredValue: unknown;
  stepValue: unknown;
}

export interface ColumnTypedDefaultValueEditorProps {
  control: Control<FieldValues>;
  columnType: ColumnType;
  disabled?: boolean;
  enumValues: string[];
  fieldPrefix: string;
  maxValue: unknown;
  minValue: unknown;
  refTableId: unknown;
  requiredValue: unknown;
  stepValue: unknown;
}

export interface EnumArrayDefaultValueEditorProps {
  control: Control<FieldValues>;
  disabled?: boolean;
  enumValues: string[];
  fieldPrefix: string;
  onAddEnumArrayDefaultValue: (value: string) => void;
  onRemoveEnumArrayDefaultValue: (value: string) => void;
}

export interface PossibleValuesEditorProps {
  disabled?: boolean;
  enumValues: string[];
  onAddPossibleValue: () => void;
  onPossibleValueInputChange: (value: string) => void;
  onRemovePossibleValue: (value: string) => void;
  possibleValueInput: string;
}
