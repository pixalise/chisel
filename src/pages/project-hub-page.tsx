import LoadingScreen from "@/components/layout/loading-screen"
import { Section } from "@/components/layout/section"
import ProjectCard from "@/components/projects/project-card"
import CreateProjectDialogButton from "@/components/projects/project-dialog/create-project-dialog-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import useProjectsQuery from "@/hooks/use-projects-query"
import type { Nullish } from "@/shared/nullish"
import type { Project } from "@/shared/schemas"
import useAppStore from "@/stores/app-store"
import { isEmpty, isNil } from "lodash"
import type { FC } from "react"
import { useState } from "react"
const ProjectHubPage: FC = () => {
  const { projects, isLoading } = useProjectsQuery()
  const { setProject } = useAppStore()
  const [selectedProject, setSelectedProject] = useState<Nullish<Project>>()
  const onSetSelected = (project: Project) => {
    if (selectedProject?.id === project.id) {
      setSelectedProject(undefined)
      return
    }
    setSelectedProject(project)
  }
  const onContinue = () => {
    setProject(selectedProject!)
  }
  if (isLoading) {
    return <LoadingScreen />
  }
  return (
    <main className="w-screen h-screen flex items-center justify-center">
      <Card className="w-[36rem]">
        <CardContent className="pt-6">
          <Section title="Project Hub" copy="Select a Chisel project to be loaded.">
            <div className="space-y-2">
              <div className="space-y-2 overflow-y-auto bg-background p-2 max-h-48">
                {isEmpty(projects) && (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    No projects yet. Open a folder to create one.
                  </p>
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
            </div>
          </Section>
        </CardContent>
      </Card>
    </main>
  )
}
export default ProjectHubPage
