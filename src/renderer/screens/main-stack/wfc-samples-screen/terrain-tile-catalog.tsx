import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { type FC, useMemo } from "react";
import {
  terrainTileKey,
  type TerrainTileBinding,
  type TerrainTileRef,
  type TerrainWorkspaceView
} from "../../../../shared/terrain-authoring";

interface TerrainTileCatalogProps {
  onBindingsChange: (bindings: Record<string, TerrainTileBinding>) => void;
  onSelectTile: (tile: TerrainTileRef) => void;
  selectedTile?: TerrainTileRef;
  workspace: TerrainWorkspaceView;
}

function defaultBinding(tilesetId: string, localId: number, roleId: string): TerrainTileBinding {
  return { slug: `${tilesetId}_${localId}`, roleId, blocking: false, tags: [] };
}

export const TerrainTileCatalog: FC<TerrainTileCatalogProps> = (props) => {
  const { onBindingsChange, onSelectTile, selectedTile, workspace } = props;
  const tiles = useMemo(
    () =>
      workspace.tilesets.flatMap((tileset) =>
        Array.from({ length: tileset.tileCount }, (_, localId) => ({ tileset, localId, key: terrainTileKey(tileset.id, localId) }))
      ),
    [workspace.tilesets]
  );
  const selected = selectedTile
    ? tiles.find((tile) => tile.key === terrainTileKey(selectedTile.tilesetId, selectedTile.localId))
    : undefined;
  const selectedBinding = selected ? workspace.tileBindings[selected.key] : undefined;

  function updateSelected(update: Partial<TerrainTileBinding>): void {
    if (!selected || workspace.roles.length === 0) return;
    const binding = selectedBinding ?? defaultBinding(selected.tileset.id, selected.localId, workspace.roles[0].id);
    onBindingsChange({ ...workspace.tileBindings, [selected.key]: { ...binding, ...update } });
  }

  function initializeAll(): void {
    if (workspace.roles.length === 0) return;
    const bindings = { ...workspace.tileBindings };
    for (const tile of tiles) bindings[tile.key] ??= defaultBinding(tile.tileset.id, tile.localId, workspace.roles[0].id);
    onBindingsChange(bindings);
  }

  return (
    <div className="grid min-h-0 gap-3 rounded-md border border-border p-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Tileset palette</h3>
            <p className="text-xs text-muted-foreground">Select a sprite to paint samples and edit its semantic metadata.</p>
          </div>
          <Button
            disabled={workspace.roles.length === 0 || tiles.length === 0}
            onClick={initializeAll}
            size="sm"
            type="button"
            variant="outline"
          >
            Initialize unbound
          </Button>
        </div>
        {tiles.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Import a PNG as a Tileset asset and set its tile size.
          </p>
        )}
        <div className="flex max-h-72 flex-wrap gap-2 overflow-y-auto rounded bg-muted/40 p-2">
          {tiles.map((tile) => {
            const scale = 48 / tile.tileset.tileSize;
            const column = tile.localId % tile.tileset.columns;
            const row = Math.floor(tile.localId / tile.tileset.columns);
            const bound = workspace.tileBindings[tile.key];
            return (
              <button
                className={cn(
                  "relative size-14 overflow-hidden rounded border-2 bg-background",
                  selected?.key === tile.key ? "border-primary" : bound ? "border-emerald-600/70" : "border-destructive/70"
                )}
                key={tile.key}
                onClick={() => onSelectTile({ tilesetId: tile.tileset.id, localId: tile.localId, orientation: 0 })}
                title={`${tile.key}${bound ? ` — ${bound.slug}` : " — unbound"}`}
                type="button"
              >
                <span
                  className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 bg-no-repeat"
                  style={{
                    width: tile.tileset.tileSize * scale,
                    height: tile.tileset.tileSize * scale,
                    backgroundImage: `url(${window.electron.toAssetUrl(tile.tileset.imagePath)})`,
                    backgroundSize: `${tile.tileset.imageWidth * scale}px ${tile.tileset.imageHeight * scale}px`,
                    backgroundPosition: `${-column * tile.tileset.tileSize * scale}px ${-row * tile.tileset.tileSize * scale}px`
                  }}
                />
                <span className="absolute bottom-0 right-0 bg-background/90 px-1 font-mono text-[9px]">{tile.localId}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-3 border-l border-border pl-3">
        <h3 className="text-sm font-semibold">Tile binding {selected?.key}</h3>
        {selected && (
          <>
            <div className="space-y-1">
              <Label htmlFor="tile-slug">Stable slug</Label>
              <Input
                id="tile-slug"
                onChange={(event) => updateSelected({ slug: event.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, "_") })}
                value={selectedBinding?.slug ?? ""}
              />
            </div>
            <Label className="flex items-center gap-2">
              <Checkbox
                checked={selectedBinding?.blocking ?? false}
                onCheckedChange={(checked) => updateSelected({ blocking: checked === true })}
              />
              Blocks movement
            </Label>
            <div className="space-y-1">
              <Label htmlFor="tile-role">Required role</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                id="tile-role"
                onChange={(event) => updateSelected({ roleId: event.target.value })}
                value={selectedBinding?.roleId ?? ""}
              >
                <option value="">Choose role</option>
                {workspace.roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="tile-tags">Optional tags</Label>
              <Input
                id="tile-tags"
                onChange={(event) =>
                  updateSelected({
                    tags: event.target.value
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
                placeholder="SHORE, WALKABLE"
                value={selectedBinding?.tags.join(", ") ?? ""}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
