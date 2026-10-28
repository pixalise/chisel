import type { LocalizationTooltip } from "@/shared/localization"
import type { Asset } from "@/shared/schemas"
import type { ReactNode } from "react"
export interface PreviewPart {
  bold?: boolean
  color?: string
  iconAsset?: Asset
  iconSlug?: string
  italic?: boolean
  label: ReactNode
  lineBreak?: boolean
  tooltip?: LocalizationTooltip
  underline?: boolean
}
