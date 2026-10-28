import type { LocalizationDocument, LocalizationKey } from "@/shared/localization"
import { createContext, type Dispatch, type SetStateAction } from "react"
export interface LocalizationContextValue {
  document: LocalizationDocument
  filteredKeyPath?: string
  selectedKey?: LocalizationKey
  selectedKeyPath?: string
  setDocument: Dispatch<SetStateAction<LocalizationDocument>>
  setFilteredKeyPath: Dispatch<SetStateAction<string | undefined>>
  setSelectedKeyPath: Dispatch<SetStateAction<string | undefined>>
  toggleKeyFilter: (path: string) => void
}
export const LocalizationContext = createContext<LocalizationContextValue | undefined>(undefined)
