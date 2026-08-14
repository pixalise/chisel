import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type FC } from "react";
import type { TiledBoardView, TiledSample } from "../../../../shared/tiled-samples";

interface TiledSampleInspectorProps {
  board: TiledBoardView;
  onChange: (sample: TiledSample) => void;
  onDelete: () => void;
  sample?: TiledSample;
}

export const TiledSampleInspector: FC<TiledSampleInspectorProps> = (props) => {
  const { board, onChange, onDelete, sample } = props;
  if (!sample) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Draw or select a sample rectangle to edit its WFC metadata.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Sample inspector</h3>
          <p className="font-mono text-xs text-muted-foreground">
            x{sample.x} y{sample.y} · {sample.width}×{sample.height} cells
          </p>
        </div>
        <Button onClick={onDelete} size="sm" type="button" variant="destructive">
          Delete
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="sample-id">Stable id</Label>
          <Input
            id="sample-id"
            onChange={(event) => onChange({ ...sample, id: event.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, "_") })}
            value={sample.id}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sample-name">Name</Label>
          <Input id="sample-name" onChange={(event) => onChange({ ...sample, name: event.target.value })} value={sample.name} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sample-kind">Kind</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            id="sample-kind"
            onChange={(event) => onChange({ ...sample, kind: event.target.value as TiledSample["kind"] })}
            value={sample.kind}
          >
            <option value="INTERIOR">Interior</option>
            <option value="BOUNDARY">Boundary</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="sample-weight">Positive weight</Label>
          <Input
            id="sample-weight"
            min="0.001"
            onChange={(event) => onChange({ ...sample, weight: Number(event.target.value) })}
            step="0.1"
            type="number"
            value={sample.weight}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="sample-profiles">Biome profile slugs</Label>
        <Input
          id="sample-profiles"
          onChange={(event) =>
            onChange({
              ...sample,
              profiles: event.target.value
                .split(",")
                .map((value) =>
                  value
                    .trim()
                    .toUpperCase()
                    .replace(/[^A-Z0-9]+/g, "_")
                )
                .filter(Boolean)
            })
          }
          placeholder="FOREST, TEMPERATE"
          value={sample.profiles.join(", ")}
        />
      </div>
      <div className="space-y-2">
        <Label>Included layers</Label>
        <div className="flex flex-wrap gap-3">
          {board.layers.map((layer) => (
            <Label className="flex items-center gap-2 text-xs" key={layer.id}>
              <Checkbox
                checked={sample.layerIds.includes(layer.id)}
                onCheckedChange={(checked) =>
                  onChange({
                    ...sample,
                    layerIds: checked ? [...sample.layerIds, layer.id] : sample.layerIds.filter((id) => id !== layer.id)
                  })
                }
              />
              {layer.name}
            </Label>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <Label className="flex items-center gap-2">
          <Checkbox
            checked={sample.allowRotations}
            onCheckedChange={(checked) => onChange({ ...sample, allowRotations: checked === true })}
          />
          Allow rotations
        </Label>
        <Label className="flex items-center gap-2">
          <Checkbox
            checked={sample.allowReflections}
            onCheckedChange={(checked) => onChange({ ...sample, allowReflections: checked === true })}
          />
          Allow reflections
        </Label>
      </div>
    </div>
  );
};
