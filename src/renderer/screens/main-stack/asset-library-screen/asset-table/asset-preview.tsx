import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ImagePreview from "@/components/image-preview";
import useAppStore from "@/stores/app-store";
import { type FC, useEffect, useState } from "react";
import { AssetTypeEnum, type Asset, type TerrainTexturePreviewResult } from "../../../../../shared/types";

export interface AssetPreviewProps {
  asset: Asset;
}

interface PreviewFactProps {
  label: string;
  value: string;
}

const imagePathPattern = /\.(?:avif|bmp|gif|jpe?g|png|tiff?|webp)$/i;

export const AssetPreview: FC<AssetPreviewProps> = (props) => {
  const { asset } = props;
  const project = useAppStore((state) => state._project);
  const isTerrainTexture = asset.type === AssetTypeEnum.terrainTexture;
  const [terrainPreview, setTerrainPreview] = useState<TerrainTexturePreviewResult | null>(null);
  const [terrainPreviewError, setTerrainPreviewError] = useState("");
  const canPreview =
    asset.type === AssetTypeEnum.terrain || asset.type === AssetTypeEnum.texture || imagePathPattern.test(asset.relativePath);
  const previewPath = asset.relativePath.startsWith("/") || !project ? asset.relativePath : `${project.path}/${asset.relativePath}`;

  useEffect(() => {
    if (!isTerrainTexture || !previewPath) {
      setTerrainPreview(null);
      setTerrainPreviewError("");
      return;
    }

    let cancelled = false;
    setTerrainPreview(null);
    setTerrainPreviewError("");
    window.electron
      .createTerrainTexturePreview(previewPath)
      .then((result) => {
        if (!cancelled) {
          setTerrainPreview(result);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setTerrainPreviewError(error instanceof Error ? error.message : "Failed to preview terrain texture.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isTerrainTexture, previewPath]);

  return (
    <div className="space-y-4">
      {isTerrainTexture ? (
        <TerrainTexturePreview preview={terrainPreview} error={terrainPreviewError} />
      ) : canPreview ? (
        <ImagePreview path={previewPath} />
      ) : (
        <div className="grid min-h-60 place-items-center overflow-hidden bg-muted text-sm text-muted-foreground">No preview</div>
      )}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <PreviewFact label="id" value={asset.id} />
        <div className="min-w-0 space-y-1">
          <dt className="font-mono text-xs text-muted-foreground">type</dt>
          <dd>
            <Badge variant="secondary">{asset.type}</Badge>
          </dd>
        </div>
        <PreviewFact label="size" value={asset.formattedBytes} />
        <PreviewFact label="dimensions" value={asset.width > 0 ? `${asset.width}x${asset.height}` : "-"} />
      </dl>
      <Separator />
      <code className="block truncate text-xs text-muted-foreground">{asset.relativePath}</code>
    </div>
  );
};

interface TerrainTexturePreviewProps {
  error: string;
  preview: TerrainTexturePreviewResult | null;
}

const TerrainTexturePreview: FC<TerrainTexturePreviewProps> = (props) => {
  const { error, preview } = props;

  if (error) {
    return <div className="grid min-h-60 place-items-center overflow-hidden bg-muted text-sm text-destructive">{error}</div>;
  }
  if (!preview) {
    return (
      <div className="grid min-h-60 place-items-center overflow-hidden bg-muted text-sm text-muted-foreground">
        Loading terrain texture...
      </div>
    );
  }

  return (
    <Tabs className="space-y-3" defaultValue="base">
      <TabsList>
        <TabsTrigger value="base">Albedo + Height</TabsTrigger>
        <TabsTrigger value="surface">Normal / AO / Roughness</TabsTrigger>
      </TabsList>
      <TabsContent className="data-[state=inactive]:hidden" forceMount value="base">
        <div className="grid min-h-60 place-items-center overflow-hidden bg-muted">
          <img alt="Terrain texture albedo and height" className="max-h-[28rem] object-contain" src={preview.baseDataUrl} />
        </div>
      </TabsContent>
      <TabsContent className="data-[state=inactive]:hidden" forceMount value="surface">
        <div className="grid min-h-60 place-items-center overflow-hidden bg-muted">
          <img alt="Terrain texture normal, AO, and roughness" className="max-h-[28rem] object-contain" src={preview.surfaceDataUrl} />
        </div>
      </TabsContent>
    </Tabs>
  );
};

const PreviewFact: FC<PreviewFactProps> = (props) => {
  const { label, value } = props;

  return (
    <div className="min-w-0 space-y-1">
      <dt className="font-mono text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
};
