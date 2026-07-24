import { FC, useState } from "react";
import Section from "@/components/layout/section";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addLocaleToLocalization, LocalizationDocument, removeLocaleFromLocalization } from "../../../../../shared/localization";
import { isEmpty, isNil } from "lodash";
import LanguageBadge from "@/screens/main-stack/localization-screen/languages-section/language-badge";

export interface LanguagesSectionProps {
  document: LocalizationDocument;
  onUpdateDocument: (updatedDocument: LocalizationDocument) => void;
}

const LanguagesSection: FC<LanguagesSectionProps> = (props) => {
  const { document, onUpdateDocument } = props;
  const [languageToAdd, setLanguageToAdd] = useState<string>("");

  const onAddLanguage = () => {
    if (isNil(languageToAdd) || isEmpty(languageToAdd)) {
      throw new Error("Could not add language.");
    }
    if (document.locales.includes(languageToAdd)) {
      throw new Error("Language is already on list.");
    }
    onUpdateDocument(addLocaleToLocalization(document, languageToAdd));
    setLanguageToAdd("");
  };

  const onRemoveLanguage = (languageToRemove: string) => {
    if (!window.confirm(`Remove locale ${languageToRemove} from every localization key?`)) {
      return;
    }
    onUpdateDocument(removeLocaleFromLocalization(document, languageToRemove));
  };

  return (
    <Section title="Languages">
      <div className="flex flex-wrap items-center gap-2">
        {document.locales.map((locale) => (
          <LanguageBadge
            isDefaultLanguage={locale === document.defaultLocale}
            language={locale}
            onRemoveLanguage={() => onRemoveLanguage(locale)}
          />
        ))}
        <Input
          className="h-8 w-28 px-2"
          onChange={(event) => setLanguageToAdd(event.target.value)}
          placeholder="de"
          value={languageToAdd}
        />
        <Button onClick={onAddLanguage} size="sm" type="button" variant="secondary" disabled={isEmpty(languageToAdd)}>
          Add Language
        </Button>
      </div>
    </Section>
  );
};
export default LanguagesSection;
