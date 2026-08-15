import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { type FC, useEffect, useMemo, useState } from "react";
import {
  terrainTileKey,
  type TerrainTileBinding,
  type TerrainTileRef,
  type TerrainWorkspaceView
} from "../../../../shared/terrain-authoring";
import { loadEmptyTerrainTileIds } from "./terrain-empty-tiles";

interface TerrainTileCatalogProps {
  onBindingsChange: (bindings: Record<string, TerrainTileBinding>) => void;
  onSelectTile: (tile?: TerrainTileRef) => void;
  selectedTile?: TerrainTileRef;
  workspace: TerrainWorkspaceView;
}

function defaultBinding(tilesetId: string, localId: number): TerrainTileBinding {
  return { slug: `${tilesetId}_${localId}`, blocking: false, tags: [] };
}

export const TerrainTileCatalog: FC<TerrainTileCatalogProps> = (props) => {
  const { onBindingsChange, onSelectTile, selectedTile, workspace } = props;
  const [emptyTileKeys, setEmptyTileKeys] = useState<Set<string>>(new Set());
  const [isScanningEmptyTiles, setIsScanningEmptyTiles] = useState(workspace.tilesets.length > 0);
  const [showEmptyTiles, setShowEmptyTiles] = useState(false);
  const [activeTilesetId, setActiveTilesetId] = useState(workspace.tilesets[0]?.id ?? "");
  const allTiles = useMemo(
    () =>
      workspace.tilesets.flatMap((tileset) =>
        Array.from({ length: tileset.tileCount }, (_, localId) => ({ tileset, localId, key: terrainTileKey(tileset.id, localId) }))
      ),
    [workspace.tilesets]
  );
  const tiles = useMemo(() => allTiles.filter((tile) => tile.tileset.id === activeTilesetId), [activeTilesetId, allTiles]);
  const visibleTiles = showEmptyTiles ? tiles : tiles.filter((tile) => !emptyTileKeys.has(tile.key));
  const selected = selectedTile
    ? tiles.find((tile) => tile.key === terrainTileKey(selectedTile.tilesetId, selectedTile.localId) && !emptyTileKeys.has(tile.key))
    : undefined;
  const selectedBinding = selected ? workspace.tileBindings[selected.key] : undefined;

  useEffect(() => {
    let cancelled = false;
    setEmptyTileKeys(new Set());
    setIsScanningEmptyTiles(workspace.tilesets.length > 0);
    Promise.all(
      workspace.tilesets.map(async (tileset) => {
        try {
          const emptyIds = await loadEmptyTerrainTileIds(tileset);
          return [...emptyIds].map((localId) => terrainTileKey(tileset.id, localId));
        } catch {
          return [];
        }
      })
    ).then((keys) => {
      if (cancelled) return;
      setEmptyTileKeys(new Set(keys.flat()));
      setIsScanningEmptyTiles(false);
    });
    return () => {
      cancelled = true;
    };
  }, [workspace.tilesets]);

  useEffect(() => {
    if (workspace.tilesets.some((tileset) => tileset.id === activeTilesetId)) return;
    setActiveTilesetId(workspace.tilesets[0]?.id ?? "");
  }, [activeTilesetId, workspace.tilesets]);

  useEffect(() => {
    if (selectedTile && emptyTileKeys.has(terrainTileKey(selectedTile.tilesetId, selectedTile.localId))) onSelectTile(undefined);
  }, [emptyTileKeys, onSelectTile, selectedTile]);

  function updateSelected(update: Partial<TerrainTileBinding>): void {
    if (!selected) return;
    const binding = selectedBinding ?? defaultBinding(selected.tileset.id, selected.localId);
    onBindingsChange({ ...workspace.tileBindings, [selected.key]: { ...binding, ...update } });
  }

  function initializeAll(): void {
    const bindings = { ...workspace.tileBindings };
    for (const tile of tiles) {
      if (!emptyTileKeys.has(tile.key)) bindings[tile.key] ??= defaultBinding(tile.tileset.id, tile.localId);
    }
    onBindingsChange(bindings);
  }

  return (
    <div className="grid min-h-0 gap-3 rounded-md border border-border p-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Tileset palette</h3>
            <p className="text-xs text-muted-foreground">Select a sprite to paint modules and edit its semantic metadata.</p>
          </div>
          <div className="flex items-center gap-3">
            <Label className="space-y-1 text-xs text-muted-foreground">
              <span className="block">Tileset</span>
              <select
                className="h-9 min-w-44 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                onChange={(event) => {
                  setActiveTilesetId(event.target.value);
                  onSelectTile(undefined);
                }}
                value={activeTilesetId}
              >
                {workspace.tilesets.map((tileset) => (
                  <option key={tileset.id} value={tileset.id}>
                    {tileset.name}
                  </option>
                ))}
              </select>
            </Label>
            <Label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={showEmptyTiles} onCheckedChange={setShowEmptyTiles} />
              Show empty tiles
            </Label>
            <Button disabled={tiles.length === 0 || isScanningEmptyTiles} onClick={initializeAll} size="sm" type="button" variant="outline">
              Initialize unbound
            </Button>
          </div>
        </div>
        {tiles.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Import a PNG as a Tileset asset and set its tile size.
          </p>
        )}
        {isScanningEmptyTiles && tiles.length > 0 && (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Inspecting tileset transparency…
          </p>
        )}
        {!isScanningEmptyTiles && (
          <div className="flex max-h-72 flex-wrap gap-2 overflow-y-auto rounded bg-muted/40 p-2">
            {visibleTiles.map((tile) => {
              const scale = 48 / tile.tileset.tileSize;
              const column = tile.localId % tile.tileset.columns;
              const row = Math.floor(tile.localId / tile.tileset.columns);
              const bound = workspace.tileBindings[tile.key];
              const empty = emptyTileKeys.has(tile.key);
              return (
                <button
                  className={cn(
                    "relative size-14 overflow-hidden rounded border-2 bg-background",
                    empty
                      ? "cursor-not-allowed border-muted-foreground/30 bg-muted opacity-50 grayscale"
                      : selected?.key === tile.key
                        ? "border-primary"
                        : bound
                          ? "border-emerald-600/70"
                          : "border-destructive/70"
                  )}
                  disabled={empty}
                  key={tile.key}
                  onClick={() => onSelectTile({ tilesetId: tile.tileset.id, localId: tile.localId, orientation: 0 })}
                  title={empty ? `${tile.key} — empty tile` : `${tile.key}${bound ? ` — ${bound.slug}` : " — unbound"}`}
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
                  {empty && <span className="absolute inset-0 bg-muted/70" />}
                  <span className="absolute bottom-0 right-0 bg-background/90 px-1 font-mono text-[9px]">{tile.localId}</span>
                </button>
              );
            })}
            {visibleTiles.length === 0 && tiles.length > 0 && (
              <p className="w-full p-3 text-center text-xs text-muted-foreground">All tiles in this tileset are empty.</p>
            )}
          </div>
        )}
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
              <Label htmlFor="tile-tags">Semantic tags</Label>
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
                placeholder="WALKABLE, WATER, SHORE, FOLIAGE"
                value={selectedBinding?.tags.join(", ") ?? ""}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
