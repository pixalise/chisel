import type { LocalizationDocument } from "@/shared/localization"
import { LocalizationContext, type LocalizationContextValue } from "@/types/localization-context"
import { type FC, type ReactNode, useEffect, useMemo, useRef, useState } from "react"
export interface LocalizationProviderProps {
  children: ReactNode
  sourceDocument: LocalizationDocument
}
const LocalizationProvider: FC<LocalizationProviderProps> = (props) => {
  const { children, sourceDocument } = props
  const [document, setDocument] = useState<LocalizationDocument>(sourceDocument)
  const [selectedKeyPath, setSelectedKeyPath] = useState<string | undefined>(
    sourceDocument.keys[0]?.path
  )
  const [filteredKeyPath, setFilteredKeyPath] = useState<string | undefined>(undefined)
  const sourceSignatureRef = useRef(JSON.stringify(sourceDocument))
  useEffect(() => {
    const signature = JSON.stringify(sourceDocument)
    if (signature === sourceSignatureRef.current) {
      return
    }
    const previousSignature = sourceSignatureRef.current
    sourceSignatureRef.current = signature
    if (JSON.stringify(document) !== previousSignature) {
      return
    }
    setDocument(sourceDocument)
    setSelectedKeyPath((current) => {
      if (current && sourceDocument.keys.some((key) => key.path === current)) {
        return current
      }
      return sourceDocument.keys[0]?.path
    })
    setFilteredKeyPath((current) => {
      if (current && sourceDocument.keys.some((key) => key.path === current)) {
        return current
      }
      return undefined
    })
  }, [document, sourceDocument])
  const selectedKey = document.keys.find((key) => key.path === selectedKeyPath) ?? document.keys[0]
  const value = useMemo<LocalizationContextValue>(
    () => ({
      document,
      filteredKeyPath,
      selectedKey,
      selectedKeyPath,
      setDocument,
      setFilteredKeyPath,
      setSelectedKeyPath,
      toggleKeyFilter: (path: string) => {
        setSelectedKeyPath(path)
        setFilteredKeyPath((current) => {
          if (current === path) {
            return undefined
          }
          return path
        })
      },
    }),
    [document, filteredKeyPath, selectedKey, selectedKeyPath]
  )
  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>
}

export default LocalizationProvider
