import { localizationKeyConstant, type LocalizationDocument } from "./localization"
import type { LuauExportFile } from "./luau-serialization"
import { stringUnion, TYPESCRIPT_HEADER } from "./typescript-declarations"

export function renderRobloxLocalizationTypes(
  document: LocalizationDocument,
  root: string
): LuauExportFile {
  const ids = document.keys.map(
    (key, index) => `readonly ${JSON.stringify(localizationKeyConstant(key.path))}: ${index + 1};`
  )
  const styles = document.styles.map((style) => `readonly ${JSON.stringify(style.slug)}: Style;`)
  const tooltips = document.tooltips.map(
    (tooltip) => `readonly ${JSON.stringify(tooltip.slug)}: Tooltip;`
  )
  return {
    path: `${root}/localization.d.ts`,
    content: `${TYPESCRIPT_HEADER}
import type { IdLookup } from "./types";

type Locale = ${stringUnion(document.locales)};
interface Style {
  readonly slug: string;
  readonly color?: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
}
interface Icon {
  readonly id: number;
  readonly contentId: string;
}
interface Tooltip {
  readonly titleId: number;
  readonly descriptionId: number;
  readonly icon: Icon | false;
}
interface Placeholder {
  readonly name: string;
  readonly type: "int" | "float" | "string";
}
type Parameters = { readonly [name: string]: string | number | undefined };
type Segment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "styleStart"; readonly slug: string; readonly style: Style }
  | { readonly kind: "styleEnd" }
  | { readonly kind: "tooltipStart"; readonly slug: string; readonly tooltip: Tooltip }
  | { readonly kind: "tooltipEnd" }
  | { readonly kind: "icon"; readonly slug: string; readonly assetId: number; readonly contentId: string };
interface Localization {
  readonly ID: { readonly INVALID: 0; ${ids.join(" ")} };
  readonly KEYS: IdLookup<${stringUnion(document.keys.map((key) => key.path))}>;
  readonly DEFAULT_LOCALE: ${JSON.stringify(document.defaultLocale)};
  readonly LOCALES: readonly Locale[];
  readonly STYLES: { ${styles.join(" ")} };
  readonly TOOLTIPS: { ${tooltips.join(" ")} };
  readonly PLACEHOLDERS: IdLookup<readonly Placeholder[]>;
  readonly text: (id: number, locale?: Locale, parameters?: Parameters) => string;
  readonly richText: (id: number, locale?: Locale, parameters?: Parameters) => string;
  readonly segments: (id: number, locale?: Locale, parameters?: Parameters) => readonly Segment[];
}
declare const localization: Localization;
export = localization;
`,
  }
}
