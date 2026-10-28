import InlineIconPreview from "@/components/localization/preview/inline-icon-preview"
import {
  previewParts,
  previewPartStyle,
} from "@/components/localization/preview/localization-preview-utilities"
import type { PreviewPart } from "@/components/localization/preview/types"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type {
  LocalizationDocument,
  LocalizationKey,
  LocalizationTooltip,
} from "@/shared/localization"
import type { Asset } from "@/shared/schemas"
import type { FC } from "react"
import { Fragment } from "react"
export interface LocalizationPreviewContentProps {
  assets: Asset[]
  document: LocalizationDocument
  enableTooltips?: boolean
  keyEntry: LocalizationKey
  locale?: string
  projectPath?: string
}
const LocalizationPreviewContent: FC<LocalizationPreviewContentProps> = (props) => {
  const {
    assets,
    document,
    enableTooltips = true,
    keyEntry,
    locale = document.defaultLocale,
    projectPath,
  } = props
  return (
    <TooltipProvider delayDuration={120}>
      {previewParts(document, keyEntry, assets, locale).map((part, index) => (
        <LocalizationPreviewPart
          assets={assets}
          document={document}
          enableTooltips={enableTooltips}
          key={`${part.label}-${index}`}
          locale={locale}
          part={part}
          projectPath={projectPath}
        />
      ))}
    </TooltipProvider>
  )
}
interface LocalizationPreviewPartProps {
  assets: Asset[]
  document: LocalizationDocument
  enableTooltips: boolean
  locale: string
  part: PreviewPart
  projectPath?: string
}
const LocalizationPreviewPart: FC<LocalizationPreviewPartProps> = (props) => {
  const { assets, document, enableTooltips, locale, part, projectPath } = props
  if (part.lineBreak) {
    return <br />
  }
  const content = (
    <span style={previewPartStyle(part)}>
      {part.iconAsset && projectPath ? (
        <InlineIconPreview
          asset={part.iconAsset}
          projectPath={projectPath}
          title={part.tooltip?.slug ?? part.iconSlug}
        />
      ) : part.iconSlug ? (
        <span className="mx-1 inline-flex items-center border border-border px-1 font-mono text-[0.7rem] leading-5">
          {part.iconSlug}
        </span>
      ) : (
        part.label
      )}
    </span>
  )
  if (!enableTooltips || !part.tooltip) {
    return content
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent className="max-w-96 bg-popover text-popover-foreground">
        <LocalizationTooltipPreview
          assets={assets}
          document={document}
          locale={locale}
          projectPath={projectPath}
          tooltip={part.tooltip}
        />
      </TooltipContent>
    </Tooltip>
  )
}
interface LocalizationTooltipPreviewProps {
  assets: Asset[]
  document: LocalizationDocument
  locale: string
  projectPath?: string
  tooltip: LocalizationTooltip
}
const LocalizationTooltipPreview: FC<LocalizationTooltipPreviewProps> = (props) => {
  const { assets, document, locale, projectPath, tooltip } = props
  const tooltipPreviewKey =
    document.keys.find((key) => key.path === tooltip.descriptionKey) ??
    document.keys.find((key) => key.path === tooltip.titleKey)
  return (
    <div className="space-y-2">
      {tooltipPreviewKey ? (
        <Fragment>
          <code className="block truncate text-xs">{tooltipPreviewKey.path}</code>
          <div className="text-sm leading-relaxed">
            <LocalizationPreviewContent
              assets={assets}
              document={document}
              enableTooltips={false}
              keyEntry={tooltipPreviewKey}
              locale={locale}
              projectPath={projectPath}
            />
          </div>
        </Fragment>
      ) : (
        <span className="text-muted-foreground">{tooltip.slug}</span>
      )}
    </div>
  )
}
export default LocalizationPreviewContent
