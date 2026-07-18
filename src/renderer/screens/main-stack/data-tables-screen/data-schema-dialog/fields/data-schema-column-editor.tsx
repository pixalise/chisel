import { type FC, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { normalizeSnakeCaseInput } from "../../../../../../shared/asset-paths";
import { ColumnType } from "../../../../../../shared/types";
import AssetRefCategoryFilterEditor from "./asset-ref-category-filter-editor";
import ColumnDefaultValueEditor from "./column-default-value-editor";
import ColumnFlagsEditor from "./column-flags-editor";
import ColumnNameEditor from "./column-name-editor";
import ColumnTypeEditor from "./column-type-editor";
import type { DataSchemaColumnEditorProps } from "./data-schema-column-editor.types";
import { createDefaultValueForColumnType, isDefaultValueValidForColumnType, isVectorColumnType } from "./data-schema-column-utils";
import NumericMetadataInput from "./numeric-metadata-input";
import PossibleValuesEditor from "./possible-values-editor";
import { useWatch } from "react-hook-form";

const DataSchemaColumnEditor: FC<DataSchemaColumnEditorProps> = (props) => {
  const { control, disabled, index, isFirst, isLast, onMoveDown, onMoveUp, onRemove, setValue } = props;
  const fieldPrefix = `columns.${index}`;
  const columnId = useWatch({ control, name: `${fieldPrefix}.id` });
  const columnType = useWatch({ control, name: `${fieldPrefix}.type` });
  const defaultValue = useWatch({ control, name: `${fieldPrefix}.defaultValue` });
  const maxValue = useWatch({ control, name: `${fieldPrefix}.max` });
  const minValue = useWatch({ control, name: `${fieldPrefix}.min` });
  const possibleValues = useWatch({ control, name: `${fieldPrefix}.possibleValues` });
  const stepValue = useWatch({ control, name: `${fieldPrefix}.step` });
  const [possibleValueInput, setPossibleValueInput] = useState("");
  const enumValues = Array.isArray(possibleValues) ? possibleValues.map(String) : [];
  const supportsNumericBounds =
    columnType === ColumnType.integer ||
    columnType === ColumnType.decimal ||
    columnType === ColumnType.range ||
    isVectorColumnType(columnType);
  const supportsMaxChars = columnType === ColumnType.string || columnType === ColumnType.text;
  const supportsStep = columnType === ColumnType.range || isVectorColumnType(columnType);

  useEffect(() => {
    if (!Object.values(ColumnType).includes(columnType)) {
      return;
    }
    const currentEnumValues = Array.isArray(possibleValues) ? possibleValues.map(String) : [];
    if (isDefaultValueValidForColumnType(columnType, defaultValue, currentEnumValues)) {
      return;
    }
    setValue(`${fieldPrefix}.defaultValue`, createDefaultValueForColumnType(columnType, currentEnumValues, minValue), {
      shouldDirty: true,
      shouldValidate: true
    });
  }, [columnType, defaultValue, fieldPrefix, minValue, possibleValues, setValue]);

  function addPossibleValue(): void {
    const value = normalizeSnakeCaseInput(possibleValueInput);
    if (!value || enumValues.includes(value)) {
      return;
    }
    setValue(`${fieldPrefix}.possibleValues`, [...enumValues, value], { shouldDirty: true, shouldValidate: true });
    setPossibleValueInput("");
  }

  function removePossibleValue(value: string): void {
    setValue(
      `${fieldPrefix}.possibleValues`,
      enumValues.filter((entry) => entry !== value),
      { shouldDirty: true, shouldValidate: true }
    );
    if (defaultValue === value) {
      const nextValues = enumValues.filter((entry) => entry !== value);
      setValue(`${fieldPrefix}.defaultValue`, createDefaultValueForColumnType(ColumnType.enum, nextValues), {
        shouldDirty: true,
        shouldValidate: true
      });
    }
    if (Array.isArray(defaultValue) && defaultValue.includes(value)) {
      setValue(
        `${fieldPrefix}.defaultValue`,
        defaultValue.filter((entry) => entry !== value),
        { shouldDirty: true, shouldValidate: true }
      );
    }
  }

  function enumArrayDefaultValues(): string[] {
    if (!Array.isArray(defaultValue)) {
      return [];
    }
    return defaultValue.map(String).filter((entry) => enumValues.length === 0 || enumValues.includes(entry));
  }

  function addEnumArrayDefaultValue(value: string): void {
    if (!value) {
      return;
    }
    const currentValues = enumArrayDefaultValues();
    if (currentValues.includes(value)) {
      return;
    }
    setValue(`${fieldPrefix}.defaultValue`, [...currentValues, value], {
      shouldDirty: true,
      shouldValidate: true
    });
  }

  function removeEnumArrayDefaultValue(value: string): void {
    setValue(
      `${fieldPrefix}.defaultValue`,
      enumArrayDefaultValues().filter((entry) => entry !== value),
      { shouldDirty: true, shouldValidate: true }
    );
  }

  return (
    <div className="space-y-2 border border-border bg-muted/30 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          Column {index + 1} ({String(columnId ?? "")})
        </span>
        <div className="flex items-center gap-1">
          <Button disabled={disabled || isFirst} onClick={onMoveUp} size="sm" type="button" variant="ghost">
            Up
          </Button>
          <Button disabled={disabled || isLast} onClick={onMoveDown} size="sm" type="button" variant="ghost">
            Down
          </Button>
          <Button disabled={disabled} onClick={onRemove} size="sm" type="button" variant="ghost">
            Remove
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 max-[640px]:grid-cols-1">
        <ColumnNameEditor control={control} disabled={disabled} fieldPrefix={fieldPrefix} />
        <ColumnTypeEditor control={control} disabled={disabled} fieldPrefix={fieldPrefix} />
      </div>

      <ColumnDefaultValueEditor
        control={control}
        columnType={columnType}
        disabled={disabled}
        enumValues={enumValues}
        fieldPrefix={fieldPrefix}
        maxValue={maxValue}
        minValue={minValue}
        onAddEnumArrayDefaultValue={addEnumArrayDefaultValue}
        onRemoveEnumArrayDefaultValue={removeEnumArrayDefaultValue}
        stepValue={stepValue}
      />

      {supportsNumericBounds && (
        <div className="grid grid-cols-2 gap-2 max-[640px]:grid-cols-1">
          <NumericMetadataInput control={control} disabled={disabled} fieldPrefix={fieldPrefix} label="Min" name="min" />
          <NumericMetadataInput control={control} disabled={disabled} fieldPrefix={fieldPrefix} label="Max" name="max" />
        </div>
      )}

      {supportsStep && (
        <div className="grid grid-cols-1 gap-2">
          <NumericMetadataInput control={control} disabled={disabled} fieldPrefix={fieldPrefix} label="Step" name="step" />
        </div>
      )}

      {supportsMaxChars && (
        <div className="grid grid-cols-1 gap-2">
          <NumericMetadataInput control={control} disabled={disabled} fieldPrefix={fieldPrefix} integer label="Max chars" name="maxChars" />
        </div>
      )}

      {columnType === ColumnType.assetRef && (
        <AssetRefCategoryFilterEditor control={control} disabled={disabled} fieldPrefix={fieldPrefix} />
      )}

      {(columnType === ColumnType.enum || columnType === ColumnType.enumArray) && (
        <PossibleValuesEditor
          disabled={disabled}
          enumValues={enumValues}
          onAddPossibleValue={addPossibleValue}
          onPossibleValueInputChange={(value) => setPossibleValueInput(normalizeSnakeCaseInput(value))}
          onRemovePossibleValue={removePossibleValue}
          possibleValueInput={possibleValueInput}
        />
      )}

      <ColumnFlagsEditor control={control} disabled={disabled} fieldPrefix={fieldPrefix} />
    </div>
  );
};

export default DataSchemaColumnEditor;
