import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dices, Play } from "lucide-react";
import { type FC, useEffect, useRef, useState } from "react";
import type { TerrainWorkspaceView } from "../../../../shared/terrain-authoring";
import {
  compileTerrainWfcLibrary,
  generateTerrainWfcOutput,
  terrainWfcAdjacencyProblem,
  terrainWfcPatternSize,
  terrainWfcViablePatternIds,
  type TerrainWfcLibrary,
  type TerrainWfcOutput
} from "../../../../shared/terrain-wfc";
import { drawTerrainCell } from "./terrain-rendering";

interface TerrainWfcPreviewProps {
  workspace: TerrainWorkspaceView;
}

const previewCellSize = 48;

export const TerrainWfcPreview: FC<TerrainWfcPreviewProps> = (props) => {
  const { workspace } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef(new Map<string, HTMLImageElement>());
  const [width, setWidth] = useState(20);
  const [height, setHeight] = useState(20);
  const [seed, setSeed] = useState(1);
  const [library, setLibrary] = useState<TerrainWfcLibrary>();
  const [output, setOutput] = useState<TerrainWfcOutput>();
  const [error, setError] = useState("");
  const [imageRevision, setImageRevision] = useState(0);

  useEffect(() => {
    setLibrary(undefined);
    setOutput(undefined);
    setError("");
  }, [workspace.samples]);

  useEffect(() => {
    imagesRef.current.clear();
    let cancelled = false;
    for (const tileset of workspace.tilesets) {
      const image = new Image();
      image.onload = () => {
        if (!cancelled) setImageRevision((value) => value + 1);
      };
      image.onerror = () => {
        if (!cancelled) setImageRevision((value) => value + 1);
      };
      image.src = window.electron.toAssetUrl(tileset.imagePath);
      imagesRef.current.set(tileset.id, image);
    }
    return () => {
      cancelled = true;
    };
  }, [workspace.tilesets]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !output) return;
    canvas.width = output.width * previewCellSize;
    canvas.height = output.height * previewCellSize;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#151515";
    context.fillRect(0, 0, canvas.width, canvas.height);
    output.cells.forEach((cell, index) =>
      drawTerrainCell(
        context,
        cell,
        workspace.tilesets,
        imagesRef.current,
        (index % output.width) * previewCellSize,
        Math.floor(index / output.width) * previewCellSize,
        previewCellSize
      )
    );
  }, [imageRevision, output, workspace.tilesets]);

  function generate(nextSeed: number): void {
    setError("");
    setOutput(undefined);
    let compiled: TerrainWfcLibrary | undefined;
    try {
      if (width < terrainWfcPatternSize || width > 64 || height < terrainWfcPatternSize || height > 64) {
        throw new Error(`Preview dimensions must be between ${terrainWfcPatternSize} and 64 cells`);
      }
      compiled = compileTerrainWfcLibrary(workspace);
      setLibrary(compiled);
      const adjacencyProblem = terrainWfcAdjacencyProblem(compiled);
      if (adjacencyProblem) throw new Error(adjacencyProblem);
      setOutput(generateTerrainWfcOutput(compiled, { width, height, seed: nextSeed }));
      setSeed(nextSeed);
    } catch (caught) {
      if (!compiled) setLibrary(undefined);
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  const missingAdjacency = library
    ? (["north", "east", "south", "west"] as const).map((direction) => ({
        direction,
        count: library.patterns.filter((pattern) => library.adjacency[direction][pattern.id].length === 0).length
      }))
    : [];

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">WFC preview</h3>
          <p className="text-xs text-muted-foreground">
            Compile large painted examples into overlapping {terrainWfcPatternSize}×{terrainWfcPatternSize} patterns. Adjacency matches
            complete layered cells by exact sprites and orientations; semantic tags do not make edges compatible.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-20 space-y-1">
            <Label className="text-xs" htmlFor="wfc-preview-width">
              Width
            </Label>
            <Input
              id="wfc-preview-width"
              max="64"
              min={terrainWfcPatternSize}
              onChange={(event) => setWidth(Number(event.target.value))}
              type="number"
              value={width}
            />
          </div>
          <div className="w-20 space-y-1">
            <Label className="text-xs" htmlFor="wfc-preview-height">
              Height
            </Label>
            <Input
              id="wfc-preview-height"
              max="64"
              min={terrainWfcPatternSize}
              onChange={(event) => setHeight(Number(event.target.value))}
              type="number"
              value={height}
            />
          </div>
          <div className="w-28 space-y-1">
            <Label className="text-xs" htmlFor="wfc-preview-seed">
              Seed
            </Label>
            <Input
              id="wfc-preview-seed"
              min="0"
              onChange={(event) => setSeed(Number(event.target.value) >>> 0)}
              type="number"
              value={seed}
            />
          </div>
          <Button disabled={workspace.samples.length === 0} onClick={() => generate(seed)} type="button">
            <Play className="size-4" />
            Generate
          </Button>
          <Button disabled={workspace.samples.length === 0} onClick={() => generate((seed + 1) >>> 0)} type="button" variant="outline">
            <Dices className="size-4" />
            Next seed
          </Button>
        </div>
      </div>
      {workspace.samples.length === 0 && (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Create and paint at least one sample to enable the compiler.
        </p>
      )}
      {error && <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
      {library && (
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>{library.patterns.length} unique patterns</span>
            <span>{terrainWfcViablePatternIds(library).size} globally viable</span>
            <span>{library.sampleSlugs.length} samples</span>
            {output && <span>{output.attempts} generation attempts</span>}
            {missingAdjacency.map((entry) => (
              <span className={entry.count > 0 ? "text-amber-500" : undefined} key={entry.direction}>
                {entry.direction[0].toUpperCase()}: {entry.count} dead ends
              </span>
            ))}
          </div>
          <details className="rounded border border-border px-2 py-1">
            <summary className="cursor-pointer">Pattern contribution by sample</summary>
            <div className="mt-1 grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
              {library.sampleSlugs.map((slug) => {
                const stats = library.sampleStats[slug];
                return (
                  <span className={stats.viablePatterns === 0 ? "text-amber-500" : undefined} key={slug}>
                    {slug}: {stats.viablePatterns}/{stats.uniquePatterns} viable ({stats.extractedOccurrences} extracted)
                  </span>
                );
              })}
            </div>
          </details>
        </div>
      )}
      {output && (
        <div className="overflow-auto rounded-md border border-border bg-slate-950 p-2">
          <canvas className="h-auto max-h-[40rem] max-w-full [image-rendering:pixelated]" ref={canvasRef} />
        </div>
      )}
    </div>
  );
};
