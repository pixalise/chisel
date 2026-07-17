import { type FC, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import useAppStore from "@/stores/app-store";
import { AssetTypeEnum, type Asset, type TerrainTexturePreviewResult } from "../../../../shared/types";

export interface TerrainVariantTexturePreviewProps {
  asset: Asset | undefined;
}

const TerrainVariantTexturePreview: FC<TerrainVariantTexturePreviewProps> = (props) => {
  const { asset } = props;
  const project = useAppStore((state) => state._project);
  const [preview, setPreview] = useState<TerrainTexturePreviewResult | null>(null);
  const [error, setError] = useState("");

  let previewPath = "";
  if (asset) {
    previewPath = asset.relativePath;
    if (!asset.relativePath.startsWith("/") && project) {
      previewPath = `${project.path}/${asset.relativePath}`;
    }
  }

  useEffect(() => {
    if (!asset || asset.type !== AssetTypeEnum.terrainTexture || !previewPath) {
      setPreview(null);
      setError("");
      return;
    }

    let cancelled = false;
    setPreview(null);
    setError("");
    window.electron
      .createTerrainTexturePreview(previewPath)
      .then((result) => {
        if (!cancelled) {
          setPreview(result);
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Failed to preview terrain texture.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [asset, previewPath]);

  if (!asset) {
    return (
      <div className="grid min-h-28 place-items-center border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        No Terrain Texture selected.
      </div>
    );
  }

  return (
    <div className="space-y-2 border border-border bg-muted/20 p-2">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{asset.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{asset.relativePath}</p>
        </div>
        <Badge variant="secondary">{asset.width > 0 ? `${asset.width}x${asset.height}` : "GTTP"}</Badge>
      </div>

      {error && <div className="grid min-h-20 place-items-center bg-background p-2 text-xs text-destructive">{error}</div>}

      {!error && !preview && (
        <div className="grid min-h-20 place-items-center bg-background p-2 text-xs text-muted-foreground">Loading preview...</div>
      )}

      {!error && preview && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">Base RGB + Height A</p>
            <div className="grid h-24 place-items-center overflow-hidden bg-background">
              <img alt={`${asset.name} base texture`} className="h-full w-full object-contain" src={preview.baseDataUrl} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">Normal / AO / Roughness</p>
            <div className="grid h-24 place-items-center overflow-hidden bg-background">
              <img alt={`${asset.name} surface texture`} className="h-full w-full object-contain" src={preview.surfaceDataUrl} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TerrainVariantTexturePreview;
