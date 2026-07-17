import { type FC, useEffect, useRef, useState } from "react";
import { debounce } from "lodash";
import { nanoid } from "nanoid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ControlTooltipLabel from "@/components/controls/control-tooltip-label";
import RangeField from "@/components/controls/range-field";
import PageHeader from "@/components/page-header";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import { TERRAIN_BIOMES_TABLE, TERRAIN_VARIANTS_TABLE } from "@/constants/system-tables";
import useListAssetsQuery from "@/hooks/use-list-assets-query";
import useListTablesQuery from "@/hooks/use-list-tables-query";
import previewService from "@/services/preview-service";
import tableService from "@/services/table-service";
import CacheUtils from "@/utils/cache-utils";
import { buildTerrainBiomePreviewConfig } from "@/utils/terrain-biome-preview";
import type { DataTableRow, SystemDataTable } from "../../../../shared/schemas";
import {
  AssetTypeEnum,
  type GraphitePreviewSnapshotConfig,
  type GraphitePreviewState,
  type GraphitePreviewTerrainBiomeConfig
} from "../../../../shared/types";
import TerrainVariantTexturePreview from "./terrain-variant-texture-preview";

const MAX_TERRAIN_VARIANTS = 16;

const splatEditorTooltips = {
  addVariant: "Adds one more material slice to the procedural zone shader. The editor assigns the runtime ID from row order.",
  biomeSelect: "Selects which zones-only terrain splat you are editing and previewing.",
  biomeKey: "This becomes the generated biome file key. Changing it also moves existing variant rows to the new key.",
  biomeName: "This label appears in Chisel and the Graphite preview overlay.",
  heightBlendWidth: "Larger values let material height influence a wider overlap area. Smaller values make zone transitions crisper.",
  macroScale: "Lower values make broad color shifts span more terrain. Higher values make smaller tint patches.",
  macroStrength: "Higher values make broad color breakup more visible across repeated terrain textures.",
  macroTintStrength: "Higher values let macro color variation affect the whole biome more strongly.",
  normalStrength: "Higher values make this material's bumps and grooves catch more light.",
  roughness: "Lower values look smoother and more reflective. Higher values look dry and matte.",
  samplingBlend: "Higher values soften stochastic material patch changes. Lower values make sampling changes more abrupt.",
  samplingMode: "Stochastic breaks texture repetition. Repeat tiles plainly. Wang is reserved until Wang tile sets exist.",
  samplingOffset: "Higher values shift stochastic patches farther in UV space, which breaks repetition but can become noisy.",
  samplingScale: "Higher values create smaller stochastic sampling patches. Lower values create broader patches.",
  save: "Writes the Splat Editor draft into the authoritative Chisel biome and variant system tables.",
  textureScale: "Higher values tile this variant more often. Lower values make the material detail appear larger.",
  tint: "The sampled albedo is multiplied toward this color before blending and lighting.",
  tintStrength: "0 leaves the source color unchanged. 1 fully applies the tint color.",
  saturation: "Higher values push texture color separation harder. Lower values make it more neutral.",
  terrainTexture: "This Terrain Texture package supplies the packed base and surface maps sampled by this variant.",
  uvScale: "Higher values make every variant tile more often across the biome.",
  wetness: "Higher values add a thin water-film response with darker diffuse color and stronger grazing reflection.",
  zoneBlendWidth: "Higher values widen procedural zone overlap. Lower values make zone borders tighter.",
  zoneContrast: "Higher values create stronger islands. Lower values make the zone noise smoother and flatter.",
  zoneEdgeBreakup: "Higher values roughen zone borders so transitions look less blobby.",
  zoneEnd: "This variant stops participating after this procedural zone value.",
  zoneNoiseScale: "Higher values create smaller procedural material regions. Lower values create larger regions.",
  zoneSeed: "Changing this reshuffles procedural zone placement without editing texture assets.",
  zoneStart: "This variant starts participating at this procedural zone value.",
  zoneWeight: "Higher values make this variant compete harder when ranges overlap."
};

function cloneDefaultValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return [...value];
  }
  if (value && typeof value === "object") {
    return { ...value };
  }
  return value;
}

function normalizeBiomeKey(value: string): string {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (key) {
    return key;
  }
  return "new_biome";
}

function rowValueByName(table: SystemDataTable, row: DataTableRow | undefined, name: string): unknown {
  const column = table.columns.find((entry) => entry.name === name);
  if (!column) {
    return "";
  }
  const value = row?.values.find((entry) => entry.columnId === column.id)?.value;
  if (value === undefined || value === null) {
    return cloneDefaultValue(column.defaultValue);
  }
  return value;
}

function textValueByName(table: SystemDataTable, row: DataTableRow | undefined, name: string): string {
  const value = rowValueByName(table, row, name);
  if (typeof value === "string") {
    return value;
  }
  return `${value ?? ""}`;
}

function numberValueByName(table: SystemDataTable, row: DataTableRow | undefined, name: string): number {
  const value = rowValueByName(table, row, name);
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return 0;
}

function vector2ValueByName(table: SystemDataTable, row: DataTableRow | undefined, name: string): [number, number] {
  const value = rowValueByName(table, row, name);
  if (Array.isArray(value) && value.length >= 2) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    return [Number.isFinite(x) ? x : 1, Number.isFinite(y) ? y : 1];
  }
  return [1, 1];
}

function tableRowFromValues(table: SystemDataTable, valuesByName: Record<string, unknown>, existingRow?: DataTableRow): DataTableRow {
  return {
    id: existingRow?.id ?? nanoid(),
    values: table.columns.map((column) => ({
      columnId: column.id,
      type: column.type,
      value: Object.prototype.hasOwnProperty.call(valuesByName, column.name)
        ? valuesByName[column.name]
        : rowValueByName(table, existingRow, column.name)
    })) as DataTableRow["values"]
  };
}

function updateRowValues(table: SystemDataTable, row: DataTableRow, nextValuesByName: Record<string, unknown>): DataTableRow {
  const currentValuesByName = Object.fromEntries(table.columns.map((column) => [column.name, rowValueByName(table, row, column.name)]));
  return tableRowFromValues(table, { ...currentValuesByName, ...nextValuesByName }, row);
}

function updateRowValue(table: SystemDataTable, row: DataTableRow, name: string, value: unknown): DataTableRow {
  return updateRowValues(table, row, { [name]: value });
}

function replaceRow(rows: DataTableRow[], nextRow: DataTableRow): DataTableRow[] {
  return rows.map((row) => (row.id === nextRow.id ? nextRow : row));
}

function nextBiomeId(rows: DataTableRow[]): number {
  const maxId = rows.reduce((maxValue, row) => Math.max(maxValue, numberValueByName(TERRAIN_BIOMES_TABLE, row, "id")), 0);
  return maxId + 1;
}

function nextBiomeKey(rows: DataTableRow[]): string {
  const usedKeys = new Set(rows.map((row) => textValueByName(TERRAIN_BIOMES_TABLE, row, "file_name")));
  let index = rows.length + 1;
  let key = `splat_${index}`;
  while (usedKeys.has(key)) {
    index += 1;
    key = `splat_${index}`;
  }
  return key;
}

function createBiomeRow(biomeRows: DataTableRow[]): DataTableRow {
  const key = nextBiomeKey(biomeRows);
  return tableRowFromValues(TERRAIN_BIOMES_TABLE, {
    file_name: key,
    id: nextBiomeId(biomeRows),
    name: "New Splat",
    variant_count: 0
  });
}

function createVariantRow(biomeKey: string, terrainTextureId: string): DataTableRow {
  return tableRowFromValues(TERRAIN_VARIANTS_TABLE, {
    biome: biomeKey,
    id: 0,
    terrain_texture: terrainTextureId
  });
}

function buildSplatPreviewSnapshot(splatName: string, terrainBiome?: GraphitePreviewTerrainBiomeConfig): GraphitePreviewSnapshotConfig {
  return {
    camera: {
      distance: 96,
      fovDegrees: 42,
      pitchDegrees: 55,
      target: [0, 0.4, 0],
      yawDegrees: 45
    },
    debugName: `Chisel Splat Preview: ${splatName}`,
    kind: "fixed_scene",
    previewOptions: {
      gridEnabled: false,
      viewMode: "terrain"
    },
    schemaVersion: 1,
    snapshotVersion: 1,
    stamps: [],
    terrainBiome,
    terrainOverlays: [],
    terrainPreview: {
      chunkCount: [1, 1],
      chunkWorldSize: 96,
      editableCellCount: [32, 32],
      paddingCells: 4,
      settingsControlled: false,
      slotSize: 2
    }
  };
}

const BiomeEditorScreen: FC = () => {
  const { assets } = useListAssetsQuery();
  const { areTablesLoading, tables } = useListTablesQuery();
  const terrainTextures = assets.filter((asset) => asset.type === AssetTypeEnum.terrainTexture);
  const terrainTexturesById = new Map(terrainTextures.map((asset) => [asset.id, asset]));
  const [biomeRows, setBiomeRows] = useState<DataTableRow[]>([]);
  const [variantRows, setVariantRows] = useState<DataTableRow[]>([]);
  const [selectedBiomeRowId, setSelectedBiomeRowId] = useState("");
  const [saveMessage, setSaveMessage] = useState("Unsaved splat draft");
  const [previewState, setPreviewState] = useState<GraphitePreviewState>({
    message: "Use the global Preview button to start Graphite.",
    running: false,
    status: "stopped"
  });
  const previewStateRef = useRef(previewState);
  const previewSnapshotRef = useRef<GraphitePreviewSnapshotConfig | undefined>(undefined);
  const debouncedPreviewUpdateRef = useRef<ReturnType<typeof debounce>>();

  const selectedBiomeRow = biomeRows.find((row) => row.id === selectedBiomeRowId);
  const selectedBiomeKey = textValueByName(TERRAIN_BIOMES_TABLE, selectedBiomeRow, "file_name");
  const selectedBiomeName = textValueByName(TERRAIN_BIOMES_TABLE, selectedBiomeRow, "name");
  const selectedVariantRows = variantRows
    .filter((row) => textValueByName(TERRAIN_VARIANTS_TABLE, row, "biome") === selectedBiomeKey)
    .sort((left, right) => numberValueByName(TERRAIN_VARIANTS_TABLE, left, "id") - numberValueByName(TERRAIN_VARIANTS_TABLE, right, "id"));

  useEffect(() => {
    const debouncedPreviewUpdate = debounce(async (snapshot: GraphitePreviewSnapshotConfig) => {
      if (!previewStateRef.current.running && previewStateRef.current.status !== "starting") {
        return;
      }
      const state = await previewService.updateSnapshot(snapshot);
      setPreviewState(state);
    }, 180);

    debouncedPreviewUpdateRef.current = debouncedPreviewUpdate;
    return () => {
      debouncedPreviewUpdate.cancel();
    };
  }, []);

  useEffect(() => {
    previewStateRef.current = previewState;
  }, [previewState]);

  useEffect(() => {
    const biomeTable = tables.find((table) => table.id === TERRAIN_BIOMES_TABLE.id);
    const variantTable = tables.find((table) => table.id === TERRAIN_VARIANTS_TABLE.id);
    if (biomeTable?.kind === "system") {
      setBiomeRows(biomeTable.rows);
      setSelectedBiomeRowId((current) => current || biomeTable.rows[0]?.id || "");
    }
    if (variantTable?.kind === "system") {
      setVariantRows(variantTable.rows);
    }
  }, [tables]);

  useEffect(() => {
    let mounted = true;
    void previewService.getStatus().then((state) => {
      if (mounted) {
        setPreviewState(state);
      }
    });
    const unsubscribe = window.electron.onGraphitePreviewEvent((event) => {
      if (event.type !== "log") {
        setPreviewState(event);
      }
      if (event.type === "ready" && previewSnapshotRef.current) {
        void previewService.updateSnapshot(previewSnapshotRef.current).then(setPreviewState);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!selectedBiomeRow) {
      previewSnapshotRef.current = undefined;
      return;
    }
    const terrainBiome = buildTerrainBiomePreviewConfig({
      assets,
      biomeKey: selectedBiomeKey,
      biomeRows,
      variantRows
    });
    const snapshot = buildSplatPreviewSnapshot(selectedBiomeName, terrainBiome);
    previewSnapshotRef.current = snapshot;
    debouncedPreviewUpdateRef.current?.(snapshot);
  }, [assets, biomeRows, previewState.running, previewState.status, selectedBiomeKey, selectedBiomeName, selectedBiomeRow, variantRows]);

  function updateBiomeField(name: string, value: unknown): void {
    if (!selectedBiomeRow) {
      return;
    }
    setBiomeRows(replaceRow(biomeRows, updateRowValue(TERRAIN_BIOMES_TABLE, selectedBiomeRow, name, value)));
    setSaveMessage("Unsaved splat draft");
  }

  function updateBiomeKey(value: string): void {
    if (!selectedBiomeRow) {
      return;
    }
    const previousKey = selectedBiomeKey;
    const nextKey = normalizeBiomeKey(value);
    const nextBiomeRow = updateRowValue(TERRAIN_BIOMES_TABLE, selectedBiomeRow, "file_name", nextKey);
    setBiomeRows(replaceRow(biomeRows, nextBiomeRow));
    setVariantRows(
      variantRows.map((row) =>
        textValueByName(TERRAIN_VARIANTS_TABLE, row, "biome") === previousKey
          ? updateRowValue(TERRAIN_VARIANTS_TABLE, row, "biome", nextKey)
          : row
      )
    );
    setSaveMessage("Unsaved splat draft");
  }

  function updateVariantField(row: DataTableRow, name: string, value: unknown): void {
    setVariantRows(replaceRow(variantRows, updateRowValue(TERRAIN_VARIANTS_TABLE, row, name, value)));
    setSaveMessage("Unsaved splat draft");
  }

  function updateVariantVector2Field(row: DataTableRow, name: string, axis: 0 | 1, value: number): void {
    const nextValue = vector2ValueByName(TERRAIN_VARIANTS_TABLE, row, name);
    nextValue[axis] = value;
    updateVariantField(row, name, nextValue);
  }

  function addBiome(): void {
    const biomeRow = createBiomeRow(biomeRows);
    setBiomeRows([...biomeRows, biomeRow]);
    setSelectedBiomeRowId(biomeRow.id);
    setSaveMessage("Unsaved new splat");
  }

  function commitVariants(nextRows: DataTableRow[]): void {
    if (!selectedBiomeRow) {
      return;
    }
    const nextVariants = nextRows.map((row, index) =>
      updateRowValues(TERRAIN_VARIANTS_TABLE, row, {
        biome: selectedBiomeKey,
        id: index
      })
    );
    const nextBiomeRow = updateRowValue(TERRAIN_BIOMES_TABLE, selectedBiomeRow, "variant_count", nextVariants.length);
    setBiomeRows(replaceRow(biomeRows, nextBiomeRow));
    setVariantRows([
      ...variantRows.filter((row) => textValueByName(TERRAIN_VARIANTS_TABLE, row, "biome") !== selectedBiomeKey),
      ...nextVariants
    ]);
    setSaveMessage("Unsaved splat draft");
  }

  function addVariant(): void {
    if (selectedVariantRows.length >= MAX_TERRAIN_VARIANTS) {
      return;
    }
    const terrainTextureId = terrainTextures[0]?.id ?? "";
    const rawRows = [...selectedVariantRows, createVariantRow(selectedBiomeKey, terrainTextureId)];
    const nextRows = rawRows.map((row, index) => {
      const count = rawRows.length;
      const zoneStep = 1 / Math.max(1, count);
      return updateRowValues(TERRAIN_VARIANTS_TABLE, row, {
        zone_end: Math.min(1, (index + 1) * zoneStep + zoneStep * 0.15),
        zone_start: Math.max(0, index * zoneStep - zoneStep * 0.15),
        zone_weight: 1
      });
    });
    commitVariants(nextRows);
  }

  function removeVariant(variantRow: DataTableRow): void {
    commitVariants(selectedVariantRows.filter((row) => row.id !== variantRow.id));
  }

  async function saveSplatTables(): Promise<void> {
    setSaveMessage("Saving...");
    await Promise.all([
      tableService.saveSystemTableRows(TERRAIN_BIOMES_TABLE.id, biomeRows),
      tableService.saveSystemTableRows(TERRAIN_VARIANTS_TABLE.id, variantRows)
    ]);
    await CacheUtils.invalidateQueries([[HookKeysEnum.listTablesQuery]]);
    setSaveMessage(`Saved ${selectedBiomeKey || "splats"}`);
  }

  return (
    <section className="flex min-h-full min-w-0 flex-col gap-4">
      <PageHeader
        title="Splat Editor"
        description="Author zones-only Graphite terrain splats. Biome globals create procedural regions; variants provide the material slices."
      />

      <section className="grid gap-3 border border-border bg-background p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="grid gap-1.5">
            <ControlTooltipLabel label="Splat" tooltip={splatEditorTooltips.biomeSelect} />
            <Select disabled={biomeRows.length === 0} value={selectedBiomeRowId} onValueChange={setSelectedBiomeRowId}>
              <SelectTrigger>
                <SelectValue placeholder="Select splat" />
              </SelectTrigger>
              <SelectContent>
                {biomeRows.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {textValueByName(TERRAIN_BIOMES_TABLE, row, "name")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <ControlTooltipLabel label="File Key" tooltip={splatEditorTooltips.biomeKey} />
            <Input value={selectedBiomeKey} onChange={(event) => updateBiomeKey(event.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <ControlTooltipLabel label="Name" tooltip={splatEditorTooltips.biomeName} />
            <Input value={selectedBiomeName} onChange={(event) => updateBiomeField("name", event.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <ControlTooltipLabel label="Sampling Mode" tooltip={splatEditorTooltips.samplingMode} />
            <Select
              value={textValueByName(TERRAIN_BIOMES_TABLE, selectedBiomeRow, "sampling_mode")}
              onValueChange={(value) => updateBiomeField("sampling_mode", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stochastic">Stochastic</SelectItem>
                <SelectItem value="repeat">Repeat</SelectItem>
                <SelectItem value="wang">Wang Reserved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Badge variant="secondary">
            {selectedVariantRows.length}/{MAX_TERRAIN_VARIANTS} variants
          </Badge>
          <Badge variant="outline">{previewState.status}</Badge>
          <span className="text-xs text-muted-foreground">{saveMessage}</span>
          <Button onClick={addBiome} type="button" variant="secondary">
            Add Splat
          </Button>
          <Button disabled={!selectedBiomeRow || areTablesLoading} onClick={saveSplatTables} type="button">
            Save
          </Button>
        </div>
      </section>

      {selectedBiomeRow && (
        <section className="grid gap-4">
          <section className="grid gap-3 border border-border bg-background p-4">
            <div>
              <h2 className="text-sm font-medium">Biome Zones</h2>
              <p className="text-xs text-muted-foreground">
                These settings shape where materials appear before per-variant height blending resolves overlaps.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <RangeField
                id="splat-uv-scale"
                label="UV Scale"
                max={0.5}
                min={0.0001}
                step={0.001}
                tooltip={splatEditorTooltips.uvScale}
                value={numberValueByName(TERRAIN_BIOMES_TABLE, selectedBiomeRow, "uv_scale")}
                onChange={(value) => updateBiomeField("uv_scale", value)}
              />
              <RangeField
                id="splat-sampling-scale"
                label="Sampling Scale"
                max={0.5}
                min={0.0001}
                step={0.001}
                tooltip={splatEditorTooltips.samplingScale}
                value={numberValueByName(TERRAIN_BIOMES_TABLE, selectedBiomeRow, "sampling_scale")}
                onChange={(value) => updateBiomeField("sampling_scale", value)}
              />
              <RangeField
                id="splat-sampling-offset"
                label="Sampling Offset"
                max={20}
                min={0}
                step={0.01}
                tooltip={splatEditorTooltips.samplingOffset}
                value={numberValueByName(TERRAIN_BIOMES_TABLE, selectedBiomeRow, "sampling_offset_scale")}
                onChange={(value) => updateBiomeField("sampling_offset_scale", value)}
              />
              <RangeField
                id="splat-height-blend"
                label="Height Blend Width"
                max={1}
                min={0.005}
                step={0.01}
                tooltip={splatEditorTooltips.heightBlendWidth}
                value={numberValueByName(TERRAIN_BIOMES_TABLE, selectedBiomeRow, "height_blend_width")}
                onChange={(value) => updateBiomeField("height_blend_width", value)}
              />
              <RangeField
                id="splat-sampling-blend"
                label="Sampling Blend"
                max={0.49}
                min={0.02}
                step={0.01}
                tooltip={splatEditorTooltips.samplingBlend}
                value={numberValueByName(TERRAIN_BIOMES_TABLE, selectedBiomeRow, "sampling_blend_width")}
                onChange={(value) => updateBiomeField("sampling_blend_width", value)}
              />
              <RangeField
                id="splat-zone-noise"
                label="Zone Noise Scale"
                max={1}
                min={0.000001}
                step={0.0001}
                tooltip={splatEditorTooltips.zoneNoiseScale}
                value={numberValueByName(TERRAIN_BIOMES_TABLE, selectedBiomeRow, "zone_noise_scale")}
                onChange={(value) => updateBiomeField("zone_noise_scale", value)}
              />
              <RangeField
                id="splat-zone-contrast"
                label="Zone Contrast"
                max={8}
                min={0.01}
                step={0.01}
                tooltip={splatEditorTooltips.zoneContrast}
                value={numberValueByName(TERRAIN_BIOMES_TABLE, selectedBiomeRow, "zone_contrast")}
                onChange={(value) => updateBiomeField("zone_contrast", value)}
              />
              <RangeField
                id="splat-zone-blend"
                label="Zone Blend Width"
                max={0.5}
                min={0}
                step={0.005}
                tooltip={splatEditorTooltips.zoneBlendWidth}
                value={numberValueByName(TERRAIN_BIOMES_TABLE, selectedBiomeRow, "zone_blend_width")}
                onChange={(value) => updateBiomeField("zone_blend_width", value)}
              />
              <RangeField
                id="splat-zone-edge"
                label="Zone Edge Breakup"
                max={1}
                min={0}
                step={0.01}
                tooltip={splatEditorTooltips.zoneEdgeBreakup}
                value={numberValueByName(TERRAIN_BIOMES_TABLE, selectedBiomeRow, "zone_edge_breakup")}
                onChange={(value) => updateBiomeField("zone_edge_breakup", value)}
              />
              <RangeField
                id="splat-macro-scale"
                label="Macro Scale"
                max={0.01}
                min={0.00005}
                step={0.00005}
                tooltip={splatEditorTooltips.macroScale}
                value={numberValueByName(TERRAIN_BIOMES_TABLE, selectedBiomeRow, "macro_scale")}
                onChange={(value) => updateBiomeField("macro_scale", value)}
              />
              <RangeField
                id="splat-macro-strength"
                label="Macro Strength"
                max={2}
                min={0}
                step={0.02}
                tooltip={splatEditorTooltips.macroStrength}
                value={numberValueByName(TERRAIN_BIOMES_TABLE, selectedBiomeRow, "macro_strength")}
                onChange={(value) => updateBiomeField("macro_strength", value)}
              />
              <RangeField
                id="splat-macro-tint"
                label="Macro Tint"
                max={4}
                min={0}
                step={0.05}
                tooltip={splatEditorTooltips.macroTintStrength}
                value={numberValueByName(TERRAIN_BIOMES_TABLE, selectedBiomeRow, "macro_tint_strength")}
                onChange={(value) => updateBiomeField("macro_tint_strength", value)}
              />
              <div className="grid gap-1.5">
                <ControlTooltipLabel label="Zone Seed" tooltip={splatEditorTooltips.zoneSeed} />
                <Input
                  min={0}
                  type="number"
                  value={numberValueByName(TERRAIN_BIOMES_TABLE, selectedBiomeRow, "zone_seed")}
                  onChange={(event) => updateBiomeField("zone_seed", Number(event.target.value))}
                />
              </div>
            </div>
          </section>

          <section className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium">Variants</h2>
                <p className="text-xs text-muted-foreground">
                  Each variant is one terrain texture slice with zone range, weight, tint, and material response.
                </p>
              </div>
              <Button disabled={selectedVariantRows.length >= MAX_TERRAIN_VARIANTS} onClick={addVariant} type="button" variant="secondary">
                Add Variant
              </Button>
            </div>

            <div className="grid gap-3">
              {selectedVariantRows.map((row) => {
                const textureId = textValueByName(TERRAIN_VARIANTS_TABLE, row, "terrain_texture");
                const textureScale = vector2ValueByName(TERRAIN_VARIANTS_TABLE, row, "texture_scale");
                return (
                  <section key={row.id} className="grid gap-4 border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Variant {numberValueByName(TERRAIN_VARIANTS_TABLE, row, "id")}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {terrainTexturesById.get(textureId)?.name ?? "No terrain texture"}
                        </span>
                      </div>
                      <Button onClick={() => removeVariant(row)} type="button" variant="outline">
                        Remove
                      </Button>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
                      <TerrainVariantTexturePreview asset={terrainTexturesById.get(textureId)} />
                      <div className="grid gap-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="grid gap-1.5">
                            <ControlTooltipLabel label="Terrain Texture" tooltip={splatEditorTooltips.terrainTexture} />
                            <Select value={textureId} onValueChange={(value) => updateVariantField(row, "terrain_texture", value)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select texture" />
                              </SelectTrigger>
                              <SelectContent>
                                {terrainTextures.map((asset) => (
                                  <SelectItem key={asset.id} value={asset.id}>
                                    {asset.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-1.5">
                            <ControlTooltipLabel label="Tint" tooltip={splatEditorTooltips.tint} />
                            <Input
                              type="color"
                              value={textValueByName(TERRAIN_VARIANTS_TABLE, row, "albedo_tint")}
                              onChange={(event) => updateVariantField(row, "albedo_tint", event.target.value)}
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <RangeField
                            id={`variant-${row.id}-scale-x`}
                            label="Texture Scale X"
                            max={50}
                            min={0.01}
                            step={0.01}
                            tooltip={splatEditorTooltips.textureScale}
                            value={textureScale[0]}
                            onChange={(value) => updateVariantVector2Field(row, "texture_scale", 0, value)}
                          />
                          <RangeField
                            id={`variant-${row.id}-scale-y`}
                            label="Texture Scale Y"
                            max={50}
                            min={0.01}
                            step={0.01}
                            tooltip={splatEditorTooltips.textureScale}
                            value={textureScale[1]}
                            onChange={(value) => updateVariantVector2Field(row, "texture_scale", 1, value)}
                          />
                          <RangeField
                            id={`variant-${row.id}-zone-start`}
                            label="Zone Start"
                            max={1}
                            min={0}
                            step={0.01}
                            tooltip={splatEditorTooltips.zoneStart}
                            value={numberValueByName(TERRAIN_VARIANTS_TABLE, row, "zone_start")}
                            onChange={(value) => updateVariantField(row, "zone_start", value)}
                          />
                          <RangeField
                            id={`variant-${row.id}-zone-end`}
                            label="Zone End"
                            max={1}
                            min={0}
                            step={0.01}
                            tooltip={splatEditorTooltips.zoneEnd}
                            value={numberValueByName(TERRAIN_VARIANTS_TABLE, row, "zone_end")}
                            onChange={(value) => updateVariantField(row, "zone_end", value)}
                          />
                          <RangeField
                            id={`variant-${row.id}-zone-weight`}
                            label="Zone Weight"
                            max={16}
                            min={0}
                            step={0.01}
                            tooltip={splatEditorTooltips.zoneWeight}
                            value={numberValueByName(TERRAIN_VARIANTS_TABLE, row, "zone_weight")}
                            onChange={(value) => updateVariantField(row, "zone_weight", value)}
                          />
                          <RangeField
                            id={`variant-${row.id}-height`}
                            label="Height Blend"
                            max={4}
                            min={0}
                            step={0.02}
                            tooltip={splatEditorTooltips.heightBlendWidth}
                            value={numberValueByName(TERRAIN_VARIANTS_TABLE, row, "height_blend_strength")}
                            onChange={(value) => updateVariantField(row, "height_blend_strength", value)}
                          />
                          <RangeField
                            id={`variant-${row.id}-normal`}
                            label="Normal Strength"
                            max={4}
                            min={0}
                            step={0.01}
                            tooltip={splatEditorTooltips.normalStrength}
                            value={numberValueByName(TERRAIN_VARIANTS_TABLE, row, "normal_strength")}
                            onChange={(value) => updateVariantField(row, "normal_strength", value)}
                          />
                          <RangeField
                            id={`variant-${row.id}-roughness`}
                            label="Roughness"
                            max={4}
                            min={0.04}
                            step={0.01}
                            tooltip={splatEditorTooltips.roughness}
                            value={numberValueByName(TERRAIN_VARIANTS_TABLE, row, "roughness_multiplier")}
                            onChange={(value) => updateVariantField(row, "roughness_multiplier", value)}
                          />
                          <RangeField
                            id={`variant-${row.id}-wetness`}
                            label="Wetness"
                            max={1}
                            min={0}
                            step={0.01}
                            tooltip={splatEditorTooltips.wetness}
                            value={numberValueByName(TERRAIN_VARIANTS_TABLE, row, "wetness")}
                            onChange={(value) => updateVariantField(row, "wetness", value)}
                          />
                          <RangeField
                            id={`variant-${row.id}-tint-strength`}
                            label="Tint Strength"
                            max={1}
                            min={0}
                            step={0.01}
                            tooltip={splatEditorTooltips.tintStrength}
                            value={numberValueByName(TERRAIN_VARIANTS_TABLE, row, "albedo_tint_strength")}
                            onChange={(value) => updateVariantField(row, "albedo_tint_strength", value)}
                          />
                          <RangeField
                            id={`variant-${row.id}-saturation`}
                            label="Saturation"
                            max={2}
                            min={0}
                            step={0.01}
                            tooltip={splatEditorTooltips.saturation}
                            value={numberValueByName(TERRAIN_VARIANTS_TABLE, row, "albedo_saturation")}
                            onChange={(value) => updateVariantField(row, "albedo_saturation", value)}
                          />
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
        </section>
      )}

      {!selectedBiomeRow && (
        <section className="grid min-h-96 place-items-center border border-border bg-background p-8">
          <Button onClick={addBiome} type="button">
            Create Splat
          </Button>
        </section>
      )}
    </section>
  );
};

export default BiomeEditorScreen;
