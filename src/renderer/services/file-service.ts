import { Nullish } from "../../shared/nullish";
import { zodParse } from "@/utils/zod-parse";
import { isNil } from "lodash";
import type { FileMetadata } from "../../shared/types";
import {
  AssetsJson,
  assetsJsonSchema,
  DataTableJson,
  dataTableJsonSchema,
  Project,
  projectFileSchema,
  projectSchema,
  TableRowsJson,
  TablesJson
} from "../../shared/schemas";
import useAppStore from "@/stores/app-store";
import { nanoid } from "nanoid";

enum FilePathEnum {
  chiselJson = "chisel.json",
  gitignore = ".gitignore",
  tablesJson = "tables.json",
  assetsJson = "assets.json"
}

class FileService {
  private async writeJsonFile(path: string, value: unknown): Promise<void> {
    await window.electron.writeFile(path, value);
  }

  private fileNameFromPath(path: string): string {
    return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
  }

  public async tryReadFile<TData>(path: string): Promise<TData | null> {
    return window.electron.tryReadFile<TData>(path);
  }

  private async tryReadJsonFile<TData>(path: string): Promise<Nullish<TData>> {
    const data = await this.tryReadFile<TData>(path);
    if (isNil(data)) {
      return undefined;
    }

    return data;
  }

  public async writeChiselJson(project: Project): Promise<void> {
    await this.writeJsonFile(this.fullPath(project.path, FilePathEnum.chiselJson), zodParse(projectFileSchema, project));
  }

  public async writeProjectTextFile(project: Project, relativePath: string, value: string): Promise<void> {
    await window.electron.writeTextFile(this.projectRelativePath(project.path, relativePath), value);
  }

  public async writeChiselGitignore(project: Project): Promise<void> {
    await window.electron.ensureGitignoreEntry(this.fullPath(project.path, FilePathEnum.gitignore), ".tmp");
  }

  public async tryReadChiselJson(path: string): Promise<Nullish<Project>> {
    const data = await this.tryReadJsonFile<unknown>(this.fullPath(path, FilePathEnum.chiselJson));
    if (isNil(data)) {
      return undefined;
    }

    return zodParse(projectSchema, { ...zodParse(projectFileSchema, data), path });
  }

  public async writeTablesJson(project: Project, value: TablesJson): Promise<void> {
    await this.writeJsonFile(this.fullPath(project.path, FilePathEnum.tablesJson), value);
  }

  public async writeUserTableJson(project: Project, tableId: string, value: DataTableJson): Promise<void> {
    await this.writeJsonFile(this.fullPath(project.path, this.userTableJsonPath(tableId)), zodParse(dataTableJsonSchema, value));
  }

  public async writeUserTableSchemaBackupJson(project: Project, tableId: string, timestamp: string, value: DataTableJson): Promise<void> {
    await this.writeJsonFile(
      this.fullPath(project.path, this.userTableSchemaBackupJsonPath(tableId, timestamp)),
      zodParse(dataTableJsonSchema, value)
    );
  }

  public async deleteUserTableJson(project: Project, tableId: string): Promise<void> {
    await window.electron.deleteFile(this.fullPath(project.path, this.userTableJsonPath(tableId)));
  }

  public async writeSystemTableDataJson(project: Project, tableId: string, value: DataTableJson): Promise<void> {
    await this.writeJsonFile(this.fullPath(project.path, this.systemTableDataJsonPath(tableId)), zodParse(dataTableJsonSchema, value));
  }

  public async tryReadSystemTableDataJson(path: string, tableId: string): Promise<Nullish<DataTableJson>> {
    const data = await this.tryReadJsonFile<DataTableJson>(this.fullPath(path, this.systemTableDataJsonPath(tableId)));
    if (isNil(data)) {
      return undefined;
    }

    return zodParse(dataTableJsonSchema, data);
  }

  public async tryReadTablesJson(path: string): Promise<Nullish<TablesJson>> {
    return this.tryReadJsonFile<TablesJson>(this.fullPath(path, FilePathEnum.tablesJson));
  }

  public async writeTableRowsJson(project: Project, tableId: string, value: TableRowsJson): Promise<void> {
    await this.writeJsonFile(this.fullPath(project.path, this.tableRowsJsonPath(tableId)), value);
  }

  public async tryReadTableRowsJson(path: string, tableId: string): Promise<Nullish<TableRowsJson>> {
    return this.tryReadJsonFile<TableRowsJson>(this.fullPath(path, this.tableRowsJsonPath(tableId)));
  }

  public async writeAssetsJson(project: Project, value: AssetsJson): Promise<void> {
    await this.writeJsonFile(this.fullPath(project.path, FilePathEnum.assetsJson), zodParse(assetsJsonSchema, value));
  }

  public async tryReadAssetsJson(path: string): Promise<Nullish<AssetsJson>> {
    const data = await this.tryReadJsonFile<AssetsJson>(this.fullPath(path, FilePathEnum.assetsJson));
    if (isNil(data)) {
      return undefined;
    }

    return zodParse(assetsJsonSchema, data);
  }

  public async copyProjectFile(project: Project, sourcePath: string, relativePath: string): Promise<void> {
    await window.electron.copyFile(sourcePath, this.projectRelativePath(project.path, relativePath));
  }

  public async writePngFile(path: string, dataUrl: string): Promise<void> {
    await window.electron.writePngFile(path, dataUrl);
  }

  public async createTemporaryFile(dataUrl: string): Promise<{ cleanup: () => void; temporaryPath: string }> {
    const temporaryPath = this.fullPath(useAppStore.getState().computed.project.path, `/.tmp/${nanoid()}.png`);
    console.log(`Temporary path: ${temporaryPath}`);
    await this.writePngFile(temporaryPath, dataUrl);
    return {
      temporaryPath,
      cleanup: () => {
        window.electron.deleteFile(temporaryPath);
      }
    };
  }

  public async deleteProjectFile(project: Project, relativePath: string): Promise<void> {
    await window.electron.deleteFile(this.projectRelativePath(project.path, relativePath));
  }

  public async getFileMetadata(sourcePath: string): Promise<FileMetadata> {
    return window.electron.getFileMetadata(sourcePath);
  }

  private fullPath(path: string, filePath: string): string {
    return `${path}/.chisel/${filePath}`;
  }

  private projectRelativePath(path: string, relativePath: string): string {
    return `${path}/${relativePath}`;
  }

  private tableRowsJsonPath(tableId: string): string {
    if (!/^[A-Za-z0-9_-]+$/.test(tableId)) {
      throw new Error(`Invalid table id '${tableId}'`);
    }
    return `tables/${tableId}_rows.json`;
  }

  private userTableJsonPath(tableId: string): string {
    return `tables/user/${this.tableJsonFileName(tableId)}`;
  }

  private userTableSchemaBackupJsonPath(tableId: string, timestamp: string): string {
    return `tables/user/backups/${this.tablePathSegment(tableId)}/${this.tableJsonFileName(timestamp)}`;
  }

  private systemTableDataJsonPath(tableId: string): string {
    return `tables/system/${this.tableJsonFileName(tableId)}`;
  }

  private tablePathSegment(tableId: string): string {
    const normalizedTableId = tableId.endsWith(".json") ? tableId.slice(0, -5) : tableId;
    if (!/^[A-Za-z0-9_-]+$/.test(normalizedTableId)) {
      throw new Error(`Invalid table id '${tableId}'`);
    }
    return normalizedTableId;
  }

  private tableJsonFileName(tableId: string): string {
    return `${this.tablePathSegment(tableId)}.json`;
  }
}

const fileService = new FileService();
export default fileService;
