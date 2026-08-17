import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type FC, useEffect, useState } from "react";
import type {
  TerrainAnnotationDefinition,
  TerrainApprovedAsset,
  TerrainSpatialLayout,
  TerrainTilesetView
} from "../../../../shared/terrain-authoring";
import { resolveApprovedTerrainCell } from "../../../../shared/terrain-approved-overpaint";
import { hasTerrainCollision } from "../../../../shared/terrain-collision";
import { setTerrainCellAnnotation } from "../../../../shared/terrain-cell-annotations";
import { TerrainApprovedMapPreview } from "./terrain-approved-map-preview";

interface TerrainSpatialAnnotationEditorProps {
  annotations: TerrainAnnotationDefinition[];
  asset: TerrainApprovedAsset;
  layouts: TerrainSpatialLayout[];
  onChange: (layouts: TerrainSpatialLayout[]) => void;
  tilesets: TerrainTilesetView[];
}

export const TerrainSpatialAnnotationEditor: FC<TerrainSpatialAnnotationEditorProps> = (props) => {
  const { annotations, asset, layouts, onChange, tilesets } = props;
  const [selectedAnnotationIndex, setSelectedAnnotationIndex] = useState<number | undefined>(annotations.length > 0 ? 0 : undefined);
  const [selectedCellIndex, setSelectedCellIndex] = useState(0);
  const layoutIndex = layouts.findIndex((layout) => layout.sourceAsset === asset.slug);
  const layout = layoutIndex >= 0 ? layouts[layoutIndex] : undefined;
  const selectedAnnotation = typeof selectedAnnotationIndex === "number" ? annotations[selectedAnnotationIndex] : undefined;
  const boundedCellIndex = Math.min(selectedCellIndex, asset.cells.length - 1);
  const selectedX = boundedCellIndex % asset.width;
  const selectedY = Math.floor(boundedCellIndex / asset.width);
  const selectedCell = resolveApprovedTerrainCell(asset, boundedCellIndex).metadata;
  const selectedCellAnnotations = layout?.cells.find((cell) => cell.index === boundedCellIndex)?.annotations ?? [];

  useEffect(() => {
    if (typeof selectedAnnotationIndex === "number" && selectedAnnotationIndex < annotations.length) return;
    setSelectedAnnotationIndex(annotations.length > 0 ? 0 : undefined);
  }, [annotations.length, selectedAnnotationIndex]);

  useEffect(() => setSelectedCellIndex(0), [asset.slug]);

  function uniqueLayoutSlug(): string {
    const base = `${asset.slug}_ANNOTATIONS`;
    if (!layouts.some((entry) => entry.slug === base)) return base;
    let suffix = 2;
    while (layouts.some((entry) => entry.slug === `${base}_${suffix}`)) suffix += 1;
    return `${base}_${suffix}`;
  }

  function paintCell(index: number, erase: boolean): void {
    if (!selectedAnnotation) return;
    const nextCells = setTerrainCellAnnotation(layout?.cells ?? [], index, selectedAnnotation.slug, erase);

    if (layout && layoutIndex >= 0) {
      onChange(layouts.map((entry, index) => (index === layoutIndex ? { ...entry, cells: nextCells } : entry)));
      return;
    }
    if (nextCells.length > 0) {
      onChange([...layouts, { slug: uniqueLayoutSlug(), sourceAsset: asset.slug, cells: nextCells }]);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div>
        <h3 className="text-sm font-semibold">Cell annotation editor</h3>
        <p className="text-xs text-muted-foreground">
          Select a project annotation, then left-drag to tag cells. Right-drag or Ctrl-drag removes only the selected annotation.
        </p>
      </div>
      {annotations.length === 0 && (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Add a global annotation above before tagging map cells.
        </p>
      )}
      {annotations.length > 0 && (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap gap-2">
              {annotations.map((annotation, index) => (
                <Button
                  className={cn(selectedAnnotationIndex === index && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
                  key={index}
                  onClick={() => setSelectedAnnotationIndex(index)}
                  size="sm"
                  style={{ borderColor: annotation.color }}
                  type="button"
                  variant="outline"
                >
                  <span className="size-3 rounded-sm" style={{ backgroundColor: annotation.color }} />
                  {annotation.slug}
                </Button>
              ))}
            </div>
            <div className="overflow-auto rounded-md bg-slate-950 p-3">
              <TerrainApprovedMapPreview
                annotations={annotations}
                asset={asset}
                layout={layout}
                onPaintCell={paintCell}
                onSelectCell={setSelectedCellIndex}
                selectedIndex={boundedCellIndex}
                tilesets={tilesets}
              />
            </div>
          </div>
          <div className="space-y-3 rounded-md border border-border p-3">
            <div>
              <p className="text-xs font-semibold">
                Cell {selectedX},{selectedY}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {selectedCell && hasTerrainCollision(selectedCell) ? "Terrain with collision" : "Walkable terrain"} ·{" "}
                {selectedCell?.tags.join(", ") || "no terrain tags"}
              </p>
            </div>
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-semibold">Annotations on this cell</p>
              {selectedCellAnnotations.length === 0 && <p className="text-xs text-muted-foreground">None</p>}
              <div className="flex flex-wrap gap-1.5">
                {selectedCellAnnotations.map((slug, index) => {
                  const definition = annotations.find((annotation) => annotation.slug === slug);
                  return (
                    <Badge
                      key={index}
                      style={definition ? { borderColor: definition.color, color: definition.color } : undefined}
                      variant="outline"
                    >
                      {slug}
                    </Badge>
                  );
                })}
              </div>
            </div>
            {layout && layout.cells.length > 0 && (
              <Button
                onClick={() => onChange(layouts.filter((_, index) => index !== layoutIndex))}
                size="sm"
                type="button"
                variant="outline"
              >
                Clear all map annotations
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
