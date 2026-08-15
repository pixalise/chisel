import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { type FC, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import {
  appendTerrainPieceLayer,
  terrainDirections,
  terrainLayerCountMax,
  type TerrainDirection,
  type TerrainPiece,
  type TerrainPieceCell,
  type TerrainSocketDefinition,
  type TerrainTileRef,
  type TerrainTilesetView
} from "../../../../shared/terrain-authoring";
import { drawTerrainCell } from "./terrain-rendering";

interface TerrainPiecePainterProps {
  onChange: (piece: TerrainPiece) => void;
  piece?: TerrainPiece;
  selectedTile?: TerrainTileRef;
  sockets: TerrainSocketDefinition[];
  tilesets: TerrainTilesetView[];
}

interface PaintState {
  erase: boolean;
  pointerId: number;
}

const displayCellSize = 64;

export const TerrainPiecePainter: FC<TerrainPiecePainterProps> = (props) => {
  const { onChange, piece, selectedTile, sockets, tilesets } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef(new Map<string, HTMLImageElement>());
  const paintRef = useRef<PaintState>();
  const lastCellRef = useRef(-1);
  const [activeLayer, setActiveLayer] = useState(0);
  const [selectedCellIndex, setSelectedCellIndex] = useState(0);
  const [imageRevision, setImageRevision] = useState(0);

  useEffect(() => {
    setActiveLayer((current) => Math.min(current, (piece?.layerCount ?? 1) - 1));
    setSelectedCellIndex((current) => Math.min(current, (piece?.cells.length ?? 1) - 1));
  }, [piece?.cells.length, piece?.layerCount, piece?.slug]);

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
    if (!canvas || !piece) return;
    const ratio = window.devicePixelRatio || 1;
    const width = piece.width * displayCellSize;
    const height = piece.height * displayCellSize;
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
    piece.cells.forEach((cell, index) => {
      const x = index % piece.width;
      const y = Math.floor(index / piece.width);
      context.fillStyle = index === selectedCellIndex ? "#30302a" : (x + y) % 2 === 0 ? "#202020" : "#191919";
      context.fillRect(x * displayCellSize, y * displayCellSize, displayCellSize, displayCellSize);
      drawTerrainCell(context, cell.tiles, tilesets, imagesRef.current, x * displayCellSize, y * displayCellSize, displayCellSize);
    });
    context.strokeStyle = "rgba(255,255,255,0.18)";
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x <= piece.width; x += 1) {
      context.moveTo(x * displayCellSize, 0);
      context.lineTo(x * displayCellSize, height);
    }
    for (let y = 0; y <= piece.height; y += 1) {
      context.moveTo(0, y * displayCellSize);
      context.lineTo(width, y * displayCellSize);
    }
    context.stroke();
    context.lineWidth = 6;
    for (const direction of terrainDirections) {
      piece.sockets[direction].forEach((socketSlug, index) => {
        context.strokeStyle = sockets.find((socket) => socket.slug === socketSlug)?.color ?? "#ef4444";
        context.beginPath();
        if (direction === "north" || direction === "south") {
          const y = direction === "north" ? 3 : height - 3;
          context.moveTo(index * displayCellSize + 4, y);
          context.lineTo((index + 1) * displayCellSize - 4, y);
        } else {
          const x = direction === "west" ? 3 : width - 3;
          context.moveTo(x, index * displayCellSize + 4);
          context.lineTo(x, (index + 1) * displayCellSize - 4);
        }
        context.stroke();
      });
    }
  }, [imageRevision, piece, selectedCellIndex, sockets, tilesets]);

  function cellAt(event: ReactPointerEvent<HTMLCanvasElement>): number {
    if (!piece) return -1;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * piece.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * piece.height);
    if (x < 0 || x >= piece.width || y < 0 || y >= piece.height) return -1;
    return y * piece.width + x;
  }

  function paint(index: number, erase: boolean): void {
    if (!piece || index < 0 || index === lastCellRef.current || (!erase && !selectedTile)) return;
    lastCellRef.current = index;
    setSelectedCellIndex(index);
    const cells = piece.cells.map((cell) => ({ ...cell, tiles: [...cell.tiles] }));
    cells[index].tiles[activeLayer] = erase ? null : { ...selectedTile!, orientation: selectedTile!.orientation };
    onChange({ ...piece, cells });
  }

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (!piece) return;
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

  function updateCell(update: Partial<TerrainPieceCell>): void {
    if (!piece) return;
    onChange({
      ...piece,
      cells: piece.cells.map((cell, index) => (index === selectedCellIndex ? { ...cell, ...update } : cell))
    });
  }

  function updateSocket(direction: TerrainDirection, index: number, socket: string): void {
    if (!piece) return;
    const profile = [...piece.sockets[direction]];
    profile[index] = socket;
    onChange({ ...piece, sockets: { ...piece.sockets, [direction]: profile } });
  }

  const selectedCell = piece?.cells[selectedCellIndex];

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Piece painter</h3>
          <p className="text-xs text-muted-foreground">Paint render layers; the colored rim is the exact Wang socket profile.</p>
        </div>
        {piece && (
          <div className="flex items-center gap-2">
            <Label className="flex items-center gap-2 text-xs">
              Layer
              <select
                className="h-8 rounded-md border border-input bg-background px-2"
                onChange={(event) => setActiveLayer(Number(event.target.value))}
                value={activeLayer}
              >
                {Array.from({ length: piece.layerCount }, (_, layer) => (
                  <option key={layer} value={layer}>
                    {layer === 0 ? "Base" : `Overlay ${layer}`}
                  </option>
                ))}
              </select>
            </Label>
            <Button
              disabled={piece.layerCount >= terrainLayerCountMax}
              onClick={() => {
                const layered = appendTerrainPieceLayer(piece);
                setActiveLayer(layered.layerCount - 1);
                onChange(layered);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <Plus className="size-4" /> Layer
            </Button>
          </div>
        )}
      </div>
      {!piece && <p className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">Create or select a piece.</p>}
      {piece && (
        <>
          <div className="overflow-auto rounded-md bg-black p-4">
            <canvas
              className="mx-auto block cursor-crosshair touch-none [image-rendering:pixelated]"
              onContextMenu={(event) => event.preventDefault()}
              onPointerCancel={pointerUp}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              ref={canvasRef}
            />
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {terrainDirections.map((direction) => (
              <div className="space-y-1 rounded border border-border p-2" key={direction}>
                <p className="text-xs font-semibold uppercase">{direction} sockets</p>
                <div className="flex flex-wrap gap-1">
                  {piece.sockets[direction].map((socket, index) => (
                    <select
                      className="h-8 min-w-28 rounded border border-input bg-background px-2 text-xs"
                      key={`${direction}-${index}`}
                      onChange={(event) => updateSocket(direction, index, event.target.value)}
                      style={{ borderColor: sockets.find((entry) => entry.slug === socket)?.color }}
                      value={socket}
                    >
                      <option value="">Missing…</option>
                      {sockets.map((entry) => (
                        <option key={entry.slug} value={entry.slug}>
                          {index + 1}: {entry.label}
                        </option>
                      ))}
                    </select>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {selectedCell && (
            <div className="grid gap-2 rounded border border-border p-2 sm:grid-cols-2 xl:grid-cols-4">
              <Label className="flex items-center gap-2 text-sm">
                <Checkbox checked={selectedCell.blocking} onCheckedChange={(checked) => updateCell({ blocking: checked === true })} />
                Blocks movement
              </Label>
              <Label className="space-y-1 text-xs">
                Elevation
                <Input
                  max={8}
                  min={-8}
                  onChange={(event) => updateCell({ elevation: Number(event.target.value) })}
                  type="number"
                  value={selectedCell.elevation}
                />
              </Label>
              <Label className="space-y-1 text-xs">
                Semantic flags
                <Input
                  onChange={(event) => updateCell({ semanticFlags: slugList(event.target.value) })}
                  value={selectedCell.semanticFlags.join(", ")}
                />
              </Label>
            </div>
          )}
        </>
      )}
    </div>
  );
};

function slugList(value: string): string[] {
  return value
    .split(",")
    .map((entry) =>
      entry
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
    )
    .filter(Boolean);
}
