import fileService from "@/services/file-service"
import {
  addLocaleToLocalization,
  addLocalizationKey,
  addLocalizationStyle,
  addLocalizationTooltip,
  emptyLocalizationDocument,
  localizationDocumentSchema,
  removeLocaleFromLocalization,
  removeLocalizationKey,
  removeLocalizationStyle,
  removeLocalizationTooltip,
  updateLocalizationKey,
  updateLocalizationStyle,
  updateLocalizationTooltip,
  validateLocalizationDocument,
  type CreateOrUpdateLocalizationKey,
  type CreateOrUpdateLocalizationStyle,
  type CreateOrUpdateLocalizationTooltip,
  type LocalizationDocument,
  type LocalizationProblem,
} from "@/shared/localization"
import type { Project } from "@/shared/schemas"
import appStore from "@/stores/app-store"
class LocalizationService {
  public async readLocalization(
    project: Project = appStore.getState().computed.project
  ): Promise<LocalizationDocument> {
    return (await fileService.tryReadLocalizationJson(project.path)) ?? emptyLocalizationDocument
  }
  public async saveLocalization(document: LocalizationDocument): Promise<LocalizationDocument> {
    const parsed = localizationDocumentSchema.parse(document)
    await fileService.writeLocalizationJson(appStore.getState().computed.project, parsed)
    return parsed
  }
  public async addLocale(locale: string): Promise<LocalizationDocument> {
    return this.saveLocalization(addLocaleToLocalization(await this.readLocalization(), locale))
  }
  public async removeLocale(locale: string): Promise<LocalizationDocument> {
    return this.saveLocalization(
      removeLocaleFromLocalization(await this.readLocalization(), locale)
    )
  }
  public async addKey(input: CreateOrUpdateLocalizationKey): Promise<LocalizationDocument> {
    return this.saveLocalization(addLocalizationKey(await this.readLocalization(), input))
  }
  public async updateKey(
    path: string,
    input: CreateOrUpdateLocalizationKey
  ): Promise<LocalizationDocument> {
    return this.saveLocalization(updateLocalizationKey(await this.readLocalization(), path, input))
  }
  public async removeKey(path: string): Promise<LocalizationDocument> {
    return this.saveLocalization(removeLocalizationKey(await this.readLocalization(), path))
  }
  public async addStyle(input: CreateOrUpdateLocalizationStyle): Promise<LocalizationDocument> {
    return this.saveLocalization(addLocalizationStyle(await this.readLocalization(), input))
  }
  public async updateStyle(
    slug: string,
    input: CreateOrUpdateLocalizationStyle
  ): Promise<LocalizationDocument> {
    return this.saveLocalization(
      updateLocalizationStyle(await this.readLocalization(), slug, input)
    )
  }
  public async removeStyle(slug: string): Promise<LocalizationDocument> {
    return this.saveLocalization(removeLocalizationStyle(await this.readLocalization(), slug))
  }
  public async addTooltip(input: CreateOrUpdateLocalizationTooltip): Promise<LocalizationDocument> {
    return this.saveLocalization(addLocalizationTooltip(await this.readLocalization(), input))
  }
  public async updateTooltip(
    slug: string,
    input: CreateOrUpdateLocalizationTooltip
  ): Promise<LocalizationDocument> {
    return this.saveLocalization(
      updateLocalizationTooltip(await this.readLocalization(), slug, input)
    )
  }
  public async removeTooltip(slug: string): Promise<LocalizationDocument> {
    return this.saveLocalization(removeLocalizationTooltip(await this.readLocalization(), slug))
  }
  public validate(document: LocalizationDocument): LocalizationProblem[] {
    return validateLocalizationDocument(document)
  }
}
const localizationService = new LocalizationService()
export default localizationService
