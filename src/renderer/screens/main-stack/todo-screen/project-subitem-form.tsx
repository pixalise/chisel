import { type FC } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { type FieldValues, type Resolver, useForm } from "react-hook-form";
import ControlledInput from "@/components/controls/controlled-input";
import { Button } from "@/components/ui/button";
import { createOrUpdateProjectSubitemSchema, type CreateOrUpdateProjectSubitem } from "../../../../shared/project-management";

export interface ProjectSubitemFormProps {
  defaultValues?: CreateOrUpdateProjectSubitem;
  disabled?: boolean;
  onCancel: () => void;
  onSave: (input: CreateOrUpdateProjectSubitem) => void | Promise<void>;
}

const ProjectSubitemForm: FC<ProjectSubitemFormProps> = (props) => {
  const { defaultValues, disabled, onCancel, onSave } = props;
  const form = useForm<FieldValues>({
    defaultValues: {
      title: defaultValues?.title ?? ""
    },
    mode: "onChange",
    resolver: zodResolver(createOrUpdateProjectSubitemSchema as never) as Resolver<FieldValues>
  });
  const canSave = form.formState.isValid && !form.formState.isSubmitting && !disabled;

  async function onSubmit(input: FieldValues): Promise<void> {
    await onSave(createOrUpdateProjectSubitemSchema.parse(input));
  }

  return (
    <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
      <ControlledInput control={form.control} disabled={disabled} label="Title" name="title" />
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

export default ProjectSubitemForm;
