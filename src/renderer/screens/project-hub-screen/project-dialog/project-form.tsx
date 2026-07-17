import { FC } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CreateOrUpdateProject, createOrUpdateProjectSchema } from "../../../../shared/schemas";

export interface ProjectFormProps {
  defaultValues?: CreateOrUpdateProject;
  onSubmit: (data: CreateOrUpdateProject) => void;
  onCancel: () => void;
  disabled?: boolean;
}

const ProjectForm: FC<ProjectFormProps> = (props) => {
  const { onSubmit, onCancel, defaultValues, disabled } = props;

  const {
    register,
    handleSubmit,
    formState: { isValid }
  } = useForm<CreateOrUpdateProject>({
    resolver: zodResolver(createOrUpdateProjectSchema),
    defaultValues
  });

  const canSave = isValid;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input placeholder="Name" {...register("name")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea placeholder="Description" rows={3} {...register("description")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="path">Path</Label>
          <Input {...register("path")} readOnly disabled />
        </div>
      </div>

      <div className="flex flex-row items-center gap-2">
        <Button onClick={onCancel} className="min-w-24" variant="outline" type="button" disabled={disabled}>
          Cancel
        </Button>
        <Button className="min-w-24" type="submit" onClick={handleSubmit(onSubmit)} disabled={!canSave || disabled}>
          Submit
        </Button>
      </div>
    </div>
  );
};

export default ProjectForm;
