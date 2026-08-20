import { FC } from "react";
import { removeLocalizationTooltip, type LocalizationTooltip } from "../../../../../shared/localization";
import type { Asset } from "../../../../../shared/schemas";
import { AssetCategoryEnum } from "../../../../../shared/types";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocalizationContext } from "@/screens/main-stack/localization-screen/localization-context";

const noIconValue = "__NO_ICON__";

export interface TooltipEditorProps {
  assets: Asset[];
}

const TooltipEditor: FC<TooltipEditorProps> = (props) => {
  const { assets } = props;
  const { document, setDocument } = useLocalizationContext();
  const { toast } = useToast();
  const uiIconAssets = assets.filter((asset) => asset.category === AssetCategoryEnum.ui);

  function updateTooltip(index: number, tooltip: LocalizationTooltip): void {
    setDocument({
      ...document,
      tooltips: document.tooltips.map((entry, entryIndex) => (entryIndex === index ? tooltip : entry))
    });
  }

  function onRemoveTooltip(slug: string): void {
    if (!window.confirm(`Remove localization tooltip ${slug}?`)) {
      return;
    }

    try {
      setDocument(removeLocalizationTooltip(document, slug));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Localization edit failed",
        description: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (document.tooltips.length === 0) {
    return <p className="m-0 text-sm text-muted-foreground">No rich tooltips.</p>;
  }

  return (
    <div className="space-y-2">
      {document.tooltips.map((tooltip, index) => (
        <FieldGroup className="gap-3 border border-border p-2" key={index}>
          <Field>
            <FieldLabel>Slug</FieldLabel>
            <Input
              className="font-mono text-xs"
              onChange={(event) => updateTooltip(index, { ...tooltip, slug: event.target.value })}
              value={tooltip.slug}
            />
          </Field>
          <Field>
            <FieldLabel>Icon</FieldLabel>
            <Select
              onValueChange={(value) => updateTooltip(index, { ...tooltip, iconAssetId: value === noIconValue ? undefined : value })}
              value={tooltip.iconAssetId ?? noIconValue}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={noIconValue}>No icon</SelectItem>
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
            <Select onValueChange={(value) => updateTooltip(index, { ...tooltip, titleKey: value })} value={tooltip.titleKey}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
            <Select onValueChange={(value) => updateTooltip(index, { ...tooltip, descriptionKey: value })} value={tooltip.descriptionKey}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {document.keys.map((key) => (
                  <SelectItem key={key.path} value={key.path}>
                    {key.path}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button onClick={() => onRemoveTooltip(tooltip.slug)} size="sm" type="button" variant="ghost">
            Remove
          </Button>
        </FieldGroup>
      ))}
    </div>
  );
};
export default TooltipEditor;
