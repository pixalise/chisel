import { cn } from "@/lib/utils";
import { type FC, useEffect, useMemo, useRef } from "react";
import type { TerrainSampleCell, TerrainTilesetView } from "../../../../shared/terrain-authoring";
import { type TerrainWfcDirection, type TerrainWfcLibrary, type TerrainWfcPatternDiagnostic } from "../../../../shared/terrain-wfc";
import { drawTerrainCell } from "./terrain-rendering";

interface TerrainWfcPatternCardProps {
  diagnostic: TerrainWfcPatternDiagnostic;
  imageRevision: number;
  images: Map<string, HTMLImageElement>;
  library: TerrainWfcLibrary;
  tilesets: TerrainTilesetView[];
}

const patternCellSize = 36;
const directionLabels: Record<TerrainWfcDirection, string> = { north: "N", east: "E", south: "S", west: "W" };
const directions: TerrainWfcDirection[] = ["north", "east", "south", "west"];

export const TerrainWfcPatternCard: FC<TerrainWfcPatternCardProps> = (props) => {
  const { diagnostic, imageRevision, images, library, tilesets } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pattern = library.patterns[diagnostic.patternId];
  const cells = useMemo(
    () =>
      pattern.symbols.map((symbol) => {
        const variant = library.visualVariants[symbol]?.[0];
        if (!variant) throw new Error(`Logical WFC cell '${symbol}' has no visual variant for pattern preview`);
        return variant.cell;
      }),
    [library.visualVariants, pattern.symbols]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = library.patternSize * patternCellSize;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#151515";
    context.fillRect(0, 0, size, size);
    cells.forEach((cell: TerrainSampleCell, index: number) =>
      drawTerrainCell(
        context,
        cell,
        tilesets,
        images,
        (index % library.patternSize) * patternCellSize,
        Math.floor(index / library.patternSize) * patternCellSize,
        patternCellSize
      )
    );
    context.strokeStyle = "rgba(255, 255, 255, 0.12)";
    context.lineWidth = 1;
    for (let offset = 1; offset < library.patternSize; offset += 1) {
      const position = offset * patternCellSize + 0.5;
      context.beginPath();
      context.moveTo(position, 0);
      context.lineTo(position, size);
      context.moveTo(0, position);
      context.lineTo(size, position);
      context.stroke();
    }
  }, [cells, imageRevision, images, library.patternSize, tilesets]);

  const sampleOccurrences = Object.entries(pattern.sampleOccurrences).sort(([left], [right]) => left.localeCompare(right));

  return (
    <article
      className={cn(
        "space-y-2 rounded-md border p-3",
        diagnostic.viable ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/50 bg-destructive/5"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs">Pattern {pattern.id}</span>
        <span className={cn("text-xs font-medium", diagnostic.viable ? "text-emerald-500" : "text-destructive")}>
          {diagnostic.viable ? "Valid" : "Invalid"}
        </span>
      </div>
      <div className="flex justify-center rounded border border-border bg-slate-950 p-2">
        <canvas className="block [image-rendering:pixelated]" ref={canvasRef} />
      </div>
      <div className="grid grid-cols-4 gap-1">
        {directions.map((direction) => {
          const counts = diagnostic.directions[direction];
          return (
            <div
              className={cn(
                "rounded border px-1 py-1 text-center font-mono text-[10px]",
                counts.viableCompatiblePatterns === 0 ? "border-destructive/50 text-destructive" : "border-border text-muted-foreground"
              )}
              key={direction}
              title={`${counts.viableCompatiblePatterns} globally viable neighbors out of ${counts.compatiblePatterns} compatible patterns`}
            >
              {directionLabels[direction]} {counts.viableCompatiblePatterns}/{counts.compatiblePatterns}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Weight {pattern.weight.toFixed(3)} · {sampleOccurrences.map(([slug, count]) => `${slug} ×${count}`).join(", ")}
      </p>
      <details className="text-[10px] text-muted-foreground">
        <summary className="cursor-pointer">Logical cells</summary>
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono leading-4">
          {formatSymbolGrid(pattern.symbols, library.patternSize)}
        </pre>
      </details>
    </article>
  );
};

function formatSymbolGrid(symbols: string[], size: number): string {
  return Array.from({ length: size }, (_, y) => symbols.slice(y * size, (y + 1) * size).join("  ")).join("\n");
}
