import { FC } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye, RectangleEllipsis, TriangleAlert } from "lucide-react";
import { isEmpty } from "lodash";
import {
  analyzeLocalizationText,
  type LocalizationDocument,
  type LocalizationKey,
  type LocalizationProblem
} from "../../../../../shared/localization";
import type { Asset } from "../../../../../shared/schemas";
import LocalizationPreviewContent from "@/screens/main-stack/localization-screen/preview/localization-preview-content";

export interface LocalizationValueToolsProps {
  assets: Asset[];
  document: LocalizationDocument;
  keyEntry: LocalizationKey;
  keyIndex: number;
  locale: string;
  problems: LocalizationProblem[];
  projectPath?: string;
}

const LocalizationValueTools: FC<LocalizationValueToolsProps> = (props) => {
  const { assets, document, keyEntry, keyIndex, locale, problems, projectPath } = props;
  const value = keyEntry.values[locale] ?? "";
  const analysis = analyzeLocalizationText(value, `keys.${keyIndex}.values.${locale}`);
  const tokenLabels = [
    ...analysis.placeholders.map((placeholder) => `{${placeholder.type}:${placeholder.name}}`),
    ...analysis.iconSlugs.map((slug) => `<icon:${slug}/>`),
    ...analysis.styleSlugs.map((slug) => `<style:${slug}>`),
    ...analysis.tooltipSlugs.map((slug) => `<tooltip:${slug}>`)
  ];
  const localeProblems = problems.filter((problem) => problem.path === `keys.${keyIndex}.values.${locale}`);

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex flex-row items-center space-x-2">
        <HoverCard closeDelay={180} openDelay={120}>
          <HoverCardTrigger asChild>
            <div className="rounded-full bg-muted p-1.5">
              <Eye className="h-5 w-5" />
            </div>
          </HoverCardTrigger>
          <HoverCardContent className="w-auto max-w-96 bg-popover text-popover-foreground">
            <div className="space-y-2">
              <code className="block truncate text-xs">{keyEntry.path}</code>
              <div className="text-sm leading-relaxed">
                <LocalizationPreviewContent
                  assets={assets}
                  document={document}
                  keyEntry={keyEntry}
                  locale={locale}
                  projectPath={projectPath}
                />
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>

        {!isEmpty(tokenLabels) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative rounded-full bg-muted p-1.5">
                <RectangleEllipsis className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-background px-1 text-[0.625rem] leading-none text-muted-foreground">
                  {tokenLabels.length}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-80 bg-popover text-popover-foreground">
              <div className="space-y-1">
                {tokenLabels.map((token, index) => (
                  <code className="block text-xs" key={`${token}-${index}`}>
                    {token}
                  </code>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {!isEmpty(localeProblems) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-full bg-destructive p-1.5 text-destructive-foreground">
                <TriangleAlert className="h-5 w-5" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-96 bg-destructive text-destructive-foreground">
              <div className="space-y-1">
                {localeProblems.map((problem) => (
                  <p className="m-0 text-xs" key={problem.message}>
                    {problem.message}
                  </p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
};
export default LocalizationValueTools;
