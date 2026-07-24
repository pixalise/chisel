import { FC } from "react";
import { LocalizationKey, removeLocalizationKey } from "../../../../../shared/localization";
import { isEmpty } from "lodash";
import LocalizationCard from "@/screens/main-stack/localization-screen/localization-matrix/localization-card";
import { useLocalizationContext } from "@/screens/main-stack/localization-screen/localization-context";

const LocalizationMatrix: FC = () => {
  const { document, filteredKeyPath, selectedKeyPath, setDocument, setFilteredKeyPath, setSelectedKeyPath } = useLocalizationContext();
  const filteredKeyExists = filteredKeyPath ? document.keys.some((key) => key.path === filteredKeyPath) : false;
  const visibleKeys = document.keys
    .map((key, index) => ({ index, key }))
    .filter((entry) => !filteredKeyPath || !filteredKeyExists || entry.key.path === filteredKeyPath);

  function updateKey(index: number, nextKey: LocalizationKey): void {
    setDocument({
      ...document,
      keys: document.keys.map((key, keyIndex) => (keyIndex === index ? nextKey : key))
    });
  }

  const onRemoveKey = (path: string): void => {
    if (!window.confirm(`Remove localization key ${path}?`)) {
      return;
    }
    const nextDocument = removeLocalizationKey(document, path);
    setDocument(nextDocument);
    setSelectedKeyPath(nextDocument.keys[0]?.path);
    setFilteredKeyPath((current) => (current === path ? undefined : current));
  };

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
          onSelectKey={setSelectedKeyPath}
          onUpdateKey={updateKey}
        />
      ))}
    </div>
  );
};
export default LocalizationMatrix;
