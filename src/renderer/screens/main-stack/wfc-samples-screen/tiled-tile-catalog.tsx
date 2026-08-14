import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { type FC, useMemo, useState } from "react";
import type { TiledBoardView, TiledRole, TiledTileBinding } from "../../../../shared/tiled-samples";

interface TiledTileCatalogProps {
  board: TiledBoardView;
  onChange: (bindings: Record<string, TiledTileBinding>) => void;
  onDeleteTileset: (tilesetId: string) => void;
  roles: TiledRole[];
}

function defaultBinding(tilesetId: string, localId: number, roleId: string): TiledTileBinding {
  return { slug: `${tilesetId}_${localId}`, roleId, blocking: false, tags: [] };
}

export const TiledTileCatalog: FC<TiledTileCatalogProps> = (props) => {
  const { board, onChange, onDeleteTileset, roles } = props;
  const [selectedKey, setSelectedKey] = useState<string>();
  const tiles = useMemo(
    () =>
      board.tilesets.flatMap((tileset) =>
        Array.from({ length: tileset.tileCount }, (_, localId) => ({ tileset, localId, key: `${tileset.id}:${localId}` }))
      ),
    [board]
  );
  const selected = tiles.find((tile) => tile.key === selectedKey) ?? tiles[0];
  const selectedBinding = selected ? board.authoring.tileBindings[selected.key] : undefined;

  function updateSelected(update: Partial<TiledTileBinding>): void {
    if (!selected || roles.length === 0) return;
    const binding = selectedBinding ?? defaultBinding(selected.tileset.id, selected.localId, roles[0].id);
    onChange({ ...board.authoring.tileBindings, [selected.key]: { ...binding, ...update } });
  }

  function initializeAll(): void {
    if (roles.length === 0) return;
    const bindings = { ...board.authoring.tileBindings };
    for (const tile of tiles) bindings[tile.key] ??= defaultBinding(tile.tileset.id, tile.localId, roles[0].id);
    onChange(bindings);
  }

  return (
    <div className="grid min-h-0 gap-3 rounded-md border border-border p-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Tileset catalog</h3>
            <p className="text-xs text-muted-foreground">Bindings use managed tileset identity and local tile id, never map GIDs.</p>
          </div>
          <Button disabled={roles.length === 0} onClick={initializeAll} size="sm" type="button" variant="outline">
            Initialize unbound
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {board.tilesets.map((tileset) => (
            <div className="flex items-center gap-2 rounded border border-border px-2 py-1" key={tileset.id}>
              <span className="font-mono text-xs">{tileset.id}</span>
              <Button
                onClick={() => {
                  if (window.confirm(`Delete unused tileset '${tileset.id}' and its managed TSX and PNG files?`)) {
                    onDeleteTileset(tileset.id);
                  }
                }}
                size="sm"
                type="button"
                variant="destructive"
              >
                Delete unused
              </Button>
            </div>
          ))}
        </div>
        <div className="flex max-h-72 flex-wrap gap-2 overflow-y-auto rounded bg-muted/40 p-2">
          {tiles.map((tile) => {
            const scale = 48 / Math.max(tile.tileset.tileWidth, tile.tileset.tileHeight);
            const column = tile.localId % tile.tileset.columns;
            const row = Math.floor(tile.localId / tile.tileset.columns);
            const bound = board.authoring.tileBindings[tile.key];
            return (
              <button
                className={cn(
                  "relative size-14 overflow-hidden rounded border-2 bg-background",
                  selected?.key === tile.key ? "border-primary" : bound ? "border-emerald-600/70" : "border-destructive/70"
                )}
                key={tile.key}
                onClick={() => setSelectedKey(tile.key)}
                title={`${tile.key}${bound ? ` — ${bound.slug}` : " — unbound"}`}
                type="button"
              >
                <span
                  className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 bg-no-repeat"
                  style={{
                    width: tile.tileset.tileWidth * scale,
                    height: tile.tileset.tileHeight * scale,
                    backgroundImage: `url(${window.electron.toAssetUrl(tile.tileset.imagePath)})`,
                    backgroundSize: `${tile.tileset.imageWidth * scale}px ${tile.tileset.imageHeight * scale}px`,
                    backgroundPosition: `${-(tile.tileset.margin + column * (tile.tileset.tileWidth + tile.tileset.spacing)) * scale}px ${-(tile.tileset.margin + row * (tile.tileset.tileHeight + tile.tileset.spacing)) * scale}px`
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
                {roles.map((role) => (
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
