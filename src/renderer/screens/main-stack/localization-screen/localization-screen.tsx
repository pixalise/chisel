import { type FC, useEffect, useMemo, useRef } from "react";
import Section from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import useListAssetsQuery from "@/hooks/use-list-assets-query";
import useLocalizationQuery from "@/hooks/use-localization-query";
import useSaveLocalizationMutation from "@/hooks/use-save-localization-mutation";
import { useToast } from "@/hooks/use-toast";
import {
  LocalizationProblemSeverity,
  analyzeLocalizationText,
  localizationPlaceholderDefaultText,
  localizationPlaceholdersForKey,
  placeholderToken,
  validateLocalizationDocument,
  type LocalizationDocument,
  type LocalizationKey,
  type LocalizationProblem
} from "../../../../shared/localization";
import type { Asset } from "../../../../shared/schemas";
import { AssetCategoryEnum } from "../../../../shared/types";
import LocalizationKeyTree from "@/screens/main-stack/localization-screen/localization-key-tree/localization-key-tree";
import LocalizationKeySection from "@/screens/main-stack/localization-screen/localization-key-section";
import LocalizationMatrix from "@/screens/main-stack/localization-screen/localization-matrix/localization-matrix";
import LanguagesSection from "@/screens/main-stack/localization-screen/languages-section/languages-section";
import { LocalizationProvider, useLocalizationContext } from "@/screens/main-stack/localization-screen/localization-context";
import TooltipEditor from "@/screens/main-stack/localization-screen/editors/tooltip-editor";
import StyleEditor from "@/screens/main-stack/localization-screen/editors/style-editor";
import TooltipCreateEditor from "@/screens/main-stack/localization-screen/editors/tooltip-create-editor";
import StyleCreateEditor from "@/screens/main-stack/localization-screen/editors/style-create-editor";
import LocalizationPreview from "@/screens/main-stack/localization-screen/preview/localization-preview";

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
            <StyleCreateEditor />
            <StyleEditor />
          </Section>

          <Section title="Tooltips">
            <TooltipCreateEditor assets={assets} />
            <TooltipEditor assets={assets} />
          </Section>

          <Section title="Preview">
            {selectedKey ? (
              <LocalizationPreview assets={assets} document={draft} keyEntry={selectedKey} />
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
