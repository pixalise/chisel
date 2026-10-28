import assetService from "@/services/asset-service"
import fileService from "@/services/file-service"
import localizationService from "@/services/localization-service"
import tableService from "@/services/table-service"
import { assetsJsonSchema, projectFileSchema, type Project } from "@/shared/schemas"
import {
  committedSourceSnapshotSchema,
  emptySourceStateJson,
  sourceStateJsonSchema,
  type CommittedSourceSnapshot,
  type SourceStateJson,
} from "@/shared/source-state"
import appStore from "@/stores/app-store"
import { nanoid } from "nanoid"
const maxCommitCount = 20
class SourceStateService {
  public async listCommits(
    project: Project = appStore.getState().computed.project
  ): Promise<CommittedSourceSnapshot[]> {
    return (await this.readSourceState(project)).commits
  }
  public async getLatestCommit(
    project: Project = appStore.getState().computed.project
  ): Promise<CommittedSourceSnapshot | undefined> {
    return (await this.listCommits(project))[0]
  }
  public async commitDraft(): Promise<CommittedSourceSnapshot> {
    const project = appStore.getState().computed.project
    const [tables, assets, localization] = await Promise.all([
      tableService.listAllTables(),
      assetService.getAllAssets(),
      localizationService.readLocalization(),
    ])
    const commit = committedSourceSnapshotSchema.parse({
      id: nanoid(),
      committedAt: new Date().toISOString(),
      project: projectFileSchema.parse(project),
      tables,
      assets: assetsJsonSchema.parse({
        schemaVersion: 1,
        assets,
      }),
      localization,
    })
    const sourceState = await this.readSourceState()
    await this.writeSourceState({
      schemaVersion: 3,
      commits: [commit, ...sourceState.commits].slice(0, maxCommitCount),
    })
    return commit
  }
  public async rollbackToCommit(commitId: string): Promise<CommittedSourceSnapshot> {
    const sourceState = await this.readSourceState()
    const commit = sourceState.commits.find((entry) => entry.id === commitId)
    if (!commit) {
      throw new Error(`Committed source state ${commitId} does not exist`)
    }
    const currentProject = appStore.getState().computed.project
    const restoredProject: Project = {
      ...commit.project,
      path: currentProject.path,
    }
    await fileService.writeChiselJson(restoredProject)
    await fileService.writeTablesJson(restoredProject, {
      schemaVersion: 1,
      tables: commit.tables,
    })
    await Promise.all(
      commit.tables.map((table) =>
        fileService.writeUserTableJson(restoredProject, table.id, { schemaVersion: 1, table })
      )
    )
    await fileService.writeAssetsJson(restoredProject, commit.assets)
    await fileService.writeLocalizationJson(restoredProject, commit.localization)
    appStore.getState().setProject(restoredProject)
    return commit
  }
  private async readSourceState(
    project: Project = appStore.getState().computed.project
  ): Promise<SourceStateJson> {
    return (await fileService.tryReadSourceStateJson(project.path)) ?? emptySourceStateJson
  }
  private async writeSourceState(value: SourceStateJson): Promise<void> {
    await fileService.writeSourceStateJson(
      appStore.getState().computed.project,
      sourceStateJsonSchema.parse(value)
    )
  }
}
const sourceStateService = new SourceStateService()
export default sourceStateService
