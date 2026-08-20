import { type FC } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import ControlledInput from "@/components/controls/controlled-input";
import { AssetCategoryEnum, assetCategoryOptionValues } from "../../../shared/types";
import ControlledSelectInput from "@/components/controls/controlled-select-input";
import ControlledSlugInput from "@/components/controls/controlled-slug-input";
import ControlledTextarea from "@/components/controls/controlled-textarea";
import { CreateOrUpdateAsset, createOrUpdateAssetSchema } from "../../../shared/schemas";

export interface AssetFormProps {
  defaultValues: CreateOrUpdateAsset;
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: (input: CreateOrUpdateAsset) => void;
}

const AssetForm: FC<AssetFormProps> = (props) => {
  const { defaultValues, disabled, onCancel, onSubmit } = props;
  const form = useForm<CreateOrUpdateAsset>({
    defaultValues,
    mode: "onChange",
    resolver: zodResolver(createOrUpdateAssetSchema)
  });
  const category = useWatch({ control: form.control, name: "category" });

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
        <ControlledSlugInput control={form.control} disabled={disabled} label="Slug" name="name" />
        <ControlledSelectInput
          control={form.control}
          disabled={disabled}
          label="Category"
          name="category"
          options={assetCategoryOptionValues}
        />
      </div>

      {category === AssetCategoryEnum.tileset && (
        <ControlledInput control={form.control} disabled={disabled} label="Tile size (px)" min={1} name="tileSize" type="number" />
      )}

      <ControlledTextarea
        control={form.control}
        disabled={disabled}
        label="Note"
        name="note"
        placeholder="Optional context, usage notes, import details..."
        rows={3}
      />

      <div className="flex flex-row items-center gap-2">
        <Button className="min-w-24" disabled={disabled} onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        <Button className="min-w-24" disabled={disabled} type="submit">
          Submit
        </Button>
      </div>
    </form>
  );
};

export default AssetForm;
