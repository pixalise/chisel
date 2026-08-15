import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { type FC, useEffect, useRef, useState } from "react";
import type { TerrainApprovedAsset, TerrainTilesetView } from "../../../../shared/terrain-authoring";
import { freezeTerrainCandidate, type TerrainCandidate, type TerrainCandidateResult } from "../../../../shared/terrain-wfc";
import { drawTerrainCell } from "./terrain-rendering";

interface TerrainCandidateBatchProps {
  approvedAssets: TerrainApprovedAsset[];
  onApprove: (asset: TerrainApprovedAsset) => Promise<void>;
  results: TerrainCandidateResult[];
  tilesets: TerrainTilesetView[];
}

export const TerrainCandidateBatch: FC<TerrainCandidateBatchProps> = (props) => {
  const { approvedAssets, onApprove, results, tilesets } = props;
  const canvases = useRef(new Map<number, HTMLCanvasElement>());
  const images = useRef(new Map<string, HTMLImageElement>());
  const [imageRevision, setImageRevision] = useState(0);
  const [selected, setSelected] = useState<TerrainCandidate>();
  const [slug, setSlug] = useState("APPROVED_MAP_1");
  const [kind, setKind] = useState<"MAP" | "SUBMODULE">("MAP");

  useEffect(() => {
    images.current.clear();
    let cancelled = false;
    for (const tileset of tilesets) {
      const image = new Image();
      image.onload = () => {
        if (!cancelled) setImageRevision((revision) => revision + 1);
      };
      image.src = window.electron.toAssetUrl(tileset.imagePath);
      images.current.set(tileset.id, image);
    }
    return () => {
      cancelled = true;
    };
  }, [tilesets]);

  useEffect(() => {
    for (const result of results) {
      const canvas = canvases.current.get(result.seed);
      const candidate = result.candidate;
      if (!canvas || !candidate) continue;
      const cellSize = Math.max(4, Math.min(14, Math.floor(280 / Math.max(candidate.width, candidate.height))));
      canvas.width = candidate.width * cellSize;
      canvas.height = candidate.height * cellSize;
      const context = canvas.getContext("2d");
      if (!context) continue;
      context.imageSmoothingEnabled = false;
      context.fillStyle = "#0e0f0e";
      context.fillRect(0, 0, canvas.width, canvas.height);
      candidate.cells.forEach((cell, index) =>
        drawTerrainCell(
          context,
          cell,
          tilesets,
          images.current,
          (index % candidate.width) * cellSize,
          Math.floor(index / candidate.width) * cellSize,
          cellSize
        )
      );
    }
  }, [imageRevision, results, tilesets]);

  async function approve(): Promise<void> {
    if (!selected) return;
    await onApprove(freezeTerrainCandidate(selected, slug, kind));
    let index = approvedAssets.length + 2;
    while (approvedAssets.some((entry) => entry.slug === `APPROVED_MAP_${index}`)) index += 1;
    setSlug(`APPROVED_MAP_${index}`);
    setSelected(undefined);
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Candidate contact sheet</h3>
          <p className="text-xs text-muted-foreground">
            Each seed solves the selected terrain collection; invalid candidates remain inspectable but cannot be approved.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {results.length > 0 && (
            <Badge variant="outline">
              Seeds {results[0].seed}–{results[results.length - 1].seed}
            </Badge>
          )}
          <Badge variant="outline">{results.length} candidates</Badge>
        </div>
      </div>
      {results.length === 0 && (
        <p className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
          Generate a macro template to produce a review batch.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {results.map((result) => {
          const candidate = result.candidate;
          const valid = candidate !== undefined && candidate.issues.length === 0;
          return (
            <div className="space-y-2 rounded border border-border bg-card p-2" key={result.seed}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs">Seed {result.seed}</span>
                <Badge variant={valid ? "secondary" : "destructive"}>{valid ? "valid" : "rejected"}</Badge>
              </div>
              {candidate && (
                <div className="flex min-h-36 items-center justify-center overflow-auto rounded bg-slate-950 p-2">
                  <canvas
                    className="[image-rendering:pixelated]"
                    ref={(canvas) => {
                      if (canvas) canvases.current.set(result.seed, canvas);
                      else canvases.current.delete(result.seed);
                    }}
                  />
                </div>
              )}
              {result.error && <p className="text-xs text-destructive">{result.error}</p>}
              {candidate && (
                <>
                  <p className="text-[11px] text-muted-foreground">
                    {candidate.metrics.distinctPieces} pieces · {candidate.metrics.walkableComponents} walkable components ·{" "}
                    {candidate.metrics.reachableAnchors}/{candidate.metrics.requiredAnchors} anchors
                  </p>
                  {candidate.issues.slice(0, 3).map((issue) => (
                    <p className="text-[11px] text-destructive" key={`${issue.code}-${issue.message}`}>
                      {issue.code}: {issue.message}
                    </p>
                  ))}
                  <Button
                    disabled={!valid}
                    onClick={() => setSelected(candidate)}
                    size="sm"
                    type="button"
                    variant={selected?.seed === candidate.seed ? "default" : "outline"}
                  >
                    Select for approval
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
      {selected && (
        <div className="grid gap-2 rounded border border-border p-3 md:grid-cols-[1fr_10rem_auto] md:items-end">
          <Label className="space-y-1 text-xs">
            Approved asset slug
            <Input onChange={(event) => setSlug(normalizeSlug(event.target.value))} value={slug} />
          </Label>
          <Label className="space-y-1 text-xs">
            Kind
            <select
              className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
              onChange={(event) => setKind(event.target.value as typeof kind)}
              value={kind}
            >
              <option value="MAP">Complete map</option>
              <option value="SUBMODULE">Submodule</option>
            </select>
          </Label>
          <Button onClick={() => void approve()} type="button">
            <Check className="size-4" /> Freeze approved asset
          </Button>
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
