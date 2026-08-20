import { nanoid } from "nanoid";
import BaseService from "@/services/base-service";
import assetService from "@/services/asset-service";
import fileService from "@/services/file-service";
import localizationService from "@/services/localization-service";
import tableService from "@/services/table-service";
import appStore from "@/stores/app-store";
import { zodParse } from "@/utils/zod-parse";
import { assetsJsonSchema, projectFileSchema, type Project } from "../../shared/schemas";
import {
  committedSourceSnapshotSchema,
  emptySourceStateJson,
  sourceStateJsonSchema,
  type CommittedSourceSnapshot,
  type SourceStateJson
} from "../../shared/source-state";

const maxCommitCount = 20;

class SourceStateService extends BaseService {
  public async listCommits(): Promise<CommittedSourceSnapshot[]> {
    return (await this.readSourceState()).commits;
  }

  public async getLatestCommit(): Promise<CommittedSourceSnapshot | undefined> {
    await assetService.getAllAssets();
    return (await this.listCommits())[0];
  }

  public async commitDraft(): Promise<CommittedSourceSnapshot> {
    const project = appStore.getState().computed.project;
    const [tables, assets, localization] = await Promise.all([
      tableService.listAllTables(),
      assetService.getAllAssets(),
      localizationService.readLocalization()
    ]);
    const commit = zodParse(committedSourceSnapshotSchema, {
      id: nanoid(),
      committedAt: new Date().toISOString(),
      project: zodParse(projectFileSchema, project),
      tables,
      assets: zodParse(assetsJsonSchema, {
        schemaVersion: 1,
        assets
      }),
      localization
    });
    const sourceState = await this.readSourceState();
    await this.writeSourceState({
      schemaVersion: 3,
      commits: [commit, ...sourceState.commits].slice(0, maxCommitCount)
    });
    return commit;
  }

  public async rollbackToCommit(commitId: string): Promise<CommittedSourceSnapshot> {
    const sourceState = await this.readSourceState();
    const commit = sourceState.commits.find((entry) => entry.id === commitId);
    if (!commit) {
      throw new Error(`Committed source state ${commitId} does not exist`);
    }

    const currentProject = appStore.getState().computed.project;
    const restoredProject: Project = {
      ...commit.project,
      path: currentProject.path
    };
    const userTables = commit.tables.filter((table) => !table.isSystemTable);
    const systemTables = commit.tables.filter((table) => table.isSystemTable);

    await fileService.writeChiselJson(restoredProject);
    await fileService.writeTablesJson(restoredProject, {
      schemaVersion: 1,
      tables: userTables
    });
    await Promise.all(userTables.map((table) => fileService.writeUserTableJson(restoredProject, table.id, { schemaVersion: 1, table })));
    await Promise.all(
      systemTables.map((table) => fileService.writeSystemTableDataJson(restoredProject, table.id, { schemaVersion: 1, table }))
    );
    await fileService.writeAssetsJson(restoredProject, commit.assets);
    await fileService.writeLocalizationJson(restoredProject, commit.localization);
    appStore.getState().setProject(restoredProject);

    return commit;
  }

  private async readSourceState(): Promise<SourceStateJson> {
    return (await fileService.tryReadSourceStateJson(this.getPath())) ?? emptySourceStateJson;
  }

  private async writeSourceState(value: SourceStateJson): Promise<void> {
    await fileService.writeSourceStateJson(appStore.getState().computed.project, zodParse(sourceStateJsonSchema, value));
  }
}

const sourceStateService = new SourceStateService();
export default sourceStateService;
