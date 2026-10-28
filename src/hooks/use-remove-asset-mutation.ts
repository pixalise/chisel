import { HookKeysEnum } from "@/enums/hook-keys-enum"
import { queryClient } from "@/query-client"
import assetService from "@/services/asset-service"
import { useMutation } from "@tanstack/react-query"
export interface UseRemoveAssetMutation {
  removeAsset: () => Promise<void>
  isRemoveAssetLoading: boolean
}
const useRemoveAssetMutation = (assetId: string): UseRemoveAssetMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.REMOVE_ASSET_MUTATION, assetId],
    mutationFn: async (): Promise<void> => {
      await assetService.removeAsset(assetId)
      await Promise.all(
        [[HookKeysEnum.LIST_ASSETS_QUERY]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        )
      )
    },
  })
  return {
    removeAsset: mutateAsync,
    isRemoveAssetLoading: isPending,
  }
}
export default useRemoveAssetMutation
