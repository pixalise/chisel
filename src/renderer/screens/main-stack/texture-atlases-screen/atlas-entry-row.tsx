import type { FC } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Asset, TextureAtlasEntry, TextureAtlasResizeMode, TextureAtlasTintMode } from "../../../../shared/schemas";

interface AtlasEntryRowProps {
  asset: Asset | undefined;
  disabled: boolean;
  entry: TextureAtlasEntry;
  onChange: (entry: TextureAtlasEntry) => void;
  onRemove: () => void;
}

function nullableInteger(value: string): number | null {
  return value.trim() === "" ? null : Number.parseInt(value, 10);
}

export const AtlasEntryRow: FC<AtlasEntryRowProps> = (props) => {
  const { asset, disabled, entry, onChange, onRemove } = props;
  const requiresBounds = entry.resizeMode === "contain" || entry.resizeMode === "cover" || entry.resizeMode === "stretch";

  return (
    <div className="grid gap-3 rounded-md border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{asset?.name ?? entry.assetId}</p>
          <p className="text-xs text-muted-foreground">
            {asset ? `${asset.width} x ${asset.height} .${asset.extension}` : "Missing managed asset"}
          </p>
        </div>
        <Button disabled={disabled} onClick={onRemove} size="icon" type="button" variant="ghost">
          <Trash2 />
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3 max-[1080px]:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium">
          Resize mode
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            disabled={disabled}
            onChange={(event) => onChange({ ...entry, resizeMode: event.target.value as TextureAtlasResizeMode })}
            value={entry.resizeMode}
          >
            <option value="native">Native</option>
            <option value="scale">Scale</option>
            <option value="contain">Contain</option>
            <option value="cover">Cover</option>
            <option value="stretch">Stretch</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium">
          Width
          <Input
            disabled={disabled || !requiresBounds}
            min={1}
            onChange={(event) => onChange({ ...entry, outputWidth: nullableInteger(event.target.value) })}
            type="number"
            value={entry.outputWidth ?? ""}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium">
          Height
          <Input
            disabled={disabled || !requiresBounds}
            min={1}
            onChange={(event) => onChange({ ...entry, outputHeight: nullableInteger(event.target.value) })}
            type="number"
            value={entry.outputHeight ?? ""}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium">
          Scale
          <Input
            disabled={disabled || entry.resizeMode !== "scale"}
            max={16}
            min={0.01}
            onChange={(event) => onChange({ ...entry, scale: Number(event.target.value) })}
            step={0.01}
            type="number"
            value={entry.scale}
          />
        </label>
      </div>

      <div className="grid grid-cols-5 gap-3 max-[1080px]:grid-cols-2">
        <label className="flex items-center gap-2 text-xs font-medium">
          <input
            checked={entry.trim}
            disabled={disabled}
            onChange={(event) => onChange({ ...entry, trim: event.target.checked })}
            type="checkbox"
          />
          Trim transparent pixels
        </label>
        <label className="grid gap-1 text-xs font-medium">
          Tint mode
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            disabled={disabled}
            onChange={(event) => onChange({ ...entry, tintMode: event.target.value as TextureAtlasTintMode })}
            value={entry.tintMode}
          >
            <option value="none">None</option>
            <option value="runtime">Runtime metadata</option>
            <option value="baked">Bake into pixels</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium">
          Tint
          <Input
            disabled={disabled || entry.tintMode === "none"}
            maxLength={9}
            onChange={(event) => onChange({ ...entry, tint: event.target.value })}
            value={entry.tint}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium">
          Pivot X
          <Input
            disabled={disabled}
            max={1}
            min={0}
            onChange={(event) => onChange({ ...entry, pivotX: Number(event.target.value) })}
            step={0.01}
            type="number"
            value={entry.pivotX}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium">
          Pivot Y
          <Input
            disabled={disabled}
            max={1}
            min={0}
            onChange={(event) => onChange({ ...entry, pivotY: Number(event.target.value) })}
            step={0.01}
            type="number"
            value={entry.pivotY}
          />
        </label>
      </div>
    </div>
  );
};
