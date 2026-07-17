import { nanoid } from "nanoid";
import { SYSTEM_TABLES } from "@/constants/system-tables";
import BaseService from "@/services/base-service";
import fileService from "@/services/file-service";
import appStore from "@/stores/app-store";
import { zodParse } from "@/utils/zod-parse";
import {
  AnyDataTable,
  CreateOrUpdateTable,
  DataTableRow,
  DataTableSchema,
  SystemDataTable,
  createOrUpdateUserTableSchema,
  dataTableJsonSchema,
  dataTableSchema,
  systemDataTableSchema,
  tablesJsonSchema
} from "../../shared/schemas";

class TableService extends BaseService {
  private static schemaVersion = 1;

  public async addTable(input: CreateOrUpdateTable): Promise<DataTableSchema> {
    const parsedInput = zodParse(createOrUpdateUserTableSchema, input);
    const userTables = await this.listUserTables();
    const table = zodParse(dataTableSchema, {
      ...parsedInput,
      id: nanoid(),
      kind: "user",
      lastChangeAt: new Date().toISOString(),
      rows: [],
      version: 1
    });

    await this.writeUserTables([...userTables, table]);
    return table;
  }

  public async deleteTable(id: string): Promise<void> {
    if (SYSTEM_TABLES.some((table) => table.id === id)) {
      throw new Error(`System table ${id} cannot be deleted`);
    }

    const userTables = await this.listUserTables();
    const existingTable = userTables.find((table) => table.id === id);
    if (!existingTable) {
      throw new Error(`Table ${id} does not exist`);
    }

    await this.backupUserTableSchema(existingTable);
    await this.writeUserTables(userTables.filter((table) => table.id !== id));
    await fileService.deleteUserTableJson(appStore.getState().computed.project, id);
  }

  public async updateTable(id: string, input: CreateOrUpdateTable): Promise<DataTableSchema> {
    if (SYSTEM_TABLES.some((table) => table.id === id)) {
      throw new Error(`System table ${id} cannot be edited`);
    }

    const parsedInput = zodParse(createOrUpdateUserTableSchema, input);
    const userTables = await this.listUserTables();
    const existingTable = userTables.find((table) => table.id === id);
    if (!existingTable) {
      throw new Error(`Table ${id} does not exist`);
    }

    const table = zodParse(dataTableSchema, {
      ...existingTable,
      ...parsedInput,
      id,
      kind: "user",
      lastChangeAt: new Date().toISOString(),
      rows: existingTable.rows,
      version: existingTable.version + 1
    });

    await this.backupUserTableSchema(existingTable);
    await this.writeUserTables(userTables.map((entry) => (entry.id === id ? table : entry)));
    return table;
  }

  public async getById(id: string): Promise<AnyDataTable | undefined> {
    const tables = await this.listAllTables();
    return tables.find((table) => table.id === id);
  }

  public async listAllTables(): Promise<AnyDataTable[]> {
    const [userTables, systemTables] = await Promise.all([this.listUserTables(), this.listSystemTables()]);
    return [...userTables, ...systemTables];
  }

  public async saveSystemTableRows(id: string, rows: DataTableRow[]): Promise<SystemDataTable> {
    const definition = SYSTEM_TABLES.find((table) => table.id === id);
    if (!definition) {
      throw new Error(`System table ${id} does not exist`);
    }

    const currentTable = await this.readSystemTable(definition);
    const table = zodParse(systemDataTableSchema, {
      ...definition,
      lastChangeAt: new Date().toISOString(),
      rows,
      version: currentTable.version + 1
    });

    await fileService.writeSystemTableDataJson(appStore.getState().computed.project, table.id, {
      schemaVersion: TableService.schemaVersion,
      table
    });

    return table;
  }

  private async listUserTables(): Promise<DataTableSchema[]> {
    const tablesJson = await fileService.tryReadTablesJson(this.getPath());
    const tables = tablesJson?.tables ?? [];
    return tables.filter((table) => !table.isSystemTable).map((table) => zodParse(dataTableSchema, table));
  }

  private async listSystemTables(): Promise<SystemDataTable[]> {
    return Promise.all(SYSTEM_TABLES.map((table) => this.readSystemTable(table)));
  }

  private async readSystemTable(definition: SystemDataTable): Promise<SystemDataTable> {
    const tableJson = await fileService.tryReadSystemTableDataJson(this.getPath(), definition.id);
    if (!tableJson) {
      return zodParse(systemDataTableSchema, definition);
    }

    const parsedTable = zodParse(dataTableJsonSchema, tableJson).table;
    if (parsedTable.id !== definition.id) {
      return zodParse(systemDataTableSchema, definition);
    }

    const table = zodParse(systemDataTableSchema, {
      ...definition,
      lastChangeAt: parsedTable.lastChangeAt,
      rows: parsedTable.rows,
      version: parsedTable.version
    });
    if (
      JSON.stringify(parsedTable.columns) !== JSON.stringify(definition.columns) ||
      parsedTable.name !== definition.name ||
      parsedTable.description !== definition.description ||
      !("moduleId" in parsedTable) ||
      parsedTable.moduleId !== definition.moduleId
    ) {
      await fileService.writeSystemTableDataJson(appStore.getState().computed.project, table.id, {
        schemaVersion: TableService.schemaVersion,
        table
      });
    }
    return table;
  }

  private async writeUserTables(tables: DataTableSchema[]): Promise<void> {
    const project = appStore.getState().computed.project;
    const parsedTables = tables.map((table) => zodParse(dataTableSchema, table));
    const tablesJson = zodParse(tablesJsonSchema, {
      schemaVersion: TableService.schemaVersion,
      tables: parsedTables
    });

    await fileService.writeTablesJson(project, tablesJson);
    await Promise.all(
      parsedTables.map((table) =>
        fileService.writeUserTableJson(project, table.id, {
          schemaVersion: TableService.schemaVersion,
          table
        })
      )
    );
  }

  private async backupUserTableSchema(table: DataTableSchema): Promise<void> {
    const schemaOnlyTable = zodParse(dataTableSchema, {
      ...table,
      rows: []
    });

    await fileService.writeUserTableSchemaBackupJson(appStore.getState().computed.project, table.id, this.backupTimestamp(), {
      schemaVersion: TableService.schemaVersion,
      table: schemaOnlyTable
    });
  }

  private backupTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, "-");
  }
}

const tableService = new TableService();
export default tableService;
