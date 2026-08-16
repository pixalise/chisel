import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { type FC, useMemo, useState } from "react";
import type { TerrainPiece, TerrainTilesetView } from "../../../../shared/terrain-authoring";
import { TerrainPiecePreview } from "./terrain-piece-preview";

interface TerrainCollectionPiecePickerProps {
  onChange: (pieceSlugs: string[], pieceWeights: Record<string, number>) => void;
  pieceWeights: Record<string, number>;
  pieces: TerrainPiece[];
  selectedPieceSlugs: string[];
  tilesets: TerrainTilesetView[];
}

type PieceStatusFilter = "all" | "active" | "inactive";

export const TerrainCollectionPiecePicker: FC<TerrainCollectionPiecePickerProps> = (props) => {
  const { onChange, pieceWeights, pieces, selectedPieceSlugs, tilesets } = props;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PieceStatusFilter>("all");
  const selected = new Set(selectedPieceSlugs);
  const activePieceCount = pieces.filter((piece) => selected.has(piece.slug)).length;
  const visiblePieces = useMemo(() => {
    const query = search.trim().toUpperCase();
    return pieces.filter((piece) => {
      const active = selectedPieceSlugs.includes(piece.slug);
      if (statusFilter === "active" && !active) return false;
      if (statusFilter === "inactive" && active) return false;
      if (!query) return true;
      return [
        piece.slug,
        `${piece.width}X${piece.height}`,
        ...piece.biomeTags,
        ...piece.siteTags,
        ...piece.semanticFlags,
        piece.mutationFamily
      ]
        .join(" ")
        .toUpperCase()
        .includes(query);
    });
  }, [pieces, search, selectedPieceSlugs, statusFilter]);

  function togglePiece(piece: TerrainPiece): void {
    if (selected.has(piece.slug)) {
      if (activePieceCount <= 1) return;
      onChange(
        selectedPieceSlugs.filter((slug) => slug !== piece.slug),
        Object.fromEntries(Object.entries(pieceWeights).filter(([slug]) => slug !== piece.slug))
      );
    } else {
      onChange([...selectedPieceSlugs, piece.slug], { ...pieceWeights, [piece.slug]: pieceWeights[piece.slug] ?? piece.weight });
    }
  }

  function updateWeight(piece: TerrainPiece, weight: number): void {
    if (!Number.isFinite(weight)) return;
    onChange(selectedPieceSlugs, { ...pieceWeights, [piece.slug]: Math.max(0, Math.min(weight, 1)) });
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold">Collection pieces</p>
          <p className="text-[11px] text-muted-foreground">
            Every authored piece is listed. Include the pieces used by this solve, then set their relative collection weights.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{activePieceCount} active</Badge>
          <Badge variant="outline">{pieces.length} available</Badge>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Search collection pieces"
          className="min-w-52 flex-1"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search slug, tag, family, or size…"
          type="search"
          value={search}
        />
        {(["all", "active", "inactive"] as const).map((filter) => (
          <Button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            size="sm"
            type="button"
            variant={statusFilter === filter ? "default" : "outline"}
          >
            {filter === "all" ? "All" : filter === "active" ? "Active" : "Inactive"}
          </Button>
        ))}
      </div>
      {visiblePieces.length > 0 ? (
        <div className="grid max-h-[42rem] gap-2 overflow-y-auto p-0.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {visiblePieces.map((piece, index) => {
            const active = selected.has(piece.slug);
            const isLastActive = active && activePieceCount <= 1;
            const weight = pieceWeights[piece.slug] ?? piece.weight;
            return (
              <div
                className={cn(
                  "relative min-w-0 space-y-2 rounded-md border bg-card p-2 transition-colors",
                  active
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border opacity-70 hover:border-primary/60 hover:bg-muted/30 hover:opacity-100",
                  isLastActive && "cursor-not-allowed"
                )}
                data-active={active}
                data-collection-piece={piece.slug}
                key={index}
              >
                <button
                  aria-pressed={active}
                  className="block w-full space-y-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={isLastActive}
                  onClick={() => togglePiece(piece)}
                  title={
                    isLastActive ? "A collection must keep at least one active piece" : `${active ? "Exclude" : "Include"} ${piece.slug}`
                  }
                  type="button"
                >
                  <div className="relative overflow-hidden rounded bg-slate-950">
                    <TerrainPiecePreview
                      ariaLabel={`${piece.slug} collection preview`}
                      piece={piece}
                      showCollision
                      size={112}
                      tilesets={tilesets}
                    />
                    <span
                      className={cn(
                        "absolute right-2 top-2 flex size-6 items-center justify-center rounded-full border",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background/90 text-muted-foreground"
                      )}
                    >
                      {active && <Check className="size-4" />}
                    </span>
                  </div>
                  <p className="truncate font-mono text-xs font-semibold" title={piece.slug}>
                    {piece.slug}
                  </p>
                  <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                    <span>
                      {piece.width}×{piece.height}
                    </span>
                    <Badge variant={active ? "secondary" : "outline"}>{active ? "Active" : "Inactive"}</Badge>
                  </div>
                </button>
                {active && (
                  <label className="block space-y-2 border-t border-border pt-2 text-[11px] font-medium">
                    <span className="flex items-center justify-between gap-2">
                      Collection weight
                      <output className="font-mono text-muted-foreground">{weight.toFixed(2)}</output>
                    </span>
                    <Slider
                      aria-label={`${piece.slug} collection weight`}
                      max={1}
                      min={0}
                      onValueChange={(value) => updateWeight(piece, value[0] ?? 0)}
                      rangeClassName="!rounded-full bg-primary/90"
                      step={0.01}
                      thumbClassName="h-4 w-4 !rounded-full border-2 border-background bg-primary shadow-[0_0_0_1px_var(--border)]"
                      trackClassName="h-2 !rounded-full border border-border bg-input"
                      value={[weight]}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          No collection pieces match this search and status filter.
        </p>
      )}
    </div>
  );
};
