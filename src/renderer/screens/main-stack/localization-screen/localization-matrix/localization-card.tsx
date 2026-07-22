import { FC, useState } from "react";
import { validateLocalizationDocument, type LocalizationKey } from "../../../../../shared/localization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import useAppStore from "@/stores/app-store";
import { useLocalizationContext } from "@/screens/main-stack/localization-screen/localization-context";
import useListAssetsQuery from "@/hooks/use-list-assets-query";
import LocalizationValueTools from "@/screens/main-stack/localization-screen/localization-matrix/localization-value-tools";
import { useDebounce } from "@/hooks/use-debounce";
import { uniq } from "lodash";
import Loader from "@/components/loader";
import { SAFE_FREQUENCY } from "@/screens/main-stack/localization-screen/localization-screen";

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
  const { document } = useLocalizationContext();
  const { assets } = useListAssetsQuery();
  const project = useAppStore((state) => state._project);
  const problems = validateLocalizationDocument(document, assets);
  const { debounce } = useDebounce(SAFE_FREQUENCY * 1.2);
  const [isLoadingByLocale, setIsLoadingByLocale] = useState<string[]>([]);

  const onChangeText = (locale: string, updatedText: string) => {
    setIsLoadingByLocale((prev) => uniq([...prev, locale]));
    debounce(() => {
      onUpdateKey(index, {
        ...keyEntry,
        values: {
          ...keyEntry.values,
          [locale]: updatedText
        }
      });
      setIsLoadingByLocale((prev) => prev.filter((l) => l !== locale));
    });
  };

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
          <div className="grid gap-2" key={locale}>
            <div className="flex flex-row items-center justify-between">
              <div className="flex flex-row items-center space-x-2">
                {isLoadingByLocale.includes(locale) && <Loader className="h-4 w-4" />}
                <Badge variant="outline">{locale}</Badge>
              </div>

              <LocalizationValueTools
                assets={assets}
                document={document}
                keyEntry={keyEntry}
                keyIndex={index}
                locale={locale}
                problems={problems}
                projectPath={project?.path}
              />
            </div>
            <Textarea
              className="min-h-32 resize-y text-xs"
              onChange={(event) => onChangeText(locale, event.target.value)}
              onFocus={() => onSelectKey(keyEntry.path)}
              defaultValue={keyEntry.values[locale] ?? ""}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
export default LocalizationCard;
