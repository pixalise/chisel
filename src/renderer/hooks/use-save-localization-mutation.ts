import { useMutation } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import localizationService from "@/services/localization-service";
import CacheUtils from "@/utils/cache-utils";
import type { LocalizationDocument } from "../../shared/localization";

export interface UseSaveLocalizationMutation {
  isSaveLocalizationLoading: boolean;
  saveLocalization: (document: LocalizationDocument) => Promise<LocalizationDocument>;
}

const useSaveLocalizationMutation = (): UseSaveLocalizationMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.saveLocalizationMutation],
    mutationFn: async (document: LocalizationDocument) => localizationService.saveLocalization(document),
    onSuccess: async () => CacheUtils.invalidateQueries([[HookKeysEnum.listLocalizationQuery]])
  });

  return {
    isSaveLocalizationLoading: isPending,
    saveLocalization: mutateAsync
  };
};

export default useSaveLocalizationMutation;
