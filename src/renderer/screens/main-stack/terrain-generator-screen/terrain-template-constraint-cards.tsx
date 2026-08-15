import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import type { FC, KeyboardEvent, MouseEvent } from "react";
import type { TerrainPiece, TerrainSiteTemplate } from "../../../../shared/terrain-authoring";
import { terrainOrientationMatrix } from "../../../../shared/terrain-wfc";
import type { TerrainConstraintHighlight } from "./terrain-template-constraint-preview";

interface TerrainTemplateConstraintCardsProps {
  focusedKey?: string;
  onChange: (update: Partial<TerrainSiteTemplate>) => void;
  onFocus: (highlight: TerrainConstraintHighlight, selectedIndex: number) => void;
  pieces: TerrainPiece[];
  template: TerrainSiteTemplate;
}

export const TerrainTemplateConstraintCards: FC<TerrainTemplateConstraintCardsProps> = (props) => {
  const { focusedKey, onChange, onFocus, pieces, template } = props;
  const constrainedCells = template.cells
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => cell.requiredTags.length > 0 || cell.forbiddenTags.length > 0);
  const constraintCount = constrainedCells.length + template.anchors.length + template.stamps.length + template.zones.length;

  function focus(highlight: TerrainConstraintHighlight): void {
    onFocus(highlight, highlight.y * template.width + highlight.x);
  }

  function handleCardKey(event: KeyboardEvent<HTMLDivElement>, highlight: TerrainConstraintHighlight): void {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    focus(highlight);
  }

  function deleteClick(event: MouseEvent<HTMLButtonElement>, action: () => void): void {
    event.stopPropagation();
    action();
  }

  const cardClass = (key: string) =>
    cn(
      "relative cursor-pointer space-y-2 rounded-md border border-border bg-card p-3 pt-10 text-left transition-colors hover:border-primary/60 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      focusedKey === key && "border-primary bg-primary/5 ring-2 ring-primary"
    );

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Created rules and constraints</p>
          <p className="text-[11px] text-muted-foreground">Click any card to highlight its complete footprint in the preview.</p>
        </div>
        <Badge variant="outline">{constraintCount}</Badge>
      </div>
      {constraintCount === 0 ? (
        <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No authored rules yet. Select a cell in the preview and create one using the panel on the right.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {constrainedCells.map(({ cell, index }) => {
            const x = index % template.width;
            const y = Math.floor(index / template.width);
            const key = `CELL_${index}`;
            const color = cell.requiredTags.length > 0 ? "#34d399" : "#f87171";
            const highlight = { key, x, y, width: 1, height: 1, color };
            return (
              <div
                className={cardClass(key)}
                data-focused={focusedKey === key}
                data-template-constraint-card={key}
                key={key}
                onClick={() => focus(highlight)}
                onKeyDown={(event) => handleCardKey(event, highlight)}
                role="button"
                tabIndex={0}
              >
                <Badge className="absolute left-3 top-3" variant="secondary">
                  Cell tag rule
                </Badge>
                <Button
                  aria-label={`Delete tag rule at ${x},${y}`}
                  className="absolute right-1 top-1"
                  onClick={(event) =>
                    deleteClick(event, () =>
                      onChange({
                        cells: template.cells.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, requiredTags: [], forbiddenTags: [] } : entry
                        )
                      })
                    )
                  }
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-3" />
                </Button>
                <p className="font-mono text-xs font-semibold">
                  Cell {x},{y}
                </p>
                {cell.requiredTags.length > 0 && <p className="text-[11px] text-emerald-400">Requires: {cell.requiredTags.join(", ")}</p>}
                {cell.forbiddenTags.length > 0 && <p className="text-[11px] text-red-400">Forbids: {cell.forbiddenTags.join(", ")}</p>}
              </div>
            );
          })}
          {template.anchors.map((anchor, index) => {
            const key = `ANCHOR_${index}`;
            const color = anchor.kind === "ENTRANCE" ? "#22d3ee" : anchor.kind === "EXIT" ? "#c084fc" : "#f472b6";
            const highlight = { key, x: anchor.x, y: anchor.y, width: 1, height: 1, color };
            return (
              <div
                className={cardClass(key)}
                data-focused={focusedKey === key}
                data-template-constraint-card={key}
                key={`${anchor.slug}-${index}`}
                onClick={() => focus(highlight)}
                onKeyDown={(event) => handleCardKey(event, highlight)}
                role="button"
                tabIndex={0}
              >
                <Badge className="absolute left-3 top-3" variant="secondary">
                  {anchor.kind.toLowerCase()} anchor
                </Badge>
                <Button
                  aria-label={`Delete ${anchor.slug}`}
                  className="absolute right-1 top-1"
                  onClick={(event) =>
                    deleteClick(event, () => onChange({ anchors: template.anchors.filter((_, entryIndex) => entryIndex !== index) }))
                  }
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-3" />
                </Button>
                <p className="truncate font-mono text-xs font-semibold">{anchor.slug}</p>
                <p className="text-[11px] text-muted-foreground">
                  Cell {anchor.x},{anchor.y} · {anchor.direction} · {anchor.socket}
                </p>
              </div>
            );
          })}
          {template.stamps.map((stamp, index) => {
            const key = `STAMP_${index}`;
            const piece = pieces.find((entry) => entry.slug === stamp.piece);
            const matrix = terrainOrientationMatrix(stamp.orientation);
            const swapsDimensions = matrix[1] !== 0 || matrix[2] !== 0;
            const width = piece ? (swapsDimensions ? piece.height : piece.width) : 1;
            const height = piece ? (swapsDimensions ? piece.width : piece.height) : 1;
            const highlight = { key, x: stamp.x, y: stamp.y, width, height, color: "#fbbf24" };
            return (
              <div
                className={cardClass(key)}
                data-focused={focusedKey === key}
                data-template-constraint-card={key}
                key={`${stamp.piece}-${stamp.x}-${stamp.y}-${index}`}
                onClick={() => focus(highlight)}
                onKeyDown={(event) => handleCardKey(event, highlight)}
                role="button"
                tabIndex={0}
              >
                <Badge className="absolute left-3 top-3" variant="secondary">
                  Required stamp
                </Badge>
                <Button
                  aria-label={`Delete ${stamp.piece} stamp`}
                  className="absolute right-1 top-1"
                  onClick={(event) =>
                    deleteClick(event, () => onChange({ stamps: template.stamps.filter((_, entryIndex) => entryIndex !== index) }))
                  }
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-3" />
                </Button>
                <p className="truncate font-mono text-xs font-semibold">{stamp.piece}</p>
                <p className="text-[11px] text-muted-foreground">
                  Cell {stamp.x},{stamp.y} · {width}×{height} · orientation {stamp.orientation}
                </p>
              </div>
            );
          })}
          {template.zones.map((zone, index) => {
            const key = `ZONE_${index}`;
            const highlight = {
              key,
              x: zone.x,
              y: zone.y,
              width: zone.width,
              height: zone.height,
              color: "#60a5fa"
            };
            return (
              <div
                className={cardClass(key)}
                data-focused={focusedKey === key}
                data-template-constraint-card={key}
                key={`${zone.slug}-${index}`}
                onClick={() => focus(highlight)}
                onKeyDown={(event) => handleCardKey(event, highlight)}
                role="button"
                tabIndex={0}
              >
                <Badge className="absolute left-3 top-3" variant="secondary">
                  Validation zone
                </Badge>
                <Button
                  aria-label={`Delete ${zone.slug}`}
                  className="absolute right-1 top-1"
                  onClick={(event) =>
                    deleteClick(event, () => onChange({ zones: template.zones.filter((_, entryIndex) => entryIndex !== index) }))
                  }
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-3" />
                </Button>
                <p className="truncate font-mono text-xs font-semibold">{zone.slug}</p>
                <p className="text-[11px] text-muted-foreground">
                  Cell {zone.x},{zone.y} · {zone.width}×{zone.height} · {zone.requiredTags.join(", ") || "any terrain tag"}
                </p>
                <div className="grid grid-cols-2 gap-2" onClick={(event) => event.stopPropagation()}>
                  <Label className="space-y-1 text-[10px]">
                    Minimum count
                    <Input
                      min={0}
                      onChange={(event) =>
                        onChange({
                          zones: template.zones.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, minCount: Number(event.target.value) } : entry
                          )
                        })
                      }
                      type="number"
                      value={zone.minCount}
                    />
                  </Label>
                  <Label className="space-y-1 text-[10px]">
                    Maximum count
                    <Input
                      min={0}
                      onChange={(event) =>
                        onChange({
                          zones: template.zones.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, maxCount: Number(event.target.value) } : entry
                          )
                        })
                      }
                      type="number"
                      value={zone.maxCount}
                    />
                  </Label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
