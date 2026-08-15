import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { type FC, useEffect, useState } from "react";
import type { TerrainAdjacencyOverride, TerrainDirection, TerrainPiece, TerrainPieceSet } from "../../../../shared/terrain-authoring";

interface TerrainPieceSetEditorProps {
  onOverridesChange: (overrides: TerrainAdjacencyOverride[]) => void;
  onSetsChange: (sets: TerrainPieceSet[]) => void;
  overrides: TerrainAdjacencyOverride[];
  pieces: TerrainPiece[];
  sets: TerrainPieceSet[];
}

export const TerrainPieceSetEditor: FC<TerrainPieceSetEditorProps> = (props) => {
  const { onOverridesChange, onSetsChange, overrides, pieces, sets } = props;
  const [selectedSetSlug, setSelectedSetSlug] = useState(sets[0]?.slug ?? "");
  const [sourcePiece, setSourcePiece] = useState("");
  const [targetPiece, setTargetPiece] = useState("");
  const [direction, setDirection] = useState<TerrainDirection>("north");
  const [mode, setMode] = useState<"ALLOW_ONLY" | "DENY">("DENY");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const selectedSet = sets.find((entry) => entry.slug === selectedSetSlug);

  useEffect(() => {
    if (sets.some((entry) => entry.slug === selectedSetSlug)) return;
    setSelectedSetSlug(sets[0]?.slug ?? "");
  }, [selectedSetSlug, sets]);

  function addSet(): void {
    let index = sets.length + 1;
    while (sets.some((entry) => entry.slug === `PIECE_SET_${index}`)) index += 1;
    const next: TerrainPieceSet = {
      slug: `PIECE_SET_${index}`,
      label: "New collection",
      pieceSlugs: pieces.slice(0, 1).map((piece) => piece.slug),
      biomeTags: [],
      siteTags: []
    };
    onSetsChange([...sets, next]);
    setSelectedSetSlug(next.slug);
  }

  function updateSet(update: Partial<TerrainPieceSet>): void {
    if (!selectedSet) return;
    onSetsChange(sets.map((entry) => (entry.slug === selectedSet.slug ? { ...entry, ...update } : entry)));
    if (update.slug) setSelectedSetSlug(update.slug);
  }

  function addOverride(): void {
    if (!sourcePiece || !targetPiece) return;
    let index = overrides.length + 1;
    while (overrides.some((entry) => entry.slug === `ADJACENCY_${index}`)) index += 1;
    onOverridesChange([...overrides, { slug: `ADJACENCY_${index}`, sourcePiece, targetPiece, direction, mode }]);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-md border border-border p-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Collections</h3>
            <p className="text-xs text-muted-foreground">A collection is simply the group of pieces available to one terrain generation.</p>
          </div>
          <div className="flex items-end gap-2">
            <Button disabled={pieces.length === 0} onClick={addSet} size="sm" type="button" variant="outline">
              <Plus className="size-4" /> Add collection
            </Button>
          </div>
        </div>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          onChange={(event) => setSelectedSetSlug(event.target.value)}
          value={selectedSetSlug}
        >
          <option value="">Choose a collection…</option>
          {sets.map((entry) => (
            <option key={entry.slug} value={entry.slug}>
              {entry.slug}
            </option>
          ))}
        </select>
        {selectedSet && (
          <>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input onChange={(event) => updateSet({ slug: normalizeSlug(event.target.value) })} value={selectedSet.slug} />
              <Input onChange={(event) => updateSet({ label: event.target.value })} value={selectedSet.label} />
              <Button
                onClick={() => {
                  onSetsChange(sets.filter((entry) => entry.slug !== selectedSet.slug));
                  setSelectedSetSlug("");
                }}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Label className="space-y-1 text-xs">
                Biome tags
                <Input
                  onChange={(event) => updateSet({ biomeTags: slugList(event.target.value) })}
                  value={selectedSet.biomeTags.join(", ")}
                />
              </Label>
              <Label className="space-y-1 text-xs">
                Site tags
                <Input
                  onChange={(event) => updateSet({ siteTags: slugList(event.target.value) })}
                  value={selectedSet.siteTags.join(", ")}
                />
              </Label>
            </div>
            <div className="flex flex-wrap gap-3 rounded border border-border p-2">
              {pieces.map((piece) => (
                <Label className="flex items-center gap-2 text-xs" key={piece.slug}>
                  <Checkbox
                    checked={selectedSet.pieceSlugs.includes(piece.slug)}
                    onCheckedChange={(checked) =>
                      updateSet({
                        pieceSlugs:
                          checked === true
                            ? [...new Set([...selectedSet.pieceSlugs, piece.slug])]
                            : selectedSet.pieceSlugs.filter((slug) => slug !== piece.slug)
                      })
                    }
                  />
                  {piece.slug}
                </Label>
              ))}
            </div>
          </>
        )}
      </div>
      <Button className="justify-self-start" onClick={() => setShowAdvanced((value) => !value)} type="button" variant="outline">
        <Settings2 className="size-4" /> {showAdvanced ? "Hide advanced adjacency" : "Advanced adjacency overrides"}
      </Button>
      {showAdvanced && (
        <div className="space-y-3 rounded-md border border-border p-3">
          <div>
            <h3 className="text-sm font-semibold">Adjacency exceptions</h3>
            <p className="text-xs text-muted-foreground">
              Exceptions apply after sockets match; they never connect incompatible edge tags.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-5">
            <select
              className="h-9 rounded border border-input bg-background px-2 text-xs"
              onChange={(event) => setSourcePiece(event.target.value)}
              value={sourcePiece}
            >
              <option value="">Source…</option>
              {pieces.map((piece) => (
                <option key={piece.slug} value={piece.slug}>
                  {piece.slug}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded border border-input bg-background px-2 text-xs"
              onChange={(event) => setDirection(event.target.value as TerrainDirection)}
              value={direction}
            >
              <option value="north">North</option>
              <option value="east">East</option>
              <option value="south">South</option>
              <option value="west">West</option>
            </select>
            <select
              className="h-9 rounded border border-input bg-background px-2 text-xs"
              onChange={(event) => setTargetPiece(event.target.value)}
              value={targetPiece}
            >
              <option value="">Target…</option>
              {pieces.map((piece) => (
                <option key={piece.slug} value={piece.slug}>
                  {piece.slug}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded border border-input bg-background px-2 text-xs"
              onChange={(event) => setMode(event.target.value as "ALLOW_ONLY" | "DENY")}
              value={mode}
            >
              <option value="DENY">Deny</option>
              <option value="ALLOW_ONLY">Allow only</option>
            </select>
            <Button onClick={addOverride} size="sm" type="button">
              <Plus className="size-4" /> Add
            </Button>
          </div>
          <div className="space-y-1">
            {overrides.map((entry) => (
              <div className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1 text-xs" key={entry.slug}>
                <span>
                  {entry.sourcePiece} · {entry.direction} · {entry.mode} · {entry.targetPiece}
                </span>
                <Button
                  onClick={() => onOverridesChange(overrides.filter((override) => override.slug !== entry.slug))}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function normalizeSlug(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+/, "");
}

function slugList(value: string): string[] {
  return value.split(",").map(normalizeSlug).filter(Boolean);
}
