import { useMutation } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import assetService from "@/services/asset-service";
import CacheUtils from "@/utils/cache-utils";
import type { Asset } from "../../shared/schemas";

export interface UseUpdateAssetMutation {
  updateAsset: (asset: Asset) => Promise<void>;
  isUpdateAssetLoading: boolean;
}

const useUpdateAssetMutation = (assetId: string): UseUpdateAssetMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.updateAssetMutation, assetId],
    mutationFn: async (asset: Asset): Promise<void> => {
      await assetService.updateAsset(assetId, asset);
      await CacheUtils.invalidateQueries([[HookKeysEnum.listAssetsQuery]]);
    }
  });

  return {
    updateAsset: mutateAsync,
    isUpdateAssetLoading: isPending
  };
};

export default useUpdateAssetMutation;
