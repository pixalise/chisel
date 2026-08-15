import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { type FC, useEffect, useState } from "react";
import type {
  TerrainApprovedAsset,
  TerrainSpatialLayout,
  TerrainTileBinding,
  TerrainTileRef,
  TerrainWorkspaceView
} from "../../../../shared/terrain-authoring";
import { TerrainApprovedMapPreview } from "./terrain-approved-map-preview";
import { TerrainApprovedOverpaintEditor } from "./terrain-approved-overpaint-editor";
import { TerrainSpatialAnnotationEditor } from "./terrain-spatial-annotation-editor";
import { TerrainTileCatalog } from "./terrain-tile-catalog";

interface TerrainApprovedLibraryProps {
  assets: TerrainApprovedAsset[];
  layouts: TerrainSpatialLayout[];
  onDelete: (slug: string) => Promise<void>;
  onAssetsChange: (assets: TerrainApprovedAsset[]) => void;
  onBindingsChange: (bindings: Record<string, TerrainTileBinding>) => void;
  onLayoutsChange: (layouts: TerrainSpatialLayout[]) => void;
  workspace: TerrainWorkspaceView;
}

export const TerrainApprovedLibrary: FC<TerrainApprovedLibraryProps> = (props) => {
  const { assets, layouts, onAssetsChange, onBindingsChange, onDelete, onLayoutsChange, workspace } = props;
  const [selectedAssetSlug, setSelectedAssetSlug] = useState(assets[0]?.slug ?? "");
  const [selectedTile, setSelectedTile] = useState<TerrainTileRef>();
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
              Preview approved maps, then polish their terrain or add separate spatial annotations.
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
                  <TerrainApprovedMapPreview asset={asset} layout={assetLayouts[0]} maxSize={320} tilesets={workspace.tilesets} />
                </div>
                <div className="pr-9">
                  <p className="truncate text-sm font-medium">{asset.slug}</p>
                  <p className="text-xs text-muted-foreground">
                    {asset.kind} · {asset.width}×{asset.height} · {asset.sourceTemplate}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {asset.metrics.distinctPieces} piece types · {asset.metrics.walkableComponents} walkable components ·{" "}
                    {asset.cellOverrides.length} overrides · {assetLayouts.length} {assetLayouts.length === 1 ? "dressing" : "dressings"}
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
        <Tabs defaultValue="polish">
          <TabsList className="grid h-auto w-full grid-cols-2">
            <TabsTrigger value="polish">Terrain polish</TabsTrigger>
            <TabsTrigger value="annotations">Spatial annotations</TabsTrigger>
          </TabsList>
          <TabsContent className="space-y-4" value="polish">
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.7fr)] xl:items-start">
              <TerrainApprovedOverpaintEditor
                asset={selectedAsset}
                onChange={(asset) => onAssetsChange(assets.map((entry) => (entry.slug === asset.slug ? asset : entry)))}
                selectedTile={selectedTile}
                tilesets={workspace.tilesets}
              />
              <TerrainTileCatalog
                compact
                onBindingsChange={onBindingsChange}
                onSelectTile={setSelectedTile}
                selectedTile={selectedTile}
                workspace={workspace}
              />
            </div>
          </TabsContent>
          <TabsContent value="annotations">
            <TerrainSpatialAnnotationEditor
              asset={selectedAsset}
              layouts={layouts}
              onChange={onLayoutsChange}
              tilesets={workspace.tilesets}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
