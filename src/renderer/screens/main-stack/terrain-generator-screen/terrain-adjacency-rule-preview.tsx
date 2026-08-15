import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, LockKeyhole, X } from "lucide-react";
import { type FC, useEffect, useRef, useState } from "react";
import type { TerrainAdjacencyOverride, TerrainPiece, TerrainTilesetView } from "../../../../shared/terrain-authoring";
import { drawTerrainCell } from "./terrain-rendering";

interface TerrainAdjacencyRulePreviewProps {
  rule: TerrainAdjacencyOverride;
  source?: TerrainPiece;
  target?: TerrainPiece;
  tilesets: TerrainTilesetView[];
}

const previewSize = 112;

export const TerrainAdjacencyRulePreview: FC<TerrainAdjacencyRulePreviewProps> = (props) => {
  const { rule, source, target, tilesets } = props;
  const sourceCanvas = useRef<HTMLCanvasElement>(null);
  const targetCanvas = useRef<HTMLCanvasElement>(null);
  const images = useRef(new Map<string, HTMLImageElement>());
  const [imageRevision, setImageRevision] = useState(0);
  const DirectionIcon = {
    north: ArrowUp,
    east: ArrowRight,
    south: ArrowDown,
    west: ArrowLeft
  }[rule.direction];

  useEffect(() => {
    images.current.clear();
    let cancelled = false;
    for (const tileset of tilesets) {
      const image = new Image();
      image.onload = () => {
        if (!cancelled) setImageRevision((revision) => revision + 1);
      };
      image.onerror = () => {
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
    drawPiece(sourceCanvas.current, source, tilesets, images.current);
    drawPiece(targetCanvas.current, target, tilesets, images.current);
  }, [imageRevision, source, target, tilesets]);

  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] items-center gap-1 rounded-md bg-slate-950 p-3"
      data-rule-preview={rule.slug}
    >
      <div className="space-y-1 text-center">
        <canvas className="mx-auto block max-w-full [image-rendering:pixelated]" ref={sourceCanvas} />
        <p className="truncate text-[10px] font-medium text-slate-300" title={rule.sourcePiece}>
          Source
        </p>
      </div>
      <div className="flex flex-col items-center gap-1 text-slate-300">
        <DirectionIcon className="size-5" />
        <span className="text-[9px] font-semibold uppercase">{rule.direction}</span>
      </div>
      <div className="space-y-1 text-center">
        <div className="relative mx-auto w-fit max-w-full">
          <canvas className="block max-w-full [image-rendering:pixelated]" ref={targetCanvas} />
          <div
            aria-label={rule.mode === "DENY" ? "Denied neighbor" : "Only allowed neighbor"}
            className={`absolute bottom-1 left-1 flex size-7 items-center justify-center rounded-full border shadow-lg ${
              rule.mode === "DENY" ? "border-red-300 bg-red-950/90 text-red-200" : "border-amber-300 bg-amber-950/90 text-amber-200"
            }`}
            title={rule.mode === "DENY" ? "This neighbor is denied" : "This is the only allowed neighbor"}
          >
            {rule.mode === "DENY" && <X className="size-5" strokeWidth={3} />}
            {rule.mode === "ALLOW_ONLY" && <LockKeyhole className="size-4" strokeWidth={2.5} />}
          </div>
        </div>
        <p className="truncate text-[10px] font-medium text-slate-300" title={rule.targetPiece}>
          {rule.mode === "DENY" ? "Blocked" : "Only neighbor"}
        </p>
      </div>
    </div>
  );
};

function drawPiece(
  canvas: HTMLCanvasElement | null,
  piece: TerrainPiece | undefined,
  tilesets: TerrainTilesetView[],
  images: Map<string, HTMLImageElement>
): void {
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = previewSize * ratio;
  canvas.height = previewSize * ratio;
  canvas.style.width = `${previewSize}px`;
  canvas.style.height = `${previewSize}px`;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#111827";
  context.fillRect(0, 0, previewSize, previewSize);
  if (!piece) {
    context.fillStyle = "#f87171";
    context.font = "600 11px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("MISSING", previewSize / 2, previewSize / 2);
    return;
  }
  const cellSize = Math.max(1, Math.floor((previewSize - 16) / Math.max(piece.width, piece.height)));
  const drawnWidth = cellSize * piece.width;
  const drawnHeight = cellSize * piece.height;
  const offsetX = Math.floor((previewSize - drawnWidth) / 2);
  const offsetY = Math.floor((previewSize - drawnHeight) / 2);
  piece.cells.forEach((cell, index) => {
    const x = index % piece.width;
    const y = Math.floor(index / piece.width);
    context.fillStyle = (x + y) % 2 === 0 ? "#252a32" : "#1d222a";
    context.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
    drawTerrainCell(context, cell.tiles, tilesets, images, offsetX + x * cellSize, offsetY + y * cellSize, cellSize);
  });
  context.strokeStyle = "rgba(255,255,255,0.22)";
  context.lineWidth = 1;
  context.strokeRect(offsetX + 0.5, offsetY + 0.5, drawnWidth - 1, drawnHeight - 1);
}
