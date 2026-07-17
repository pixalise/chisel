import { FC } from "react";
import { Tag } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProjectForm from "@/screens/project-hub-screen/project-dialog/project-form";
import useCreateOrUpdateProjectMutation from "@/hooks/use-create-or-update-project-mutation";
import { CreateOrUpdateProject, Project } from "../../../../shared/schemas";

export interface EditAdminDialogProps {
  project: Project;
  onClose: () => void;
}

const EditProjectDialogButton: FC<EditAdminDialogProps> = (props) => {
  const { project, onClose } = props;
  const { id, name } = project;

  const { createOrUpdateProject, isCreateOrUpdateProjectLoading } = useCreateOrUpdateProjectMutation(id);

  const onUpdate = async (input: CreateOrUpdateProject) => {
    await createOrUpdateProject(input);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(change) => !change && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Update {name}
          </DialogTitle>
          <DialogDescription>Update the {name}.</DialogDescription>
        </DialogHeader>
        <ProjectForm onSubmit={onUpdate} onCancel={onClose} defaultValues={project} disabled={isCreateOrUpdateProjectLoading} />
      </DialogContent>
    </Dialog>
  );
};

export default EditProjectDialogButton;
