import ImagePreview from "@/components/image-preview"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { AssetCategoryEnum } from "@/enums/asset-category-enum"
import { cn } from "@/lib/utils"
import { type Asset } from "@/shared/types"
import useAppStore from "@/stores/app-store"
import { type FC } from "react"
export interface AssetPreviewProps {
  asset: Asset
  className?: string
}
interface PreviewFactProps {
  label: string
  value: string
}
const previewablePathPattern = /\.(?:avif|bmp|gif|jpe?g|png|tiff?|webp)$/i
export const AssetPreview: FC<AssetPreviewProps> = (props) => {
  const { asset, className } = props
  const { _project: project } = useAppStore()
  const canPreview = previewablePathPattern.test(asset.relativePath)
  const canPlayAudio = asset.category === AssetCategoryEnum.AUDIO
  const previewPath =
    asset.relativePath.startsWith("/") || !project
      ? asset.relativePath
      : `${project.path}/${asset.relativePath}`
  return (
    <div className={cn("min-w-0 space-y-4", className)}>
      <div className="grid min-h-60 ">
        {canPreview && <ImagePreview path={previewPath} />}
        {canPlayAudio && (
          <audio
            className="w-full self-center"
            controls
            preload="metadata"
            src={window.electron.toAssetUrl(previewPath)}
          />
        )}
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
        <PreviewFact
          label="dimensions"
          value={asset.width > 0 ? `${asset.width}x${asset.height}` : "-"}
        />
        {asset.category === AssetCategoryEnum.TILESET && (
          <PreviewFact label="tile size" value={`${asset.tileSize}px`} />
        )}
      </dl>
      <Separator />
      <code className="block truncate text-xs text-muted-foreground">{asset.relativePath}</code>
    </div>
  )
}
const PreviewFact: FC<PreviewFactProps> = (props) => {
  const { label, value } = props
  return (
    <div className="min-w-0 space-y-1">
      <dt className="font-mono text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  )
}
