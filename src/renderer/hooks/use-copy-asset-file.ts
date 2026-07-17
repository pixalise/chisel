import { useMutation } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import assetService from "@/services/asset-service";
import type { Asset } from "../../shared/schemas";

export interface CopyAssetFileInput {
  asset: Asset;
  sourcePath: string;
}

export interface UseCopyAssetFile {
  importAsset: (input: CopyAssetFileInput) => Promise<void>;
  isImportAssetLoading: boolean;
}

const useCopyAssetFile = (): UseCopyAssetFile => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.importAssetMutation],
    mutationFn: async (input: CopyAssetFileInput): Promise<void> => {
      const { sourcePath, asset } = input;
      await assetService.copyAssetFile(sourcePath, asset);
    }
  });

  return {
    importAsset: mutateAsync,
    isImportAssetLoading: isPending
  };
};

export default useCopyAssetFile;
