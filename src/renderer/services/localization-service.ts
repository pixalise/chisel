import BaseService from "@/services/base-service";
import fileService from "@/services/file-service";
import appStore from "@/stores/app-store";
import { zodParse } from "@/utils/zod-parse";
import {
  emptyLocalizationDocument,
  localizationDocumentSchema,
  validateLocalizationDocument,
  type LocalizationDocument,
  type LocalizationProblem
} from "../../shared/localization";

class LocalizationService extends BaseService {
  public async readLocalization(): Promise<LocalizationDocument> {
    return (await fileService.tryReadLocalizationJson(this.getPath())) ?? emptyLocalizationDocument;
  }

  public async saveLocalization(document: LocalizationDocument): Promise<LocalizationDocument> {
    const parsed = zodParse(localizationDocumentSchema, document);
    await fileService.writeLocalizationJson(appStore.getState().computed.project, parsed);
    return parsed;
  }

  public validate(document: LocalizationDocument): LocalizationProblem[] {
    return validateLocalizationDocument(document);
  }
}

const localizationService = new LocalizationService();
export default localizationService;
