import ProjectForm from "@/components/projects/project-dialog/project-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import useCreateOrUpdateProjectMutation from "@/hooks/use-create-or-update-project-mutation"
import fileService from "@/services/file-service"
import type { Nullish } from "@/shared/nullish"
import type { CreateOrUpdateProject } from "@/shared/schemas"
import { isNil } from "lodash"
import { ShieldCheck } from "lucide-react"
import type { FC } from "react"
import { useState } from "react"
const CreateProjectDialogButton: FC = () => {
  const [pendingPath, setPendingPath] = useState<Nullish<string>>()
  const { createOrUpdateProject, isCreateOrUpdateProjectLoading } =
    useCreateOrUpdateProjectMutation()
  const onOpenProject = async () => {
    const path = await window.electron.openFolderDialog()
    if (isNil(path)) {
      return
    }
    const maybeExisting = await fileService.tryReadChiselJson(path)
    if (!isNil(maybeExisting)) {
      // Just add the project if already exists
      await createOrUpdateProject(maybeExisting)
      return
    }
    setPendingPath(path)
  }
  const onCreate = async (input: CreateOrUpdateProject) => {
    await createOrUpdateProject(input)
    setPendingPath(undefined)
  }
  const isOpen = !isNil(pendingPath)
  return (
    <Dialog open={isOpen} onOpenChange={(visible) => !visible && setPendingPath(undefined)}>
      <Button variant="outline" onClick={onOpenProject} disabled={isCreateOrUpdateProjectLoading}>
        Open Project
      </Button>

      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Create Project
          </DialogTitle>
          <DialogDescription>Name the Roblox project in the selected folder.</DialogDescription>
        </DialogHeader>
        {isOpen && (
          <ProjectForm
            onSubmit={onCreate}
            onCancel={() => setPendingPath(undefined)}
            disabled={isCreateOrUpdateProjectLoading}
            defaultValues={{
              name: "Default",
              path: pendingPath,
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
export default CreateProjectDialogButton
