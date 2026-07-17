import { type FC, type PointerEvent, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import RangeField from "@/components/controls/range-field";
import SignedRangeField from "@/components/controls/signed-range-field";
import {
  STAMP_MASKS_TABLE,
  STAMP_HEIGHT_FIELDS_TABLE,
  STAMP_OVERLAY_LAYERS_TABLE,
  STAMP_OVERLAYS_TABLE,
  STAMPS_TABLE,
  TERRAIN_BIOMES_TABLE,
  TERRAIN_VARIANTS_TABLE
} from "@/constants/system-tables";
import PageHeader from "@/components/page-header";
import { cn } from "@/lib/utils";
import previewService from "@/services/preview-service";
import tableService from "@/services/table-service";
import useListAssetsQuery from "@/hooks/use-list-assets-query";
import useListTablesQuery from "@/hooks/use-list-tables-query";
import { buildTerrainBiomePreviewConfig } from "@/utils/terrain-biome-preview";
import type { CellMaskValue, DataColumnDefinition, DataTableRow, HeightFieldValue, SystemDataTable } from "../../../../shared/schemas";
import type {
  Asset,
  GraphitePreviewOptionsConfig,
  GraphitePreviewSnapshotConfig,
  GraphitePreviewStampConfig,
  GraphitePreviewState,
  GraphitePreviewTerrainBiomeConfig,
  GraphitePreviewTerrainStampConfig,
  GraphitePreviewViewMode
} from "../../../../shared/types";
import { AssetTypeEnum, ColumnType } from "../../../../shared/types";
import AssetRefCellEditor from "../data-tables-screen/data-table/asset-ref-cell-editor/asset-ref-cell-editor";

const stampCellSizeMeters = 2;
type FootprintSizeCells = 4 | 8 | 12 | 16 | 24 | 32;
type FootprintDrawMode = "paint" | "erase";
type StampPaintLayer = "footprint" | "blocking" | "foliage";

interface StampPaintMasks {
  blocking: Set<string>;
  foliage: Set<string>;
  footprint: Set<string>;
}

interface StampOverlayLayerDraft {
  assetId: string;
  albedoSaturation: number;
  albedoTint: string;
  albedoTintStrength: number;
  heightInfluence: number;
  order: number;
  textureOffset: [number, number];
  textureRotation: number;
  textureScale: [number, number];
  weight: number;
}

interface StampOverlayDraft {
  bleed: number;
  edgeBreakup: number;
  edgeJitter: number;
  enabled: boolean;
  heightBlendWidth: number;
  heightSharpness: number;
  opacity: number;
  layers: StampOverlayLayerDraft[];
  patchScale: number;
  roughnessBias: number;
  seed: number;
  textureScale: number;
  wetnessBias: number;
}

type TerrainStampBlendMode = "add" | "replace";

interface TerrainHeightDraft {
  blendMode: TerrainStampBlendMode;
  brushHeightMeters: number;
  valuesMeters: number[];
}

const defaultFootprintSizeCells: FootprintSizeCells = 12;
const footprintPaddingCells = 4;
const footprintSizeOptions: FootprintSizeCells[] = [4, 8, 12, 16, 24, 32];
const paintLayerOptions: Array<{ description: string; label: string; value: StampPaintLayer }> = [
  {
    description: "Base bounded area for all stamp layers.",
    label: "Footprint",
    value: "footprint"
  },
  {
    description: "Simulation blocking cells. New footprint cells block by default.",
    label: "Blocking",
    value: "blocking"
  },
  {
    description: "Foliage inpaint mask. Empty by default.",
    label: "Foliage",
    value: "foliage"
  }
];
const paintLayerActiveClassMap: Record<StampPaintLayer, string> = {
  blocking: "border-red-400 bg-red-500/70 hover:bg-red-500/80",
  foliage: "border-emerald-400 bg-emerald-500/70 hover:bg-emerald-500/80",
  footprint: "border-sky-400 bg-sky-500/70 hover:bg-sky-500/80"
};
const footprintGridColumnClassMap: Record<FootprintSizeCells, string> = {
  4: "grid-cols-[repeat(4,1.25rem)]",
  8: "grid-cols-[repeat(8,1.25rem)]",
  12: "grid-cols-[repeat(12,1.25rem)]",
  16: "grid-cols-[repeat(16,1.25rem)]",
  24: "grid-cols-[repeat(24,1.25rem)]",
  32: "grid-cols-[repeat(32,1.25rem)]"
};
const previewViewModeOptions: Array<{ label: string; value: GraphitePreviewViewMode }> = [
  { label: "Terrain", value: "terrain" },
  { label: "Stamp Bounds", value: "stamp_bounds" },
  { label: "Simulation", value: "sim" },
  { label: "Overlays", value: "overlays" },
  { label: "Prefabs", value: "prefabs" },
  { label: "All Layers", value: "all" }
];
const maxOverlayLayers = 4;
const defaultTerrainHeightDraft: TerrainHeightDraft = {
  blendMode: "add",
  brushHeightMeters: 2,
  valuesMeters: Array.from({ length: (defaultFootprintSizeCells + 1) * (defaultFootprintSizeCells + 1) }, () => 0)
};
const defaultOverlayDraft: StampOverlayDraft = {
  bleed: 0.25,
  edgeBreakup: 0.45,
  edgeJitter: 0,
  enabled: false,
  heightBlendWidth: 0.12,
  heightSharpness: 4,
  opacity: 1,
  layers: [],
  patchScale: 0.18,
  roughnessBias: 0,
  seed: 11,
  textureScale: 0.25,
  wetnessBias: 0
};
const stampOverlayLayerAssetColumn: DataColumnDefinition = {
  assetType: AssetTypeEnum.terrainTexture,
  defaultValue: "",
  id: "stamp_overlay_layer0",
  name: "terrain_texture",
  required: true,
  type: ColumnType.assetRef,
  unique: false
};

function stampPaintMasksEmpty(): StampPaintMasks {
  return {
    blocking: new Set(),
    foliage: new Set(),
    footprint: new Set()
  };
}

function resizeTerrainHeightValues(values: number[], previousSize: number, nextSize: number): number[] {
  const nextValues = Array.from({ length: (nextSize + 1) * (nextSize + 1) }, () => 0);
  const copiedSize = Math.min(previousSize, nextSize);
  for (let z = 0; z <= copiedSize; z += 1) {
    for (let x = 0; x <= copiedSize; x += 1) {
      nextValues[z * (nextSize + 1) + x] = values[z * (previousSize + 1) + x] ?? 0;
    }
  }
  return nextValues;
}

function terrainCornerInfluenceValues(footprint: ReadonlySet<string>, size: number): number[] {
  return Array.from({ length: (size + 1) * (size + 1) }, (_, index) => {
    const cornerX = index % (size + 1);
    const cornerZ = Math.floor(index / (size + 1));
    for (let offsetZ = -1; offsetZ <= 0; offsetZ += 1) {
      for (let offsetX = -1; offsetX <= 0; offsetX += 1) {
        const cellX = cornerX + offsetX;
        const cellZ = cornerZ + offsetZ;
        if (cellX >= 0 && cellZ >= 0 && cellX < size && cellZ < size && footprint.has(`${cellX}:${cellZ}`)) {
          return 1;
        }
      }
    }
    return 0;
  });
}

function terrainHeightFieldValue(draft: TerrainHeightDraft, size: number): HeightFieldValue {
  return {
    cellSizeMeters: stampCellSizeMeters,
    cornerHeight: size + 1,
    cornerWidth: size + 1,
    height: size,
    values: draft.valuesMeters,
    width: size
  };
}

function stampPaintMasksClone(masks: StampPaintMasks): StampPaintMasks {
  return {
    blocking: new Set(masks.blocking),
    foliage: new Set(masks.foliage),
    footprint: new Set(masks.footprint)
  };
}

function stampCellInBounds(cellKey: string, footprintSizeCells: FootprintSizeCells): boolean {
  const [xRaw, zRaw] = cellKey.split(":");
  const x = numberFromInput(xRaw, -1);
  const z = numberFromInput(zRaw, -1);
  return x >= 0 && z >= 0 && x < footprintSizeCells && z < footprintSizeCells;
}

function stampPaintMasksClip(masks: StampPaintMasks, footprintSizeCells: FootprintSizeCells): StampPaintMasks {
  const nextMasks = stampPaintMasksEmpty();
  masks.footprint.forEach((cellKey) => {
    if (stampCellInBounds(cellKey, footprintSizeCells)) {
      nextMasks.footprint.add(cellKey);
    }
  });
  masks.blocking.forEach((cellKey) => {
    if (nextMasks.footprint.has(cellKey)) {
      nextMasks.blocking.add(cellKey);
    }
  });
  masks.foliage.forEach((cellKey) => {
    if (nextMasks.footprint.has(cellKey)) {
      nextMasks.foliage.add(cellKey);
    }
  });
  return nextMasks;
}

function stampPaintMasksLayerSize(masks: StampPaintMasks, layer: StampPaintLayer): number {
  return masks[layer].size;
}

function cloneDefaultValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

function stableNanoId(seed: string): string {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const suffix = Math.abs(hash >>> 0).toString(36);
  const normalized = seed.replace(/[^A-Za-z0-9_-]/g, "_").replace(/^_+|_+$/g, "") || "row";
  const prefixLength = Math.max(1, 20 - suffix.length);
  return `${normalized.slice(0, prefixLength)}_${suffix}`.slice(0, 21).padEnd(21, "0");
}

function stampKeyFromName(name: string): string {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (key) {
    return key;
  }
  return "stamp";
}

function cellMaskValue(cells: ReadonlySet<string>, footprintSizeCells: FootprintSizeCells): CellMaskValue {
  return {
    cellSizeMeters: stampCellSizeMeters,
    cells: Array.from(cells)
      .sort()
      .map((cellKey) => {
        const [xRaw, zRaw] = cellKey.split(":");
        return [numberFromInput(xRaw, 0), numberFromInput(zRaw, 0)] as [number, number];
      }),
    height: footprintSizeCells,
    width: footprintSizeCells
  };
}

function systemTableRow(table: SystemDataTable, rowSeed: string, valuesByName: Record<string, unknown>): DataTableRow {
  return {
    id: stableNanoId(`${table.id}_${rowSeed}`),
    values: table.columns.map((column) => ({
      columnId: column.id,
      type: column.type,
      value: Object.prototype.hasOwnProperty.call(valuesByName, column.name)
        ? valuesByName[column.name]
        : cloneDefaultValue(column.defaultValue)
    })) as DataTableRow["values"]
  };
}

function upsertRows(rows: DataTableRow[], nextRows: DataTableRow[]): DataTableRow[] {
  const nextRowIds = new Set(nextRows.map((row) => row.id));
  return [...rows.filter((row) => !nextRowIds.has(row.id)), ...nextRows];
}

function requireSystemTable(table: Awaited<ReturnType<typeof tableService.getById>>, id: string): SystemDataTable {
  if (!table || table.kind !== "system") {
    throw new Error(`System table ${id} is missing`);
  }
  return table;
}

function terrainTextureAssetsById(assets: Asset[]): Map<string, Asset> {
  return new Map(assets.filter((asset) => asset.type === AssetTypeEnum.terrainTexture).map((asset) => [asset.id, asset]));
}

function textTableValueByName(table: SystemDataTable, row: DataTableRow, name: string): string {
  const column = table.columns.find((entry) => entry.name === name);
  if (!column) {
    return "";
  }
  const value = row.values.find((entry) => entry.columnId === column.id)?.value;
  if (typeof value === "string") {
    return value;
  }
  return `${value ?? ""}`;
}

function vector2TableValueByName(table: SystemDataTable, row: DataTableRow, name: string, fallback: [number, number]): [number, number] {
  const column = table.columns.find((entry) => entry.name === name);
  const value = row.values.find((entry) => entry.columnId === column?.id)?.value;
  if (Array.isArray(value) && value.length >= 2) {
    return [numberFromInput(`${value[0]}`, fallback[0]), numberFromInput(`${value[1]}`, fallback[1])];
  }
  return fallback;
}

function numberTableValueByName(table: SystemDataTable, row: DataTableRow, name: string, fallback: number): number {
  const column = table.columns.find((entry) => entry.name === name);
  const value = row.values.find((entry) => entry.columnId === column?.id)?.value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

function stampOverlayLayerDefaults(
  assetId: string,
  selectedBiome: string,
  variantRows: DataTableRow[]
): Pick<
  StampOverlayLayerDraft,
  "albedoSaturation" | "albedoTint" | "albedoTintStrength" | "heightInfluence" | "textureOffset" | "textureRotation" | "textureScale"
> {
  const biomeVariant = variantRows.find(
    (row) =>
      textTableValueByName(TERRAIN_VARIANTS_TABLE, row, "biome") === selectedBiome &&
      textTableValueByName(TERRAIN_VARIANTS_TABLE, row, "terrain_texture") === assetId
  );
  return {
    albedoSaturation: biomeVariant ? numberTableValueByName(TERRAIN_VARIANTS_TABLE, biomeVariant, "albedo_saturation", 1) : 1,
    albedoTint: biomeVariant ? textTableValueByName(TERRAIN_VARIANTS_TABLE, biomeVariant, "albedo_tint") || "#ffffff" : "#ffffff",
    albedoTintStrength: biomeVariant ? numberTableValueByName(TERRAIN_VARIANTS_TABLE, biomeVariant, "albedo_tint_strength", 0) : 0,
    heightInfluence: 1,
    textureOffset: biomeVariant ? vector2TableValueByName(TERRAIN_VARIANTS_TABLE, biomeVariant, "texture_offset", [0, 0]) : [0, 0],
    textureRotation: 0,
    textureScale: biomeVariant ? vector2TableValueByName(TERRAIN_VARIANTS_TABLE, biomeVariant, "texture_scale", [1, 1]) : [1, 1]
  };
}

function footprintCellsValue(cells: ReadonlySet<string>): Array<[number, number]> {
  return Array.from(cells)
    .sort()
    .map((cellKey) => {
      const [xRaw, zRaw] = cellKey.split(":");
      return [numberFromInput(xRaw, 0), numberFromInput(zRaw, 0)] as [number, number];
    });
}

function validOverlayLayers(overlayDraft: StampOverlayDraft, assetsById: Map<string, Asset>) {
  return overlayDraft.layers
    .map((layer) => {
      const asset = assetsById.get(layer.assetId);
      if (!asset) {
        return undefined;
      }
      return {
        assetId: asset.id,
        albedoSaturation: layer.albedoSaturation,
        albedoTint: hexColorToRgb(layer.albedoTint),
        albedoTintStrength: layer.albedoTintStrength,
        heightInfluence: layer.heightInfluence,
        order: layer.order,
        terrainTexture: asset.relativePath,
        textureOffset: layer.textureOffset,
        textureRotationDegrees: layer.textureRotation,
        textureScale: layer.textureScale,
        weight: layer.weight
      };
    })
    .filter((layer): layer is NonNullable<typeof layer> => Boolean(layer))
    .sort((a, b) => a.order - b.order)
    .slice(0, maxOverlayLayers);
}

function replaceRowsById(rows: DataTableRow[], replacedIds: Set<string>, nextRows: DataTableRow[]): DataTableRow[] {
  return [...rows.filter((row) => !replacedIds.has(row.id)), ...nextRows];
}

const defaultPreviewStamp: GraphitePreviewStampConfig = {
  affectedDomains: ["prefab"],
  blockerMask: [],
  debugName: "Preview Stamp",
  id: "preview_stamp",
  position: [0, 0],
  priority: 10,
  radius: 0,
  rotationDegrees: 0,
  seed: 11,
  shape: "prefab_footprint",
  size: [defaultFootprintSizeCells * stampCellSizeMeters, defaultFootprintSizeCells * stampCellSizeMeters],
  surfaceOverride: "builtin_soil",
  traversalCostDelta: -0.2
};

function numberFromInput(value: string, fallback: number): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function hexColorToRgb(value: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) {
    return [1, 1, 1];
  }
  const raw = match[1];
  return [parseInt(raw.slice(0, 2), 16) / 255, parseInt(raw.slice(2, 4), 16) / 255, parseInt(raw.slice(4, 6), 16) / 255];
}

function buildStampPreviewSnapshot(
  stamp: GraphitePreviewStampConfig,
  paintMasks: StampPaintMasks,
  previewOptions: GraphitePreviewOptionsConfig,
  footprintSizeCells: FootprintSizeCells,
  terrainHeightDraft: TerrainHeightDraft,
  overlayDraft: StampOverlayDraft,
  assetsById: Map<string, Asset>,
  selectedBiome: string,
  terrainBiome?: GraphitePreviewTerrainBiomeConfig
): GraphitePreviewSnapshotConfig {
  const terrainWorldSize = (footprintSizeCells + footprintPaddingCells * 2) * stampCellSizeMeters;
  const cameraDistance = Math.max(48, terrainWorldSize * 1.2);
  const buildLayerStamps = (layer: StampPaintLayer, cells: ReadonlySet<string>, startPriority: number): GraphitePreviewStampConfig[] =>
    Array.from(cells)
      .sort()
      .map((cellKey, index) => {
        const [xRaw, zRaw] = cellKey.split(":");
        const x = numberFromInput(xRaw, 0);
        const z = numberFromInput(zRaw, 0);
        const centerX = (x + 0.5 - footprintSizeCells * 0.5) * stampCellSizeMeters;
        const centerZ = (z + 0.5 - footprintSizeCells * 0.5) * stampCellSizeMeters;
        const layerDomains: Record<StampPaintLayer, string[]> = {
          blocking: ["sim"],
          foliage: ["foliage"],
          footprint: ["prefab"]
        };
        return {
          ...stamp,
          affectedDomains: layerDomains[layer],
          blockerMask: layer === "blocking" ? ["structure"] : [],
          debugName: `${stamp.debugName} ${layer} ${cellKey}`,
          id: `${stamp.id}_${layer}_${x}_${z}`,
          position: [centerX, centerZ] as [number, number],
          priority: startPriority + index,
          radius: 0,
          rotationDegrees: 0,
          shape: "prefab_footprint",
          size: [stampCellSizeMeters, stampCellSizeMeters] as [number, number],
          traversalCostDelta: layer === "blocking" ? stamp.traversalCostDelta : 0
        };
      });
  const stamps = [
    ...buildLayerStamps("footprint", paintMasks.footprint, 1000),
    ...buildLayerStamps("blocking", paintMasks.blocking, 2000),
    ...buildLayerStamps("foliage", paintMasks.foliage, 3000)
  ];
  const overlayLayers = validOverlayLayers(overlayDraft, assetsById);
  const terrainOverlays =
    overlayDraft.enabled && paintMasks.footprint.size > 0 && overlayLayers.length > 0
      ? [
          {
            algorithm: "height_patch_blend" as const,
            bleed: overlayDraft.bleed,
            cellSizeMeters: stampCellSizeMeters,
            debugName: `${stamp.debugName} terrain overlay`,
            edgeBreakup: overlayDraft.edgeBreakup,
            edgeJitter: overlayDraft.edgeJitter,
            enabled: true,
            footprintCells: footprintCellsValue(paintMasks.footprint),
            heightBlendWidth: overlayDraft.heightBlendWidth,
            heightSharpness: overlayDraft.heightSharpness,
            id: `${stamp.id}_terrain_overlay`,
            opacity: overlayDraft.opacity,
            layers: overlayLayers,
            patchScale: overlayDraft.patchScale,
            roughnessBias: overlayDraft.roughnessBias,
            seed: overlayDraft.seed,
            size: [footprintSizeCells, footprintSizeCells] as [number, number],
            textureScale: overlayDraft.textureScale,
            wetnessBias: overlayDraft.wetnessBias
          }
        ]
      : [];
  const terrainStamps: GraphitePreviewTerrainStampConfig[] =
    paintMasks.footprint.size > 0
      ? [
          {
            anchorHeightMeters: 0,
            blendMode: terrainHeightDraft.blendMode,
            cellSizeMeters: stampCellSizeMeters,
            height: footprintSizeCells + 1,
            heightValuesMeters: terrainHeightDraft.valuesMeters,
            id: `${stamp.id}_terrain_height`,
            influenceValues: terrainCornerInfluenceValues(paintMasks.footprint, footprintSizeCells),
            pivotMeters: [(footprintSizeCells * stampCellSizeMeters) / 2, (footprintSizeCells * stampCellSizeMeters) / 2],
            position: [0, 0],
            priority: stamp.priority,
            rotationDegrees: 0,
            scale: 1,
            verticalStrength: 1,
            width: footprintSizeCells + 1
          }
        ]
      : [];

  return {
    camera: {
      distance: cameraDistance,
      fovDegrees: 42,
      pitchDegrees: 55,
      target: [0, 0.4, 0],
      yawDegrees: 45
    },
    debugName: selectedBiome ? `Chisel Stamp Preview: ${selectedBiome}` : "Chisel Stamp Preview",
    kind: "fixed_scene",
    previewOptions,
    schemaVersion: 1,
    snapshotVersion: 1,
    stamps,
    terrainBiome,
    terrainOverlays,
    terrainStamps,
    terrainPreview: {
      chunkCount: [1, 1],
      chunkWorldSize: terrainWorldSize,
      editableCellCount: [footprintSizeCells, footprintSizeCells],
      paddingCells: footprintPaddingCells,
      settingsControlled: false,
      slotSize: stampCellSizeMeters
    }
  };
}

const StampEditorScreen: FC = () => {
  const { assets } = useListAssetsQuery();
  const { tables } = useListTablesQuery();
  const terrainTextureAssets = terrainTextureAssetsById(assets);
  const biomeTable = tables.find((table) => table.id === TERRAIN_BIOMES_TABLE.id && table.kind === "system");
  const variantTable = tables.find((table) => table.id === TERRAIN_VARIANTS_TABLE.id && table.kind === "system");
  const biomeRows = biomeTable?.rows ?? [];
  const variantRows = variantTable?.rows ?? [];
  const biomeOptions = biomeRows.map((row) => ({
    label: textTableValueByName(TERRAIN_BIOMES_TABLE, row, "name"),
    value: textTableValueByName(TERRAIN_BIOMES_TABLE, row, "file_name")
  }));
  const [previewState, setPreviewState] = useState<GraphitePreviewState>({
    message: "Use the global Preview button to start Graphite.",
    running: false,
    status: "stopped"
  });
  const [viewMode, setViewMode] = useState<GraphitePreviewViewMode>("overlays");
  const [gridEnabled, setGridEnabled] = useState(true);
  const [canRotate, setCanRotate] = useState(false);
  const [stamp, setStamp] = useState<GraphitePreviewStampConfig>(defaultPreviewStamp);
  const [stampDescription, setStampDescription] = useState("");
  const [paintMasks, setPaintMasks] = useState<StampPaintMasks>(() => stampPaintMasksEmpty());
  const [paintLayer, setPaintLayer] = useState<StampPaintLayer>("footprint");
  const [footprintSizeCells, setFootprintSizeCells] = useState<FootprintSizeCells>(defaultFootprintSizeCells);
  const [terrainHeightDraft, setTerrainHeightDraft] = useState<TerrainHeightDraft>(defaultTerrainHeightDraft);
  const [drawMode, setDrawMode] = useState<FootprintDrawMode>("paint");
  const [overlayDraft, setOverlayDraft] = useState<StampOverlayDraft>(defaultOverlayDraft);
  const [selectedBiome, setSelectedBiome] = useState("");
  const selectedTerrainBiome = buildTerrainBiomePreviewConfig({
    assets,
    biomeKey: selectedBiome,
    biomeRows,
    variantRows
  });
  const [selectedOverlayLayerAsset, setSelectedOverlayLayerAsset] = useState("");
  const [saveMessage, setSaveMessage] = useState("Unsaved draft");
  const [isDrawing, setIsDrawing] = useState(false);
  const previewOptions: GraphitePreviewOptionsConfig = {
    gridEnabled,
    viewMode
  };
  const paintMasksRef = useRef(paintMasks);
  const snapshotRef = useRef<GraphitePreviewSnapshotConfig>(
    buildStampPreviewSnapshot(
      stamp,
      paintMasks,
      previewOptions,
      footprintSizeCells,
      terrainHeightDraft,
      overlayDraft,
      terrainTextureAssets,
      selectedBiome,
      selectedTerrainBiome
    )
  );
  const canSaveStamp =
    stamp.debugName.trim().length > 0 &&
    paintMasks.footprint.size > 0 &&
    (!overlayDraft.enabled || validOverlayLayers(overlayDraft, terrainTextureAssets).length > 0);

  async function pushSnapshot(
    nextStamp: GraphitePreviewStampConfig,
    nextPaintMasks: StampPaintMasks,
    nextOptions: GraphitePreviewOptionsConfig,
    nextFootprintSizeCells: FootprintSizeCells,
    nextOverlayDraft: StampOverlayDraft,
    nextAssetsById: Map<string, Asset>,
    nextBiome: string,
    nextTerrainHeightDraft: TerrainHeightDraft = terrainHeightDraft
  ): Promise<void> {
    if (!previewState.running && previewState.status !== "starting") {
      return;
    }
    const nextTerrainBiome = buildTerrainBiomePreviewConfig({
      assets,
      biomeKey: nextBiome,
      biomeRows,
      variantRows
    });
    const state = await previewService.updateSnapshot(
      buildStampPreviewSnapshot(
        nextStamp,
        nextPaintMasks,
        nextOptions,
        nextFootprintSizeCells,
        nextTerrainHeightDraft,
        nextOverlayDraft,
        nextAssetsById,
        nextBiome,
        nextTerrainBiome
      )
    );
    setPreviewState(state);
  }

  useEffect(() => {
    snapshotRef.current = buildStampPreviewSnapshot(
      stamp,
      paintMasks,
      { gridEnabled, viewMode },
      footprintSizeCells,
      terrainHeightDraft,
      overlayDraft,
      terrainTextureAssets,
      selectedBiome,
      selectedTerrainBiome
    );
    paintMasksRef.current = paintMasks;
  }, [
    footprintSizeCells,
    gridEnabled,
    overlayDraft,
    paintMasks,
    selectedBiome,
    selectedTerrainBiome,
    stamp,
    terrainHeightDraft,
    terrainTextureAssets,
    viewMode
  ]);

  useEffect(() => {
    if (!selectedBiome && biomeOptions[0]) {
      setSelectedBiome(biomeOptions[0].value);
    }
  }, [biomeOptions, selectedBiome]);

  useEffect(() => {
    let mounted = true;
    void previewService.getStatus().then((state) => {
      if (mounted) {
        setPreviewState(state);
      }
      if (state.running) {
        void previewService.resetView("stamp");
        void previewService.updateSnapshot(snapshotRef.current);
      }
    });
    const unsubscribe = window.electron.onGraphitePreviewEvent((event) => {
      if (event.type !== "log") {
        setPreviewState(event);
      }
      if (event.type === "ready") {
        void previewService.resetView("stamp");
        void previewService.updateSnapshot(snapshotRef.current);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isDrawing) {
      return;
    }

    function finishDrawing(): void {
      setIsDrawing(false);
      if (!previewState.running && previewState.status !== "starting") {
        return;
      }
      void previewService
        .updateSnapshot(
          buildStampPreviewSnapshot(
            stamp,
            paintMasksRef.current,
            { gridEnabled, viewMode },
            footprintSizeCells,
            terrainHeightDraft,
            overlayDraft,
            terrainTextureAssets,
            selectedBiome,
            selectedTerrainBiome
          )
        )
        .then(setPreviewState);
    }

    window.addEventListener("pointerup", finishDrawing);
    return () => {
      window.removeEventListener("pointerup", finishDrawing);
    };
  }, [
    footprintSizeCells,
    gridEnabled,
    isDrawing,
    overlayDraft,
    previewState.running,
    previewState.status,
    selectedBiome,
    selectedTerrainBiome,
    stamp,
    terrainHeightDraft,
    terrainTextureAssets,
    viewMode
  ]);

  async function pushOptions(nextOptions: GraphitePreviewOptionsConfig): Promise<void> {
    if (!previewState.running && previewState.status !== "starting") {
      return;
    }
    const state = await previewService.updateOptions(nextOptions);
    setPreviewState(state);
  }

  function commitStamp(nextStamp: GraphitePreviewStampConfig): void {
    setSaveMessage("Unsaved draft");
    setStamp(nextStamp);
    void pushSnapshot(nextStamp, paintMasks, previewOptions, footprintSizeCells, overlayDraft, terrainTextureAssets, selectedBiome);
  }

  function updateSelectedBiome(value: string): void {
    setSaveMessage("Unsaved draft");
    setSelectedBiome(value);
    void pushSnapshot(stamp, paintMasks, previewOptions, footprintSizeCells, overlayDraft, terrainTextureAssets, value);
  }

  function updateStampNumber(key: keyof GraphitePreviewStampConfig, value: string): void {
    const current = stamp[key];
    if (typeof current !== "number") {
      return;
    }
    commitStamp({
      ...stamp,
      [key]: numberFromInput(value, current)
    });
  }

  function updateViewMode(value: string): void {
    const nextOptions = {
      gridEnabled,
      viewMode: value as GraphitePreviewViewMode
    };
    setViewMode(nextOptions.viewMode);
    void pushOptions(nextOptions);
  }

  function updateGridEnabled(checked: boolean): void {
    const nextOptions = {
      gridEnabled: checked,
      viewMode
    };
    setGridEnabled(checked);
    void pushOptions(nextOptions);
  }

  function commitPaintMasks(nextMasks: StampPaintMasks, pushPreview: boolean): void {
    paintMasksRef.current = nextMasks;
    setSaveMessage("Unsaved draft");
    setPaintMasks(nextMasks);
    if (pushPreview) {
      void pushSnapshot(stamp, nextMasks, previewOptions, footprintSizeCells, overlayDraft, terrainTextureAssets, selectedBiome);
    }
  }

  function applyPaintLayerDraw(x: number, z: number, mode: FootprintDrawMode): void {
    const key = `${x}:${z}`;
    const nextMasks = stampPaintMasksClone(paintMasksRef.current);
    if (paintLayer === "footprint") {
      if (mode === "erase") {
        nextMasks.footprint.delete(key);
        nextMasks.blocking.delete(key);
        nextMasks.foliage.delete(key);
      } else {
        nextMasks.footprint.add(key);
        nextMasks.blocking.add(key);
      }
      commitPaintMasks(nextMasks, false);
      return;
    }
    if (!nextMasks.footprint.has(key)) {
      return;
    }
    if (mode === "erase") {
      nextMasks[paintLayer].delete(key);
    } else {
      nextMasks[paintLayer].add(key);
    }
    commitPaintMasks(nextMasks, false);
  }

  function startPaintLayerDraw(event: PointerEvent<HTMLButtonElement>, x: number, z: number): void {
    event.preventDefault();
    setIsDrawing(true);
    applyPaintLayerDraw(x, z, drawMode);
  }

  function continuePaintLayerDraw(x: number, z: number): void {
    if (isDrawing) {
      applyPaintLayerDraw(x, z, drawMode);
    }
  }

  function clearActivePaintLayer(): void {
    const nextMasks = stampPaintMasksClone(paintMasksRef.current);
    if (paintLayer === "footprint") {
      nextMasks.footprint.clear();
      nextMasks.blocking.clear();
      nextMasks.foliage.clear();
    } else {
      nextMasks[paintLayer].clear();
    }
    commitPaintMasks(nextMasks, true);
  }

  function updateFootprintSize(value: string): void {
    const nextSize = Number(value) as FootprintSizeCells;
    if (!footprintSizeOptions.includes(nextSize)) {
      return;
    }
    const nextMasks = stampPaintMasksClip(paintMasksRef.current, nextSize);
    const nextStamp = {
      ...stamp,
      size: [nextSize * stampCellSizeMeters, nextSize * stampCellSizeMeters] as [number, number]
    };
    const nextTerrainHeightDraft = {
      ...terrainHeightDraft,
      valuesMeters: resizeTerrainHeightValues(terrainHeightDraft.valuesMeters, footprintSizeCells, nextSize)
    };
    paintMasksRef.current = nextMasks;
    setSaveMessage("Unsaved draft");
    setFootprintSizeCells(nextSize);
    setStamp(nextStamp);
    setPaintMasks(nextMasks);
    setTerrainHeightDraft(nextTerrainHeightDraft);
    void pushSnapshot(
      nextStamp,
      nextMasks,
      previewOptions,
      nextSize,
      overlayDraft,
      terrainTextureAssets,
      selectedBiome,
      nextTerrainHeightDraft
    );
  }

  function commitTerrainHeight(nextDraft: TerrainHeightDraft): void {
    setSaveMessage("Unsaved draft");
    setTerrainHeightDraft(nextDraft);
    void pushSnapshot(stamp, paintMasks, previewOptions, footprintSizeCells, overlayDraft, terrainTextureAssets, selectedBiome, nextDraft);
  }

  function paintTerrainHeightCorner(index: number): void {
    const nextValues = [...terrainHeightDraft.valuesMeters];
    nextValues[index] = terrainHeightDraft.brushHeightMeters;
    commitTerrainHeight({
      ...terrainHeightDraft,
      valuesMeters: nextValues
    });
  }

  function commitOverlay(nextOverlayDraft: StampOverlayDraft): void {
    setSaveMessage("Unsaved draft");
    setOverlayDraft(nextOverlayDraft);
    void pushSnapshot(stamp, paintMasks, previewOptions, footprintSizeCells, nextOverlayDraft, terrainTextureAssets, selectedBiome);
  }

  function updateOverlayEnabled(checked: boolean): void {
    commitOverlay({
      ...overlayDraft,
      enabled: checked
    });
  }

  function updateOverlayNumber(
    key: keyof Pick<
      StampOverlayDraft,
      | "bleed"
      | "edgeBreakup"
      | "edgeJitter"
      | "heightBlendWidth"
      | "heightSharpness"
      | "opacity"
      | "patchScale"
      | "roughnessBias"
      | "seed"
      | "textureScale"
      | "wetnessBias"
    >,
    value: number | string
  ): void {
    const current = overlayDraft[key];
    const nextValue = typeof value === "number" ? value : numberFromInput(value, current);
    commitOverlay({
      ...overlayDraft,
      [key]: nextValue
    });
  }

  function updateOverlayLayerAsset(value: unknown): void {
    setSelectedOverlayLayerAsset(typeof value === "string" ? value : "");
  }

  function addOverlayLayer(): void {
    if (!selectedOverlayLayerAsset || overlayDraft.layers.some((layer) => layer.assetId === selectedOverlayLayerAsset)) {
      return;
    }
    if (overlayDraft.layers.length >= maxOverlayLayers) {
      return;
    }
    const layerDefaults = stampOverlayLayerDefaults(selectedOverlayLayerAsset, selectedBiome, variantRows);
    commitOverlay({
      ...overlayDraft,
      layers: [
        ...overlayDraft.layers,
        {
          assetId: selectedOverlayLayerAsset,
          albedoSaturation: layerDefaults.albedoSaturation,
          albedoTint: layerDefaults.albedoTint,
          albedoTintStrength: layerDefaults.albedoTintStrength,
          heightInfluence: layerDefaults.heightInfluence,
          order: overlayDraft.layers.length,
          textureOffset: layerDefaults.textureOffset,
          textureRotation: layerDefaults.textureRotation,
          textureScale: layerDefaults.textureScale,
          weight: 1
        }
      ]
    });
    setSelectedOverlayLayerAsset("");
  }

  function updateCanRotate(checked: boolean): void {
    setSaveMessage("Unsaved draft");
    setCanRotate(checked);
  }

  function updateStampDescription(value: string): void {
    setSaveMessage("Unsaved draft");
    setStampDescription(value);
  }

  function removeOverlayLayer(assetId: string): void {
    commitOverlay({
      ...overlayDraft,
      layers: overlayDraft.layers
        .filter((layer) => layer.assetId !== assetId)
        .map((layer, index) => ({
          ...layer,
          order: index
        }))
    });
  }

  function updateOverlayLayerWeight(assetId: string, value: number | string): void {
    updateOverlayLayerNumber(assetId, "weight", value, 0, 1);
  }

  function updateOverlayLayerNumber(
    assetId: string,
    key: "albedoSaturation" | "albedoTintStrength" | "heightInfluence" | "textureRotation" | "weight",
    value: number | string,
    min: number,
    max: number
  ): void {
    commitOverlay({
      ...overlayDraft,
      layers: overlayDraft.layers.map((layer) => ({
        ...layer,
        [key]:
          layer.assetId === assetId
            ? clampNumber(typeof value === "number" ? value : numberFromInput(value, layer[key]), min, max)
            : layer[key]
      }))
    });
  }

  function updateOverlayLayerColor(assetId: string, value: string): void {
    commitOverlay({
      ...overlayDraft,
      layers: overlayDraft.layers.map((layer) => ({
        ...layer,
        albedoTint: layer.assetId === assetId ? value : layer.albedoTint
      }))
    });
  }

  function updateOverlayLayerVector(
    assetId: string,
    key: "textureOffset" | "textureScale",
    axis: 0 | 1,
    value: string,
    min: number,
    max: number
  ): void {
    commitOverlay({
      ...overlayDraft,
      layers: overlayDraft.layers.map((layer) => {
        if (layer.assetId !== assetId) {
          return layer;
        }
        const nextValue: [number, number] = [...layer[key]];
        nextValue[axis] = clampNumber(numberFromInput(value, layer[key][axis]), min, max);
        return {
          ...layer,
          [key]: nextValue
        };
      })
    });
  }

  async function saveStampDraft(): Promise<void> {
    if (!canSaveStamp) {
      setSaveMessage("Paint at least one footprint cell and add a Terrain Texture when overlay is enabled.");
      return;
    }

    try {
      setSaveMessage("Saving...");
      const stampKey = stampKeyFromName(stamp.debugName);
      const [stampsTableRaw, masksTableRaw, heightFieldsTableRaw, overlaysTableRaw, overlayLayersTableRaw] = await Promise.all([
        tableService.getById(STAMPS_TABLE.id),
        tableService.getById(STAMP_MASKS_TABLE.id),
        tableService.getById(STAMP_HEIGHT_FIELDS_TABLE.id),
        tableService.getById(STAMP_OVERLAYS_TABLE.id),
        tableService.getById(STAMP_OVERLAY_LAYERS_TABLE.id)
      ]);
      const stampsTable = requireSystemTable(stampsTableRaw, STAMPS_TABLE.id);
      const masksTable = requireSystemTable(masksTableRaw, STAMP_MASKS_TABLE.id);
      const heightFieldsTable = requireSystemTable(heightFieldsTableRaw, STAMP_HEIGHT_FIELDS_TABLE.id);
      const overlaysTable = requireSystemTable(overlaysTableRaw, STAMP_OVERLAYS_TABLE.id);
      const overlayLayersTable = requireSystemTable(overlayLayersTableRaw, STAMP_OVERLAY_LAYERS_TABLE.id);

      const rootRow = systemTableRow(stampsTable, `${stampKey}_root`, {
        can_rotate: canRotate,
        cell_size_meters: stampCellSizeMeters,
        default_biome: selectedBiome,
        description: stampDescription,
        editable_size_cells: [footprintSizeCells, footprintSizeCells],
        key: stampKey,
        name: stamp.debugName.trim(),
        notes: "",
        stamp_kind: "terrain"
      });
      const maskRows = [
        systemTableRow(masksTable, `${stampKey}_mask_footprint`, {
          blocker_mask: [],
          description: "Root editable footprint for this stamp.",
          key: "footprint",
          kind: "footprint",
          mask: cellMaskValue(paintMasks.footprint, footprintSizeCells),
          stamp: stampKey,
          traversal_cost_delta: 0,
          weight: 1
        }),
        systemTableRow(masksTable, `${stampKey}_mask_blocking`, {
          blocker_mask: ["structure"],
          description: "Simulation blocking mask seeded from the footprint.",
          key: "blocking",
          kind: "blocking",
          mask: cellMaskValue(paintMasks.blocking, footprintSizeCells),
          stamp: stampKey,
          traversal_cost_delta: stamp.traversalCostDelta,
          weight: 1
        }),
        systemTableRow(masksTable, `${stampKey}_mask_foliage`, {
          blocker_mask: [],
          description: "Foliage inpaint/suppression mask.",
          key: "foliage",
          kind: "foliage",
          mask: cellMaskValue(paintMasks.foliage, footprintSizeCells),
          stamp: stampKey,
          traversal_cost_delta: 0,
          weight: 1
        })
      ];
      const overlayRow = systemTableRow(overlaysTable, `${stampKey}_overlay_0`, {
        algorithm: "height_patch_blend",
        bleed: overlayDraft.bleed,
        description: "Primary reversible procedural terrain overlay.",
        enabled: overlayDraft.enabled,
        edge_breakup: overlayDraft.edgeBreakup,
        edge_jitter: overlayDraft.edgeJitter,
        height_blend_width: overlayDraft.heightBlendWidth,
        height_sharpness: overlayDraft.heightSharpness,
        key: "overlay_0",
        mask: "footprint",
        opacity: overlayDraft.opacity,
        patch_scale: overlayDraft.patchScale,
        roughness_bias: overlayDraft.roughnessBias,
        seed: overlayDraft.seed,
        stamp: stampKey,
        texture_scale: overlayDraft.textureScale,
        wetness_bias: overlayDraft.wetnessBias
      });
      const heightFieldRow = systemTableRow(heightFieldsTable, `${stampKey}_height_field`, {
        blend_mode: terrainHeightDraft.blendMode,
        description: "Signed terrain height patch in meters.",
        field: terrainHeightFieldValue(terrainHeightDraft, footprintSizeCells),
        influence_mask: "footprint",
        key: "height_field",
        pivot_meters: [(footprintSizeCells * stampCellSizeMeters) / 2, (footprintSizeCells * stampCellSizeMeters) / 2],
        stamp: stampKey
      });
      const overlayLayerRows = overlayDraft.layers.map((layer, index) =>
        systemTableRow(overlayLayersTable, `${stampKey}_overlay_layer_${index}`, {
          albedo_saturation: layer.albedoSaturation,
          albedo_tint: layer.albedoTint,
          albedo_tint_strength: layer.albedoTintStrength,
          height_influence: layer.heightInfluence,
          order: index,
          overlay: "overlay_0",
          stamp: stampKey,
          terrain_texture: layer.assetId,
          texture_offset: layer.textureOffset,
          texture_rotation: layer.textureRotation,
          texture_scale: layer.textureScale,
          weight: layer.weight
        })
      );
      const overlayLayerRowIds = new Set(
        Array.from({ length: maxOverlayLayers }, (_, index) => stableNanoId(`${overlayLayersTable.id}_${stampKey}_overlay_layer_${index}`))
      );

      await Promise.all([
        tableService.saveSystemTableRows(stampsTable.id, upsertRows(stampsTable.rows, [rootRow])),
        tableService.saveSystemTableRows(masksTable.id, upsertRows(masksTable.rows, maskRows)),
        tableService.saveSystemTableRows(heightFieldsTable.id, upsertRows(heightFieldsTable.rows, [heightFieldRow])),
        tableService.saveSystemTableRows(overlaysTable.id, upsertRows(overlaysTable.rows, [overlayRow])),
        tableService.saveSystemTableRows(
          overlayLayersTable.id,
          replaceRowsById(overlayLayersTable.rows, overlayLayerRowIds, overlayLayerRows)
        )
      ]);
      setSaveMessage(`Saved ${stampKey}`);
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Save failed");
    }
  }

  const selectedPaintLayer = paintLayerOptions.find((option) => option.value === paintLayer) ?? paintLayerOptions[0];
  const activePaintLayerCellCount = stampPaintMasksLayerSize(paintMasks, paintLayer);
  const terrainInfluenceValues = terrainCornerInfluenceValues(paintMasks.footprint, footprintSizeCells);
  return (
    <section className="flex min-h-full min-w-0 flex-col gap-4">
      <PageHeader
        title="Stamp Editor"
        description="Author cell-locked stamp footprints, terrain modifiers, sim blockers, foliage suppression, and prefab contents."
      />

      <section className="space-y-3 border border-border bg-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="max-w-xl space-y-1">
              <Label className="text-xs text-muted-foreground" htmlFor="stamp-name">
                Name
              </Label>
              <Input
                className="h-8"
                id="stamp-name"
                value={stamp.debugName}
                onChange={(event) =>
                  commitStamp({
                    ...stamp,
                    debugName: event.target.value
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground" htmlFor="stamp-description">
                Description
              </Label>
              <Textarea
                className="min-h-16"
                id="stamp-description"
                placeholder="Optional authoring notes for this stamp."
                value={stampDescription}
                onChange={(event) => updateStampDescription(event.target.value)}
              />
            </div>
          </div>
          <div className="flex min-w-56 flex-col items-end gap-2">
            <Button disabled={!canSaveStamp} onClick={() => void saveStampDraft()} size="sm" type="button">
              Save
            </Button>
            <Badge className="max-w-64 truncate" variant={canSaveStamp ? "outline" : "secondary"}>
              {saveMessage}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Label className="flex h-8 items-center justify-between gap-2 border border-border px-2 text-xs">
            Can rotate on placement
            <Switch checked={canRotate} onCheckedChange={updateCanRotate} />
          </Label>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground" htmlFor="stamp-default-biome">
              Biome
            </Label>
            <Select disabled={biomeOptions.length === 0} value={selectedBiome} onValueChange={updateSelectedBiome}>
              <SelectTrigger className="h-8 w-44" id="stamp-default-biome">
                <SelectValue placeholder="No biomes" />
              </SelectTrigger>
              <SelectContent>
                {biomeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Badge variant="secondary">
            Footprint {footprintSizeCells} x {footprintSizeCells}
          </Badge>
          <Badge variant="secondary">{stampCellSizeMeters}m cells</Badge>
          <Badge variant="secondary">{footprintPaddingCells} cell padding</Badge>
          <Badge variant="outline">Footprint {paintMasks.footprint.size}</Badge>
          <Badge variant="outline">Blocking {paintMasks.blocking.size}</Badge>
          <Badge variant="outline">Foliage {paintMasks.foliage.size}</Badge>
          <Badge variant={previewState.status === "error" ? "destructive" : "outline"}>Preview {previewState.status}</Badge>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-background p-3">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold">Graphite Stamp Preview</p>
          <Badge variant="secondary">2m cells</Badge>
          <Badge
            className="w-80 truncate"
            title={previewState.message}
            variant={previewState.status === "error" ? "destructive" : "outline"}
          >
            {previewState.message}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs text-muted-foreground" htmlFor="stamp-preview-view-mode">
            View
          </Label>
          <Select onValueChange={updateViewMode} value={viewMode}>
            <SelectTrigger className="h-8 w-36" id="stamp-preview-view-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {previewViewModeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 px-1">
            <Switch checked={gridEnabled} id="stamp-preview-grid" onCheckedChange={updateGridEnabled} />
            <Label className="text-xs text-muted-foreground" htmlFor="stamp-preview-grid">
              Grid
            </Label>
          </div>
          <Button onClick={() => void previewService.resetView("stamp")} size="sm" type="button" variant="outline">
            Reset View
          </Button>
        </div>
      </div>

      <section className="space-y-3 border border-border bg-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Footprint Cells</p>
            <p className="text-xs text-muted-foreground">
              Paint 2m cells inside the editable footprint. Blocking follows new footprint cells by default; foliage starts empty.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs text-muted-foreground" htmlFor="stamp-paint-layer">
              Layer
            </Label>
            <Select onValueChange={(value) => setPaintLayer(value as StampPaintLayer)} value={paintLayer}>
              <SelectTrigger className="h-8 w-32" id="stamp-paint-layer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paintLayerOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label className="text-xs text-muted-foreground" htmlFor="stamp-footprint-size">
              Area
            </Label>
            <Select onValueChange={updateFootprintSize} value={`${footprintSizeCells}`}>
              <SelectTrigger className="h-8 w-32" id="stamp-footprint-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {footprintSizeOptions.map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size} x {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              aria-pressed={drawMode === "paint"}
              onClick={() => setDrawMode("paint")}
              size="sm"
              type="button"
              variant={drawMode === "paint" ? "secondary" : "outline"}
            >
              Paint
            </Button>
            <Button
              aria-pressed={drawMode === "erase"}
              onClick={() => setDrawMode("erase")}
              size="sm"
              type="button"
              variant={drawMode === "erase" ? "secondary" : "outline"}
            >
              Erase
            </Button>
            <Button disabled={activePaintLayerCellCount === 0} onClick={clearActivePaintLayer} size="sm" type="button" variant="outline">
              Clear Layer
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{selectedPaintLayer.description}</p>
        <ScrollArea className="h-[30rem] w-full border border-border">
          <div className={`grid w-max ${footprintGridColumnClassMap[footprintSizeCells]} gap-px p-2`}>
            {Array.from({ length: footprintSizeCells * footprintSizeCells }).map((_, index) => {
              const x = index % footprintSizeCells;
              const z = Math.floor(index / footprintSizeCells);
              const key = `${x}:${z}`;
              const isFootprint = paintMasks.footprint.has(key);
              const isPaintLayerActive = paintMasks[paintLayer].has(key);
              const canEditCell = paintLayer === "footprint" || isFootprint;
              return (
                <Button
                  aria-label={`Paint ${paintLayer} cell ${x},${z}`}
                  aria-pressed={isPaintLayerActive}
                  className={cn(
                    "size-5 p-0 text-[0px]",
                    isFootprint && paintLayer !== "footprint" && "border-sky-500/40 bg-sky-500/15",
                    isPaintLayerActive && paintLayerActiveClassMap[paintLayer],
                    !canEditCell && "opacity-25"
                  )}
                  disabled={!canEditCell}
                  key={key}
                  onPointerDown={(event) => startPaintLayerDraw(event, x, z)}
                  onPointerEnter={() => continuePaintLayerDraw(x, z)}
                  size="sm"
                  title={`${x},${z}`}
                  type="button"
                  variant="outline"
                />
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <p className="text-xs text-muted-foreground">
          Footprint {paintMasks.footprint.size} cells, blocking {paintMasks.blocking.size} cells, foliage {paintMasks.foliage.size} cells.
          Canvas is {footprintSizeCells * stampCellSizeMeters}m x {footprintSizeCells * stampCellSizeMeters}m with {footprintPaddingCells}{" "}
          cells of preview padding.
        </p>
      </section>

      <section className="space-y-3 border border-border bg-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Terrain Height Patch</p>
            <p className="text-xs text-muted-foreground">Paint signed corner heights. The footprint supplies the terrain influence mask.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs text-muted-foreground" htmlFor="stamp-terrain-blend">
              Blend
            </Label>
            <Select
              onValueChange={(value) =>
                commitTerrainHeight({
                  ...terrainHeightDraft,
                  blendMode: value as TerrainStampBlendMode
                })
              }
              value={terrainHeightDraft.blendMode}
            >
              <SelectTrigger className="h-8 w-28" id="stamp-terrain-blend">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Add</SelectItem>
                <SelectItem value="replace">Replace</SelectItem>
              </SelectContent>
            </Select>
            <Label className="text-xs text-muted-foreground" htmlFor="stamp-terrain-height-brush">
              Height (m)
            </Label>
            <Input
              className="h-8 w-24"
              id="stamp-terrain-height-brush"
              max="100"
              min="-100"
              step="0.25"
              type="number"
              value={terrainHeightDraft.brushHeightMeters}
              onChange={(event) =>
                setTerrainHeightDraft({
                  ...terrainHeightDraft,
                  brushHeightMeters: clampNumber(numberFromInput(event.target.value, 0), -100, 100)
                })
              }
            />
            <Button
              disabled={terrainHeightDraft.valuesMeters.every((height) => height === 0)}
              onClick={() =>
                commitTerrainHeight({
                  ...terrainHeightDraft,
                  valuesMeters: terrainHeightDraft.valuesMeters.map(() => 0)
                })
              }
              size="sm"
              type="button"
              variant="outline"
            >
              Clear
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[30rem] w-full border border-border">
          <div className="grid w-max gap-px p-2" style={{ gridTemplateColumns: `repeat(${footprintSizeCells + 1}, 2rem)` }}>
            {terrainHeightDraft.valuesMeters.map((height, index) => {
              const influence = terrainInfluenceValues[index];
              const x = index % (footprintSizeCells + 1);
              const z = Math.floor(index / (footprintSizeCells + 1));
              return (
                <Button
                  aria-label={`Set terrain height corner ${x},${z} to ${terrainHeightDraft.brushHeightMeters} meters`}
                  className={cn(
                    "h-8 w-8 p-0 font-mono text-[9px]",
                    height > 0 && "border-amber-400 bg-amber-500/30",
                    height < 0 && "border-sky-400 bg-sky-500/30",
                    influence === 0 && "opacity-25"
                  )}
                  disabled={influence === 0}
                  key={`${x}:${z}`}
                  onClick={() => paintTerrainHeightCorner(index)}
                  title={`${x},${z}: ${height.toFixed(2)}m`}
                  type="button"
                  variant="outline"
                >
                  {height === 0 ? "" : height.toFixed(1)}
                </Button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="space-y-3 border border-border bg-background p-4">
            <div>
              <p className="text-sm font-semibold">Terrain Overlay</p>
              <p className="text-xs text-muted-foreground">
                Opt-in procedural overlay using Terrain Textures. It blends above terrain and does not mutate splats, sim surfaces, or mesh
                data.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Label className="flex h-8 items-center justify-between gap-2 border border-border px-2 text-xs">
                Enable overlay
                <Switch checked={overlayDraft.enabled} onCheckedChange={updateOverlayEnabled} />
              </Label>
              <Badge variant="secondary">height patch blend</Badge>
              <Badge variant={overlayDraft.layers.length > 0 ? "outline" : "secondary"}>{overlayDraft.layers.length}/4 layers</Badge>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground" htmlFor="stamp-overlay-bleed">
                  Bleed
                </Label>
                <Input
                  className="h-8"
                  id="stamp-overlay-bleed"
                  min="0"
                  step="0.05"
                  type="number"
                  value={overlayDraft.bleed}
                  onChange={(event) => updateOverlayNumber("bleed", event.target.value)}
                />
              </div>
              <RangeField
                id="stamp-overlay-texture-scale"
                label="Texture Scale"
                max={2}
                min={0.02}
                step={0.01}
                value={overlayDraft.textureScale}
                onChange={(value) => updateOverlayNumber("textureScale", value)}
              />
              <RangeField
                id="stamp-overlay-patch-scale"
                label="Patch Scale"
                max={2}
                min={0.01}
                step={0.01}
                value={overlayDraft.patchScale}
                onChange={(value) => updateOverlayNumber("patchScale", value)}
              />
              <RangeField
                id="stamp-overlay-height-sharpness"
                label="Height Sharpness"
                max={12}
                min={0}
                step={0.1}
                value={overlayDraft.heightSharpness}
                onChange={(value) => updateOverlayNumber("heightSharpness", value)}
              />
              <RangeField
                id="stamp-overlay-height-blend-width"
                label="Height Blend Width"
                max={1}
                min={0.005}
                step={0.005}
                value={overlayDraft.heightBlendWidth}
                onChange={(value) => updateOverlayNumber("heightBlendWidth", value)}
              />
              <RangeField
                id="stamp-overlay-opacity"
                label="Opacity"
                max={1}
                min={0}
                step={0.01}
                value={overlayDraft.opacity}
                onChange={(value) => updateOverlayNumber("opacity", value)}
              />
              <SignedRangeField
                id="stamp-overlay-wetness-bias"
                label="Wetness Bias"
                max={1}
                min={-1}
                step={0.01}
                value={overlayDraft.wetnessBias}
                onChange={(value) => updateOverlayNumber("wetnessBias", value)}
              />
              <RangeField
                id="stamp-overlay-edge-jitter"
                label="Edge Jitter"
                max={1}
                min={0}
                step={0.01}
                value={overlayDraft.edgeJitter}
                onChange={(value) => updateOverlayNumber("edgeJitter", value)}
              />
              <RangeField
                id="stamp-overlay-edge-breakup"
                label="Edge Breakup"
                max={1}
                min={0}
                step={0.01}
                value={overlayDraft.edgeBreakup}
                onChange={(value) => updateOverlayNumber("edgeBreakup", value)}
              />
              <SignedRangeField
                id="stamp-overlay-roughness-bias"
                label="Roughness Bias"
                max={1}
                min={-1}
                step={0.01}
                value={overlayDraft.roughnessBias}
                onChange={(value) => updateOverlayNumber("roughnessBias", value)}
              />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground" htmlFor="stamp-overlay-seed">
                  Seed
                </Label>
                <Input
                  className="h-8"
                  id="stamp-overlay-seed"
                  min="0"
                  step="1"
                  type="number"
                  value={overlayDraft.seed}
                  onChange={(event) => updateOverlayNumber("seed", event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2 border border-border p-3">
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                <AssetRefCellEditor
                  column={stampOverlayLayerAssetColumn}
                  value={selectedOverlayLayerAsset}
                  onCommit={updateOverlayLayerAsset}
                />
                <Button
                  disabled={!selectedOverlayLayerAsset || overlayDraft.layers.length >= maxOverlayLayers}
                  onClick={addOverlayLayer}
                  size="sm"
                  type="button"
                >
                  Add Layer
                </Button>
              </div>
              {overlayDraft.layers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No Terrain Textures selected. Overlay preview stays empty until one is added.
                </p>
              )}
              {overlayDraft.layers.map((layer) => {
                const asset = terrainTextureAssets.get(layer.assetId);
                return (
                  <div
                    className="grid gap-3 border border-border p-2 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,32rem)_auto]"
                    key={layer.assetId}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{asset?.name ?? layer.assetId}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{asset?.relativePath ?? "missing terrain texture"}</p>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground" htmlFor={`stamp-overlay-layer-${layer.assetId}-tint`}>
                          Tint
                        </Label>
                        <Input
                          className="h-8 w-full p-1"
                          id={`stamp-overlay-layer-${layer.assetId}-tint`}
                          title="Tint shifts this overlay texture toward a shared palette before overlay mixing and lighting."
                          type="color"
                          value={layer.albedoTint}
                          onChange={(event) => updateOverlayLayerColor(layer.assetId, event.target.value)}
                        />
                      </div>
                      <RangeField
                        id={`stamp-overlay-layer-${layer.assetId}-tint-strength`}
                        label="Tint Strength"
                        max={1}
                        min={0}
                        step={0.01}
                        tooltip="Higher values make the tint color take over more strongly; 0 leaves this texture unchanged."
                        value={layer.albedoTintStrength}
                        onChange={(value) => updateOverlayLayerNumber(layer.assetId, "albedoTintStrength", value, 0, 1)}
                      />
                      <RangeField
                        id={`stamp-overlay-layer-${layer.assetId}-saturation`}
                        label="Saturation"
                        max={2}
                        min={0}
                        step={0.01}
                        tooltip="Higher values push color separation harder; lower values make this texture more neutral."
                        value={layer.albedoSaturation}
                        onChange={(value) => updateOverlayLayerNumber(layer.assetId, "albedoSaturation", value, 0, 2)}
                      />
                      <RangeField
                        id={`stamp-overlay-layer-${layer.assetId}-weight`}
                        label="Weight"
                        max={1}
                        min={0}
                        step={0.01}
                        value={layer.weight}
                        onChange={(value) => updateOverlayLayerWeight(layer.assetId, value)}
                      />
                      <RangeField
                        id={`stamp-overlay-layer-${layer.assetId}-height`}
                        label="Height Influence"
                        max={4}
                        min={0}
                        step={0.01}
                        value={layer.heightInfluence}
                        onChange={(value) => updateOverlayLayerNumber(layer.assetId, "heightInfluence", value, 0, 4)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground" htmlFor={`stamp-overlay-layer-${layer.assetId}-scale-x`}>
                            Scale X
                          </Label>
                          <Input
                            className="h-8"
                            id={`stamp-overlay-layer-${layer.assetId}-scale-x`}
                            min="0.0001"
                            step="0.01"
                            type="number"
                            value={layer.textureScale[0]}
                            onChange={(event) => updateOverlayLayerVector(layer.assetId, "textureScale", 0, event.target.value, 0.0001, 64)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground" htmlFor={`stamp-overlay-layer-${layer.assetId}-scale-z`}>
                            Scale Z
                          </Label>
                          <Input
                            className="h-8"
                            id={`stamp-overlay-layer-${layer.assetId}-scale-z`}
                            min="0.0001"
                            step="0.01"
                            type="number"
                            value={layer.textureScale[1]}
                            onChange={(event) => updateOverlayLayerVector(layer.assetId, "textureScale", 1, event.target.value, 0.0001, 64)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground" htmlFor={`stamp-overlay-layer-${layer.assetId}-offset-x`}>
                            Offset X
                          </Label>
                          <Input
                            className="h-8"
                            id={`stamp-overlay-layer-${layer.assetId}-offset-x`}
                            step="0.01"
                            type="number"
                            value={layer.textureOffset[0]}
                            onChange={(event) =>
                              updateOverlayLayerVector(layer.assetId, "textureOffset", 0, event.target.value, -1024, 1024)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground" htmlFor={`stamp-overlay-layer-${layer.assetId}-offset-z`}>
                            Offset Z
                          </Label>
                          <Input
                            className="h-8"
                            id={`stamp-overlay-layer-${layer.assetId}-offset-z`}
                            step="0.01"
                            type="number"
                            value={layer.textureOffset[1]}
                            onChange={(event) =>
                              updateOverlayLayerVector(layer.assetId, "textureOffset", 1, event.target.value, -1024, 1024)
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label className="text-xs text-muted-foreground" htmlFor={`stamp-overlay-layer-${layer.assetId}-rotation`}>
                          Rotation Degrees
                        </Label>
                        <Input
                          className="h-8"
                          id={`stamp-overlay-layer-${layer.assetId}-rotation`}
                          max="180"
                          min="-180"
                          step="1"
                          type="number"
                          value={layer.textureRotation}
                          onChange={(event) => updateOverlayLayerNumber(layer.assetId, "textureRotation", event.target.value, -180, 180)}
                        />
                      </div>
                    </div>
                    <Button
                      className="self-start"
                      onClick={() => removeOverlayLayer(layer.assetId)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Remove
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-3 border border-border bg-background p-4">
            <div>
              <p className="text-sm font-semibold">Simulation</p>
              <p className="text-xs text-muted-foreground">
                Blocking cells write the simulation blocker mask. Cost is saved with the blocking mask and affects traversal later.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground" htmlFor="stamp-cost">
                  Cost
                </Label>
                <Input
                  className="h-8"
                  id="stamp-cost"
                  step="0.05"
                  type="number"
                  value={stamp.traversalCostDelta}
                  onChange={(event) => updateStampNumber("traversalCostDelta", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Blocking Mask</Label>
                <div className="flex h-8 items-center border border-border px-2 text-xs text-muted-foreground">
                  {paintMasks.blocking.size} cells, blocker structure
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="border border-border bg-background p-4">
          <p className="text-sm font-semibold">Prefab And Markers</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Placeholder for the next pass. Prefab asset refs and marker transforms are not painted masks; they will be authored with
            transform controls inside the Graphite preview window and persisted through stamp prefab/marker system tables.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Terrain Overlays are active now as reversible, terrain-compatible stamp coverage. Freeform prefab transforms and marker tools
            come later with the dedicated preview-window transform controls.
          </p>
        </aside>
      </section>
    </section>
  );
};

export default StampEditorScreen;
