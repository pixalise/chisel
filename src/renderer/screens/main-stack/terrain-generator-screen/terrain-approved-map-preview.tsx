import { type FC, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import type {
  TerrainAnnotationDefinition,
  TerrainApprovedAsset,
  TerrainSpatialLayout,
  TerrainTilesetView
} from "../../../../shared/terrain-authoring";
import { resolveApprovedTerrainCell } from "../../../../shared/terrain-approved-overpaint";
import { drawTerrainCell, drawTerrainCollision } from "./terrain-rendering";

interface TerrainApprovedMapPreviewProps {
  annotations?: TerrainAnnotationDefinition[];
  asset: TerrainApprovedAsset;
  layout?: TerrainSpatialLayout;
  maxSize?: number;
  onPaintCell?: (index: number, erase: boolean, collisionX: number, collisionY: number) => void;
  onSelectCell?: (index: number) => void;
  paintResolution?: number;
  selectedIndex?: number;
  showOverrideMarkers?: boolean;
  tilesets: TerrainTilesetView[];
}

interface PointerState {
  erase: boolean;
  pointerId: number;
}

interface PaintTarget {
  collisionX: number;
  collisionY: number;
  index: number;
  key: string;
}

export const TerrainApprovedMapPreview: FC<TerrainApprovedMapPreviewProps> = (props) => {
  const {
    annotations = [],
    asset,
    layout,
    maxSize = 560,
    onPaintCell,
    onSelectCell,
    paintResolution = 1,
    selectedIndex,
    showOverrideMarkers,
    tilesets
  } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const images = useRef(new Map<string, HTMLImageElement>());
  const pointerState = useRef<PointerState>();
  const lastTarget = useRef("");
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
    asset.cells.forEach((_, index) => {
      const x = index % asset.width;
      const y = Math.floor(index / asset.width);
      const cell = resolveApprovedTerrainCell(asset, index);
      drawTerrainCell(context, cell.tiles, tilesets, images.current, x * cellSize, y * cellSize, cellSize);
      drawTerrainCollision(context, cell.metadata, x * cellSize, y * cellSize, cellSize, 0.24);
    });

    if (onPaintCell && paintResolution > 1) {
      const subcellSize = cellSize / paintResolution;
      context.strokeStyle = "rgba(255,255,255,0.1)";
      context.lineWidth = 1;
      context.beginPath();
      for (let x = 0; x < asset.width; x += 1) {
        for (let y = 0; y < asset.height; y += 1) {
          for (let subcell = 1; subcell < paintResolution; subcell += 1) {
            context.moveTo(x * cellSize + subcell * subcellSize, y * cellSize);
            context.lineTo(x * cellSize + subcell * subcellSize, (y + 1) * cellSize);
            context.moveTo(x * cellSize, y * cellSize + subcell * subcellSize);
            context.lineTo((x + 1) * cellSize, y * cellSize + subcell * subcellSize);
          }
        }
      }
      context.stroke();
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

    if (showOverrideMarkers) {
      context.fillStyle = "#22d3ee";
      for (const override of asset.cellOverrides) {
        const x = override.index % asset.width;
        const y = Math.floor(override.index / asset.width);
        const markerSize = Math.max(3, Math.floor(cellSize * 0.22));
        context.beginPath();
        context.moveTo(x * cellSize, y * cellSize);
        context.lineTo(x * cellSize + markerSize, y * cellSize);
        context.lineTo(x * cellSize, y * cellSize + markerSize);
        context.closePath();
        context.fill();
      }
    }

    const annotationColors = new Map(annotations.map((annotation) => [annotation.slug, annotation.color]));
    for (const taggedCell of layout?.cells ?? []) {
      if (taggedCell.index >= asset.width * asset.height) continue;
      const x = taggedCell.index % asset.width;
      const y = Math.floor(taggedCell.index / asset.width);
      const colors = taggedCell.annotations.map((slug) => annotationColors.get(slug)).filter((color): color is string => Boolean(color));
      if (colors.length === 0) continue;
      context.save();
      context.globalAlpha = 0.24;
      context.fillStyle = colors[0];
      context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      context.restore();
      const stripeWidth = cellSize / colors.length;
      colors.forEach((color, index) => {
        context.fillStyle = color;
        context.fillRect(
          x * cellSize + index * stripeWidth,
          (y + 1) * cellSize - Math.max(3, cellSize * 0.18),
          stripeWidth,
          Math.max(3, cellSize * 0.18)
        );
      });
    }

    if (selectedIndex !== undefined) {
      const x = selectedIndex % asset.width;
      const y = Math.floor(selectedIndex / asset.width);
      context.strokeStyle = "#ffffff";
      context.lineWidth = 3;
      context.strokeRect(x * cellSize + 1.5, y * cellSize + 1.5, cellSize - 3, cellSize - 3);
    }
  }, [annotations, asset, cellSize, imageRevision, layout, onPaintCell, paintResolution, selectedIndex, showOverrideMarkers, tilesets]);

  function targetAt(event: ReactPointerEvent<HTMLCanvasElement>): PaintTarget | undefined {
    const rect = event.currentTarget.getBoundingClientRect();
    const assetX = ((event.clientX - rect.left) / rect.width) * asset.width;
    const assetY = ((event.clientY - rect.top) / rect.height) * asset.height;
    const x = Math.floor(assetX);
    const y = Math.floor(assetY);
    if (x < 0 || x >= asset.width || y < 0 || y >= asset.height) return undefined;
    const collisionX = Math.min(paintResolution - 1, Math.floor((assetX - x) * paintResolution));
    const collisionY = Math.min(paintResolution - 1, Math.floor((assetY - y) * paintResolution));
    const index = y * asset.width + x;
    return { collisionX, collisionY, index, key: `${index}:${collisionX}:${collisionY}` };
  }

  function applyPointer(event: ReactPointerEvent<HTMLCanvasElement>, erase: boolean): void {
    const target = targetAt(event);
    if (!target || target.key === lastTarget.current) return;
    lastTarget.current = target.key;
    onPaintCell?.(target.index, erase, target.collisionX, target.collisionY);
    onSelectCell?.(target.index);
  }

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const erase = event.button === 2 || event.ctrlKey;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerState.current = { erase, pointerId: event.pointerId };
    lastTarget.current = "";
    applyPointer(event, erase);
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const state = pointerState.current;
    if (!state || state.pointerId !== event.pointerId || !onPaintCell) return;
    applyPointer(event, state.erase);
  }

  function pointerUp(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (pointerState.current?.pointerId === event.pointerId) pointerState.current = undefined;
    lastTarget.current = "";
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
