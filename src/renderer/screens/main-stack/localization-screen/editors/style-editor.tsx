import { FC } from "react";
import { removeLocalizationStyle, type LocalizationStyle } from "../../../../../shared/localization";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLocalizationContext } from "@/screens/main-stack/localization-screen/localization-context";

const StyleEditor: FC = () => {
  const { document, setDocument } = useLocalizationContext();
  const { toast } = useToast();

  function updateStyle(index: number, style: LocalizationStyle): void {
    setDocument({
      ...document,
      styles: document.styles.map((entry, entryIndex) => (entryIndex === index ? style : entry))
    });
  }

  function onRemoveStyle(slug: string): void {
    if (!window.confirm(`Remove localization style ${slug}?`)) {
      return;
    }

    try {
      setDocument(removeLocalizationStyle(document, slug));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Localization edit failed",
        description: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (document.styles.length === 0) {
    return <p className="m-0 text-sm text-muted-foreground">No rich styles.</p>;
  }

  return (
    <div className="space-y-2">
      {document.styles.map((style, index) => (
        <FieldGroup className="gap-3 border border-border p-2" key={index}>
          <Field>
            <FieldLabel>Slug</FieldLabel>
            <Input
              className="font-mono text-xs"
              onChange={(event) => updateStyle(index, { ...style, slug: event.target.value })}
              value={style.slug}
            />
          </Field>
          <Field>
            <FieldLabel>Color</FieldLabel>
            <Input
              onChange={(event) => updateStyle(index, { ...style, color: event.target.value || undefined })}
              placeholder="#65C7FF"
              value={style.color ?? ""}
            />
          </Field>
          <Field orientation="horizontal">
            <Checkbox checked={style.bold} onCheckedChange={(checked) => updateStyle(index, { ...style, bold: checked === true })} />
            <FieldLabel>Bold</FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <Checkbox checked={style.italic} onCheckedChange={(checked) => updateStyle(index, { ...style, italic: checked === true })} />
            <FieldLabel>Italic</FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <Checkbox
              checked={style.underline}
              onCheckedChange={(checked) => updateStyle(index, { ...style, underline: checked === true })}
            />
            <FieldLabel>Underline</FieldLabel>
          </Field>
          <Button onClick={() => onRemoveStyle(style.slug)} size="sm" type="button" variant="ghost">
            Remove
          </Button>
        </FieldGroup>
      ))}
    </div>
  );
};
export default StyleEditor;
