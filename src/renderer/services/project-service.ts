import PStorage from "@/utils/pstorage";
import { StorageKeysEnum } from "@/constants/storage-keys-enum";
import { zodParse } from "@/utils/zod-parse";
import fileService from "@/services/file-service";
import { CreateOrUpdateProject, createOrUpdateProjectSchema, Project, projectSchema } from "../../shared/schemas";

class ProjectService {
  public async listAllProjects(): Promise<Project[]> {
    const projects = await PStorage.get<Project[]>(StorageKeysEnum.projects);
    return (projects ?? []).map((project) => zodParse(projectSchema, project));
  }

  public async createOrUpdateProject(id: string, input: CreateOrUpdateProject): Promise<Project> {
    const parsedInput = zodParse(createOrUpdateProjectSchema, input);
    const projects = await this.listAllProjects();
    const project = zodParse(projectSchema, {
      id,
      ...parsedInput
    });

    const index = projects.findIndex((p) => p.id === id);
    if (index === -1) {
      projects.push(project);
    } else {
      projects[index] = project;
    }

    await PStorage.set(StorageKeysEnum.projects, projects);
    await fileService.writeChiselJson(project);
    await fileService.writeChiselGitignore(project);
    return project;
  }

  public async removeProjectFromHub(id: string): Promise<void> {
    const projects = await this.listAllProjects();
    await PStorage.set(
      StorageKeysEnum.projects,
      projects.filter((p) => p.id !== id)
    );
  }
}

const projectService = new ProjectService();
export default projectService;
