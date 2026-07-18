import { type FC, useState } from "react";
import { Archive } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AssetForm from "@/components/asset-dialog/asset-form";
import useCopyAssetFile from "@/hooks/use-copy-asset-file";
import { Nullish } from "../../../shared/nullish";
import { isNil } from "lodash";
import useAddAssetMutation from "@/hooks/use-add-asset-mutation";
import { AssetCategoryEnum, FileMetadata, isTerrainTextureExtension } from "../../../shared/types";
import fileService from "@/services/file-service";
import { CreateOrUpdateAsset } from "../../../shared/schemas";
import { normalizeSnakeCaseInput } from "../../../shared/asset-paths";

function categoryForFile(metadata: FileMetadata): AssetCategoryEnum {
  const extension = metadata.extension.toLowerCase();
  if (isTerrainTextureExtension(extension)) {
    return AssetCategoryEnum.terrainTexture;
  }

  if (metadata.isImage) {
    return AssetCategoryEnum.image;
  }

  if (["mp3", "ogg", "wav", "flac", "m4a"].includes(extension)) {
    return AssetCategoryEnum.audio;
  }
  if (["otf", "ttf", "woff", "woff2"].includes(extension)) {
    return AssetCategoryEnum.font;
  }
  if (["csv", "json", "jsonl", "tsv", "txt", "xml", "yaml", "yml"].includes(extension)) {
    return AssetCategoryEnum.data;
  }
  return AssetCategoryEnum.other;
}

const AddAssetDialogButton: FC = () => {
  const [fileMetadata, setFileMetadata] = useState<Nullish<FileMetadata>>();
  const { importAsset, isImportAssetLoading } = useCopyAssetFile();
  const { addAsset, isAddAssetLoading } = useAddAssetMutation();

  const onCopy = async (input: CreateOrUpdateAsset) => {
    const asset = await addAsset(input);
    await importAsset({ sourcePath: fileMetadata!.sourcePath!, asset });
    setFileMetadata(undefined);
  };

  const onSelectSourceFile = async () => {
    const source = await window.electron.openFileDialog();
    if (isNil(source)) {
      return;
    }
    const metadata = await fileService.getFileMetadata(source);
    setFileMetadata(metadata);
  };

  const isOpen = !isNil(fileMetadata);

  return (
    <Dialog open={isOpen} onOpenChange={(visible) => !visible && setFileMetadata(undefined)}>
      <Button key="import-asset" onClick={onSelectSourceFile} variant="secondary">
        Import Asset
      </Button>

      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Import Asset
          </DialogTitle>
          <DialogDescription>Copy a source file into the project managed asset library.</DialogDescription>
        </DialogHeader>
        {isOpen && (
          <AssetForm
            disabled={isImportAssetLoading || isAddAssetLoading}
            onCancel={() => setFileMetadata(undefined)}
            onSubmit={onCopy}
            defaultValues={{
              category: categoryForFile(fileMetadata),
              extension: fileMetadata.extension,
              height: fileMetadata.height ?? 0,
              name: normalizeSnakeCaseInput(fileMetadata.stem),
              note: "",
              sizeBytes: fileMetadata.sizeBytes,
              width: fileMetadata.width ?? 0
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddAssetDialogButton;
