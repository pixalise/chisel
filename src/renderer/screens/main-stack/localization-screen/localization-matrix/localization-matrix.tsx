import { FC } from "react";
import type { LocalizationDocument, LocalizationKey } from "../../../../../shared/localization";
import { isEmpty } from "lodash";
import LocalizationCard from "@/screens/main-stack/localization-screen/localization-matrix/localization-card";

interface LocalizationMatrixProps {
  document: LocalizationDocument;
  filteredKeyPath?: string;
  onChange: (document: LocalizationDocument) => void;
  onRemoveKey: (path: string) => void;
  onSelectKey: (path: string) => void;
  selectedKeyPath?: string;
}

const LocalizationMatrix: FC<LocalizationMatrixProps> = (props) => {
  const { document, filteredKeyPath, onChange, onRemoveKey, onSelectKey, selectedKeyPath } = props;
  const filteredKeyExists = filteredKeyPath ? document.keys.some((key) => key.path === filteredKeyPath) : false;
  const visibleKeys = document.keys
    .map((key, index) => ({ index, key }))
    .filter((entry) => !filteredKeyPath || !filteredKeyExists || entry.key.path === filteredKeyPath);

  function updateKey(index: number, nextKey: LocalizationKey): void {
    onChange({
      ...document,
      keys: document.keys.map((key, keyIndex) => (keyIndex === index ? nextKey : key))
    });
  }

  if (isEmpty(document.keys)) {
    return <p className="m-0 border border-dashed border-border p-6 text-sm text-muted-foreground">No localization keys.</p>;
  }

  return (
    <div className="space-y-3">
      {visibleKeys.map(({ key, index }) => (
        <LocalizationCard
          index={index}
          isSelected={key.path === selectedKeyPath}
          key={index}
          keyEntry={key}
          locales={document.locales}
          onRemoveKey={onRemoveKey}
          onSelectKey={onSelectKey}
          onUpdateKey={updateKey}
        />
      ))}
    </div>
  );
};
export default LocalizationMatrix;
