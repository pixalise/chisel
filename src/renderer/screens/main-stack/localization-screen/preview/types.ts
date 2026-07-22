import type { ReactNode } from "react";
import type { LocalizationTooltip } from "../../../../../shared/localization";
import type { Asset } from "../../../../../shared/schemas";

export interface PreviewPart {
  bold?: boolean;
  color?: string;
  iconAsset?: Asset;
  iconSlug?: string;
  italic?: boolean;
  label: ReactNode;
  tooltip?: LocalizationTooltip;
  underline?: boolean;
}
