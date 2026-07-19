import { type FC, type ReactNode, useEffect, useMemo, useState } from "react";
import Section from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import useListAssetsQuery from "@/hooks/use-list-assets-query";
import useLocalizationQuery from "@/hooks/use-localization-query";
import useSaveLocalizationMutation from "@/hooks/use-save-localization-mutation";
import useAppStore from "@/stores/app-store";
import { useToast } from "@/hooks/use-toast";
import {
  LocalizationProblemSeverity,
  TranslationPlaceholderType,
  addLocaleToLocalization,
  addLocalizationKey,
  addLocalizationTerm,
  analyzeLocalizationText,
  localizationPlaceholderDefaultText,
  localizationPlaceholdersForKey,
  placeholderToken,
  removeLocaleFromLocalization,
  removeLocalizationKey,
  removeLocalizationTerm,
  validateLocalizationDocument,
  type LocalizationDocument,
  type LocalizationKey,
  type LocalizationProblem,
  type LocalizationTerm
} from "../../../../shared/localization";
import type { Asset } from "../../../../shared/schemas";
import { AssetCategoryEnum } from "../../../../shared/types";

const LocalizationScreen: FC = () => {
  const { assets } = useListAssetsQuery();
  const { localization, isLocalizationLoading } = useLocalizationQuery();
  const { saveLocalization, isSaveLocalizationLoading } = useSaveLocalizationMutation();
  const { toast } = useToast();
  const [draft, setDraft] = useState<LocalizationDocument>(localization);
  const [newLocale, setNewLocale] = useState("sl_SI");
  const [newKeyPath, setNewKeyPath] = useState("UNIT.NEW_ENTRY.DESCRIPTION");
  const [newTermSlug, setNewTermSlug] = useState("AOE_RADIUS");
  const [selectedKeyPath, setSelectedKeyPath] = useState<string | undefined>(undefined);

  useEffect(() => {
    setDraft(localization);
    setSelectedKeyPath(localization.keys[0]?.path);
  }, [localization]);

  const problems = useMemo(() => validateLocalizationDocument(draft, assets), [assets, draft]);
  const errorCount = problems.filter((problem) => problem.severity === LocalizationProblemSeverity.error).length;
  const warningCount = problems.filter((problem) => problem.severity === LocalizationProblemSeverity.warning).length;
  const selectedKey = draft.keys.find((key) => key.path === selectedKeyPath) ?? draft.keys[0];

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

  function onAddLocale(): void {
    try {
      setDraft(addLocaleToLocalization(draft, newLocale));
      setNewLocale("");
    } catch (error) {
      showDraftError(error);
    }
  }

  function onRemoveLocale(locale: string): void {
    if (!window.confirm(`Remove locale ${locale} from every localization key?`)) {
      return;
    }
    try {
      setDraft(removeLocaleFromLocalization(draft, locale));
    } catch (error) {
      showDraftError(error);
    }
  }

  function onAddKey(): void {
    try {
      const nextDraft = addLocalizationKey(draft, { path: newKeyPath });
      setDraft(nextDraft);
      setSelectedKeyPath(newKeyPath);
      setNewKeyPath("");
    } catch (error) {
      showDraftError(error);
    }
  }

  function onRemoveKey(path: string): void {
    if (!window.confirm(`Remove localization key ${path}?`)) {
      return;
    }
    try {
      const nextDraft = removeLocalizationKey(draft, path);
      setDraft(nextDraft);
      setSelectedKeyPath(nextDraft.keys[0]?.path);
    } catch (error) {
      showDraftError(error);
    }
  }

  function onAddTerm(): void {
    try {
      setDraft(addLocalizationTerm(draft, { slug: newTermSlug }));
      setNewTermSlug("");
    } catch (error) {
      showDraftError(error);
    }
  }

  function onRemoveTerm(slug: string): void {
    if (!window.confirm(`Remove localization term ${slug}?`)) {
      return;
    }
    try {
      setDraft(removeLocalizationTerm(draft, slug));
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

  return (
    <Section
      title="Localization"
      copy="Key/value translation matrix with typed placeholders, reusable rich terms, and generated Godot exports."
      actions={[
        <Button disabled={isLocalizationLoading || isSaveLocalizationLoading || errorCount > 0} key="save" onClick={onSave} type="button">
          {isSaveLocalizationLoading ? "Saving..." : "Save Localization"}
        </Button>
      ]}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_24rem] gap-4 max-[1180px]:grid-cols-1">
        <div className="min-w-0 space-y-4">
          <Section title="Languages">
            <div className="flex flex-wrap items-center gap-2">
              {draft.locales.map((locale) => (
                <Badge className="gap-2" key={locale} variant={locale === draft.defaultLocale ? "default" : "secondary"}>
                  {locale}
                  {locale !== draft.defaultLocale && (
                    <button className="text-xs" onClick={() => onRemoveLocale(locale)} type="button">
                      Remove
                    </button>
                  )}
                </Badge>
              ))}
              <Input className="h-8 w-28" onChange={(event) => setNewLocale(event.target.value)} value={newLocale} />
              <Button onClick={onAddLocale} size="sm" type="button" variant="secondary">
                Add Language
              </Button>
            </div>
          </Section>

          <Section title="Keys">
            <div className="mb-3 flex gap-2 max-[760px]:flex-col">
              <Input onChange={(event) => setNewKeyPath(event.target.value)} value={newKeyPath} />
              <Button className="shrink-0" onClick={onAddKey} type="button" variant="secondary">
                Add Key
              </Button>
            </div>
            <LocalizationMatrix
              document={draft}
              onChange={setDraft}
              onRemoveKey={onRemoveKey}
              onSelectKey={setSelectedKeyPath}
              selectedKeyPath={selectedKey?.path}
            />
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

          <Section title="Terms">
            <div className="mb-3 flex gap-2">
              <Input onChange={(event) => setNewTermSlug(event.target.value)} value={newTermSlug} />
              <Button onClick={onAddTerm} type="button" variant="secondary">
                Add
              </Button>
            </div>
            <TermEditor document={draft} onChange={setDraft} onRemoveTerm={onRemoveTerm} />
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

interface LocalizationMatrixProps {
  document: LocalizationDocument;
  onChange: (document: LocalizationDocument) => void;
  onRemoveKey: (path: string) => void;
  onSelectKey: (path: string) => void;
  selectedKeyPath?: string;
}

const LocalizationMatrix: FC<LocalizationMatrixProps> = (props) => {
  const { document, onChange, onRemoveKey, onSelectKey, selectedKeyPath } = props;

  function updateKey(index: number, nextKey: LocalizationKey): void {
    onChange({
      ...document,
      keys: document.keys.map((key, keyIndex) => (keyIndex === index ? nextKey : key))
    });
  }

  if (document.keys.length === 0) {
    return <p className="m-0 border border-dashed border-border p-6 text-sm text-muted-foreground">No localization keys.</p>;
  }

  return (
    <div className="space-y-3">
      {document.keys.map((key, index) => (
        <div
          className={key.path === selectedKeyPath ? "border border-primary bg-primary/10 p-3" : "border border-border p-3"}
          key={`${key.path}-${index}`}
        >
          <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Input
              className="font-mono text-xs"
              onChange={(event) => updateKey(index, { ...key, path: event.target.value })}
              onFocus={() => onSelectKey(key.path)}
              value={key.path}
            />
            <Button onClick={() => onRemoveKey(key.path)} size="sm" type="button" variant="ghost">
              Remove
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-4">
            {document.locales.map((locale) => (
              <label className="grid gap-1" key={locale}>
                <span className="font-mono text-xs uppercase text-muted-foreground">{locale}</span>
                <Textarea
                  className="min-h-20 resize-y text-sm"
                  onChange={(event) =>
                    updateKey(index, {
                      ...key,
                      values: {
                        ...key.values,
                        [locale]: event.target.value
                      }
                    })
                  }
                  onFocus={() => onSelectKey(key.path)}
                  value={key.values[locale] ?? ""}
                />
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
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
      {placeholders.length === 0 && analysis.iconSlugs.length === 0 && (
        <p className="m-0 text-sm text-muted-foreground">No typed placeholders or icons.</p>
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
            <code className="truncate text-xs">{`[icon:${iconSlug}]`}</code>
            <Badge variant={isUiIcon ? "outline" : "destructive"}>{asset?.category ?? "missing"}</Badge>
          </div>
        );
      })}
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

const TermEditor: FC<{
  document: LocalizationDocument;
  onChange: (document: LocalizationDocument) => void;
  onRemoveTerm: (slug: string) => void;
}> = (props) => {
  const { document, onChange, onRemoveTerm } = props;

  function updateTerm(index: number, term: LocalizationTerm): void {
    onChange({
      ...document,
      terms: document.terms.map((entry, entryIndex) => (entryIndex === index ? term : entry))
    });
  }

  if (document.terms.length === 0) {
    return <p className="m-0 text-sm text-muted-foreground">No rich terms.</p>;
  }

  return (
    <div className="space-y-2">
      {document.terms.map((term, index) => (
        <div className="space-y-2 border border-border p-2" key={`${term.slug}-${index}`}>
          <Input
            className="font-mono text-xs"
            onChange={(event) => updateTerm(index, { ...term, slug: event.target.value })}
            value={term.slug}
          />
          <Input
            onChange={(event) => updateTerm(index, { ...term, color: event.target.value || undefined })}
            placeholder="#65C7FF"
            value={term.color ?? ""}
          />
          <select
            className="h-9 w-full border border-input bg-background px-2 text-sm"
            onChange={(event) => updateTerm(index, { ...term, tooltipKey: event.target.value.length > 0 ? event.target.value : undefined })}
            value={term.tooltipKey ?? ""}
          >
            <option value="">No tooltip key</option>
            {document.keys.map((key) => (
              <option key={key.path} value={key.path}>
                {key.path}
              </option>
            ))}
          </select>
          <Button onClick={() => onRemoveTerm(term.slug)} size="sm" type="button" variant="ghost">
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
          <span key={`${part.label}-${index}`} style={part.color ? { color: part.color } : undefined} title={part.tooltip}>
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
  color?: string;
  iconAsset?: Asset;
  iconSlug?: string;
  label: ReactNode;
  tooltip?: string;
}

function previewParts(document: LocalizationDocument, keyEntry: LocalizationKey, assets: Asset[]): PreviewPart[] {
  const text = keyEntry.values[document.defaultLocale] ?? "";
  const parts: PreviewPart[] = [];
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const termsBySlug = new Map(document.terms.map((term) => [term.slug, term]));
  const keysByPath = new Map(document.keys.map((key) => [key.path, key]));
  const activeTerms: LocalizationTerm[] = [];
  const regex = /\[term:([A-Z][A-Z0-9_]*)\]|\[\/term\]|\[icon:([A-Z][A-Z0-9_]*)\]|\{(int|float|string):([a-z][a-z0-9_]*)\}/g;
  let cursor = 0;
  for (const match of text.matchAll(regex)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      appendPreviewPart(parts, text.slice(cursor, index), activeTerms, keysByPath, document.defaultLocale);
    }
    const token = match[0] ?? "";
    if (token.startsWith("[term:")) {
      const term = termsBySlug.get(match[1] ?? "");
      if (term) {
        activeTerms.push(term);
      }
    } else if (token === "[/term]") {
      activeTerms.pop();
    } else if (token.startsWith("[icon:")) {
      appendIconPreviewPart(parts, match[2] ?? "", activeTerms, keysByPath, document.defaultLocale, assetsById);
    } else {
      appendPreviewPart(
        parts,
        localizationPlaceholderDefaultText(match[3] as TranslationPlaceholderType),
        activeTerms,
        keysByPath,
        document.defaultLocale
      );
    }
    cursor = index + match[0].length;
  }
  if (cursor < text.length) {
    appendPreviewPart(parts, text.slice(cursor), activeTerms, keysByPath, document.defaultLocale);
  }
  return parts;
}

function appendIconPreviewPart(
  parts: PreviewPart[],
  iconSlug: string,
  activeTerms: LocalizationTerm[],
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
  const term = activeTerms[activeTerms.length - 1];
  const tooltipKey = term?.tooltipKey ? keysByPath.get(term.tooltipKey) : undefined;
  parts.push({
    iconAsset,
    iconSlug: label,
    label,
    color: term?.color,
    tooltip: tooltipKey?.values[defaultLocale]
  });
}

function assetPreviewPath(asset: Asset, projectPath: string): string {
  return asset.relativePath.startsWith("/") ? asset.relativePath : `${projectPath}/${asset.relativePath}`;
}

function appendPreviewPart(
  parts: PreviewPart[],
  label: string,
  activeTerms: LocalizationTerm[],
  keysByPath: Map<string, LocalizationKey>,
  defaultLocale: string
): void {
  if (label.length === 0) {
    return;
  }
  const term = activeTerms[activeTerms.length - 1];
  const tooltipKey = term?.tooltipKey ? keysByPath.get(term.tooltipKey) : undefined;
  parts.push({
    label,
    color: term?.color,
    tooltip: tooltipKey?.values[defaultLocale]
  });
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
