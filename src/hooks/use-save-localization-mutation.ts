import { HookKeysEnum } from "@/enums/hook-keys-enum"
import { queryClient } from "@/query-client"
import localizationService from "@/services/localization-service"
import type { LocalizationDocument } from "@/shared/localization"
import { useMutation } from "@tanstack/react-query"
export interface UseSaveLocalizationMutation {
  isSaveLocalizationLoading: boolean
  saveLocalization: (document: LocalizationDocument) => Promise<LocalizationDocument>
}
const useSaveLocalizationMutation = (): UseSaveLocalizationMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.SAVE_LOCALIZATION_MUTATION],
    mutationFn: async (document: LocalizationDocument) =>
      localizationService.saveLocalization(document),
    onSuccess: async () =>
      Promise.all(
        [[HookKeysEnum.LIST_LOCALIZATION_QUERY]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        )
      ),
  })
  return {
    isSaveLocalizationLoading: isPending,
    saveLocalization: mutateAsync,
  }
}
export default useSaveLocalizationMutation
