import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { type FC, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import type { TiledBoardView } from "../../../../shared/tiled-samples";

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TiledBoardCanvasProps {
  board: TiledBoardView;
  onCreateBounds: (bounds: Bounds) => void;
  onSelectSample: (sampleSlug: string) => void;
  selectedSampleSlug?: string;
}

interface Camera {
  x: number;
  y: number;
}

interface DragState {
  kind: "pan" | "sample";
  pointerX: number;
  pointerY: number;
  startCellX: number;
  startCellY: number;
  startCameraX: number;
  startCameraY: number;
}

const gidMask = 0x0fffffff;
const horizontalFlipFlag = 0x80000000;
const verticalFlipFlag = 0x40000000;
const diagonalFlipFlag = 0x20000000;

export const TiledBoardCanvas: FC<TiledBoardCanvasProps> = (props) => {
  const { board, onCreateBounds, onSelectSample, selectedSampleSlug } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef(new Map<string, HTMLImageElement>());
  const dragRef = useRef<DragState>();
  const [camera, setCamera] = useState<Camera>({ x: 24, y: 24 });
  const [draft, setDraft] = useState<Bounds>();
  const [visibleLayerIds, setVisibleLayerIds] = useState(
    () => new Set(board.layers.filter((layer) => layer.visible).map((layer) => layer.id))
  );
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 520 });
  const [imageRevision, setImageRevision] = useState(0);

  useEffect(() => {
    setVisibleLayerIds(new Set(board.layers.filter((layer) => layer.visible).map((layer) => layer.id)));
    setCamera({ x: 24, y: 24 });
    setDraft(undefined);
  }, [board.id, board.layers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      setCanvasSize({ width: Math.max(1, Math.floor(entry.contentRect.width)), height: Math.max(1, Math.floor(entry.contentRect.height)) });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    imagesRef.current.clear();
    let cancelled = false;
    for (const tileset of board.tilesets) {
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
  }, [board.tilesets]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvasSize.width * ratio);
    canvas.height = Math.floor(canvasSize.height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, canvasSize.width, canvasSize.height);
    context.fillStyle = "#151515";
    context.fillRect(0, 0, canvasSize.width, canvasSize.height);
    context.save();
    context.translate(camera.x, camera.y);
    context.imageSmoothingEnabled = false;

    const orderedTilesets = [...board.tilesets].sort((left, right) => left.firstGid - right.firstGid);
    for (const layer of board.layers) {
      if (!visibleLayerIds.has(layer.id)) continue;
      context.globalAlpha = layer.opacity;
      layer.data.forEach((encodedGid, cellIndex) => {
        const unsigned = encodedGid >>> 0;
        const gid = unsigned & gidMask;
        if (gid === 0) return;
        const tileset = [...orderedTilesets].reverse().find((entry) => entry.firstGid <= gid);
        if (!tileset) return;
        const image = imagesRef.current.get(tileset.id);
        if (!image?.complete || image.naturalWidth === 0 || image.naturalHeight === 0) return;
        const localId = gid - tileset.firstGid;
        const sourceX = tileset.margin + (localId % tileset.columns) * (tileset.tileWidth + tileset.spacing);
        const sourceY = tileset.margin + Math.floor(localId / tileset.columns) * (tileset.tileHeight + tileset.spacing);
        const destinationX = (cellIndex % board.width) * board.tileWidth;
        const destinationY = Math.floor(cellIndex / board.width) * board.tileHeight;
        const horizontal = (unsigned & horizontalFlipFlag) !== 0;
        const vertical = (unsigned & verticalFlipFlag) !== 0;
        const diagonal = (unsigned & diagonalFlipFlag) !== 0;
        context.save();
        context.translate(destinationX + board.tileWidth / 2, destinationY + board.tileHeight / 2);
        if (diagonal) {
          context.transform(0, 1, 1, 0, 0, 0);
        }
        context.scale(horizontal ? -1 : 1, vertical ? -1 : 1);
        context.drawImage(
          image,
          sourceX,
          sourceY,
          tileset.tileWidth,
          tileset.tileHeight,
          -board.tileWidth / 2,
          -board.tileHeight / 2,
          board.tileWidth,
          board.tileHeight
        );
        context.restore();
      });
    }

    context.globalAlpha = 1;
    context.strokeStyle = "rgba(255,255,255,0.16)";
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x <= board.width; x += 1) {
      context.moveTo(x * board.tileWidth, 0);
      context.lineTo(x * board.tileWidth, board.height * board.tileHeight);
    }
    for (let y = 0; y <= board.height; y += 1) {
      context.moveTo(0, y * board.tileHeight);
      context.lineTo(board.width * board.tileWidth, y * board.tileHeight);
    }
    context.stroke();

    for (const sample of board.enrichment.samples) {
      context.fillStyle = sample.slug === selectedSampleSlug ? "rgba(251,191,36,0.25)" : "rgba(59,130,246,0.18)";
      context.strokeStyle = sample.slug === selectedSampleSlug ? "#fbbf24" : "#60a5fa";
      context.lineWidth = 2;
      context.fillRect(
        sample.x * board.tileWidth,
        sample.y * board.tileHeight,
        sample.width * board.tileWidth,
        sample.height * board.tileHeight
      );
      context.strokeRect(
        sample.x * board.tileWidth,
        sample.y * board.tileHeight,
        sample.width * board.tileWidth,
        sample.height * board.tileHeight
      );
    }
    if (draft) {
      context.fillStyle = "rgba(16,185,129,0.2)";
      context.strokeStyle = "#34d399";
      context.lineWidth = 2;
      context.fillRect(
        draft.x * board.tileWidth,
        draft.y * board.tileHeight,
        draft.width * board.tileWidth,
        draft.height * board.tileHeight
      );
      context.strokeRect(
        draft.x * board.tileWidth,
        draft.y * board.tileHeight,
        draft.width * board.tileWidth,
        draft.height * board.tileHeight
      );
    }
    context.restore();
  }, [board, camera, canvasSize, draft, imageRevision, selectedSampleSlug, visibleLayerIds]);

  function cellAt(event: ReactPointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(board.width - 1, Math.floor((event.clientX - rect.left - camera.x) / board.tileWidth))),
      y: Math.max(0, Math.min(board.height - 1, Math.floor((event.clientY - rect.top - camera.y) / board.tileHeight)))
    };
  }

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const cell = cellAt(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.button === 1 || event.button === 2 || event.altKey) {
      dragRef.current = {
        kind: "pan",
        pointerX: event.clientX,
        pointerY: event.clientY,
        startCellX: cell.x,
        startCellY: cell.y,
        startCameraX: camera.x,
        startCameraY: camera.y
      };
      return;
    }
    const sample = [...board.enrichment.samples]
      .reverse()
      .find((entry) => cell.x >= entry.x && cell.x < entry.x + entry.width && cell.y >= entry.y && cell.y < entry.y + entry.height);
    if (sample) {
      onSelectSample(sample.slug);
      return;
    }
    dragRef.current = {
      kind: "sample",
      pointerX: event.clientX,
      pointerY: event.clientY,
      startCellX: cell.x,
      startCellY: cell.y,
      startCameraX: camera.x,
      startCameraY: camera.y
    };
    setDraft({ x: cell.x, y: cell.y, width: 1, height: 1 });
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "pan") {
      setCamera((value) => ({
        ...value,
        x: drag.startCameraX + event.clientX - drag.pointerX,
        y: drag.startCameraY + event.clientY - drag.pointerY
      }));
      return;
    }
    const cell = cellAt(event);
    setDraft({
      x: Math.min(cell.x, drag.startCellX),
      y: Math.min(cell.y, drag.startCellY),
      width: Math.abs(cell.x - drag.startCellX) + 1,
      height: Math.abs(cell.y - drag.startCellY) + 1
    });
  }

  function pointerUp(): void {
    if (dragRef.current?.kind === "sample" && draft) onCreateBounds(draft);
    dragRef.current = undefined;
    setDraft(undefined);
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          {board.layers.map((layer) => (
            <Label className="flex items-center gap-2 text-xs" key={layer.id}>
              <Checkbox
                checked={visibleLayerIds.has(layer.id)}
                onCheckedChange={(checked) =>
                  setVisibleLayerIds((current) => {
                    const next = new Set(current);
                    if (checked) next.add(layer.id);
                    else next.delete(layer.id);
                    return next;
                  })
                }
              />
              {layer.name}
            </Label>
          ))}
        </div>
      </div>
      <canvas
        className="h-[32rem] w-full cursor-crosshair rounded bg-black touch-none"
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        ref={canvasRef}
      />
      <p className="text-xs text-muted-foreground">
        Drag empty cells to create a grid-aligned sample. Click a sample to inspect it. Alt/right/middle drag pans.
      </p>
    </div>
  );
};
