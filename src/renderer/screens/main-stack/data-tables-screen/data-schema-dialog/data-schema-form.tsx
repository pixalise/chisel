import { type FC } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { nanoid } from "nanoid";
import { type FieldValues, type Resolver, useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import ControlledInput from "@/components/controls/controlled-input";
import ControlledTextarea from "@/components/controls/controlled-textarea";
import { createOrUpdateUserTableSchema, type CreateOrUpdateTable } from "../../../../../shared/schemas";
import { ColumnType } from "../../../../../shared/types";
import DataSchemaColumnEditor from "./fields/data-schema-column-editor";
import { createDefaultValueForColumnType } from "./fields/data-schema-column-utils";

export interface DataSchemaFormProps {
  defaultValues?: CreateOrUpdateTable;
  disabled?: boolean;
  onCancel?: () => void;
  onSave: (input: CreateOrUpdateTable) => void | Promise<void>;
}

const createDefaultData = (): CreateOrUpdateTable => ({
  columns: [
    {
      defaultValue: createDefaultValueForColumnType(ColumnType.id),
      id: nanoid(),
      type: ColumnType.id,
      name: "id",
      required: true,
      unique: true
    }
  ],
  description: "",
  name: "New Table"
});

const DataSchemaForm: FC<DataSchemaFormProps> = (props) => {
  const { defaultValues, disabled, onCancel, onSave } = props;
  const form = useForm<FieldValues>({
    defaultValues: defaultValues ?? createDefaultData(),
    mode: "onChange",
    resolver: zodResolver(createOrUpdateUserTableSchema as never) as Resolver<FieldValues>
  });
  const columns = useFieldArray({
    control: form.control,
    name: "columns"
  });

  const canSave = form.formState.isValid && !form.formState.isSubmitting && !disabled;

  function addColumn(): void {
    columns.append({
      defaultValue: createDefaultValueForColumnType(ColumnType.string),
      id: nanoid(),
      name: "name",
      required: true,
      type: ColumnType.string,
      unique: false
    });
  }

  async function onSubmit(input: FieldValues): Promise<void> {
    await onSave(createOrUpdateUserTableSchema.parse(input));
  }

  return (
    <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
      <ControlledInput control={form.control} disabled={disabled} label="Table name" name="name" />
      <ControlledTextarea
        control={form.control}
        description="Describe what this table stores and how it is exported."
        disabled={disabled}
        label="Description"
        name="description"
        rows={3}
      />

      <div className="space-y-2 border border-border p-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <strong className="block text-sm">Columns</strong>
            <span className="block text-xs text-muted-foreground">{columns.fields.length} definitions</span>
          </div>
          <Button disabled={disabled} onClick={addColumn} type="button" variant="outline">
            Add Column
          </Button>
        </div>

        <div className="max-h-[44vh] space-y-2 overflow-y-auto pr-1">
          {columns.fields.map((column, index) => (
            <DataSchemaColumnEditor
              control={form.control}
              disabled={disabled}
              index={index}
              isFirst={index === 0}
              isLast={index === columns.fields.length - 1}
              key={column.id}
              onMoveDown={() => columns.move(index, index + 1)}
              onMoveUp={() => columns.move(index, index - 1)}
              onRemove={() => columns.remove(index)}
              setValue={form.setValue}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-row items-center gap-2">
        <Button className="min-w-24" disabled={disabled || form.formState.isSubmitting} onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        <Button className="min-w-24" disabled={!canSave} type="submit">
          Save
        </Button>
      </div>
    </form>
  );
};

export default DataSchemaForm;
