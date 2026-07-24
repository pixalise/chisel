import { type FC, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useToast } from "@/hooks/use-toast";
import { addLocalizationStyle } from "../../../../../shared/localization";
import { useLocalizationContext } from "@/screens/main-stack/localization-screen/localization-context";
import SlugInput from "@/components/controls/slug-input";

const StyleCreateEditor: FC = () => {
  const { document, setDocument } = useLocalizationContext();
  const { toast } = useToast();
  const [slug, setSlug] = useState("");

  function onAddStyle(): void {
    try {
      setDocument(addLocalizationStyle(document, { slug, bold: false, italic: false, underline: false }));
      setSlug("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Localization edit failed",
        description: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return (
    <FieldGroup className="mb-3 gap-3">
      <Field>
        <FieldLabel>Slug</FieldLabel>
        <SlugInput onChange={(event) => setSlug(event.target.value)} placeholder="PHYSICAL_DAMAGE_STYLE" value={slug} />
      </Field>
      <Button onClick={onAddStyle} type="button" variant="secondary">
        Add Style
      </Button>
    </FieldGroup>
  );
};
export default StyleCreateEditor;
