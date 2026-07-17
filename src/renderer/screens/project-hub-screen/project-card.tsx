import { Project } from "../../../shared/schemas";
import EditProjectDialogButton from "@/screens/project-hub-screen/project-dialog/edit-project-dialog-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FolderOpen, Pencil, X } from "lucide-react";
import { FC, Fragment, useState } from "react";
import { isNil } from "lodash";
import { cn } from "@/lib/utils";
import useRemoveProjectFromHubMutation from "@/hooks/use-remove-project-from-hub-mutation";

export interface ProjectCardProps {
  project: Project;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

const ProjectCard: FC<ProjectCardProps> = (props) => {
  const { project, isSelected, onSelect, onRemove } = props;
  const { name, description, path } = project;
  const [isEditing, setIsEditing] = useState(false);

  const { removeProjectFromHub, isRemoveProjectFromHubLoading } = useRemoveProjectFromHubMutation(project.id);

  const onRemoveProject = async () => {
    onRemove();
    await removeProjectFromHub();
  };

  return (
    <Fragment>
      <Card
        className={cn(
          "p-2 flex flex-row items-center justify-between cursor-pointer",
          !isSelected && "hover:bg-accent",
          isSelected && "border-primary"
        )}
        onClick={onSelect}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            <p className="font-bold">{name}</p>
          </div>
          {!isNil(description) && <p className="text-xs">{description}</p>}
          <p className="text-xs text-muted-foreground">{path}</p>
        </div>

        <div className="flex flex-row items-center space-x-2">
          <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} disabled={isRemoveProjectFromHubLoading}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={() => confirm(`Do you really want to remove ${project.id} from hub?`) && onRemoveProject()}
            disabled={isRemoveProjectFromHubLoading}
          >
            <X />
          </Button>
        </div>
      </Card>

      {isEditing && <EditProjectDialogButton project={project} onClose={() => setIsEditing(false)} />}
    </Fragment>
  );
};
export default ProjectCard;
