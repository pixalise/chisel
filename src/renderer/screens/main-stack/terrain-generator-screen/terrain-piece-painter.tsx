import { Badge } from "@/components/ui/badge";
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
  clear: boolean;
  mode: PieceBrushMode;
  pointerId: number;
}

type PieceBrushMode = "terrain" | "collision";

const displayCellSize = 64;

export const TerrainPiecePainter: FC<TerrainPiecePainterProps> = (props) => {
  const { onChange, piece, selectedTile, sockets, tilesets } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef(new Map<string, HTMLImageElement>());
  const paintRef = useRef<PaintState>();
  const lastCellRef = useRef(-1);
  const [activeLayer, setActiveLayer] = useState(0);
  const [brushMode, setBrushMode] = useState<PieceBrushMode>("terrain");
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
      if (cell.blocking) {
        context.fillStyle = brushMode === "collision" ? "rgba(225, 29, 72, 0.48)" : "rgba(225, 29, 72, 0.2)";
        context.fillRect(x * displayCellSize, y * displayCellSize, displayCellSize, displayCellSize);
        context.strokeStyle = "#fb7185";
        context.lineWidth = brushMode === "collision" ? 4 : 2;
        context.beginPath();
        context.moveTo(x * displayCellSize + 10, y * displayCellSize + 10);
        context.lineTo((x + 1) * displayCellSize - 10, (y + 1) * displayCellSize - 10);
        context.moveTo((x + 1) * displayCellSize - 10, y * displayCellSize + 10);
        context.lineTo(x * displayCellSize + 10, (y + 1) * displayCellSize - 10);
        context.stroke();
      }
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
  }, [brushMode, imageRevision, piece, selectedCellIndex, sockets, tilesets]);

  function cellAt(event: ReactPointerEvent<HTMLCanvasElement>): number {
    if (!piece) return -1;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * piece.width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * piece.height);
    if (x < 0 || x >= piece.width || y < 0 || y >= piece.height) return -1;
    return y * piece.width + x;
  }

  function paint(index: number, clear: boolean, mode: PieceBrushMode): void {
    if (!piece || index < 0 || index === lastCellRef.current || (mode === "terrain" && !clear && !selectedTile)) return;
    lastCellRef.current = index;
    setSelectedCellIndex(index);
    const cells = piece.cells.map((cell) => ({ ...cell, tiles: [...cell.tiles] }));
    if (mode === "terrain") {
      cells[index].tiles[activeLayer] = clear ? null : { ...selectedTile!, orientation: selectedTile!.orientation };
    } else {
      cells[index].blocking = !clear;
    }
    onChange({ ...piece, cells });
  }

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (!piece) return;
    const clear = event.button === 2 || event.ctrlKey;
    event.currentTarget.setPointerCapture(event.pointerId);
    paintRef.current = { clear, mode: brushMode, pointerId: event.pointerId };
    lastCellRef.current = -1;
    paint(cellAt(event), clear, brushMode);
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const state = paintRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    paint(cellAt(event), state.clear, state.mode);
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
  const selectedCellX = piece ? selectedCellIndex % piece.width : 0;
  const selectedCellY = piece ? Math.floor(selectedCellIndex / piece.width) : 0;
  const blockingCellCount = piece?.cells.filter((cell) => cell.blocking).length ?? 0;
  const logicalCellCount = piece?.cells.filter((cell) => cell.tiles[0] === null).length ?? 0;

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Piece painter</h3>
          <p className="text-xs text-muted-foreground">
            Paint terrain and its per-cell collision mask; the colored rim is the exact Wang socket profile.
          </p>
        </div>
        {piece && (
          <div className="flex items-center gap-2">
            <Label className="flex items-center gap-2 text-xs">
              Layer
              <select
                className="h-8 rounded-md border border-input bg-background px-2"
                disabled={brushMode === "collision"}
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
              disabled={brushMode === "collision" || piece.layerCount >= terrainLayerCountMax}
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold">Authoring mode</p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setBrushMode("terrain")}
                  size="sm"
                  type="button"
                  variant={brushMode === "terrain" ? "default" : "outline"}
                >
                  Paint terrain
                </Button>
                <Button
                  onClick={() => setBrushMode("collision")}
                  size="sm"
                  type="button"
                  variant={brushMode === "collision" ? "destructive" : "outline"}
                >
                  Paint collision
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant={logicalCellCount > 0 ? "secondary" : "outline"}>
                {logicalCellCount} logical-only {logicalCellCount === 1 ? "cell" : "cells"}
              </Badge>
              <Badge variant={blockingCellCount > 0 ? "destructive" : "outline"}>
                {blockingCellCount} of {piece.cells.length} cells blocking
              </Badge>
              {brushMode === "collision" && (
                <>
                  <Button
                    onClick={() => onChange({ ...piece, cells: piece.cells.map((cell) => ({ ...cell, blocking: true })) })}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Block all
                  </Button>
                  <Button
                    onClick={() => onChange({ ...piece, cells: piece.cells.map((cell) => ({ ...cell, blocking: false })) })}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Clear collision
                  </Button>
                </>
              )}
            </div>
            <p className="w-full text-[11px] text-muted-foreground">
              {brushMode === "terrain"
                ? "Left-drag paints the selected sprite. Right-drag or Ctrl-drag erases the active layer. An erased base remains a valid logical cell controlled by its flags, collision, and sockets."
                : "Left-drag marks piece cells as blocking. Right-drag or Ctrl-drag makes them walkable. Red X cells become collision areas in generated terrain."}
            </p>
          </div>
          <div className="overflow-auto rounded-md bg-black p-4">
            <canvas
              aria-label="Terrain piece painter"
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
                      {sockets.map((entry, socketIndex) => (
                        <option key={socketIndex} value={entry.slug}>
                          {index + 1}: {entry.slug}
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
              <div className="space-y-1">
                <p className="text-xs font-semibold">
                  Selected cell {selectedCellX},{selectedCellY}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant={selectedCell.blocking ? "destructive" : "outline"}>
                    {selectedCell.blocking ? "Blocking" : "Walkable"}
                  </Badge>
                  {selectedCell.tiles[0] === null && <Badge variant="secondary">Logical only</Badge>}
                </div>
              </div>
              <Label className="flex items-center gap-2 text-sm">
                <Checkbox checked={selectedCell.blocking} onCheckedChange={(checked) => updateCell({ blocking: checked === true })} />
                This cell blocks movement
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
