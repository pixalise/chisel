import { FC } from "react";
import type { LocalizationKey } from "../../../../../shared/localization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface LocalizationCardProps {
  index: number;
  isSelected: boolean;
  keyEntry: LocalizationKey;
  locales: string[];
  onRemoveKey: (path: string) => void;
  onSelectKey: (path: string) => void;
  onUpdateKey: (index: number, nextKey: LocalizationKey) => void;
}

const LocalizationCard: FC<LocalizationCardProps> = (props) => {
  const { index, isSelected, keyEntry, locales, onRemoveKey, onSelectKey, onUpdateKey } = props;

  return (
    <div className={isSelected ? "border border-primary bg-primary/10 p-3" : "border border-border p-3"}>
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Input
          className="font-mono text-xs"
          onChange={(event) => onUpdateKey(index, { ...keyEntry, path: event.target.value })}
          onFocus={() => onSelectKey(keyEntry.path)}
          value={keyEntry.path}
        />
        <Button onClick={() => onRemoveKey(keyEntry.path)} size="sm" type="button" variant="ghost">
          Remove
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-4">
        {locales.map((locale) => (
          <label className="grid gap-1" key={locale}>
            <span className="font-mono text-xs uppercase text-muted-foreground">{locale}</span>
            <Textarea
              className="min-h-32 resize-y text-xs"
              onChange={(event) =>
                onUpdateKey(index, {
                  ...keyEntry,
                  values: {
                    ...keyEntry.values,
                    [locale]: event.target.value
                  }
                })
              }
              onFocus={() => onSelectKey(keyEntry.path)}
              value={keyEntry.values[locale] ?? ""}
            />
          </label>
        ))}
      </div>
    </div>
  );
};
export default LocalizationCard;
