import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type FC, useState } from "react";
import type { TerrainSample, TerrainSampleDimension, TerrainSampleLayerCount } from "../../../../shared/terrain-authoring";

export interface TerrainSampleCreation {
  height: TerrainSampleDimension;
  layerCount: TerrainSampleLayerCount;
  width: TerrainSampleDimension;
}

interface TerrainSampleInspectorProps {
  onChange: (sample: TerrainSample) => void;
  onCreate: (creation: TerrainSampleCreation) => void;
  onDelete: () => void;
  onSelect: (sampleSlug?: string) => void;
  sample?: TerrainSample;
  samples: TerrainSample[];
}

export const TerrainSampleInspector: FC<TerrainSampleInspectorProps> = (props) => {
  const { onChange, onCreate, onDelete, onSelect, sample, samples } = props;
  const [width, setWidth] = useState<TerrainSampleDimension>(12);
  const [height, setHeight] = useState<TerrainSampleDimension>(12);
  const [layerCount, setLayerCount] = useState<TerrainSampleLayerCount>(1);

  function updateLayerCount(nextLayerCount: TerrainSampleLayerCount): void {
    if (!sample) return;
    onChange({
      ...sample,
      layerCount: nextLayerCount,
      cells: sample.cells.map((cell) => Array.from({ length: nextLayerCount }, (_, index) => cell[index] ?? null))
    });
  }

  return (
    <div className="space-y-4 rounded-md border border-border p-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_5rem_5rem_6rem_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="wfc-sample-selection">Sample to edit</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            disabled={samples.length === 0}
            id="wfc-sample-selection"
            onChange={(event) => onSelect(event.target.value || undefined)}
            value={sample?.slug ?? ""}
          >
            <option value="">Choose a sample…</option>
            {samples.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {entry.slug} — {entry.width}×{entry.height}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-sample-width">Width</Label>
          <Input
            id="new-sample-width"
            max={64}
            min={3}
            onChange={(event) => setWidth(Number(event.target.value))}
            type="number"
            value={width}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-sample-height">Height</Label>
          <Input
            id="new-sample-height"
            max={64}
            min={3}
            onChange={(event) => setHeight(Number(event.target.value))}
            type="number"
            value={height}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-sample-layers">Layers</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            id="new-sample-layers"
            onChange={(event) => setLayerCount(Number(event.target.value) as TerrainSampleLayerCount)}
            value={layerCount}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </div>
        <Button onClick={() => onCreate({ width, height, layerCount })} type="button">
          Create sample
        </Button>
      </div>
      {!sample && (
        <div className="rounded-md border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          Create or choose a sample, then paint it with the tileset palette.
        </div>
      )}
      {sample && (
        <div className="grid gap-3 border-t border-border pt-3 md:grid-cols-[minmax(12rem,1fr)_6rem_auto_auto_auto_auto] md:items-end">
          <div className="space-y-1">
            <Label htmlFor="sample-slug">Stable slug</Label>
            <Input
              id="sample-slug"
              onChange={(event) => onChange({ ...sample, slug: event.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, "_") })}
              value={sample.slug}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sample-layer-count">Layers</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              id="sample-layer-count"
              onChange={(event) => updateLayerCount(Number(event.target.value) as TerrainSampleLayerCount)}
              value={sample.layerCount}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>
          <Label className="flex h-9 items-center gap-2">
            <Checkbox
              checked={sample.periodicInput}
              onCheckedChange={(checked) => onChange({ ...sample, periodicInput: checked === true })}
            />
            Periodic input
          </Label>
          <Label className="flex h-9 items-center gap-2">
            <Checkbox
              checked={sample.allowRotations}
              onCheckedChange={(checked) => onChange({ ...sample, allowRotations: checked === true })}
            />
            Rotations
          </Label>
          <Label className="flex h-9 items-center gap-2">
            <Checkbox
              checked={sample.allowReflections}
              onCheckedChange={(checked) => onChange({ ...sample, allowReflections: checked === true })}
            />
            Reflections
          </Label>
          <Button onClick={onDelete} type="button" variant="destructive">
            Delete sample
          </Button>
        </div>
      )}
    </div>
  );
};
