import { FC, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import useCreateOrUpdateProjectMutation from "@/hooks/use-create-or-update-project-mutation";
import ProjectForm from "@/screens/project-hub-screen/project-dialog/project-form";
import { Nullish } from "../../../../shared/nullish";
import { isNil } from "lodash";
import fileService from "@/services/file-service";
import { CreateOrUpdateProject } from "../../../../shared/schemas";

const CreateProjectDialogButton: FC = () => {
  const [pendingPath, setPendingPath] = useState<Nullish<string>>();

  const { createOrUpdateProject, isCreateOrUpdateProjectLoading } = useCreateOrUpdateProjectMutation();

  const onOpenProject = async () => {
    const path = await window.electron.openFolderDialog();
    if (isNil(path)) {
      return;
    }

    const maybeExisting = await fileService.tryReadChiselJson(path);
    if (!isNil(maybeExisting)) {
      // Just add the project if already exists
      await createOrUpdateProject(maybeExisting);
      return;
    }
    setPendingPath(path);
  };

  const onCreate = async (input: CreateOrUpdateProject) => {
    await createOrUpdateProject(input);
    setPendingPath(undefined);
  };

  const isOpen = !isNil(pendingPath);

  return (
    <Dialog open={isOpen} onOpenChange={(visible) => !visible && setPendingPath(undefined)}>
      <Button variant="outline" onClick={onOpenProject} disabled={isCreateOrUpdateProjectLoading}>
        Open Project
      </Button>

      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            New Admin
          </DialogTitle>
          <DialogDescription>Add access to another person via email.</DialogDescription>
        </DialogHeader>
        {isOpen && (
          <ProjectForm
            onSubmit={onCreate}
            onCancel={() => setPendingPath(undefined)}
            disabled={isCreateOrUpdateProjectLoading}
            defaultValues={{
              name: "Default",
              path: pendingPath
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectDialogButton;
