import { HookKeysEnum } from "@/enums/hook-keys-enum"
import assetService from "@/services/asset-service"
import type { Asset } from "@/shared/schemas"
import useAppStore from "@/stores/app-store"
import { useQuery } from "@tanstack/react-query"
export interface UseListAssetsQuery {
  assets: Asset[]
  areAssetsLoading: boolean
}
const useListAssetsQuery = (): UseListAssetsQuery => {
  const {
    computed: { project },
  } = useAppStore()
  const { data, isLoading } = useQuery({
    queryKey: [HookKeysEnum.LIST_ASSETS_QUERY, project.id, project.path],
    queryFn: async () => {
      const assets = await assetService.getAllAssets(project)
      return assets
    },
  })
  return {
    assets: data ?? [],
    areAssetsLoading: isLoading,
  }
}
export default useListAssetsQuery
