import { FC, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import useProjectsQuery from "@/hooks/use-projects-query";
import SplashScreen from "@/screens/splash-screen";
import CreateProjectDialogButton from "@/screens/project-hub-screen/project-dialog/create-project-dialog-button";
import ProjectCard from "@/screens/project-hub-screen/project-card";
import { isEmpty, isNil } from "lodash";
import { Project } from "../../../shared/schemas";
import { Nullish } from "../../../shared/nullish";
import { Button } from "@/components/ui/button";
import useAppStore from "@/stores/app-store";

const ProjectHubScreen: FC = () => {
  const { projects, isLoading } = useProjectsQuery();
  const { setProject } = useAppStore();
  const [selectedProject, setSelectedProject] = useState<Nullish<Project>>();

  const onSetSelected = (project: Project) => {
    if (selectedProject?.id === project.id) {
      setSelectedProject(undefined);
      return;
    }

    setSelectedProject(project);
  };

  const onContinue = () => {
    setProject(selectedProject!);
  };

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <main className="w-screen h-screen flex items-center justify-center">
      <Card className="w-[36rem]">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl tracking-tight">Project Hub</h1>
          </CardTitle>
          <CardDescription>Select a Chisel project to be loaded.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-2 overflow-y-auto bg-background p-2 max-h-48">
            {isEmpty(projects) && (
              <p className="p-4 text-center text-sm text-muted-foreground">No projects yet. Open a folder to create one.</p>
            )}
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                isSelected={selectedProject?.id === project.id}
                onSelect={() => onSetSelected(project)}
                project={project}
                onRemove={() => setSelectedProject(undefined)}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <CreateProjectDialogButton />
            <Button onClick={onContinue} disabled={isNil(selectedProject)}>
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};
export default ProjectHubScreen;
