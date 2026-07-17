import { useMutation } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import assetService from "@/services/asset-service";
import CacheUtils from "@/utils/cache-utils";
import type { Asset, AddAsset } from "../../shared/schemas";

export interface UseAddAssetMutation {
  addAsset: (input: AddAsset) => Promise<Asset>;
  isAddAssetLoading: boolean;
}

const useAssAssetMutation = (): UseAddAssetMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.importAssetMutation],
    mutationFn: async (input: AddAsset): Promise<Asset> => {
      const asset = await assetService.addAsset(input);
      await CacheUtils.invalidateQueries([[HookKeysEnum.listAssetsQuery]]);
      return asset;
    }
  });

  return {
    addAsset: mutateAsync,
    isAddAssetLoading: isPending
  };
};

export default useAssAssetMutation;
