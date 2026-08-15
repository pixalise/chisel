import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Trash2 } from "lucide-react";
import { type FC, useState } from "react";
import {
  createTerrainPieceCell,
  type TerrainPiece,
  type TerrainPiecePass,
  type TerrainSocketDefinition
} from "../../../../shared/terrain-authoring";

interface TerrainPieceEditorProps {
  onAnalyze: () => void;
  onChange: (piece: TerrainPiece) => void;
  onCreate: (piece: TerrainPiece) => void;
  onDelete: () => void;
  onSelect: (slug?: string) => void;
  piece?: TerrainPiece;
  pieces: TerrainPiece[];
  sockets: TerrainSocketDefinition[];
}

export const TerrainPieceEditor: FC<TerrainPieceEditorProps> = (props) => {
  const { onAnalyze, onChange, onCreate, onDelete, onSelect, piece, pieces, sockets } = props;
  const [width, setWidth] = useState(1);
  const [height, setHeight] = useState(1);
  const [pass, setPass] = useState<TerrainPiecePass>("BASE");

  function createPiece(): void {
    let index = pieces.length + 1;
    while (pieces.some((entry) => entry.slug === `PIECE_${index}`)) index += 1;
    const socket = sockets.find((entry) => entry.passes.includes(pass))?.slug ?? "";
    onCreate({
      slug: `PIECE_${index}`,
      pass,
      width,
      height,
      layerCount: 1,
      cells: Array.from({ length: width * height }, () => createTerrainPieceCell(1, pass)),
      sockets: {
        north: Array(width).fill(socket),
        east: Array(height).fill(socket),
        south: Array(width).fill(socket),
        west: Array(height).fill(socket)
      },
      allowRotations: false,
      allowReflections: false,
      weight: 1,
      biomeTags: [],
      siteTags: [],
      semanticFlags: [],
      mutationFamily: ""
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_5rem_5rem_7rem_auto] sm:items-end">
        <Label className="space-y-1">
          Piece to edit
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) => onSelect(event.target.value || undefined)}
            value={piece?.slug ?? ""}
          >
            <option value="">Choose a piece…</option>
            {pieces.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {entry.slug} — {entry.pass} {entry.width}×{entry.height}
              </option>
            ))}
          </select>
        </Label>
        <Label className="space-y-1">
          Width
          <Input max={8} min={1} onChange={(event) => setWidth(Number(event.target.value))} type="number" value={width} />
        </Label>
        <Label className="space-y-1">
          Height
          <Input max={8} min={1} onChange={(event) => setHeight(Number(event.target.value))} type="number" value={height} />
        </Label>
        <Label className="space-y-1">
          Pass
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            onChange={(event) => setPass(event.target.value as TerrainPiecePass)}
            value={pass}
          >
            <option value="BASE">Base</option>
            <option value="CLIFF">Cliff</option>
          </select>
        </Label>
        <Button disabled={!sockets.some((entry) => entry.passes.includes(pass))} onClick={createPiece} type="button">
          Create piece
        </Button>
      </div>
      {piece && (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="grid gap-2 md:grid-cols-[minmax(10rem,1fr)_7rem_7rem_7rem_7rem_minmax(10rem,1fr)_auto_auto] md:items-end">
            <Label className="space-y-1">
              Stable slug
              <Input onChange={(event) => onChange({ ...piece, slug: normalizeSlug(event.target.value) })} value={piece.slug} />
            </Label>
            <Label className="space-y-1">
              Weight
              <Input
                min={0.001}
                onChange={(event) => onChange({ ...piece, weight: Number(event.target.value) })}
                step="0.1"
                type="number"
                value={piece.weight}
              />
            </Label>
            <Label className="flex h-9 items-center gap-2 text-xs">
              <Checkbox
                checked={piece.allowRotations}
                onCheckedChange={(checked) => onChange({ ...piece, allowRotations: checked === true })}
              />{" "}
              Rotations
            </Label>
            <Label className="flex h-9 items-center gap-2 text-xs">
              <Checkbox
                checked={piece.allowReflections}
                onCheckedChange={(checked) => onChange({ ...piece, allowReflections: checked === true })}
              />{" "}
              Reflections
            </Label>
            <Label className="space-y-1">
              Mutation
              <Input
                onChange={(event) => onChange({ ...piece, mutationFamily: normalizeSlug(event.target.value) })}
                value={piece.mutationFamily}
              />
            </Label>
            <Label className="space-y-1">
              Semantic flags
              <Input
                onChange={(event) => onChange({ ...piece, semanticFlags: slugList(event.target.value) })}
                value={piece.semanticFlags.join(", ")}
              />
            </Label>
            <Button
              aria-label="Inspect current piece compatibility"
              onClick={onAnalyze}
              size="icon"
              title="Inspect current unsaved piece compatibility"
              type="button"
              variant="outline"
            >
              <ShoppingCart className="size-4" />
            </Button>
            <Button aria-label={`Delete ${piece.slug}`} onClick={onDelete} size="icon" type="button" variant="destructive">
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Label className="space-y-1 text-xs">
              Biome tags
              <Input
                onChange={(event) => onChange({ ...piece, biomeTags: slugList(event.target.value) })}
                value={piece.biomeTags.join(", ")}
              />
            </Label>
            <Label className="space-y-1 text-xs">
              Site tags
              <Input
                onChange={(event) => onChange({ ...piece, siteTags: slugList(event.target.value) })}
                value={piece.siteTags.join(", ")}
              />
            </Label>
          </div>
        </div>
      )}
    </div>
  );
};

function normalizeSlug(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+/, "");
}

function slugList(value: string): string[] {
  return value.split(",").map(normalizeSlug).filter(Boolean);
}
