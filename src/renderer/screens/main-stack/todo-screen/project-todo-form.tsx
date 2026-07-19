import { type FC } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { type FieldValues, type Resolver, useForm } from "react-hook-form";
import ControlledInput from "@/components/controls/controlled-input";
import ControlledSelectInput from "@/components/controls/controlled-select-input";
import { Button } from "@/components/ui/button";
import {
  createOrUpdateProjectTodoSchema,
  type CreateOrUpdateProjectTodo,
  ProjectTodoPriority,
  projectTodoPriorityOptionValues
} from "../../../../shared/project-management";

export interface ProjectTodoFormProps {
  defaultValues?: CreateOrUpdateProjectTodo;
  disabled?: boolean;
  onCancel: () => void;
  onSave: (input: CreateOrUpdateProjectTodo) => void | Promise<void>;
}

const ProjectTodoForm: FC<ProjectTodoFormProps> = (props) => {
  const { defaultValues, disabled, onCancel, onSave } = props;
  const form = useForm<FieldValues>({
    defaultValues: {
      title: defaultValues?.title ?? "",
      priority: defaultValues?.priority ?? ProjectTodoPriority.medium,
      dueDate: defaultValues?.dueDate ?? ""
    },
    mode: "onChange",
    resolver: zodResolver(createOrUpdateProjectTodoSchema as never) as Resolver<FieldValues>
  });
  const canSave = form.formState.isValid && !form.formState.isSubmitting && !disabled;

  async function onSubmit(input: FieldValues): Promise<void> {
    await onSave(createOrUpdateProjectTodoSchema.parse(input));
  }

  return (
    <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
      <ControlledInput control={form.control} disabled={disabled} label="Title" name="title" />
      <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
        <ControlledSelectInput
          control={form.control}
          disabled={disabled}
          label="Priority"
          name="priority"
          options={projectTodoPriorityOptionValues}
        />
        <ControlledInput control={form.control} disabled={disabled} label="Due date" name="dueDate" type="date" />
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

export default ProjectTodoForm;
