import { HookKeysEnum } from "@/enums/hook-keys-enum"
import { queryClient } from "@/query-client"
import assetService from "@/services/asset-service"
import type { Asset } from "@/shared/schemas"
import { useMutation } from "@tanstack/react-query"
export interface UseUpdateAssetMutation {
  updateAsset: (asset: Asset) => Promise<void>
  isUpdateAssetLoading: boolean
}
const useUpdateAssetMutation = (assetId: string): UseUpdateAssetMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.UPDATE_ASSET_MUTATION, assetId],
    mutationFn: async (asset: Asset): Promise<void> => {
      await assetService.updateAsset(assetId, asset)
      await Promise.all(
        [[HookKeysEnum.LIST_ASSETS_QUERY]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        )
      )
    },
  })
  return {
    updateAsset: mutateAsync,
    isUpdateAssetLoading: isPending,
  }
}
export default useUpdateAssetMutation
