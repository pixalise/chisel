import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { type FC, useEffect, useState } from "react";
import type {
  TerrainAnnotationDefinition,
  TerrainApprovedAsset,
  TerrainSpatialLayout,
  TerrainTileBinding,
  TerrainTileRef,
  TerrainWorkspaceView
} from "../../../../shared/terrain-authoring";
import { TerrainApprovedMapPreview } from "./terrain-approved-map-preview";
import { TerrainApprovedOverpaintEditor } from "./terrain-approved-overpaint-editor";
import { TerrainAnnotationCatalog } from "./terrain-annotation-catalog";
import { TerrainSpatialAnnotationEditor } from "./terrain-spatial-annotation-editor";
import { TerrainTileCatalog } from "./terrain-tile-catalog";

interface TerrainApprovedLibraryProps {
  annotations: TerrainAnnotationDefinition[];
  assets: TerrainApprovedAsset[];
  layouts: TerrainSpatialLayout[];
  onDelete: (slug: string) => Promise<void>;
  onAssetsChange: (assets: TerrainApprovedAsset[]) => void;
  onAnnotationsChange: (annotations: TerrainAnnotationDefinition[]) => void;
  onBindingsChange: (bindings: Record<string, TerrainTileBinding>) => void;
  onLayoutsChange: (layouts: TerrainSpatialLayout[]) => void;
  workspace: TerrainWorkspaceView;
}

export const TerrainApprovedLibrary: FC<TerrainApprovedLibraryProps> = (props) => {
  const { annotations, assets, layouts, onAnnotationsChange, onAssetsChange, onBindingsChange, onDelete, onLayoutsChange, workspace } =
    props;
  const [selectedAssetIndex, setSelectedAssetIndex] = useState<number | undefined>(assets.length > 0 ? 0 : undefined);
  const [selectedTile, setSelectedTile] = useState<TerrainTileRef>();
  const selectedAsset = typeof selectedAssetIndex === "number" ? assets[selectedAssetIndex] : undefined;

  useEffect(() => {
    if (typeof selectedAssetIndex !== "number" || selectedAssetIndex >= assets.length) {
      setSelectedAssetIndex(assets.length > 0 ? 0 : undefined);
    }
  }, [assets.length, selectedAssetIndex]);

  return (
    <div className="space-y-4">
      <TerrainAnnotationCatalog
        annotations={annotations}
        layouts={layouts}
        onAnnotationsChange={onAnnotationsChange}
        onLayoutsChange={onLayoutsChange}
      />
      <div className="space-y-3 rounded-md border border-border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Approved geography library</h3>
            <p className="text-xs text-muted-foreground">
              Preview approved maps, then polish terrain or tag cells with the global annotations above.
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
          {assets.map((asset, index) => {
            const assetLayout = layouts.find((layout) => layout.sourceAsset === asset.slug);
            const taggedCellCount = assetLayout?.cells.length ?? 0;
            const selected = index === selectedAssetIndex;
            return (
              <div
                className={cn(
                  "group relative space-y-3 rounded border border-border p-3 transition-colors hover:border-primary/60",
                  selected && "border-primary bg-primary/5 ring-1 ring-primary"
                )}
                data-approved-asset={asset.slug}
                key={index}
                onClick={() => setSelectedAssetIndex(index)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelectedAssetIndex(index);
                }}
              >
                <div className="overflow-hidden rounded bg-slate-950 p-2">
                  <TerrainApprovedMapPreview
                    annotations={annotations}
                    asset={asset}
                    layout={assetLayout}
                    maxSize={320}
                    tilesets={workspace.tilesets}
                  />
                </div>
                <div className="pr-9">
                  <p className="truncate text-sm font-medium">{asset.slug}</p>
                  <p className="text-xs text-muted-foreground">
                    {asset.kind} · {asset.width}×{asset.height} · {asset.sourceTemplate}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {asset.metrics.distinctPieces} piece types · {asset.metrics.walkableComponents} walkable components ·{" "}
                    {asset.cellOverrides.length} overrides · {taggedCellCount} tagged cells
                  </p>
                </div>
                <Button
                  aria-label={`Delete ${asset.slug}`}
                  className="absolute bottom-2 right-2"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!window.confirm(`Delete approved asset '${asset.slug}' and all of its cell annotations?`)) return;
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
            <TabsTrigger value="annotations">Cell annotations</TabsTrigger>
          </TabsList>
          <TabsContent className="space-y-4" value="polish">
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.7fr)] xl:items-start">
              <TerrainApprovedOverpaintEditor
                asset={selectedAsset}
                onChange={(asset) => onAssetsChange(assets.map((entry, index) => (index === selectedAssetIndex ? asset : entry)))}
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
              annotations={annotations}
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
