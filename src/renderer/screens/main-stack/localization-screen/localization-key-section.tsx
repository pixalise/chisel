import { FC, useState } from "react";
import { Input } from "@/components/ui/input";
import { normalizeConstantCaseInput } from "../../../../shared/asset-paths";
import { Button } from "@/components/ui/button";
import { isEmpty, isNil } from "lodash";
import { addLocalizationKey } from "../../../../shared/localization";
import { useLocalizationContext } from "@/screens/main-stack/localization-screen/localization-context";

const LocalizationKeySection: FC = () => {
  const { document, setDocument, setFilteredKeyPath, setSelectedKeyPath } = useLocalizationContext();
  const [localizationKey, setLocalizationKey] = useState<string>();

  const onSubmitKey = () => {
    if (isNil(localizationKey) || isEmpty(localizationKey)) {
      return;
    }

    const nextDocument = addLocalizationKey(document, {
      path: localizationKey,
      values: {
        [document.defaultLocale]: ""
      }
    });
    setDocument(nextDocument);
    setSelectedKeyPath(localizationKey);
    setFilteredKeyPath(localizationKey);
    setLocalizationKey(undefined);
  };

  return (
    <div className="mb-3 flex gap-2 max-[760px]:flex-col">
      <Input
        onChange={(event) => setLocalizationKey(normalizeConstantCaseInput(event.target.value))}
        value={localizationKey}
        placeholder="UNIT.NEW_ENTRY.DESCRIPTION"
      />
      <Button className="shrink-0" onClick={onSubmitKey} type="button" variant="secondary">
        Add Key
      </Button>
    </div>
  );
};
export default LocalizationKeySection;
