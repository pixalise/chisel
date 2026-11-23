import sourceStateService from "@/services/source-state-service"
import { createZoraExportBundle, ZORA_EXPORT_ROOT, ZORA_MANIFEST_PATH } from "@/shared/zora-export"
import appStore from "@/stores/app-store"
export interface ExportProjectResult {
  exportedAt: string
  fileCount: number
  manifestPath: string
  outputPath: string
}
class ExportService {
  public async exportProject(): Promise<ExportProjectResult> {
    const project = appStore.getState().computed.project
    const commit = await sourceStateService.getLatestCommit(project)
    if (!commit) {
      throw new Error("Commit the current Chisel source state before exporting Zora data.")
    }
    const committedProject = { ...commit.project, path: project.path }
    const exportedAt = new Date().toISOString()
    const bundle = createZoraExportBundle(
      committedProject,
      commit.tables,
      exportedAt,
      commit.assets.assets,
      commit.localization,
      commit.assetHashes
    )
    await window.electron.writeZoraExport({ projectPath: project.path, ...bundle })
    let fileCount = bundle.files.length
    for (const asset of bundle.assets) {
      if (asset.destination.endsWith(".zpbr")) {
        fileCount += 2
      } else {
        fileCount++
      }
    }
    return {
      exportedAt,
      fileCount,
      manifestPath: ZORA_MANIFEST_PATH,
      outputPath: `${project.path}/${ZORA_EXPORT_ROOT}`,
    }
  }
}
export default new ExportService()
