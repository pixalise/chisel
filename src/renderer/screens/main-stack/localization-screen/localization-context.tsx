import {
  createContext,
  type Dispatch,
  type FC,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { LocalizationDocument, LocalizationKey } from "../../../../shared/localization";

export interface LocalizationContextValue {
  document: LocalizationDocument;
  filteredKeyPath?: string;
  selectedKey?: LocalizationKey;
  selectedKeyPath?: string;
  setDocument: Dispatch<SetStateAction<LocalizationDocument>>;
  setFilteredKeyPath: Dispatch<SetStateAction<string | undefined>>;
  setSelectedKeyPath: Dispatch<SetStateAction<string | undefined>>;
  toggleKeyFilter: (path: string) => void;
}

export interface LocalizationProviderProps {
  children: ReactNode;
  sourceDocument: LocalizationDocument;
}

const LocalizationContext = createContext<LocalizationContextValue | undefined>(undefined);

export const LocalizationProvider: FC<LocalizationProviderProps> = (props) => {
  const { children, sourceDocument } = props;
  const [document, setDocument] = useState<LocalizationDocument>(sourceDocument);
  const [selectedKeyPath, setSelectedKeyPath] = useState<string | undefined>(sourceDocument.keys[0]?.path);
  const [filteredKeyPath, setFilteredKeyPath] = useState<string | undefined>(undefined);

  useEffect(() => {
    setDocument(sourceDocument);
    setSelectedKeyPath((current) =>
      current && sourceDocument.keys.some((key) => key.path === current) ? current : sourceDocument.keys[0]?.path
    );
    setFilteredKeyPath((current) => (current && sourceDocument.keys.some((key) => key.path === current) ? current : undefined));
  }, [sourceDocument]);

  const selectedKey = document.keys.find((key) => key.path === selectedKeyPath) ?? document.keys[0];

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
        setSelectedKeyPath(path);
        setFilteredKeyPath((current) => (current === path ? undefined : path));
      }
    }),
    [document, filteredKeyPath, selectedKey, selectedKeyPath]
  );

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
};

export function useLocalizationContext(): LocalizationContextValue {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error("useLocalizationContext must be used inside LocalizationProvider.");
  }
  return context;
}
