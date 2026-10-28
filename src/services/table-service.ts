import fileService from "@/services/file-service"
import { findTableReferences } from "@/shared/project-validation"
import type { CreateOrUpdateTable, DataTableRow, DataTableSchema, Project } from "@/shared/schemas"
import { createOrUpdateUserTableSchema, dataTableSchema, tablesJsonSchema } from "@/shared/schemas"
import appStore from "@/stores/app-store"
import { nanoid } from "nanoid"
class TableService {
  private static schemaVersion = 1
  public async addTable(input: CreateOrUpdateTable): Promise<DataTableSchema> {
    const parsedInput = createOrUpdateUserTableSchema.parse(input)
    const userTables = await this.listAllTables()
    const table = dataTableSchema.parse({
      ...parsedInput,
      id: nanoid(),
      kind: "user",
      lastChangeAt: new Date().toISOString(),
      rows: [],
      version: 1,
    })
    await this.writeUserTables([...userTables, table])
    return table
  }
  public async deleteTable(id: string): Promise<void> {
    const userTables = await this.listAllTables()
    const existingTable = userTables.find((table) => table.id === id)
    if (!existingTable) {
      throw new Error(`Table ${id} does not exist`)
    }
    const references = findTableReferences(await this.listAllTables(), id).filter(
      (reference) => reference.sourceTableId !== id
    )
    if (references.length > 0) {
      const reference = references[0]!
      throw new Error(
        `Table ${existingTable.name} is referenced by ${reference.sourceTableName}.${reference.columnName}`
      )
    }
    await this.backupUserTableSchema(existingTable)
    await this.writeUserTables(userTables.filter((table) => table.id !== id))
    await fileService.deleteUserTableJson(appStore.getState().computed.project, id)
  }
  public async updateTable(id: string, input: CreateOrUpdateTable): Promise<DataTableSchema> {
    const parsedInput = createOrUpdateUserTableSchema.parse(input)
    const userTables = await this.listAllTables()
    const existingTable = userTables.find((table) => table.id === id)
    if (!existingTable) {
      throw new Error(`Table ${id} does not exist`)
    }
    const table = dataTableSchema.parse({
      ...existingTable,
      ...parsedInput,
      id,
      kind: "user",
      lastChangeAt: new Date().toISOString(),
      rows: existingTable.rows,
      version: existingTable.version + 1,
    })
    await this.backupUserTableSchema(existingTable)
    await this.writeUserTables(userTables.map((entry) => (entry.id === id ? table : entry)))
    return table
  }
  public async getById(id: string): Promise<DataTableSchema | undefined> {
    const tables = await this.listAllTables()
    return tables.find((table) => table.id === id)
  }
  public async listAllTables(
    project: Project = appStore.getState().computed.project
  ): Promise<DataTableSchema[]> {
    const tablesJson = await fileService.tryReadTablesJson(project.path)
    const tables = tablesJson?.tables ?? []
    return tables.map((table) => dataTableSchema.parse(table))
  }
  public async saveTableRows(id: string, rows: DataTableRow[]): Promise<DataTableSchema> {
    const userTables = await this.listAllTables()
    const existingTable = userTables.find((table) => table.id === id)
    if (!existingTable) {
      throw new Error(`Table ${id} does not exist`)
    }
    await this.assertRemovedRowsAreUnreferenced(id, existingTable.rows, rows)
    const table = dataTableSchema.parse({
      ...existingTable,
      lastChangeAt: new Date().toISOString(),
      rows,
      version: existingTable.version + 1,
    })
    await this.writeUserTables(userTables.map((entry) => (entry.id === id ? table : entry)))
    return table
  }
  private async writeUserTables(tables: DataTableSchema[]): Promise<void> {
    const project = appStore.getState().computed.project
    const parsedTables = tables.map((table) => dataTableSchema.parse(table))
    const tablesJson = tablesJsonSchema.parse({
      schemaVersion: TableService.schemaVersion,
      tables: parsedTables,
    })
    await fileService.writeTablesJson(project, tablesJson)
    await Promise.all(
      parsedTables.map((table) =>
        fileService.writeUserTableJson(project, table.id, {
          schemaVersion: TableService.schemaVersion,
          table,
        })
      )
    )
  }
  private async backupUserTableSchema(table: DataTableSchema): Promise<void> {
    const schemaOnlyTable = dataTableSchema.parse({
      ...table,
      rows: [],
    })
    await fileService.writeUserTableSchemaBackupJson(
      appStore.getState().computed.project,
      table.id,
      this.backupTimestamp(),
      {
        schemaVersion: TableService.schemaVersion,
        table: schemaOnlyTable,
      }
    )
  }
  private backupTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, "-")
  }
  private async assertRemovedRowsAreUnreferenced(
    tableId: string,
    currentRows: DataTableRow[],
    nextRows: DataTableRow[]
  ): Promise<void> {
    const nextSlugs = new Set(nextRows.map((row) => row.slug))
    const removedSlugs = new Set(
      currentRows.map((row) => row.slug).filter((slug) => !nextSlugs.has(slug))
    )
    if (removedSlugs.size === 0) {
      return
    }
    const tables = await this.listAllTables()
    const nextTables = tables.map((table) =>
      table.id === tableId ? { ...table, rows: nextRows } : table
    )
    const references = findTableReferences(nextTables, tableId, removedSlugs)
    if (references.length === 0) {
      return
    }
    const reference = references[0]!
    throw new Error(
      `Row ${reference.targetRowSlug ?? "unknown"} is referenced by ${reference.sourceTableName}.${reference.sourceRowSlug}.${reference.columnName}`
    )
  }
}
const tableService = new TableService()
export default tableService
