import { type FC, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import type { TerrainApprovedAsset, TerrainSpatialLayout, TerrainTilesetView } from "../../../../shared/terrain-authoring";
import { drawTerrainCell } from "./terrain-rendering";

interface TerrainApprovedMapPreviewProps {
  activeZoneSlug?: string;
  asset: TerrainApprovedAsset;
  layout?: TerrainSpatialLayout;
  maxSize?: number;
  onPaintCell?: (index: number, erase: boolean) => void;
  onSelectCell?: (index: number) => void;
  selectedIndex?: number;
  tilesets: TerrainTilesetView[];
}

interface PointerState {
  erase: boolean;
  pointerId: number;
}

export const TerrainApprovedMapPreview: FC<TerrainApprovedMapPreviewProps> = (props) => {
  const { activeZoneSlug, asset, layout, maxSize = 560, onPaintCell, onSelectCell, selectedIndex, tilesets } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const images = useRef(new Map<string, HTMLImageElement>());
  const pointerState = useRef<PointerState>();
  const lastIndex = useRef(-1);
  const [imageRevision, setImageRevision] = useState(0);
  const cellSize = Math.max(4, Math.min(36, Math.floor(maxSize / Math.max(asset.width, asset.height))));

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
    const width = asset.width * cellSize;
    const height = asset.height * cellSize;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#0f172a";
    context.fillRect(0, 0, width, height);
    asset.cells.forEach((cell, index) => {
      const x = index % asset.width;
      const y = Math.floor(index / asset.width);
      drawTerrainCell(context, cell, tilesets, images.current, x * cellSize, y * cellSize, cellSize);
      if (asset.cellMetadata[index]?.blocking) {
        context.fillStyle = "rgba(225, 29, 72, 0.16)";
        context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    });

    for (const zone of layout?.zones ?? []) {
      const color = zoneColor(zone.kind);
      const active = zone.slug === activeZoneSlug;
      for (const index of zone.cells) {
        if (index >= asset.width * asset.height) continue;
        const x = index % asset.width;
        const y = Math.floor(index / asset.width);
        context.fillStyle = color.fill;
        context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        context.strokeStyle = active ? "#ffffff" : color.stroke;
        context.lineWidth = active ? 2 : 1;
        context.strokeRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
      }
    }

    for (const placement of layout?.placements ?? []) {
      context.fillStyle = placement.mode === "FIXED" ? "rgba(34, 197, 94, 0.24)" : "rgba(168, 85, 247, 0.24)";
      context.fillRect(placement.x * cellSize, placement.y * cellSize, placement.width * cellSize, placement.height * cellSize);
      context.strokeStyle = placement.mode === "FIXED" ? "#4ade80" : "#c084fc";
      context.lineWidth = 3;
      context.strokeRect(
        placement.x * cellSize + 1.5,
        placement.y * cellSize + 1.5,
        placement.width * cellSize - 3,
        placement.height * cellSize - 3
      );
      drawLabel(context, placement.mode === "FIXED" ? "F" : "R", placement.x * cellSize + 3, placement.y * cellSize + 3);
    }

    for (const marker of layout?.markers ?? []) {
      const centerX = marker.x * cellSize + cellSize / 2;
      const centerY = marker.y * cellSize + cellSize / 2;
      if (marker.radius > 0) {
        context.fillStyle = "rgba(34, 211, 238, 0.1)";
        context.strokeStyle = "rgba(34, 211, 238, 0.5)";
        context.lineWidth = 1;
        context.beginPath();
        context.arc(centerX, centerY, marker.radius * cellSize, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }
      context.fillStyle = "rgba(8, 47, 73, 0.92)";
      context.strokeStyle = "#22d3ee";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(centerX, centerY, Math.max(5, cellSize * 0.28), 0, Math.PI * 2);
      context.fill();
      context.stroke();
      if (cellSize >= 14) {
        context.fillStyle = "#cffafe";
        context.font = `700 ${Math.max(8, Math.floor(cellSize * 0.34))}px sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(marker.kind.slice(0, 1), centerX, centerY);
      }
    }

    context.strokeStyle = "rgba(255,255,255,0.13)";
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x <= asset.width; x += 1) {
      context.moveTo(x * cellSize, 0);
      context.lineTo(x * cellSize, height);
    }
    for (let y = 0; y <= asset.height; y += 1) {
      context.moveTo(0, y * cellSize);
      context.lineTo(width, y * cellSize);
    }
    context.stroke();

    if (selectedIndex !== undefined) {
      const x = selectedIndex % asset.width;
      const y = Math.floor(selectedIndex / asset.width);
      context.strokeStyle = "#ffffff";
      context.lineWidth = 3;
      context.strokeRect(x * cellSize + 1.5, y * cellSize + 1.5, cellSize - 3, cellSize - 3);
    }
  }, [activeZoneSlug, asset, cellSize, imageRevision, layout, selectedIndex, tilesets]);

  function cellAt(event: ReactPointerEvent<HTMLCanvasElement>): number {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * asset.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * asset.height);
    return x >= 0 && x < asset.width && y >= 0 && y < asset.height ? y * asset.width + x : -1;
  }

  function applyPointer(event: ReactPointerEvent<HTMLCanvasElement>, erase: boolean): void {
    const index = cellAt(event);
    if (index < 0 || index === lastIndex.current) return;
    lastIndex.current = index;
    onPaintCell?.(index, erase);
    onSelectCell?.(index);
  }

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const erase = event.button === 2 || event.ctrlKey;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerState.current = { erase, pointerId: event.pointerId };
    lastIndex.current = -1;
    applyPointer(event, erase);
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const state = pointerState.current;
    if (!state || state.pointerId !== event.pointerId || !onPaintCell) return;
    applyPointer(event, state.erase);
  }

  function pointerUp(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (pointerState.current?.pointerId === event.pointerId) pointerState.current = undefined;
    lastIndex.current = -1;
  }

  return (
    <canvas
      aria-label={`${asset.slug} approved map preview`}
      className="mx-auto block max-w-full touch-none [image-rendering:pixelated] data-[paintable=true]:cursor-crosshair"
      data-paintable={Boolean(onPaintCell)}
      onContextMenu={(event) => event.preventDefault()}
      onPointerCancel={pointerUp}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      ref={canvasRef}
    />
  );
};

function zoneColor(kind: TerrainSpatialLayout["zones"][number]["kind"]): { fill: string; stroke: string } {
  if (kind === "EXCLUSION") return { fill: "rgba(239, 68, 68, 0.32)", stroke: "#f87171" };
  if (kind === "RESERVED") return { fill: "rgba(245, 158, 11, 0.3)", stroke: "#fbbf24" };
  return { fill: "rgba(59, 130, 246, 0.28)", stroke: "#60a5fa" };
}

function drawLabel(context: CanvasRenderingContext2D, label: string, x: number, y: number): void {
  context.fillStyle = "rgba(15, 23, 42, 0.92)";
  context.fillRect(x, y, 14, 14);
  context.fillStyle = "#ffffff";
  context.font = "700 10px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, x + 7, y + 7);
}
