import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";
import { type FC, useEffect, useState } from "react";
import type { TerrainApprovedAsset, TerrainTileRef, TerrainTilesetView } from "../../../../shared/terrain-authoring";
import {
  approvedTerrainOverride,
  refreshApprovedTerrainMetrics,
  resolveApprovedTerrainCell,
  revertApprovedTerrainCell,
  setApprovedTerrainCellOverride
} from "../../../../shared/terrain-approved-overpaint";
import { TerrainApprovedMapPreview } from "./terrain-approved-map-preview";

interface TerrainApprovedOverpaintEditorProps {
  asset: TerrainApprovedAsset;
  onChange: (asset: TerrainApprovedAsset) => void;
  selectedTile?: TerrainTileRef;
  tilesets: TerrainTilesetView[];
}

type OverpaintBrushMode = "terrain" | "collision";

export const TerrainApprovedOverpaintEditor: FC<TerrainApprovedOverpaintEditorProps> = (props) => {
  const { asset, onChange, selectedTile, tilesets } = props;
  const [activeLayer, setActiveLayer] = useState(0);
  const [brushMode, setBrushMode] = useState<OverpaintBrushMode>("terrain");
  const [orientation, setOrientation] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const boundedSelectedIndex = Math.min(selectedIndex, asset.cells.length - 1);
  const selectedCell = resolveApprovedTerrainCell(asset, boundedSelectedIndex);
  const selectedOverride = approvedTerrainOverride(asset, boundedSelectedIndex);
  const selectedX = boundedSelectedIndex % asset.width;
  const selectedY = Math.floor(boundedSelectedIndex / asset.width);

  useEffect(() => {
    setActiveLayer((current) => Math.min(current, asset.layerCount - 1));
    setSelectedIndex((current) => Math.min(current, asset.cells.length - 1));
  }, [asset.cells.length, asset.layerCount, asset.slug]);

  function paint(index: number, erase: boolean): void {
    const cell = resolveApprovedTerrainCell(asset, index);
    const tiles = [...cell.tiles];
    const metadata = { ...cell.metadata, tags: [...cell.metadata.tags] };
    if (brushMode === "terrain") {
      if (!erase && !selectedTile) return;
      tiles[activeLayer] = erase ? null : { ...selectedTile!, orientation };
    } else {
      metadata.blocking = !erase;
    }
    onChange(setApprovedTerrainCellOverride(asset, index, tiles, metadata));
  }

  function updateSelectedMetadata(update: Partial<typeof selectedCell.metadata>): void {
    onChange(
      setApprovedTerrainCellOverride(asset, boundedSelectedIndex, selectedCell.tiles, {
        ...selectedCell.metadata,
        ...update,
        tags: update.tags ?? selectedCell.metadata.tags
      })
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Approved terrain polish</h3>
          <p className="text-xs text-muted-foreground">
            Paint sparse corrections over the frozen generation. Cyan corners mark overridden cells; the generated base remains intact.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={asset.cellOverrides.length > 0 ? "secondary" : "outline"}>{asset.cellOverrides.length} overridden cells</Badge>
          <Button
            disabled={asset.cellOverrides.length === 0}
            onClick={() => {
              if (!window.confirm(`Revert every terrain correction on '${asset.slug}'?`)) return;
              onChange(refreshApprovedTerrainMetrics({ ...asset, cellOverrides: [] }));
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <RotateCcw className="size-4" /> Revert all
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3 rounded border border-border bg-muted/30 p-3">
        <div className="flex gap-2">
          <Button onClick={() => setBrushMode("terrain")} size="sm" type="button" variant={brushMode === "terrain" ? "default" : "outline"}>
            Paint terrain
          </Button>
          <Button
            onClick={() => setBrushMode("collision")}
            size="sm"
            type="button"
            variant={brushMode === "collision" ? "destructive" : "outline"}
          >
            Paint collision
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Label className="space-y-1 text-xs">
            Layer
            <select
              className="block h-8 rounded border border-input bg-background px-2"
              disabled={brushMode === "collision"}
              onChange={(event) => setActiveLayer(Number(event.target.value))}
              value={activeLayer}
            >
              {Array.from({ length: asset.layerCount }, (_, layer) => (
                <option key={layer} value={layer}>
                  {layer === 0 ? "Base" : `Overlay ${layer}`}
                </option>
              ))}
            </select>
          </Label>
          <Label className="space-y-1 text-xs">
            Orientation
            <select
              className="block h-8 rounded border border-input bg-background px-2"
              disabled={brushMode === "collision"}
              onChange={(event) => setOrientation(Number(event.target.value))}
              value={orientation}
            >
              {Array.from({ length: 8 }, (_, value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Label>
        </div>
        <p className="w-full text-[11px] text-muted-foreground">
          {brushMode === "terrain"
            ? "Choose a sprite in the palette. Left-drag paints it; right-drag or Ctrl-drag clears the active layer."
            : "Left-drag makes cells blocking; right-drag or Ctrl-drag makes them walkable."}
        </p>
      </div>
      <div className="overflow-auto rounded-md bg-slate-950 p-3">
        <TerrainApprovedMapPreview
          asset={asset}
          maxSize={640}
          onPaintCell={paint}
          onSelectCell={setSelectedIndex}
          selectedIndex={boundedSelectedIndex}
          showOverrideMarkers
          tilesets={tilesets}
        />
      </div>
      <div className="grid gap-3 rounded border border-border p-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold">
            Selected cell {selectedX},{selectedY}
          </p>
          <Badge variant={selectedOverride ? "secondary" : "outline"}>{selectedOverride ? "Overridden" : "Generated base"}</Badge>
        </div>
        <Label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={selectedCell.metadata.blocking}
            onCheckedChange={(checked) => updateSelectedMetadata({ blocking: checked === true })}
          />
          Blocks movement
        </Label>
        <Label className="space-y-1 text-xs">
          Elevation
          <Input
            max={8}
            min={-8}
            onChange={(event) => updateSelectedMetadata({ elevation: Number(event.target.value) })}
            type="number"
            value={selectedCell.metadata.elevation}
          />
        </Label>
        <Label className="space-y-1 text-xs">
          Semantic tags
          <Input
            onChange={(event) => updateSelectedMetadata({ tags: slugList(event.target.value) })}
            value={selectedCell.metadata.tags.join(", ")}
          />
        </Label>
        <Button
          className="md:col-start-2 xl:col-start-4"
          disabled={!selectedOverride}
          onClick={() => onChange(revertApprovedTerrainCell(asset, boundedSelectedIndex))}
          size="sm"
          type="button"
          variant="outline"
        >
          <RotateCcw className="size-4" /> Revert selected cell
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Badge variant={asset.metrics.walkableComponents === 1 ? "outline" : "destructive"}>
          {asset.metrics.walkableComponents} walkable components
        </Badge>
        <Badge variant={asset.metrics.reachableAnchors === asset.metrics.requiredAnchors ? "outline" : "destructive"}>
          {asset.metrics.reachableAnchors}/{asset.metrics.requiredAnchors} reachable anchors
        </Badge>
      </div>
    </div>
  );
};

function slugList(value: string): string[] {
  return value
    .split(",")
    .map((entry) =>
      entry
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
    )
    .filter(Boolean);
}
