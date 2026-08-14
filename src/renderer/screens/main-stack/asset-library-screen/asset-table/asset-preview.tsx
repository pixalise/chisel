import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import ImagePreview from "@/components/image-preview";
import useAppStore from "@/stores/app-store";
import { type FC } from "react";
import { AssetCategoryEnum, type Asset } from "../../../../../shared/types";
import { cn } from "@/lib/utils";

export interface AssetPreviewProps {
  asset: Asset;
  className?: string;
}

interface PreviewFactProps {
  label: string;
  value: string;
}

const previewablePathPattern = /\.(?:avif|bmp|gif|jpe?g|png|tiff?|webp)$/i;

export const AssetPreview: FC<AssetPreviewProps> = (props) => {
  const { asset, className } = props;
  const project = useAppStore((state) => state._project);
  const canPreview = previewablePathPattern.test(asset.relativePath);
  const canPlayAudio = asset.category === AssetCategoryEnum.audio;
  const previewPath = asset.relativePath.startsWith("/") || !project ? asset.relativePath : `${project.path}/${asset.relativePath}`;

  return (
    <div className={cn("min-w-0 space-y-4", className)}>
      <div className="grid min-h-60 ">
        {canPreview && <ImagePreview path={previewPath} />}
        {canPlayAudio && <audio className="w-full self-center" controls preload="metadata" src={window.electron.toAssetUrl(previewPath)} />}
        {!canPreview && !canPlayAudio && <p>No preview</p>}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <PreviewFact label="id" value={asset.id} />
        <div className="min-w-0 space-y-1">
          <dt className="font-mono text-xs text-muted-foreground">category</dt>
          <dd>
            <Badge variant="secondary">{asset.category}</Badge>
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

const PreviewFact: FC<PreviewFactProps> = (props) => {
  const { label, value } = props;

  return (
    <div className="min-w-0 space-y-1">
      <dt className="font-mono text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
};
