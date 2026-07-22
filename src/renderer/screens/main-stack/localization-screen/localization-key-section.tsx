import { FC, useState } from "react";
import { Input } from "@/components/ui/input";
import { normalizeConstantCaseInput } from "../../../../shared/asset-paths";
import { Button } from "@/components/ui/button";
import { isEmpty, isNil } from "lodash";

export interface LocalizationKeyInputProps {
  onAddKey: (key: string) => void;
}

const LocalizationKeySection: FC<LocalizationKeyInputProps> = (props) => {
  const { onAddKey } = props;
  const [localizationKey, setLocalizationKey] = useState<string>();

  const onSubmitKey = () => {
    if (isNil(localizationKey) || isEmpty(localizationKey)) {
      return;
    }

    onAddKey(localizationKey);
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
