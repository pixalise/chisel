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
import { finalizeTerrainSlug, normalizeTerrainSlugDraft } from "../../../../shared/terrain-slug";
import { loadEmptyTerrainTileIds } from "./terrain-empty-tiles";

interface TerrainTileCatalogProps {
  compact?: boolean;
  onBindingsChange: (bindings: Record<string, TerrainTileBinding>) => void;
  onSelectTile: (tile?: TerrainTileRef) => void;
  selectedTile?: TerrainTileRef;
  workspace: TerrainWorkspaceView;
}

function defaultBinding(tilesetId: string, localId: number): TerrainTileBinding {
  return { slug: `${tilesetId}_${localId}`, tags: [] };
}

export const TerrainTileCatalog: FC<TerrainTileCatalogProps> = (props) => {
  const { compact = false, onBindingsChange, onSelectTile, selectedTile, workspace } = props;
  const [emptyTileKeys, setEmptyTileKeys] = useState<Set<string>>(new Set());
  const [isScanningEmptyTiles, setIsScanningEmptyTiles] = useState(workspace.tilesets.length > 0);
  const [showEmptyTiles, setShowEmptyTiles] = useState(false);
  const [search, setSearch] = useState("");
  const [slugDraft, setSlugDraft] = useState("");
  const [activeTilesetId, setActiveTilesetId] = useState(workspace.tilesets[0]?.id ?? "");
  const allTiles = useMemo(
    () =>
      workspace.tilesets.flatMap((tileset) =>
        Array.from({ length: tileset.tileCount }, (_, localId) => ({ tileset, localId, key: terrainTileKey(tileset.id, localId) }))
      ),
    [workspace.tilesets]
  );
  const tiles = useMemo(() => allTiles.filter((tile) => tile.tileset.id === activeTilesetId), [activeTilesetId, allTiles]);
  const availableTiles = useMemo(
    () => (showEmptyTiles ? tiles : tiles.filter((tile) => !emptyTileKeys.has(tile.key))),
    [emptyTileKeys, showEmptyTiles, tiles]
  );
  const visibleTiles = useMemo(() => {
    const query = search.trim().toUpperCase();
    if (!query) return availableTiles;
    return availableTiles.filter((tile) => {
      const binding = workspace.tileBindings[tile.key];
      return [tile.key, String(tile.localId), binding?.slug ?? "", ...(binding?.tags ?? [])].join(" ").toUpperCase().includes(query);
    });
  }, [availableTiles, search, workspace.tileBindings]);
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

  useEffect(() => setSlugDraft(selectedBinding?.slug ?? ""), [selected?.key, selectedBinding?.slug]);

  function updateSelected(update: Partial<TerrainTileBinding>): void {
    if (!selected) return;
    const binding = selectedBinding ?? defaultBinding(selected.tileset.id, selected.localId);
    onBindingsChange({ ...workspace.tileBindings, [selected.key]: { ...binding, ...update } });
  }

  function commitSelectedSlug(): void {
    if (!selected) return;
    const slug = finalizeTerrainSlug(slugDraft, defaultBinding(selected.tileset.id, selected.localId).slug);
    setSlugDraft(slug);
    if (slug !== selectedBinding?.slug) updateSelected({ slug });
  }

  function selectTile(tile: (typeof tiles)[number]): void {
    if (!workspace.tileBindings[tile.key]) {
      onBindingsChange({
        ...workspace.tileBindings,
        [tile.key]: defaultBinding(tile.tileset.id, tile.localId)
      });
    }
    onSelectTile({ tilesetId: tile.tileset.id, localId: tile.localId, orientation: 0 });
  }

  return (
    <div
      className={cn(
        "grid min-h-0 gap-3 rounded-md border border-border p-3",
        compact ? "grid-cols-1" : "lg:grid-cols-[minmax(0,1fr)_18rem]"
      )}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">{compact ? "Sprite palette" : "Tileset catalog"}</h3>
            <p className="text-xs text-muted-foreground">
              {compact
                ? "Choose the sprite used by the terrain paint mode."
                : "Select sprites to assign stable identity and semantic tags. Metadata is created automatically on first selection."}
            </p>
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
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Search terrain sprites"
            className="min-w-52 flex-1"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search local ID, sprite slug, or semantic tag…"
            type="search"
            value={search}
          />
          <span className="text-xs text-muted-foreground">
            {visibleTiles.length} of {availableTiles.length} sprites
          </span>
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
              const binding = workspace.tileBindings[tile.key];
              const empty = emptyTileKeys.has(tile.key);
              return (
                <button
                  className={cn(
                    "relative size-14 overflow-hidden rounded border-2 bg-background",
                    empty
                      ? "cursor-not-allowed border-muted-foreground/30 bg-muted opacity-50 grayscale"
                      : selected?.key === tile.key
                        ? "border-primary"
                        : "border-border hover:border-primary/60"
                  )}
                  disabled={empty}
                  data-terrain-sprite={tile.key}
                  key={tile.key}
                  onClick={() => selectTile(tile)}
                  title={empty ? `${tile.key} — empty tile` : `${tile.key}${binding ? ` — ${binding.slug}` : ""}`}
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
              <p className="w-full p-3 text-center text-xs text-muted-foreground">
                {search ? "No sprites match this search." : "All tiles in this tileset are empty."}
              </p>
            )}
          </div>
        )}
      </div>
      {!compact && (
        <div className="space-y-3 border-l border-border pl-3">
          <h3 className="text-sm font-semibold">Sprite metadata {selected?.key}</h3>
          {selected && (
            <>
              <div className="space-y-1">
                <Label htmlFor="tile-slug">Stable slug</Label>
                <Input
                  id="tile-slug"
                  onBlur={commitSelectedSlug}
                  onChange={(event) => setSlugDraft(normalizeTerrainSlugDraft(event.target.value))}
                  value={slugDraft}
                />
              </div>
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
      )}
    </div>
  );
};
