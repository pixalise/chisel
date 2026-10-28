import fileService from "@/services/file-service"
import storageService from "@/services/storage-service"
import type { CreateOrUpdateProject, Project } from "@/shared/schemas"
import { createOrUpdateProjectSchema, projectSchema } from "@/shared/schemas"
class ProjectService {
  public async listAllProjects(): Promise<Project[]> {
    return (await storageService.tryGetProjects()) ?? []
  }
  public async createOrUpdateProject(id: string, input: CreateOrUpdateProject): Promise<Project> {
    const parsedInput = createOrUpdateProjectSchema.parse(input)
    const projects = await this.listAllProjects()
    const project = projectSchema.parse({
      id,
      ...parsedInput,
    })
    const index = projects.findIndex((p) => p.id === id)
    if (index === -1) {
      projects.push(project)
    } else {
      projects[index] = project
    }
    await storageService.saveProjects(projects)
    await fileService.writeChiselJson(project)
    await fileService.writeChiselGitignore(project)
    return project
  }
  public async removeProjectFromHub(id: string): Promise<void> {
    const projects = await this.listAllProjects()
    await storageService.saveProjects(projects.filter((p) => p.id !== id))
  }
}
const projectService = new ProjectService()
export default projectService
