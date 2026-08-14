import { type FC, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import type { TerrainSample, TerrainTileRef, TerrainTilesetView } from "../../../../shared/terrain-authoring";
import { drawTerrainTile } from "./terrain-rendering";

interface TerrainSamplePainterProps {
  onChange: (sample: TerrainSample) => void;
  sample?: TerrainSample;
  selectedTile?: TerrainTileRef;
  tilesets: TerrainTilesetView[];
}

interface PaintState {
  erase: boolean;
  pointerId: number;
}

const displayCellSize = 96;

export const TerrainSamplePainter: FC<TerrainSamplePainterProps> = (props) => {
  const { onChange, sample, selectedTile, tilesets } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef(new Map<string, HTMLImageElement>());
  const paintRef = useRef<PaintState>();
  const lastCellRef = useRef(-1);
  const [imageRevision, setImageRevision] = useState(0);

  useEffect(() => {
    imagesRef.current.clear();
    let cancelled = false;
    for (const tileset of tilesets) {
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
  }, [tilesets]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sample) return;
    const ratio = window.devicePixelRatio || 1;
    const width = sample.width * displayCellSize;
    const height = sample.height * displayCellSize;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#151515";
    context.fillRect(0, 0, width, height);
    sample.cells.forEach((tile, index) => {
      const x = index % sample.width;
      const y = Math.floor(index / sample.width);
      context.fillStyle = (x + y) % 2 === 0 ? "#202020" : "#191919";
      context.fillRect(x * displayCellSize, y * displayCellSize, displayCellSize, displayCellSize);
      if (tile) drawTerrainTile(context, tile, tilesets, imagesRef.current, x * displayCellSize, y * displayCellSize, displayCellSize);
    });
    context.strokeStyle = "rgba(255,255,255,0.2)";
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x <= sample.width; x += 1) {
      context.moveTo(x * displayCellSize, 0);
      context.lineTo(x * displayCellSize, height);
    }
    for (let y = 0; y <= sample.height; y += 1) {
      context.moveTo(0, y * displayCellSize);
      context.lineTo(width, y * displayCellSize);
    }
    context.stroke();
  }, [imageRevision, sample, tilesets]);

  function cellAt(event: ReactPointerEvent<HTMLCanvasElement>): number {
    if (!sample) return -1;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * sample.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * sample.height);
    if (x < 0 || x >= sample.width || y < 0 || y >= sample.height) return -1;
    return y * sample.width + x;
  }

  function paint(index: number, erase: boolean): void {
    if (!sample || index < 0 || index === lastCellRef.current || (!erase && !selectedTile)) return;
    lastCellRef.current = index;
    const cells = [...sample.cells];
    cells[index] = erase ? null : { ...selectedTile!, orientation: 0 };
    onChange({ ...sample, cells });
  }

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (!sample) return;
    const erase = event.button === 2 || event.ctrlKey;
    event.currentTarget.setPointerCapture(event.pointerId);
    paintRef.current = { erase, pointerId: event.pointerId };
    lastCellRef.current = -1;
    paint(cellAt(event), erase);
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const state = paintRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    paint(cellAt(event), state.erase);
  }

  function pointerUp(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (paintRef.current?.pointerId === event.pointerId) paintRef.current = undefined;
    lastCellRef.current = -1;
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div>
        <h3 className="text-sm font-semibold">Sample painter</h3>
        <p className="text-xs text-muted-foreground">
          Left-click or drag to paint the selected palette tile. Ctrl+left-click, right-click, or drag erases cells.
        </p>
      </div>
      {!sample && (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Choose a sample to begin painting.
        </div>
      )}
      {sample && (
        <div className="overflow-auto rounded-md bg-black p-3">
          <canvas
            className="mx-auto block cursor-crosshair touch-none [image-rendering:pixelated]"
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerCancel={pointerUp}
            onPointerUp={pointerUp}
            ref={canvasRef}
          />
        </div>
      )}
    </div>
  );
};
