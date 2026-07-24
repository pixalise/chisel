import type { LocalizationKey } from "../../../../../shared/localization";

export interface LocalizationKeyTreeNode {
  children: LocalizationKeyTreeNode[];
  key?: LocalizationKey;
  path: string;
  segment: string;
}
