import { Badge } from "@/components/ui/badge";
import { type FC, type MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from "react";
import type { TerrainPiece, TerrainSiteTemplate, TerrainTilesetView } from "../../../../shared/terrain-authoring";
import { terrainOrientationMatrix, type TerrainCandidate } from "../../../../shared/terrain-wfc";
import { drawTerrainCell } from "./terrain-rendering";

interface TerrainTemplateConstraintPreviewProps {
  candidate?: TerrainCandidate;
  highlight?: TerrainConstraintHighlight;
  onSelectCell: (index: number) => void;
  pieces: TerrainPiece[];
  selectedIndex: number;
  template: TerrainSiteTemplate;
  tilesets: TerrainTilesetView[];
}

export interface TerrainConstraintHighlight {
  color: string;
  height: number;
  key: string;
  width: number;
  x: number;
  y: number;
}

export const TerrainTemplateConstraintPreview: FC<TerrainTemplateConstraintPreviewProps> = (props) => {
  const { candidate, highlight, onSelectCell, pieces, selectedIndex, template, tilesets } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const images = useRef(new Map<string, HTMLImageElement>());
  const [imageRevision, setImageRevision] = useState(0);
  const cellSize = Math.max(8, Math.min(36, Math.floor(540 / Math.max(template.width, template.height))));

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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = template.width * cellSize;
    const height = template.height * cellSize;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#111827";
    context.fillRect(0, 0, width, height);

    const currentCandidate =
      candidate?.sourceTemplate === template.slug && candidate.width === template.width && candidate.height === template.height
        ? candidate
        : undefined;
    for (let index = 0; index < template.cells.length; index += 1) {
      const x = index % template.width;
      const y = Math.floor(index / template.width);
      context.fillStyle = (x + y) % 2 === 0 ? "#222831" : "#1b2129";
      context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      const stack = currentCandidate?.cells[index];
      if (stack) drawTerrainCell(context, stack, tilesets, images.current, x * cellSize, y * cellSize, cellSize);
    }

    for (const zone of template.zones) {
      context.fillStyle = "rgba(59, 130, 246, 0.2)";
      context.fillRect(zone.x * cellSize, zone.y * cellSize, zone.width * cellSize, zone.height * cellSize);
      context.strokeStyle = "#60a5fa";
      context.lineWidth = 2;
      context.strokeRect(zone.x * cellSize + 1, zone.y * cellSize + 1, zone.width * cellSize - 2, zone.height * cellSize - 2);
      if (cellSize >= 16) drawLabel(context, "Z", zone.x * cellSize + 3, zone.y * cellSize + 3, "#dbeafe");
    }

    template.cells.forEach((cell, index) => {
      if (cell.requiredTags.length === 0 && cell.forbiddenTags.length === 0) return;
      const x = index % template.width;
      const y = Math.floor(index / template.width);
      const required = cell.requiredTags.length > 0;
      context.fillStyle = required ? "rgba(34, 197, 94, 0.45)" : "rgba(239, 68, 68, 0.45)";
      context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      if (cellSize >= 14) {
        context.fillStyle = "#ffffff";
        context.font = `700 ${Math.max(10, Math.floor(cellSize * 0.55))}px sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(required ? "+" : "−", x * cellSize + cellSize / 2, y * cellSize + cellSize / 2);
      }
    });

    for (const stamp of template.stamps) {
      const piece = pieces.find((entry) => entry.slug === stamp.piece);
      if (!piece) continue;
      const matrix = terrainOrientationMatrix(stamp.orientation);
      const swapsDimensions = matrix[1] !== 0 || matrix[2] !== 0;
      const stampWidth = swapsDimensions ? piece.height : piece.width;
      const stampHeight = swapsDimensions ? piece.width : piece.height;
      context.fillStyle = "rgba(245, 158, 11, 0.18)";
      context.fillRect(stamp.x * cellSize, stamp.y * cellSize, stampWidth * cellSize, stampHeight * cellSize);
      context.strokeStyle = "#fbbf24";
      context.lineWidth = 3;
      context.strokeRect(stamp.x * cellSize + 1.5, stamp.y * cellSize + 1.5, stampWidth * cellSize - 3, stampHeight * cellSize - 3);
      if (cellSize >= 16) drawLabel(context, "S", stamp.x * cellSize + 4, stamp.y * cellSize + 4, "#fef3c7");
    }

    for (const anchor of template.anchors) {
      const centerX = anchor.x * cellSize + cellSize / 2;
      const centerY = anchor.y * cellSize + cellSize / 2;
      const color = anchor.kind === "ENTRANCE" ? "#22d3ee" : anchor.kind === "EXIT" ? "#c084fc" : "#f472b6";
      context.fillStyle = "rgba(15, 23, 42, 0.88)";
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(centerX, centerY, Math.max(5, cellSize * 0.3), 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.strokeStyle = color;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(centerX, centerY);
      const vector = {
        north: [0, -1],
        east: [1, 0],
        south: [0, 1],
        west: [-1, 0]
      }[anchor.direction];
      context.lineTo(centerX + vector[0] * cellSize * 0.45, centerY + vector[1] * cellSize * 0.45);
      context.stroke();
    }

    context.strokeStyle = "rgba(255,255,255,0.16)";
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x <= template.width; x += 1) {
      context.moveTo(x * cellSize, 0);
      context.lineTo(x * cellSize, height);
    }
    for (let y = 0; y <= template.height; y += 1) {
      context.moveTo(0, y * cellSize);
      context.lineTo(width, y * cellSize);
    }
    context.stroke();

    if (highlight) {
      const inset = 2;
      context.save();
      context.shadowBlur = 12;
      context.shadowColor = highlight.color;
      context.strokeStyle = highlight.color;
      context.lineWidth = 4;
      context.strokeRect(
        highlight.x * cellSize + inset,
        highlight.y * cellSize + inset,
        highlight.width * cellSize - inset * 2,
        highlight.height * cellSize - inset * 2
      );
      context.restore();
    }

    const selectedX = selectedIndex % template.width;
    const selectedY = Math.floor(selectedIndex / template.width);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 3;
    context.strokeRect(selectedX * cellSize + 1.5, selectedY * cellSize + 1.5, cellSize - 3, cellSize - 3);
  }, [candidate, cellSize, highlight, imageRevision, pieces, selectedIndex, template, tilesets]);

  function selectCell(event: ReactMouseEvent<HTMLCanvasElement>): void {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * template.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * template.height);
    if (x >= 0 && x < template.width && y >= 0 && y < template.height) onSelectCell(y * template.width + x);
  }

  const backdrop = candidate?.sourceTemplate === template.slug ? candidate : undefined;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium">Constraint preview</p>
          <p className="text-[11px] text-muted-foreground">Click a cell to edit it. All authored constraints are overlaid together.</p>
        </div>
        <Badge variant="outline">{backdrop ? `Terrain seed ${backdrop.seed}` : "Generate for terrain backdrop"}</Badge>
      </div>
      <div className="max-h-[38rem] overflow-auto rounded bg-slate-950 p-3">
        <canvas
          aria-label="Terrain template constraint preview"
          className="mx-auto block cursor-crosshair [image-rendering:pixelated]"
          onClick={selectCell}
          ref={canvasRef}
        />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="text-emerald-400">+ Required tags</span>
        <span className="text-red-400">− Forbidden tags</span>
        <span className="text-amber-300">S Required stamp</span>
        <span className="text-blue-300">Z Validation zone</span>
        <span className="text-cyan-300">○ Entrance</span>
        <span className="text-purple-300">○ Exit</span>
        <span className="text-pink-300">○ Extension</span>
      </div>
    </div>
  );
};

function drawLabel(context: CanvasRenderingContext2D, label: string, x: number, y: number, color: string): void {
  context.fillStyle = "rgba(15, 23, 42, 0.9)";
  context.fillRect(x, y, 14, 14);
  context.fillStyle = color;
  context.font = "700 10px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, x + 7, y + 7);
}
