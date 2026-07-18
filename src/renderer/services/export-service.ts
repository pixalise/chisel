import { createGodotExportBundle } from "../../shared/godot-export";
import { validatedDataTableSchema } from "../../shared/schemas";
import appStore from "@/stores/app-store";
import fileService from "@/services/file-service";
import tableService from "@/services/table-service";

export interface ExportProjectResult {
  exportedAt: string;
  fileCount: number;
  manifestPath: string;
  outputPath: string;
}

class ExportService {
  public async exportProject(): Promise<ExportProjectResult> {
    const project = appStore.getState().computed.project;
    const exportedAt = new Date().toISOString();
    const tables = (await tableService.listAllTables()).map((table) => validatedDataTableSchema.parse(table));
    const bundle = createGodotExportBundle(project, tables, exportedAt);

    await Promise.all(bundle.files.map((file) => fileService.writeProjectTextFile(project, file.path, file.content)));

    return {
      exportedAt,
      fileCount: bundle.files.length,
      manifestPath: "game_data/manifest.gd",
      outputPath: `${project.path}/game_data`
    };
  }
}

const exportService = new ExportService();
export default exportService;
