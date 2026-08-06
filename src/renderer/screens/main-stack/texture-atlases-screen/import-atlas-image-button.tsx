import { type FC, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import appStore from "@/stores/app-store";
import CacheUtils from "@/utils/cache-utils";
import { assetSlug } from "../../../../shared/asset-paths";
import type { Asset } from "../../../../shared/schemas";
import { AssetCategoryEnum } from "../../../../shared/types";

interface ImportAtlasImageButtonProps {
  disabled: boolean;
  onError: (message: string) => void;
  onImported: (asset: Asset) => void;
}

export const ImportAtlasImageButton: FC<ImportAtlasImageButtonProps> = (props) => {
  const { disabled, onError, onImported } = props;
  const [isImporting, setIsImporting] = useState(false);

  async function importImage(): Promise<void> {
    const sourcePath = await window.electron.openFileDialog({
      title: "Import atlas image",
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "tif", "tiff"] }]
    });
    if (!sourcePath) {
      return;
    }

    setIsImporting(true);
    try {
      const metadata = await window.electron.getFileMetadata(sourcePath);
      if (!metadata.isImage) {
        throw new Error(`${metadata.fileName} is not an image`);
      }
      const asset = await window.electron.importAsset({
        projectPath: appStore.getState().computed.project.path,
        sourcePath,
        name: assetSlug(metadata.stem),
        category: AssetCategoryEnum.image
      });
      await CacheUtils.invalidateQueries([[HookKeysEnum.listAssetsQuery]]);
      onImported(asset);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Button disabled={disabled || isImporting} onClick={importImage} type="button" variant="secondary">
      <ImagePlus />
      {isImporting ? "Importing..." : "Import image"}
    </Button>
  );
};
