import { type FC, useEffect, useMemo, useState } from "react";
import Section from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import useLocalizationQuery from "@/hooks/use-localization-query";
import useSaveLocalizationMutation from "@/hooks/use-save-localization-mutation";
import { useToast } from "@/hooks/use-toast";
import {
  LocalizationProblemSeverity,
  localizationDocumentSchema,
  validateLocalizationDocument,
  type LocalizationDocument,
  type LocalizationProblem
} from "../../../../shared/localization";

const LocalizationScreen: FC = () => {
  const { localization, isLocalizationLoading } = useLocalizationQuery();
  const { saveLocalization, isSaveLocalizationLoading } = useSaveLocalizationMutation();
  const { toast } = useToast();
  const [documentText, setDocumentText] = useState("");

  useEffect(() => {
    setDocumentText(JSON.stringify(localization, null, 2));
  }, [localization]);

  const parsedDocument = useMemo(() => parseLocalization(documentText), [documentText]);
  const problems = useMemo(() => {
    if (!parsedDocument.document) {
      return [];
    }
    return validateLocalizationDocument(parsedDocument.document);
  }, [parsedDocument.document]);
  const errorCount = problems.filter((problem) => problem.severity === LocalizationProblemSeverity.error).length;
  const warningCount = problems.filter((problem) => problem.severity === LocalizationProblemSeverity.warning).length;

  async function onSave(): Promise<void> {
    if (!parsedDocument.document) {
      toast({
        variant: "destructive",
        title: "Localization is invalid",
        description: parsedDocument.error ?? "Fix the JSON before saving."
      });
      return;
    }
    if (errorCount > 0) {
      toast({
        variant: "destructive",
        title: "Localization has blocking errors",
        description: problems.find((problem) => problem.severity === LocalizationProblemSeverity.error)?.message
      });
      return;
    }

    try {
      const saved = await saveLocalization(parsedDocument.document);
      setDocumentText(JSON.stringify(saved, null, 2));
      toast({
        title: "Localization saved",
        description: `${saved.translations.length} translations across ${saved.activeLocales.length} active locales.`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Localization save failed",
        description: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return (
    <Section
      title="Localization"
      copy="Chisel-only translation source data. Export uses the latest committed snapshot."
      actions={[
        <Button
          disabled={isLocalizationLoading || isSaveLocalizationLoading || !parsedDocument.document || errorCount > 0}
          key="save-localization"
          onClick={onSave}
          type="button"
        >
          {isSaveLocalizationLoading ? "Saving..." : "Save Localization"}
        </Button>
      ]}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_22rem] gap-4 max-[1120px]:grid-cols-1">
        <div className="min-w-0 space-y-3">
          <Textarea
            className="min-h-[32rem] resize-y font-mono text-xs leading-relaxed"
            disabled={isLocalizationLoading || isSaveLocalizationLoading}
            onChange={(event) => setDocumentText(event.target.value)}
            spellCheck={false}
            value={documentText}
          />
          {parsedDocument.error && <p className="m-0 text-sm text-destructive">{parsedDocument.error}</p>}
        </div>
        <div className="space-y-4">
          <Section title="Summary">
            <div className="space-y-2">
              <SummaryRow label="Locales" value={parsedDocument.document?.activeLocales.join(", ") ?? "-"} />
              <SummaryRow label="Translations" value={String(parsedDocument.document?.translations.length ?? 0)} />
              <div className="flex gap-2">
                <Badge variant={errorCount > 0 ? "destructive" : "outline"}>{errorCount} errors</Badge>
                <Badge variant={warningCount > 0 ? "secondary" : "outline"}>{warningCount} warnings</Badge>
              </div>
            </div>
          </Section>
          <Section title="Problems">
            <ProblemList parseError={parsedDocument.error} problems={problems} />
          </Section>
        </div>
      </div>
    </Section>
  );
};

interface ParsedLocalization {
  document?: LocalizationDocument;
  error?: string;
}

function parseLocalization(value: string): ParsedLocalization {
  try {
    const raw = JSON.parse(value) as unknown;
    const parsed = localizationDocumentSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Localization schema is invalid." };
    }
    return { document: parsed.data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

const SummaryRow: FC<{ label: string; value: string }> = (props) => {
  const { label, value } = props;
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 border-b border-border py-2 text-sm first:border-t">
      <span className="font-mono text-xs uppercase text-muted-foreground">{label}</span>
      <span className="truncate">{value}</span>
    </div>
  );
};

const ProblemList: FC<{ parseError?: string; problems: LocalizationProblem[] }> = (props) => {
  const { parseError, problems } = props;
  if (parseError) {
    return <p className="m-0 text-sm text-destructive">{parseError}</p>;
  }
  if (problems.length === 0) {
    return <p className="m-0 text-sm text-muted-foreground">No localization problems.</p>;
  }

  return (
    <div className="space-y-2">
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
