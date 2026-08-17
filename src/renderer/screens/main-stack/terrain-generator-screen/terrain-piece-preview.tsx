import { type FC, useEffect, useRef, useState } from "react";
import type { TerrainPiece, TerrainTilesetView } from "../../../../shared/terrain-authoring";
import { drawTerrainCell, drawTerrainCollision } from "./terrain-rendering";

interface TerrainPiecePreviewProps {
  ariaLabel: string;
  piece?: TerrainPiece;
  showCollision?: boolean;
  size?: number;
  tilesets: TerrainTilesetView[];
}

export const TerrainPiecePreview: FC<TerrainPiecePreviewProps> = (props) => {
  const { ariaLabel, piece, showCollision = false, size = 112, tilesets } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const images = useRef(new Map<string, HTMLImageElement>());
  const [imageRevision, setImageRevision] = useState(0);

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
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#111827";
    context.fillRect(0, 0, size, size);
    if (!piece) {
      context.fillStyle = "#f87171";
      context.font = "600 11px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("MISSING", size / 2, size / 2);
      return;
    }
    const cellSize = Math.max(1, Math.floor((size - 16) / Math.max(piece.width, piece.height)));
    const drawnWidth = cellSize * piece.width;
    const drawnHeight = cellSize * piece.height;
    const offsetX = Math.floor((size - drawnWidth) / 2);
    const offsetY = Math.floor((size - drawnHeight) / 2);
    piece.cells.forEach((cell, index) => {
      const x = index % piece.width;
      const y = Math.floor(index / piece.width);
      const left = offsetX + x * cellSize;
      const top = offsetY + y * cellSize;
      context.fillStyle = (x + y) % 2 === 0 ? "#252a32" : "#1d222a";
      context.fillRect(left, top, cellSize, cellSize);
      drawTerrainCell(context, cell.tiles, tilesets, images.current, left, top, cellSize);
      if (showCollision) drawTerrainCollision(context, cell, left, top, cellSize, 0.32);
    });
    context.strokeStyle = "rgba(255,255,255,0.22)";
    context.lineWidth = 1;
    context.strokeRect(offsetX + 0.5, offsetY + 0.5, drawnWidth - 1, drawnHeight - 1);
  }, [imageRevision, piece, showCollision, size, tilesets]);

  return <canvas aria-label={ariaLabel} className="block max-w-full [image-rendering:pixelated]" ref={canvasRef} />;
};
