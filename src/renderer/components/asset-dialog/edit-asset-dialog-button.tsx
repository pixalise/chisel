import { type FC, useState } from "react";
import { Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AssetForm from "@/components/asset-dialog/asset-form";
import useUpdateAssetMutation from "@/hooks/use-update-asset-mutation";
import type { Asset, CreateOrUpdateAsset } from "../../../shared/schemas";

export interface EditAssetDialogButtonProps {
  asset: Asset;
}

const EditAssetDialogButton: FC<EditAssetDialogButtonProps> = (props) => {
  const { asset } = props;
  const [isOpen, setIsOpen] = useState(false);
  const { updateAsset, isUpdateAssetLoading } = useUpdateAssetMutation(asset.id);

  const onUpdate = async (input: CreateOrUpdateAsset) => {
    await updateAsset({
      ...asset,
      category: input.category,
      name: input.name,
      note: input.note
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Button
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen(true);
        }}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Pencil className="size-4" />
        Edit
      </Button>

      <DialogContent className="max-w-3xl" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Edit {asset.name}
          </DialogTitle>
          <DialogDescription>Update asset metadata. Slug changes move the managed file and update asset references.</DialogDescription>
        </DialogHeader>
        {isOpen && (
          <AssetForm
            defaultValues={{
              extension: asset.extension,
              height: asset.height,
              name: asset.name,
              note: asset.note ?? "",
              sizeBytes: asset.sizeBytes,
              category: asset.category,
              width: asset.width
            }}
            disabled={isUpdateAssetLoading}
            onCancel={() => setIsOpen(false)}
            onSubmit={onUpdate}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditAssetDialogButton;
