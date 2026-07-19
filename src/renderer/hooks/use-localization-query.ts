import { useQuery } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import localizationService from "@/services/localization-service";
import { emptyLocalizationDocument, type LocalizationDocument } from "../../shared/localization";

export interface UseLocalizationQuery {
  isLocalizationLoading: boolean;
  localization: LocalizationDocument;
}

const useLocalizationQuery = (): UseLocalizationQuery => {
  const { data, isLoading } = useQuery({
    queryKey: [HookKeysEnum.listLocalizationQuery],
    queryFn: async () => localizationService.readLocalization()
  });

  return {
    isLocalizationLoading: isLoading,
    localization: data ?? emptyLocalizationDocument
  };
};

export default useLocalizationQuery;
