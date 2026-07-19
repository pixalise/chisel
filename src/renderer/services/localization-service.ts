import BaseService from "@/services/base-service";
import fileService from "@/services/file-service";
import appStore from "@/stores/app-store";
import { zodParse } from "@/utils/zod-parse";
import {
  addLocaleToLocalization,
  addLocalizationKey,
  addLocalizationTerm,
  emptyLocalizationDocument,
  localizationDocumentSchema,
  removeLocaleFromLocalization,
  removeLocalizationKey,
  removeLocalizationTerm,
  updateLocalizationKey,
  updateLocalizationTerm,
  validateLocalizationDocument,
  type CreateOrUpdateLocalizationKey,
  type CreateOrUpdateLocalizationTerm,
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

  public async addLocale(locale: string): Promise<LocalizationDocument> {
    return this.saveLocalization(addLocaleToLocalization(await this.readLocalization(), locale));
  }

  public async removeLocale(locale: string): Promise<LocalizationDocument> {
    return this.saveLocalization(removeLocaleFromLocalization(await this.readLocalization(), locale));
  }

  public async addKey(input: CreateOrUpdateLocalizationKey): Promise<LocalizationDocument> {
    return this.saveLocalization(addLocalizationKey(await this.readLocalization(), input));
  }

  public async updateKey(path: string, input: CreateOrUpdateLocalizationKey): Promise<LocalizationDocument> {
    return this.saveLocalization(updateLocalizationKey(await this.readLocalization(), path, input));
  }

  public async removeKey(path: string): Promise<LocalizationDocument> {
    return this.saveLocalization(removeLocalizationKey(await this.readLocalization(), path));
  }

  public async addTerm(input: CreateOrUpdateLocalizationTerm): Promise<LocalizationDocument> {
    return this.saveLocalization(addLocalizationTerm(await this.readLocalization(), input));
  }

  public async updateTerm(slug: string, input: CreateOrUpdateLocalizationTerm): Promise<LocalizationDocument> {
    return this.saveLocalization(updateLocalizationTerm(await this.readLocalization(), slug, input));
  }

  public async removeTerm(slug: string): Promise<LocalizationDocument> {
    return this.saveLocalization(removeLocalizationTerm(await this.readLocalization(), slug));
  }

  public validate(document: LocalizationDocument): LocalizationProblem[] {
    return validateLocalizationDocument(document);
  }
}

const localizationService = new LocalizationService();
export default localizationService;
