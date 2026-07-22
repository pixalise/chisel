import { type CSSProperties, type FC, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Section from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useListAssetsQuery from "@/hooks/use-list-assets-query";
import useLocalizationQuery from "@/hooks/use-localization-query";
import useSaveLocalizationMutation from "@/hooks/use-save-localization-mutation";
import useAppStore from "@/stores/app-store";
import { useToast } from "@/hooks/use-toast";
import {
  LocalizationProblemSeverity,
  TranslationPlaceholderType,
  addLocalizationStyle,
  addLocalizationTooltip,
  analyzeLocalizationText,
  localizationPlaceholderDefaultText,
  localizationPlaceholdersForKey,
  placeholderToken,
  removeLocalizationStyle,
  removeLocalizationTooltip,
  validateLocalizationDocument,
  type LocalizationDocument,
  type LocalizationKey,
  type LocalizationProblem,
  type LocalizationStyle,
  type LocalizationTooltip
} from "../../../../shared/localization";
import type { Asset } from "../../../../shared/schemas";
import { AssetCategoryEnum } from "../../../../shared/types";
import LocalizationKeyTree from "@/screens/main-stack/localization-screen/localization-key-tree/localization-key-tree";
import LocalizationKeySection from "@/screens/main-stack/localization-screen/localization-key-section";
import LocalizationMatrix from "@/screens/main-stack/localization-screen/localization-matrix/localization-matrix";
import LanguagesSection from "@/screens/main-stack/localization-screen/languages-section/languages-section";
import { LocalizationProvider, useLocalizationContext } from "@/screens/main-stack/localization-screen/localization-context";
import TooltipEditor from "@/screens/main-stack/localization-screen/editors/tooltip-editor";

const LocalizationScreen: FC = () => {
  const { localization, isLocalizationLoading } = useLocalizationQuery();

  return (
    <LocalizationProvider sourceDocument={localization}>
      <LocalizationScreenContent isLocalizationLoading={isLocalizationLoading} sourceLocalization={localization} />
    </LocalizationProvider>
  );
};

interface LocalizationScreenContentProps {
  isLocalizationLoading: boolean;
  sourceLocalization: LocalizationDocument;
}

const LocalizationScreenContent: FC<LocalizationScreenContentProps> = (props) => {
  const { isLocalizationLoading, sourceLocalization } = props;
  const { assets } = useListAssetsQuery();
  const { document: draft, selectedKey, setDocument: setDraft } = useLocalizationContext();
  const { saveLocalization, isSaveLocalizationLoading } = useSaveLocalizationMutation();
  const { toast } = useToast();
  const [newStyleSlug, setNewStyleSlug] = useState("");
  const [newTooltipSlug, setNewTooltipSlug] = useState("");
  const [newTooltipIconAssetId, setNewTooltipIconAssetId] = useState("");
  const [newTooltipTitleKey, setNewTooltipTitleKey] = useState("");
  const [newTooltipDescriptionKey, setNewTooltipDescriptionKey] = useState("");
  const autosaveRef = useRef({
    draft,
    errorCount: 0,
    isLocalizationLoading,
    isSaveLocalizationLoading,
    saveLocalization
  });
  const isAutosavingRef = useRef(false);
  const lastAutosavedErrorRef = useRef<string | undefined>(undefined);
  const lastSavedSignatureRef = useRef(JSON.stringify(sourceLocalization));

  useEffect(() => {
    lastSavedSignatureRef.current = JSON.stringify(sourceLocalization);
  }, [sourceLocalization]);

  const problems = useMemo(() => validateLocalizationDocument(draft, assets), [assets, draft]);
  const errorCount = problems.filter((problem) => problem.severity === LocalizationProblemSeverity.error).length;
  const warningCount = problems.filter((problem) => problem.severity === LocalizationProblemSeverity.warning).length;

  async function onSave(): Promise<void> {
    if (errorCount > 0) {
      toast({
        variant: "destructive",
        title: "Localization has blocking errors",
        description: problems.find((problem) => problem.severity === LocalizationProblemSeverity.error)?.message
      });
      return;
    }

    try {
      const saved = await saveLocalization(draft);
      setDraft(saved);
      toast({
        title: "Localization saved",
        description: `${saved.keys.length} keys across ${saved.locales.length} locales.`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Localization save failed",
        description: error instanceof Error ? error.message : String(error)
      });
    }
  }

  function onAddStyle(): void {
    try {
      setDraft(addLocalizationStyle(draft, { slug: newStyleSlug, bold: false, italic: false, underline: false }));
      setNewStyleSlug("");
    } catch (error) {
      showDraftError(error);
    }
  }

  function onRemoveStyle(slug: string): void {
    if (!window.confirm(`Remove localization style ${slug}?`)) {
      return;
    }
    try {
      setDraft(removeLocalizationStyle(draft, slug));
    } catch (error) {
      showDraftError(error);
    }
  }

  function onAddTooltip(): void {
    try {
      const fallbackKey = selectedKey?.path ?? draft.keys[0]?.path ?? "TOOLTIP.NEW_TOOLTIP.DESCRIPTION";
      setDraft(
        addLocalizationTooltip(draft, {
          slug: newTooltipSlug,
          iconAssetId: newTooltipIconAssetId || undefined,
          titleKey: newTooltipTitleKey || fallbackKey,
          descriptionKey: newTooltipDescriptionKey || fallbackKey
        })
      );
      setNewTooltipSlug("");
      setNewTooltipIconAssetId("");
      setNewTooltipTitleKey("");
      setNewTooltipDescriptionKey("");
    } catch (error) {
      showDraftError(error);
    }
  }

  function onRemoveTooltip(slug: string): void {
    if (!window.confirm(`Remove localization tooltip ${slug}?`)) {
      return;
    }
    try {
      setDraft(removeLocalizationTooltip(draft, slug));
    } catch (error) {
      showDraftError(error);
    }
  }

  function showDraftError(error: unknown): void {
    toast({
      variant: "destructive",
      title: "Localization edit failed",
      description: error instanceof Error ? error.message : String(error)
    });
  }

  useEffect(() => {
    autosaveRef.current = {
      draft,
      errorCount,
      isLocalizationLoading,
      isSaveLocalizationLoading,
      saveLocalization
    };
  }, [draft, errorCount, isLocalizationLoading, isSaveLocalizationLoading, saveLocalization]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = autosaveRef.current;
      if (current.errorCount > 0 || current.isLocalizationLoading || current.isSaveLocalizationLoading || isAutosavingRef.current) {
        return;
      }

      const signature = JSON.stringify(current.draft);
      if (signature === lastSavedSignatureRef.current) {
        return;
      }

      isAutosavingRef.current = true;
      void current
        .saveLocalization(current.draft)
        .then((saved) => {
          lastSavedSignatureRef.current = JSON.stringify(saved);
          lastAutosavedErrorRef.current = undefined;
          setDraft((currentDraft) => (JSON.stringify(currentDraft) === signature ? saved : currentDraft));
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          if (lastAutosavedErrorRef.current === message) {
            return;
          }
          lastAutosavedErrorRef.current = message;
          toast({
            variant: "destructive",
            title: "Localization autosave failed",
            description: message
          });
        })
        .finally(() => {
          isAutosavingRef.current = false;
        });
    }, 3000);
    return () => {
      window.clearInterval(interval);
    };
  }, [toast, setDraft]);

  return (
    <Section
      title="Localization"
      copy="Key/value translation matrix with typed placeholders, reusable rich styles, tooltips, and generated Godot exports."
      actions={[
        <Button disabled={isLocalizationLoading || isSaveLocalizationLoading || errorCount > 0} key="save" onClick={onSave} type="button">
          {isSaveLocalizationLoading ? "Saving..." : "Save Localization"}
        </Button>
      ]}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_24rem] gap-4 max-[1180px]:grid-cols-1">
        <div className="min-w-0 space-y-4">
          <LanguagesSection document={draft} onUpdateDocument={setDraft} />
          <Section title="Keys">
            <div className="grid grid-cols-[20rem_minmax(0,1fr)] gap-3">
              <LocalizationKeyTree />
              <div>
                <LocalizationKeySection />
                <LocalizationMatrix />
              </div>
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Tokens">
            {selectedKey ? (
              <PlaceholderSummary assets={assets} document={draft} keyEntry={selectedKey} />
            ) : (
              <p className="m-0 text-sm text-muted-foreground">No key selected.</p>
            )}
          </Section>

          <Section title="Styles">
            <div className="mb-3 flex gap-2">
              <Input onChange={(event) => setNewStyleSlug(event.target.value)} placeholder="PHYSICAL_DAMAGE_STYLE" value={newStyleSlug} />
              <Button onClick={onAddStyle} type="button" variant="secondary">
                Add Style
              </Button>
            </div>
            <StyleEditor document={draft} onChange={setDraft} onRemoveStyle={onRemoveStyle} />
          </Section>

          <Section title="Tooltips">
            <div className="mb-3 grid gap-2">
              <Input
                onChange={(event) => setNewTooltipSlug(event.target.value)}
                placeholder="PHYSICAL_DAMAGE_TYPE"
                value={newTooltipSlug}
              />
              <select
                className="h-9 w-full border border-input bg-background px-2 text-sm"
                onChange={(event) => setNewTooltipIconAssetId(event.target.value)}
                value={newTooltipIconAssetId}
              >
                <option value="">No icon</option>
                {assets
                  .filter((asset) => asset.category === AssetCategoryEnum.uiIcon)
                  .map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
              </select>
              <select
                className="h-9 w-full border border-input bg-background px-2 text-sm"
                onChange={(event) => setNewTooltipTitleKey(event.target.value)}
                value={newTooltipTitleKey}
              >
                <option value="">Title key</option>
                {draft.keys.map((key) => (
                  <option key={key.path} value={key.path}>
                    {key.path}
                  </option>
                ))}
              </select>
              <select
                className="h-9 w-full border border-input bg-background px-2 text-sm"
                onChange={(event) => setNewTooltipDescriptionKey(event.target.value)}
                value={newTooltipDescriptionKey}
              >
                <option value="">Description key</option>
                {draft.keys.map((key) => (
                  <option key={key.path} value={key.path}>
                    {key.path}
                  </option>
                ))}
              </select>
              <Button onClick={onAddTooltip} type="button" variant="secondary">
                Add Tooltip
              </Button>
            </div>
            <TooltipEditor assets={assets} document={draft} onChange={setDraft} onRemoveTooltip={onRemoveTooltip} />
          </Section>

          <Section title="Preview">
            {selectedKey ? (
              <Preview assets={assets} document={draft} keyEntry={selectedKey} />
            ) : (
              <p className="m-0 text-sm text-muted-foreground">No key selected.</p>
            )}
          </Section>

          <Section title="Problems">
            <ProblemList problems={problems} />
            <div className="mt-3 flex gap-2">
              <Badge variant={errorCount > 0 ? "destructive" : "outline"}>{errorCount} errors</Badge>
              <Badge variant={warningCount > 0 ? "secondary" : "outline"}>{warningCount} warnings</Badge>
            </div>
          </Section>
        </div>
      </div>
    </Section>
  );
};

const PlaceholderSummary: FC<{
  assets: Asset[];
  document: LocalizationDocument;
  keyEntry: LocalizationKey;
}> = (props) => {
  const { assets, document, keyEntry } = props;
  const placeholders = localizationPlaceholdersForKey(keyEntry, document.defaultLocale);
  const analysis = analyzeLocalizationText(keyEntry.values[document.defaultLocale] ?? "", "");
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

  return (
    <div className="space-y-2">
      {placeholders.length === 0 &&
        analysis.iconSlugs.length === 0 &&
        analysis.styleSlugs.length === 0 &&
        analysis.tooltipSlugs.length === 0 && (
          <p className="m-0 text-sm text-muted-foreground">No typed placeholders, icons, styles, or tooltips.</p>
        )}
      {placeholders.map((placeholder) => (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border border-border p-2" key={placeholder.name}>
          <code className="truncate text-xs">{`{${placeholderToken(placeholder)}}`}</code>
          <Badge variant="outline">{localizationPlaceholderDefaultText(placeholder.type)}</Badge>
        </div>
      ))}
      {analysis.iconSlugs.map((iconSlug) => {
        const asset = assetsById.get(iconSlug);
        const isUiIcon = asset?.category === AssetCategoryEnum.uiIcon;
        return (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border border-border p-2" key={iconSlug}>
            <code className="truncate text-xs">{`<icon:${iconSlug}/>`}</code>
            <Badge variant={isUiIcon ? "outline" : "destructive"}>{asset?.category ?? "missing"}</Badge>
          </div>
        );
      })}
      {analysis.styleSlugs.map((styleSlug) => (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border border-border p-2" key={styleSlug}>
          <code className="truncate text-xs">{`<style:${styleSlug}>`}</code>
          <Badge variant={document.styles.some((style) => style.slug === styleSlug) ? "outline" : "destructive"}>style</Badge>
        </div>
      ))}
      {analysis.tooltipSlugs.map((tooltipSlug) => (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border border-border p-2" key={tooltipSlug}>
          <code className="truncate text-xs">{`<tooltip:${tooltipSlug}>`}</code>
          <Badge variant={document.tooltips.some((tooltip) => tooltip.slug === tooltipSlug) ? "outline" : "destructive"}>tooltip</Badge>
        </div>
      ))}
      {analysis.problems.length > 0 && (
        <div className="space-y-2 pt-1">
          {analysis.problems.map((problem) => (
            <p className="m-0 text-xs text-destructive" key={problem.message}>
              {problem.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

const StyleEditor: FC<{
  document: LocalizationDocument;
  onChange: (document: LocalizationDocument) => void;
  onRemoveStyle: (slug: string) => void;
}> = (props) => {
  const { document, onChange, onRemoveStyle } = props;

  function updateStyle(index: number, style: LocalizationStyle): void {
    onChange({
      ...document,
      styles: document.styles.map((entry, entryIndex) => (entryIndex === index ? style : entry))
    });
  }

  if (document.styles.length === 0) {
    return <p className="m-0 text-sm text-muted-foreground">No rich styles.</p>;
  }

  return (
    <div className="space-y-2">
      {document.styles.map((style, index) => (
        <div className="space-y-2 border border-border p-2" key={index}>
          <Input
            className="font-mono text-xs"
            onChange={(event) => updateStyle(index, { ...style, slug: event.target.value })}
            value={style.slug}
          />
          <Input
            onChange={(event) => updateStyle(index, { ...style, color: event.target.value || undefined })}
            placeholder="#65C7FF"
            value={style.color ?? ""}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              checked={style.bold}
              onChange={(event) => updateStyle(index, { ...style, bold: event.target.checked })}
              type="checkbox"
            />
            Bold
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              checked={style.italic}
              onChange={(event) => updateStyle(index, { ...style, italic: event.target.checked })}
              type="checkbox"
            />
            Italic
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              checked={style.underline}
              onChange={(event) => updateStyle(index, { ...style, underline: event.target.checked })}
              type="checkbox"
            />
            Underline
          </label>
          <Button onClick={() => onRemoveStyle(style.slug)} size="sm" type="button" variant="ghost">
            Remove
          </Button>
        </div>
      ))}
    </div>
  );
};

const Preview: FC<{ assets: Asset[]; document: LocalizationDocument; keyEntry: LocalizationKey }> = (props) => {
  const { assets, document, keyEntry } = props;
  const project = useAppStore((state) => state._project);
  return (
    <div className="space-y-2">
      <code className="block truncate text-xs">{keyEntry.path}</code>
      <div className="border border-border p-3 text-sm leading-relaxed">
        {previewParts(document, keyEntry, assets).map((part, index) => (
          <span key={`${part.label}-${index}`} style={previewPartStyle(part)} title={part.tooltip}>
            {part.iconAsset && project ? (
              <InlineIconPreview asset={part.iconAsset} projectPath={project.path} title={part.tooltip ?? part.iconSlug} />
            ) : part.iconSlug ? (
              <span
                className="mx-1 inline-flex items-center border border-border px-1 font-mono text-[0.7rem] leading-5"
                title={part.tooltip ?? part.iconSlug}
              >
                {part.iconSlug}
              </span>
            ) : (
              part.label
            )}
          </span>
        ))}
      </div>
    </div>
  );
};

const InlineIconPreview: FC<{ asset: Asset; projectPath: string; title?: string }> = (props) => {
  const { asset, projectPath, title } = props;
  const path = assetPreviewPath(asset, projectPath);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    window.electron
      .createImageConversionPreview(path)
      .then((nextSource) => {
        if (!cancelled) {
          setSource(nextSource);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSource("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!source) {
    return (
      <span
        className="mx-1 inline-flex items-center border border-border px-1 font-mono text-[0.7rem] leading-5"
        title={title ?? asset.name}
      >
        {asset.name}
      </span>
    );
  }

  return (
    <img alt={asset.name} className="mx-1 inline-block size-5 align-[-0.25rem] object-contain" src={source} title={title ?? asset.name} />
  );
};

interface PreviewPart {
  bold?: boolean;
  color?: string;
  iconAsset?: Asset;
  iconSlug?: string;
  italic?: boolean;
  label: ReactNode;
  tooltip?: string;
  underline?: boolean;
}

function previewPartStyle(part: PreviewPart): CSSProperties | undefined {
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

function previewParts(document: LocalizationDocument, keyEntry: LocalizationKey, assets: Asset[]): PreviewPart[] {
  const text = keyEntry.values[document.defaultLocale] ?? "";
  const parts: PreviewPart[] = [];
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const stylesBySlug = new Map(document.styles.map((style) => [style.slug, style]));
  const tooltipsBySlug = new Map(document.tooltips.map((tooltip) => [tooltip.slug, tooltip]));
  const keysByPath = new Map(document.keys.map((key) => [key.path, key]));
  const activeStyles: LocalizationStyle[] = [];
  const activeTooltips: LocalizationTooltip[] = [];
  const regex =
    /<style:([A-Z][A-Z0-9_]*)>|<\/style>|<tooltip:([A-Z][A-Z0-9_]*)>|<\/tooltip>|<icon:([A-Z][A-Z0-9_]*)\s*\/>|\[icon:([A-Z][A-Z0-9_]*)\]|\[term:([A-Z][A-Z0-9_]*)\]|\[\/term\]|\{(int|float|string):([a-z][a-z0-9_]*)\}/g;
  let cursor = 0;
  for (const match of text.matchAll(regex)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      appendPreviewPart(parts, text.slice(cursor, index), activeStyles, activeTooltips, keysByPath, document.defaultLocale);
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
    } else if (token.startsWith("<icon:")) {
      appendIconPreviewPart(parts, match[3] ?? "", activeStyles, activeTooltips, keysByPath, document.defaultLocale, assetsById);
    } else if (token.startsWith("[icon:")) {
      appendIconPreviewPart(parts, match[4] ?? "", activeStyles, activeTooltips, keysByPath, document.defaultLocale, assetsById);
    } else if (token.startsWith("[term:")) {
      const style = stylesBySlug.get(match[5] ?? "");
      if (style) {
        activeStyles.push(style);
      }
    } else if (token === "[/term]") {
      activeStyles.pop();
    } else {
      appendPreviewPart(
        parts,
        localizationPlaceholderDefaultText(match[6] as TranslationPlaceholderType),
        activeStyles,
        activeTooltips,
        keysByPath,
        document.defaultLocale
      );
    }
    cursor = index + match[0].length;
  }
  if (cursor < text.length) {
    appendPreviewPart(parts, text.slice(cursor), activeStyles, activeTooltips, keysByPath, document.defaultLocale);
  }
  return parts;
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
  const iconAsset = asset?.category === AssetCategoryEnum.uiIcon ? asset : undefined;
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
    tooltip: tooltip ? previewTooltipText(tooltip, keysByPath, defaultLocale) : undefined,
    underline: style?.underline
  });
}

function assetPreviewPath(asset: Asset, projectPath: string): string {
  return asset.relativePath.startsWith("/") ? asset.relativePath : `${projectPath}/${asset.relativePath}`;
}

function appendPreviewPart(
  parts: PreviewPart[],
  label: string,
  activeStyles: LocalizationStyle[],
  activeTooltips: LocalizationTooltip[],
  keysByPath: Map<string, LocalizationKey>,
  defaultLocale: string
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
    tooltip: tooltip ? previewTooltipText(tooltip, keysByPath, defaultLocale) : undefined,
    underline: style?.underline
  });
}

function previewTooltipText(
  tooltip: LocalizationTooltip,
  keysByPath: Map<string, LocalizationKey>,
  defaultLocale: string
): string | undefined {
  const title = keysByPath.get(tooltip.titleKey)?.values[defaultLocale] ?? "";
  const description = keysByPath.get(tooltip.descriptionKey)?.values[defaultLocale] ?? "";
  if (title && description && title !== description) {
    return `${title}\n${description}`;
  }
  return title || description || undefined;
}

const ProblemList: FC<{ problems: LocalizationProblem[] }> = (props) => {
  const { problems } = props;
  if (problems.length === 0) {
    return <p className="m-0 text-sm text-muted-foreground">No localization problems.</p>;
  }

  return (
    <div className="max-h-72 space-y-2 overflow-auto">
      {problems.map((problem) => (
        <div className="border border-border p-2" key={`${problem.severity}-${problem.path}-${problem.message}`}>
          <div className="mb-1 flex items-center gap-2">
            <Badge variant={problem.severity === LocalizationProblemSeverity.error ? "destructive" : "secondary"}>{problem.severity}</Badge>
            <code className="truncate text-xs">{problem.path}</code>
          </div>
          <p className="m-0 text-sm text-muted-foreground">{problem.message}</p>
        </div>
      ))}
    </div>
  );
};

export default LocalizationScreen;
