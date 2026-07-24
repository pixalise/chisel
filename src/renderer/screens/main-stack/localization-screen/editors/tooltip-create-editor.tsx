import { type FC, useState } from "react";
import { addLocalizationTooltip } from "../../../../../shared/localization";
import type { Asset } from "../../../../../shared/schemas";
import { AssetCategoryEnum } from "../../../../../shared/types";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocalizationContext } from "@/screens/main-stack/localization-screen/localization-context";
import SlugInput from "@/components/controls/slug-input";

const emptySelectionValue = "__EMPTY__";

export interface TooltipCreateEditorProps {
  assets: Asset[];
}

const TooltipCreateEditor: FC<TooltipCreateEditorProps> = (props) => {
  const { assets } = props;
  const { document, selectedKey, setDocument } = useLocalizationContext();
  const { toast } = useToast();
  const [slug, setSlug] = useState("");
  const [iconAssetId, setIconAssetId] = useState("");
  const [titleKey, setTitleKey] = useState("");
  const [descriptionKey, setDescriptionKey] = useState("");
  const uiIconAssets = assets.filter((asset) => asset.category === AssetCategoryEnum.uiIcon);

  function onAddTooltip(): void {
    try {
      const fallbackKey = selectedKey?.path ?? document.keys[0]?.path ?? "TOOLTIP.NEW_TOOLTIP.DESCRIPTION";
      setDocument(
        addLocalizationTooltip(document, {
          slug,
          iconAssetId: iconAssetId || undefined,
          titleKey: titleKey || fallbackKey,
          descriptionKey: descriptionKey || fallbackKey
        })
      );
      setSlug("");
      setIconAssetId("");
      setTitleKey("");
      setDescriptionKey("");
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
        <SlugInput onChange={(event) => setSlug(event.target.value)} placeholder="PHYSICAL_DAMAGE_TYPE" value={slug} />
      </Field>
      <Field>
        <FieldLabel>Icon</FieldLabel>
        <Select
          onValueChange={(value) => setIconAssetId(value === emptySelectionValue ? "" : value)}
          value={iconAssetId || emptySelectionValue}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={emptySelectionValue}>No icon</SelectItem>
            {uiIconAssets.map((asset) => (
              <SelectItem key={asset.id} value={asset.id}>
                {asset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>Title key</FieldLabel>
        <Select onValueChange={(value) => setTitleKey(value === emptySelectionValue ? "" : value)} value={titleKey || emptySelectionValue}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={emptySelectionValue}>Title key</SelectItem>
            {document.keys.map((key) => (
              <SelectItem key={key.path} value={key.path}>
                {key.path}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>Description key</FieldLabel>
        <Select
          onValueChange={(value) => setDescriptionKey(value === emptySelectionValue ? "" : value)}
          value={descriptionKey || emptySelectionValue}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={emptySelectionValue}>Description key</SelectItem>
            {document.keys.map((key) => (
              <SelectItem key={key.path} value={key.path}>
                {key.path}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Button onClick={onAddTooltip} type="button" variant="secondary">
        Add Tooltip
      </Button>
    </FieldGroup>
  );
};
export default TooltipCreateEditor;
