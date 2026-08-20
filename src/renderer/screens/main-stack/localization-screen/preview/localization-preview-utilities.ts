import type { CSSProperties } from "react";
import {
  TranslationPlaceholderType,
  localizationPlaceholderDefaultText,
  type LocalizationDocument,
  type LocalizationKey,
  type LocalizationStyle,
  type LocalizationTooltip
} from "../../../../../shared/localization";
import type { Asset } from "../../../../../shared/schemas";
import { AssetCategoryEnum } from "../../../../../shared/types";
import type { PreviewPart } from "@/screens/main-stack/localization-screen/preview/types";

export function previewPartStyle(part: PreviewPart): CSSProperties | undefined {
  if (!part.color && !part.bold && !part.italic && !part.underline) {
    return undefined;
  }
  return {
    color: part.color,
    fontStyle: part.italic ? "italic" : undefined,
    fontWeight: part.bold ? 700 : undefined,
    textDecorationColor: part.color,
    textDecorationLine: part.underline ? "underline" : undefined
  };
}

export function previewParts(
  document: LocalizationDocument,
  keyEntry: LocalizationKey,
  assets: Asset[],
  locale = document.defaultLocale
): PreviewPart[] {
  const text = keyEntry.values[locale] ?? "";
  const parts: PreviewPart[] = [];
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const stylesBySlug = new Map(document.styles.map((style) => [style.slug, style]));
  const tooltipsBySlug = new Map(document.tooltips.map((tooltip) => [tooltip.slug, tooltip]));
  const keysByPath = new Map(document.keys.map((key) => [key.path, key]));
  const activeStyles: LocalizationStyle[] = [];
  const activeTooltips: LocalizationTooltip[] = [];
  const regex =
    /<style:([A-Z][A-Z0-9_]*)>|<\/style>|<tooltip:([A-Z][A-Z0-9_]*)>|<\/tooltip>|<br\s*\/>|<icon:([A-Z][A-Z0-9_]*)\s*\/>|\{(int|float|string):([a-z][a-z0-9_]*)\}/g;
  let cursor = 0;
  for (const match of text.matchAll(regex)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      appendPreviewPart(parts, text.slice(cursor, index), activeStyles, activeTooltips);
    }
    const token = match[0] ?? "";
    if (token.startsWith("<style:")) {
      const style = stylesBySlug.get(match[1] ?? "");
      if (style) {
        activeStyles.push(style);
      }
    } else if (token === "</style>") {
      activeStyles.pop();
    } else if (token.startsWith("<tooltip:")) {
      const tooltip = tooltipsBySlug.get(match[2] ?? "");
      if (tooltip) {
        activeTooltips.push(tooltip);
      }
    } else if (token === "</tooltip>") {
      activeTooltips.pop();
    } else if (token.startsWith("<br")) {
      appendLineBreakPart(parts, activeStyles, activeTooltips);
    } else if (token.startsWith("<icon:")) {
      appendIconPreviewPart(parts, match[3] ?? "", activeStyles, activeTooltips, keysByPath, locale, assetsById);
    } else {
      appendPreviewPart(parts, localizationPlaceholderDefaultText(match[4] as TranslationPlaceholderType), activeStyles, activeTooltips);
    }
    cursor = index + match[0].length;
  }
  if (cursor < text.length) {
    appendPreviewPart(parts, text.slice(cursor), activeStyles, activeTooltips);
  }
  return parts;
}

export function assetPreviewPath(asset: Asset, projectPath: string): string {
  return asset.relativePath.startsWith("/") ? asset.relativePath : `${projectPath}/${asset.relativePath}`;
}

function appendIconPreviewPart(
  parts: PreviewPart[],
  iconSlug: string,
  activeStyles: LocalizationStyle[],
  activeTooltips: LocalizationTooltip[],
  keysByPath: Map<string, LocalizationKey>,
  defaultLocale: string,
  assetsById: Map<string, Asset>
): void {
  if (iconSlug.length === 0) {
    return;
  }
  const asset = assetsById.get(iconSlug);
  const iconAsset = asset?.category === AssetCategoryEnum.ui ? asset : undefined;
  const label = iconAsset?.name ?? iconSlug;
  const style = activeStyles[activeStyles.length - 1];
  const tooltip = activeTooltips[activeTooltips.length - 1];
  parts.push({
    bold: style?.bold,
    iconAsset,
    iconSlug: label,
    italic: style?.italic,
    label,
    color: style?.color,
    tooltip,
    underline: style?.underline
  });
}

function appendLineBreakPart(parts: PreviewPart[], activeStyles: LocalizationStyle[], activeTooltips: LocalizationTooltip[]): void {
  const style = activeStyles[activeStyles.length - 1];
  const tooltip = activeTooltips[activeTooltips.length - 1];
  parts.push({
    bold: style?.bold,
    label: "\n",
    color: style?.color,
    italic: style?.italic,
    lineBreak: true,
    tooltip,
    underline: style?.underline
  });
}

function appendPreviewPart(
  parts: PreviewPart[],
  label: string,
  activeStyles: LocalizationStyle[],
  activeTooltips: LocalizationTooltip[]
): void {
  if (label.length === 0) {
    return;
  }
  const style = activeStyles[activeStyles.length - 1];
  const tooltip = activeTooltips[activeTooltips.length - 1];
  parts.push({
    bold: style?.bold,
    label,
    color: style?.color,
    italic: style?.italic,
    tooltip,
    underline: style?.underline
  });
}
