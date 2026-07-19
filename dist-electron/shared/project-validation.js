"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectValidationSeverity = void 0;
exports.validateProjectContent = validateProjectContent;
exports.findTableReferences = findTableReferences;
exports.findAssetReferences = findAssetReferences;
const types_1 = require("./types");
var ProjectValidationSeverity;
(function (ProjectValidationSeverity) {
    ProjectValidationSeverity["error"] = "error";
    ProjectValidationSeverity["warning"] = "warning";
})(ProjectValidationSeverity || (exports.ProjectValidationSeverity = ProjectValidationSeverity = {}));
function validateProjectContent(tables, assets) {
    const issues = [];
    const tablesById = new Map(tables.map((table) => [table.id, table]));
    const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
    for (const table of tables) {
        for (const column of table.columns) {
            if (column.type === types_1.ColumnType.ref) {
                if (!column.refTableId) {
                    issues.push({
                        severity: ProjectValidationSeverity.error,
                        path: `${table.id}.${column.name}`,
                        message: `Reference column "${column.name}" must declare a target table`
                    });
                    continue;
                }
                const targetTable = tablesById.get(column.refTableId);
                if (!targetTable) {
                    issues.push({
                        severity: ProjectValidationSeverity.error,
                        path: `${table.id}.${column.name}`,
                        message: `Reference column "${column.name}" points at missing table "${column.refTableId}"`
                    });
                    continue;
                }
                const targetSlugs = new Set(targetTable.rows.map((row) => row.slug));
                for (const row of table.rows) {
                    const value = columnValue(row, column);
                    if (isEmptyReferenceValue(value)) {
                        continue;
                    }
                    if (typeof value !== "string" || !targetSlugs.has(value)) {
                        issues.push({
                            severity: ProjectValidationSeverity.error,
                            path: `${table.id}.${row.slug}.${column.name}`,
                            message: `Reference "${String(value)}" does not exist in "${targetTable.name}"`
                        });
                    }
                }
            }
            if (column.type === types_1.ColumnType.assetRef) {
                for (const row of table.rows) {
                    const value = columnValue(row, column);
                    if (isEmptyReferenceValue(value)) {
                        continue;
                    }
                    if (typeof value !== "string") {
                        issues.push({
                            severity: ProjectValidationSeverity.error,
                            path: `${table.id}.${row.slug}.${column.name}`,
                            message: `Asset reference must be an asset slug`
                        });
                        continue;
                    }
                    const asset = assetsById.get(value);
                    if (!asset) {
                        issues.push({
                            severity: ProjectValidationSeverity.error,
                            path: `${table.id}.${row.slug}.${column.name}`,
                            message: `Asset "${value}" does not exist`
                        });
                        continue;
                    }
                    if (column.assetCategory && asset.category !== column.assetCategory) {
                        issues.push({
                            severity: ProjectValidationSeverity.error,
                            path: `${table.id}.${row.slug}.${column.name}`,
                            message: `Asset "${value}" is ${asset.category}, expected ${column.assetCategory}`
                        });
                    }
                }
            }
        }
    }
    return issues;
}
function findTableReferences(tables, targetTableId, targetRowSlugs) {
    const hits = [];
    for (const table of tables) {
        for (const column of table.columns) {
            if (column.type !== types_1.ColumnType.ref || column.refTableId !== targetTableId) {
                continue;
            }
            if (!targetRowSlugs) {
                hits.push({
                    column,
                    columnName: column.name,
                    sourceTableId: table.id,
                    sourceTableName: table.name
                });
                continue;
            }
            for (const row of table.rows) {
                const value = columnValue(row, column);
                if (typeof value === "string" && targetRowSlugs.has(value)) {
                    hits.push({
                        column,
                        columnName: column.name,
                        sourceRowSlug: row.slug,
                        sourceTableId: table.id,
                        sourceTableName: table.name,
                        targetRowSlug: value
                    });
                }
            }
        }
    }
    return hits;
}
function findAssetReferences(tables, assetId) {
    const hits = [];
    for (const table of tables) {
        for (const column of table.columns) {
            if (column.type !== types_1.ColumnType.assetRef) {
                continue;
            }
            for (const row of table.rows) {
                const value = columnValue(row, column);
                if (value === assetId) {
                    hits.push({
                        column,
                        columnName: column.name,
                        sourceRowSlug: row.slug,
                        sourceTableId: table.id,
                        sourceTableName: table.name
                    });
                }
            }
        }
    }
    return hits;
}
function columnValue(row, column) {
    return row.values.find((entry) => entry.columnId === column.id)?.value ?? column.defaultValue;
}
function isEmptyReferenceValue(value) {
    return value === null || typeof value === "undefined" || value === "";
}
