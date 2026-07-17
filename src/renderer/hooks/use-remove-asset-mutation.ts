import { useMutation } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import assetService from "@/services/asset-service";
import CacheUtils from "@/utils/cache-utils";

export interface UseRemoveAssetMutation {
  removeAsset: () => Promise<void>;
  isRemoveAssetLoading: boolean;
}

const useRemoveAssetMutation = (assetId: string): UseRemoveAssetMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.removeAssetMutation, assetId],
    mutationFn: async (): Promise<void> => {
      await assetService.removeAsset(assetId);
      await CacheUtils.invalidateQueries([[HookKeysEnum.listAssetsQuery]]);
    }
  });

  return {
    removeAsset: mutateAsync,
    isRemoveAssetLoading: isPending
  };
};

export default useRemoveAssetMutation;
