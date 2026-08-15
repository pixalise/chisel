import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { type FC } from "react";
import type { TerrainApprovedAsset } from "../../../../shared/terrain-authoring";

interface TerrainApprovedLibraryProps {
  assets: TerrainApprovedAsset[];
  onDelete: (slug: string) => Promise<void>;
}

export const TerrainApprovedLibrary: FC<TerrainApprovedLibraryProps> = (props) => {
  const { assets, onDelete } = props;
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Approved geography library</h3>
          <p className="text-xs text-muted-foreground">Frozen maps and submodules remain unchanged when their source grammar is edited.</p>
        </div>
        <Badge variant="secondary">{assets.length}</Badge>
      </div>
      {assets.length === 0 && (
        <p className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">
          No approved geography yet. Select a valid candidate on the Generate page and freeze it here as a map or submodule.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {assets.map((asset) => (
          <div className="flex items-center justify-between gap-3 rounded border border-border p-3" key={asset.slug}>
            <div>
              <p className="text-sm font-medium">{asset.slug}</p>
              <p className="text-xs text-muted-foreground">
                {asset.kind} · {asset.width}×{asset.height} · seed {asset.seed} · {asset.sourceTemplate}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {asset.metrics.distinctPieces} piece types · {asset.metrics.walkableComponents} walkable components
              </p>
            </div>
            <Button aria-label={`Delete ${asset.slug}`} onClick={() => void onDelete(asset.slug)} size="icon" type="button" variant="ghost">
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
