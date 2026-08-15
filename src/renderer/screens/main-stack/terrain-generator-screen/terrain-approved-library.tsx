import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { type FC, useEffect, useState } from "react";
import type { TerrainApprovedAsset, TerrainSpatialLayout, TerrainTilesetView } from "../../../../shared/terrain-authoring";
import { TerrainApprovedMapPreview } from "./terrain-approved-map-preview";
import { TerrainSpatialAnnotationEditor } from "./terrain-spatial-annotation-editor";

interface TerrainApprovedLibraryProps {
  assets: TerrainApprovedAsset[];
  layouts: TerrainSpatialLayout[];
  onDelete: (slug: string) => Promise<void>;
  onLayoutsChange: (layouts: TerrainSpatialLayout[]) => void;
  tilesets: TerrainTilesetView[];
}

export const TerrainApprovedLibrary: FC<TerrainApprovedLibraryProps> = (props) => {
  const { assets, layouts, onDelete, onLayoutsChange, tilesets } = props;
  const [selectedAssetSlug, setSelectedAssetSlug] = useState(assets[0]?.slug ?? "");
  const selectedAsset = assets.find((asset) => asset.slug === selectedAssetSlug);

  useEffect(() => {
    if (assets.some((asset) => asset.slug === selectedAssetSlug)) return;
    setSelectedAssetSlug(assets[0]?.slug ?? "");
  }, [assets, selectedAssetSlug]);

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-md border border-border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Approved geography library</h3>
            <p className="text-xs text-muted-foreground">
              Preview frozen maps, then select one to add separate spatial annotations without repainting its terrain.
            </p>
          </div>
          <Badge variant="secondary">{assets.length}</Badge>
        </div>
        {assets.length === 0 && (
          <p className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">
            No approved geography yet. Select a valid candidate on the Generate page and freeze it here as a map or submodule.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => {
            const assetLayouts = layouts.filter((layout) => layout.sourceAsset === asset.slug);
            const selected = asset.slug === selectedAssetSlug;
            return (
              <div
                className={cn(
                  "group relative space-y-3 rounded border border-border p-3 transition-colors hover:border-primary/60",
                  selected && "border-primary bg-primary/5 ring-1 ring-primary"
                )}
                data-approved-asset={asset.slug}
                key={asset.slug}
                onClick={() => setSelectedAssetSlug(asset.slug)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelectedAssetSlug(asset.slug);
                }}
              >
                <div className="overflow-hidden rounded bg-slate-950 p-2">
                  <TerrainApprovedMapPreview asset={asset} layout={assetLayouts[0]} maxSize={320} tilesets={tilesets} />
                </div>
                <div className="pr-9">
                  <p className="truncate text-sm font-medium">{asset.slug}</p>
                  <p className="text-xs text-muted-foreground">
                    {asset.kind} · {asset.width}×{asset.height} · seed {asset.seed} · {asset.sourceTemplate}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {asset.metrics.distinctPieces} piece types · {asset.metrics.walkableComponents} walkable components ·{" "}
                    {assetLayouts.length} {assetLayouts.length === 1 ? "dressing" : "dressings"}
                  </p>
                </div>
                <Button
                  aria-label={`Delete ${asset.slug}`}
                  className="absolute bottom-2 right-2"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!window.confirm(`Delete approved asset '${asset.slug}' and all of its spatial dressings?`)) return;
                    void onDelete(asset.slug);
                  }}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
      {selectedAsset && (
        <TerrainSpatialAnnotationEditor asset={selectedAsset} layouts={layouts} onChange={onLayoutsChange} tilesets={tilesets} />
      )}
    </div>
  );
};
