import { HookKeysEnum } from "@/enums/hook-keys-enum"
import assetService from "@/services/asset-service"
import type { Asset } from "@/shared/schemas"
import { useMutation } from "@tanstack/react-query"
export interface CopyAssetFileInput {
  asset: Asset
  sourcePath: string
}
export interface UseCopyAssetFile {
  importAsset: (input: CopyAssetFileInput) => Promise<void>
  isImportAssetLoading: boolean
}
const useCopyAssetFile = (): UseCopyAssetFile => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.IMPORT_ASSET_MUTATION],
    mutationFn: async (input: CopyAssetFileInput): Promise<void> => {
      const { sourcePath, asset } = input
      await assetService.copyAssetFile(sourcePath, asset)
    },
  })
  return {
    importAsset: mutateAsync,
    isImportAssetLoading: isPending,
  }
}
export default useCopyAssetFile
