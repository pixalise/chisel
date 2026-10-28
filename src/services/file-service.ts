import { localizationDocumentSchema, type LocalizationDocument } from "@/shared/localization"
import type { Nullish } from "@/shared/nullish"
import {
  projectManagementJsonSchema,
  type ProjectManagementJson,
} from "@/shared/project-management"
import type { AssetsJson, DataTableJson, Project, TablesJson } from "@/shared/schemas"
import {
  assetsJsonSchema,
  dataTableJsonSchema,
  projectFileSchema,
  projectSchema,
} from "@/shared/schemas"
import { sourceStateJsonSchema, type SourceStateJson } from "@/shared/source-state"
import type { FileMetadata } from "@/shared/types"
import { isNil } from "lodash"
import { FilePathEnum } from "../enums/file-path-enum"
class FileService {
  private async writeJsonFile(path: string, value: unknown): Promise<void> {
    await window.electron.writeFile(path, value)
  }
  public async tryReadFile<TData>(path: string): Promise<TData | null> {
    return window.electron.tryReadFile<TData>(path)
  }
  private async tryReadJsonFile<TData>(path: string): Promise<Nullish<TData>> {
    const data = await this.tryReadFile<TData>(path)
    if (isNil(data)) {
      return undefined
    }
    return data
  }
  public async writeChiselJson(project: Project): Promise<void> {
    await this.writeJsonFile(
      this.fullPath(project.path, FilePathEnum.CHISEL_JSON),
      projectFileSchema.parse(project)
    )
  }
  public async writeChiselGitignore(project: Project): Promise<void> {
    await window.electron.ensureGitignoreEntry(
      this.fullPath(project.path, FilePathEnum.GITIGNORE),
      "/tmp"
    )
  }
  public async tryReadChiselJson(path: string): Promise<Nullish<Project>> {
    const data = await this.tryReadJsonFile<unknown>(this.fullPath(path, FilePathEnum.CHISEL_JSON))
    if (isNil(data)) {
      return undefined
    }
    return projectSchema.parse({ ...projectFileSchema.parse(data), path })
  }
  public async writeTablesJson(project: Project, value: TablesJson): Promise<void> {
    await this.writeJsonFile(this.fullPath(project.path, FilePathEnum.TABLES_JSON), value)
  }
  public async writeUserTableJson(
    project: Project,
    tableId: string,
    value: DataTableJson
  ): Promise<void> {
    await this.writeJsonFile(
      this.fullPath(project.path, this.userTableJsonPath(tableId)),
      dataTableJsonSchema.parse(value)
    )
  }
  public async writeUserTableSchemaBackupJson(
    project: Project,
    tableId: string,
    timestamp: string,
    value: DataTableJson
  ): Promise<void> {
    await this.writeJsonFile(
      this.fullPath(project.path, this.userTableSchemaBackupJsonPath(tableId, timestamp)),
      dataTableJsonSchema.parse(value)
    )
  }
  public async deleteUserTableJson(project: Project, tableId: string): Promise<void> {
    await window.electron.deleteFile(this.fullPath(project.path, this.userTableJsonPath(tableId)))
  }
  public async tryReadTablesJson(path: string): Promise<Nullish<TablesJson>> {
    return this.tryReadJsonFile<TablesJson>(this.fullPath(path, FilePathEnum.TABLES_JSON))
  }
  public async writeAssetsJson(project: Project, value: AssetsJson): Promise<void> {
    await this.writeJsonFile(
      this.fullPath(project.path, FilePathEnum.ASSETS_JSON),
      assetsJsonSchema.parse(value)
    )
  }
  public async tryReadAssetsJson(path: string): Promise<Nullish<AssetsJson>> {
    const data = await this.tryReadJsonFile<AssetsJson>(
      this.fullPath(path, FilePathEnum.ASSETS_JSON)
    )
    if (isNil(data)) {
      return undefined
    }
    return assetsJsonSchema.parse(data)
  }
  public async writeProjectManagementJson(
    project: Project,
    value: ProjectManagementJson
  ): Promise<void> {
    await this.writeJsonFile(
      this.fullPath(project.path, FilePathEnum.PROJECT_MANAGEMENT_JSON),
      projectManagementJsonSchema.parse(value)
    )
  }
  public async tryReadProjectManagementJson(path: string): Promise<Nullish<ProjectManagementJson>> {
    const data = await this.tryReadJsonFile<ProjectManagementJson>(
      this.fullPath(path, FilePathEnum.PROJECT_MANAGEMENT_JSON)
    )
    if (isNil(data)) {
      return undefined
    }
    return projectManagementJsonSchema.parse(data)
  }
  public async writeLocalizationJson(project: Project, value: LocalizationDocument): Promise<void> {
    await this.writeJsonFile(
      this.fullPath(project.path, FilePathEnum.LOCALIZATION_JSON),
      localizationDocumentSchema.parse(value)
    )
  }
  public async tryReadLocalizationJson(path: string): Promise<Nullish<LocalizationDocument>> {
    const data = await this.tryReadJsonFile<LocalizationDocument>(
      this.fullPath(path, FilePathEnum.LOCALIZATION_JSON)
    )
    if (isNil(data)) {
      return undefined
    }
    return localizationDocumentSchema.parse(data)
  }
  public async writeSourceStateJson(project: Project, value: SourceStateJson): Promise<void> {
    await this.writeJsonFile(
      this.fullPath(project.path, FilePathEnum.SOURCE_STATE_JSON),
      sourceStateJsonSchema.parse(value)
    )
  }
  public async tryReadSourceStateJson(path: string): Promise<Nullish<SourceStateJson>> {
    const data = await this.tryReadJsonFile<unknown>(
      this.fullPath(path, FilePathEnum.SOURCE_STATE_JSON)
    )
    if (isNil(data)) {
      return undefined
    }
    return sourceStateJsonSchema.parse(data)
  }
  public async copyProjectFile(
    project: Project,
    sourcePath: string,
    relativePath: string
  ): Promise<void> {
    await window.electron.copyFile(sourcePath, this.projectRelativePath(project.path, relativePath))
  }
  public async deleteProjectFile(project: Project, relativePath: string): Promise<void> {
    await window.electron.deleteFile(this.projectRelativePath(project.path, relativePath))
  }
  public async getFileMetadata(sourcePath: string): Promise<FileMetadata> {
    return window.electron.getFileMetadata(sourcePath)
  }
  private fullPath(path: string, filePath: string): string {
    return `${path}/.chisel/${filePath}`
  }
  private projectRelativePath(path: string, relativePath: string): string {
    return `${path}/${relativePath}`
  }
  private userTableJsonPath(tableId: string): string {
    return `tables/user/${this.tableJsonFileName(tableId)}`
  }
  private userTableSchemaBackupJsonPath(tableId: string, timestamp: string): string {
    return `tables/user/backups/${this.tablePathSegment(tableId)}/${this.tableJsonFileName(timestamp)}`
  }
  private tablePathSegment(tableId: string): string {
    const normalizedTableId = tableId.endsWith(".json") ? tableId.slice(0, -5) : tableId
    if (!/^[A-Za-z0-9_-]+$/.test(normalizedTableId)) {
      throw new Error(`Invalid table id '${tableId}'`)
    }
    return normalizedTableId
  }
  private tableJsonFileName(tableId: string): string {
    return `${this.tablePathSegment(tableId)}.json`
  }
}
const fileService = new FileService()
export default fileService
