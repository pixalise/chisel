import { createRobloxExportBundle, ROBLOX_EXPORT_ROOT, ROBLOX_MANIFEST_PATH } from "../../shared/roblox-export";
import appStore from "@/stores/app-store";
import sourceStateService from "@/services/source-state-service";

export interface ExportProjectResult {
  exportedAt: string;
  fileCount: number;
  manifestPath: string;
  outputPath: string;
}

class ExportService {
  public async exportProject(): Promise<ExportProjectResult> {
    const project = appStore.getState().computed.project;
    const commit = await sourceStateService.getLatestCommit();
    if (!commit) throw new Error("Commit the current Chisel source state before exporting Roblox data.");
    const committedProject = { ...commit.project, path: project.path };
    const exportedAt = new Date().toISOString();
    const bundle = createRobloxExportBundle(committedProject, commit.tables, exportedAt, commit.assets.assets, commit.localization);
    await window.electron.writeRobloxExport({ projectPath: project.path, files: bundle.files });
    return {
      exportedAt,
      fileCount: bundle.files.length,
      manifestPath: ROBLOX_MANIFEST_PATH,
      outputPath: `${project.path}/${ROBLOX_EXPORT_ROOT}`
    };
  }
}

export default new ExportService();
