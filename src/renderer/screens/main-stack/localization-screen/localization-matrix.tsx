import { FC } from "react";
import type { LocalizationDocument, LocalizationKey } from "../../../../shared/localization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

  if (document.keys.length === 0) {
    return <p className="m-0 border border-dashed border-border p-6 text-sm text-muted-foreground">No localization keys.</p>;
  }

  return (
    <div className="space-y-3">
      {visibleKeys.map(({ key, index }) => (
        <div className={key.path === selectedKeyPath ? "border border-primary bg-primary/10 p-3" : "border border-border p-3"} key={index}>
          <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Input
              className="font-mono text-xs"
              onChange={(event) => updateKey(index, { ...key, path: event.target.value })}
              onFocus={() => onSelectKey(key.path)}
              value={key.path}
            />
            <Button onClick={() => onRemoveKey(key.path)} size="sm" type="button" variant="ghost">
              Remove
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-4">
            {document.locales.map((locale) => (
              <label className="grid gap-1" key={locale}>
                <span className="font-mono text-xs uppercase text-muted-foreground">{locale}</span>
                <Textarea
                  className="min-h-20 resize-y text-sm"
                  onChange={(event) =>
                    updateKey(index, {
                      ...key,
                      values: {
                        ...key.values,
                        [locale]: event.target.value
                      }
                    })
                  }
                  onFocus={() => onSelectKey(key.path)}
                  value={key.values[locale] ?? ""}
                />
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
export default LocalizationMatrix;
