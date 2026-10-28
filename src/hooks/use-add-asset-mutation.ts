import { HookKeysEnum } from "@/enums/hook-keys-enum"
import { queryClient } from "@/query-client"
import assetService from "@/services/asset-service"
import type { AddAsset, Asset } from "@/shared/schemas"
import { useMutation } from "@tanstack/react-query"
export interface UseAddAssetMutation {
  addAsset: (input: AddAsset) => Promise<Asset>
  isAddAssetLoading: boolean
}
const useAssAssetMutation = (): UseAddAssetMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.IMPORT_ASSET_MUTATION],
    mutationFn: async (input: AddAsset): Promise<Asset> => {
      const asset = await assetService.addAsset(input)
      await Promise.all(
        [[HookKeysEnum.LIST_ASSETS_QUERY]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        )
      )
      return asset
    },
  })
  return {
    addAsset: mutateAsync,
    isAddAssetLoading: isPending,
  }
}
export default useAssAssetMutation
