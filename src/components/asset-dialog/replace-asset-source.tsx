import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AssetCategoryEnum } from "@/enums/asset-category-enum"
import { HookKeysEnum } from "@/enums/hook-keys-enum"
import { queryClient } from "@/query-client"
import assetService from "@/services/asset-service"
import { type Asset } from "@/shared/types"
import { RefreshCw } from "lucide-react"
import { type ChangeEvent, type FC, useState } from "react"
interface ReplaceAssetSourceProps {
  asset: Asset
  disabled: boolean
  onReplaced: () => void
}
function acceptedSourceTypes(category: AssetCategoryEnum): string | undefined {
  if (category === AssetCategoryEnum.AUDIO) {
    return "audio/*"
  }
  if (category === AssetCategoryEnum.FONT) {
    return ".otf,.ttf,.woff,.woff2"
  }
  if (category === AssetCategoryEnum.SHADER) {
    return ".glsl"
  }
  if (
    category === AssetCategoryEnum.IMAGE ||
    category === AssetCategoryEnum.UI ||
    category === AssetCategoryEnum.TILESET
  ) {
    return "image/*"
  }
  return undefined
}
export const ReplaceAssetSource: FC<ReplaceAssetSourceProps> = (props) => {
  const { asset, disabled, onReplaced } = props
  const [sourcePath, setSourcePath] = useState("")
  const [message, setMessage] = useState("")
  const [isReplacing, setIsReplacing] = useState(false)
  function chooseSource(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    setSourcePath(file ? window.electron.getPathForFile(file) : "")
    setMessage("")
  }
  async function replaceSource(): Promise<void> {
    if (!sourcePath) {
      setMessage("Choose a replacement source file.")
      return
    }
    setIsReplacing(true)
    setMessage("")
    try {
      await assetService.replaceAssetSource(asset.id, sourcePath)
      await Promise.all(
        [[HookKeysEnum.LIST_ASSETS_QUERY]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        )
      )
      onReplaced()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setIsReplacing(false)
    }
  }
  return (
    <section className="grid gap-3 rounded-md border border-border bg-card p-3">
      <div>
        <p className="text-sm font-semibold">Replace source file</p>
        <p className="text-xs text-muted-foreground">
          Keeps the stable asset slug and updates dimensions and file metadata.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          accept={acceptedSourceTypes(asset.category)}
          disabled={disabled || isReplacing}
          onChange={chooseSource}
          type="file"
        />
        <Button
          disabled={disabled || isReplacing || !sourcePath}
          onClick={replaceSource}
          type="button"
          variant="outline"
        >
          <RefreshCw />
          Replace
        </Button>
      </div>
      {message && <p className="text-xs text-destructive">{message}</p>}
    </section>
  )
}
