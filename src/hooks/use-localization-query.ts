import { HookKeysEnum } from "@/enums/hook-keys-enum"
import localizationService from "@/services/localization-service"
import { emptyLocalizationDocument, type LocalizationDocument } from "@/shared/localization"
import useAppStore from "@/stores/app-store"
import { useQuery } from "@tanstack/react-query"
export interface UseLocalizationQuery {
  isLocalizationLoading: boolean
  localization: LocalizationDocument
}
const useLocalizationQuery = (): UseLocalizationQuery => {
  const {
    computed: { project },
  } = useAppStore()
  const { data, isLoading } = useQuery({
    queryKey: [HookKeysEnum.LIST_LOCALIZATION_QUERY, project.id, project.path],
    queryFn: async () => localizationService.readLocalization(project),
  })
  return {
    isLocalizationLoading: isLoading,
    localization: data ?? emptyLocalizationDocument,
  }
}
export default useLocalizationQuery
