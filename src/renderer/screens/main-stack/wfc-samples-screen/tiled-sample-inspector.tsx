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
  onSelect: (sampleSlug?: string) => void;
  sample?: TiledSample;
}

export const TiledSampleInspector: FC<TiledSampleInspectorProps> = (props) => {
  const { board, onChange, onDelete, onSelect, sample } = props;

  return (
    <div className="space-y-4 rounded-md border border-border p-3 lg:sticky lg:top-0">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="wfc-sample-selection">Samples</Label>
          <span className="text-xs text-muted-foreground">{board.enrichment.samples.length}</span>
        </div>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          disabled={board.enrichment.samples.length === 0}
          id="wfc-sample-selection"
          onChange={(event) => onSelect(event.target.value || undefined)}
          value={sample?.slug ?? ""}
        >
          <option value="">Choose a sample…</option>
          {board.enrichment.samples.map((entry) => (
            <option key={entry.slug} value={entry.slug}>
              {entry.slug} — {entry.x},{entry.y} · {entry.width}×{entry.height}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Drawing an empty region creates and selects a new sample.</p>
      </div>
      {!sample && (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Draw a region or choose a sample to edit its metadata.
        </div>
      )}
      {sample && (
        <>
          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <div>
              <h3 className="text-sm font-semibold">Sample metadata</h3>
              <p className="font-mono text-xs text-muted-foreground">
                x{sample.x} y{sample.y} · {sample.width}×{sample.height} cells
              </p>
            </div>
            <Button onClick={onDelete} size="sm" type="button" variant="destructive">
              Delete
            </Button>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sample-slug">Stable slug</Label>
            <Input
              id="sample-slug"
              onChange={(event) => onChange({ ...sample, slug: event.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, "_") })}
              value={sample.slug}
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
          <div className="space-y-3">
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
        </>
      )}
    </div>
  );
};
