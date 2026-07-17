import { type FC } from "react";
import { Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assetCategoryOptionValues } from "../../../../../../shared/types";
import type { ColumnFieldEditorProps } from "./data-schema-column-editor.types";

const anyAssetCategoryValue = "__any_asset_category__";

const AssetRefCategoryFilterEditor: FC<ColumnFieldEditorProps> = (props) => {
  const { control, disabled, fieldPrefix } = props;

  return (
    <Controller
      control={control}
      name={`${fieldPrefix}.assetCategory`}
      render={({ field }) => (
        <div className="space-y-1.5">
          <Label>Asset picker category</Label>
          <Select
            disabled={disabled}
            value={typeof field.value === "string" ? field.value : anyAssetCategoryValue}
            onValueChange={(value) => field.onChange(value === anyAssetCategoryValue ? undefined : value)}
          >
            <SelectTrigger onBlur={field.onBlur}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={anyAssetCategoryValue}>Any asset category</SelectItem>
              {assetCategoryOptionValues.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    />
  );
};

export default AssetRefCategoryFilterEditor;
