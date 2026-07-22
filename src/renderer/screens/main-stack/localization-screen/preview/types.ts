import type { ReactNode } from "react";
import type { Asset } from "../../../../../shared/schemas";

export interface PreviewPart {
  bold?: boolean;
  color?: string;
  iconAsset?: Asset;
  iconSlug?: string;
  italic?: boolean;
  label: ReactNode;
  tooltip?: string;
  underline?: boolean;
}
