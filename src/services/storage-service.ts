import { StorageKeysEnum } from "@/enums/storage-keys-enum"
import { projectHubProjectsSchema, type Project } from "@/shared/schemas"
import { isNil } from "lodash"
class StorageService {
  public async tryGetProjects(): Promise<Project[] | undefined> {
    const raw = localStorage.getItem(StorageKeysEnum.PROJECTS)
    if (isNil(raw)) {
      return undefined
    }
    return projectHubProjectsSchema.parse(JSON.parse(raw))
  }
  public async saveProjects(projects: Project[]): Promise<void> {
    const parsed = projectHubProjectsSchema.parse(projects)
    localStorage.setItem(StorageKeysEnum.PROJECTS, JSON.stringify(parsed))
  }
}
export default new StorageService()
