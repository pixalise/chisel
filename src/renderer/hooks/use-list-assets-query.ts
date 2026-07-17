import { useQuery } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import { Asset } from "../../shared/schemas";
import assetService from "@/services/asset-service";

export interface UseListAssetsQuery {
  assets: Asset[];
  areAssetsLoading: boolean;
}

const useListAssetsQuery = (): UseListAssetsQuery => {
  const { data, isLoading } = useQuery({
    queryKey: [HookKeysEnum.listAssetsQuery],
    queryFn: async () => {
      const assets = await assetService.getAllAssets();
      return assets;
    }
  });

  return {
    assets: data ?? [],
    areAssetsLoading: isLoading
  };
};

export default useListAssetsQuery;
