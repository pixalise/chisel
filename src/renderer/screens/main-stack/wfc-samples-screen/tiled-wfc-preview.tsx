import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dices, Play } from "lucide-react";
import { type FC, useEffect, useRef, useState } from "react";
import type { TiledBoardView } from "../../../../shared/tiled-samples";
import {
  compileTiledWfcLibrary,
  generateTiledWfcOutput,
  type TiledWfcLibrary,
  type TiledWfcOutput,
  tiledWfcPatternSize
} from "../../../../shared/tiled-wfc";

interface TiledWfcPreviewProps {
  board: TiledBoardView;
}

const gidMask = 0x0fffffff;
const horizontalFlipFlag = 0x80000000;
const verticalFlipFlag = 0x40000000;
const diagonalFlipFlag = 0x20000000;

export const TiledWfcPreview: FC<TiledWfcPreviewProps> = (props) => {
  const { board } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef(new Map<string, HTMLImageElement>());
  const [width, setWidth] = useState(20);
  const [height, setHeight] = useState(20);
  const [seed, setSeed] = useState(1);
  const [library, setLibrary] = useState<TiledWfcLibrary>();
  const [output, setOutput] = useState<TiledWfcOutput>();
  const [error, setError] = useState("");
  const [imageRevision, setImageRevision] = useState(0);

  useEffect(() => {
    setLibrary(undefined);
    setOutput(undefined);
    setError("");
  }, [board.enrichment.samples, board.layers]);

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
    if (!canvas || !output) return;
    canvas.width = output.width * board.tileWidth;
    canvas.height = output.height * board.tileHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#164e63";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const orderedTilesets = [...board.tilesets].sort((left, right) => left.firstGid - right.firstGid);
    for (const layer of output.layers) {
      context.globalAlpha = board.layers.find((entry) => entry.id === layer.id)?.opacity ?? 1;
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
        const destinationX = (cellIndex % output.width) * board.tileWidth;
        const destinationY = Math.floor(cellIndex / output.width) * board.tileHeight;
        context.save();
        context.translate(destinationX + board.tileWidth / 2, destinationY + board.tileHeight / 2);
        if ((unsigned & diagonalFlipFlag) !== 0) context.transform(0, 1, 1, 0, 0, 0);
        context.scale((unsigned & horizontalFlipFlag) !== 0 ? -1 : 1, (unsigned & verticalFlipFlag) !== 0 ? -1 : 1);
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
  }, [board.layers, board.tileHeight, board.tileWidth, board.tilesets, imageRevision, output]);

  function generate(nextSeed: number): void {
    setError("");
    setOutput(undefined);
    let compiled: TiledWfcLibrary | undefined;
    try {
      if (width < tiledWfcPatternSize || width > 64 || height < tiledWfcPatternSize || height > 64) {
        throw new Error(`Preview dimensions must be between ${tiledWfcPatternSize} and 64 cells`);
      }
      compiled = compileTiledWfcLibrary(board);
      setLibrary(compiled);
      const generated = generateTiledWfcOutput(compiled, { width, height, seed: nextSeed });
      setOutput(generated);
      setSeed(nextSeed);
    } catch (caught) {
      if (!compiled) setLibrary(undefined);
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  const missingAdjacency = library
    ? (["north", "east", "south", "west"] as const).map((direction) => ({
        direction,
        count: library.patterns.filter((pattern) => library.adjacency[direction][pattern.id].length === 0).length
      }))
    : [];

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">WFC preview</h3>
          <p className="text-xs text-muted-foreground">
            Compile every authored sample into overlapping {tiledWfcPatternSize}×{tiledWfcPatternSize} patterns and test their adjacency.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-20 space-y-1">
            <Label className="text-xs" htmlFor="wfc-preview-width">
              Width
            </Label>
            <Input
              id="wfc-preview-width"
              max="64"
              min={tiledWfcPatternSize}
              onChange={(event) => setWidth(Number(event.target.value))}
              type="number"
              value={width}
            />
          </div>
          <div className="w-20 space-y-1">
            <Label className="text-xs" htmlFor="wfc-preview-height">
              Height
            </Label>
            <Input
              id="wfc-preview-height"
              max="64"
              min={tiledWfcPatternSize}
              onChange={(event) => setHeight(Number(event.target.value))}
              type="number"
              value={height}
            />
          </div>
          <div className="w-28 space-y-1">
            <Label className="text-xs" htmlFor="wfc-preview-seed">
              Seed
            </Label>
            <Input
              id="wfc-preview-seed"
              min="0"
              onChange={(event) => setSeed(Number(event.target.value) >>> 0)}
              type="number"
              value={seed}
            />
          </div>
          <Button disabled={board.enrichment.samples.length === 0} onClick={() => generate(seed)} type="button">
            <Play className="size-4" />
            Generate
          </Button>
          <Button
            disabled={board.enrichment.samples.length === 0}
            onClick={() => generate((seed + 1) >>> 0)}
            type="button"
            variant="outline"
          >
            <Dices className="size-4" />
            Next seed
          </Button>
        </div>
      </div>
      {board.enrichment.samples.length === 0 && (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Draw at least one sample of 3×3 cells or larger to enable the compiler.
        </p>
      )}
      {error && <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
      {library && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{library.patterns.length} unique patterns</span>
          <span>{library.sampleSlugs.length} samples</span>
          {output && <span>{output.attempts} generation attempts</span>}
          {missingAdjacency.map((entry) => (
            <span className={entry.count > 0 ? "text-amber-500" : undefined} key={entry.direction}>
              {entry.direction[0].toUpperCase()}: {entry.count} dead ends
            </span>
          ))}
        </div>
      )}
      {output && (
        <>
          <div className="overflow-auto rounded-md border border-border bg-slate-950 p-2">
            <canvas className="h-auto max-h-[40rem] max-w-full [image-rendering:pixelated]" ref={canvasRef} />
          </div>
        </>
      )}
    </div>
  );
};
