import { type ChangeEvent, type FC, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import assetService from "@/services/asset-service";
import CacheUtils from "@/utils/cache-utils";

interface ReplaceAssetSourceProps {
  assetId: string;
  disabled: boolean;
  onReplaced: () => void;
}

export const ReplaceAssetSource: FC<ReplaceAssetSourceProps> = (props) => {
  const { assetId, disabled, onReplaced } = props;
  const [sourcePath, setSourcePath] = useState("");
  const [message, setMessage] = useState("");
  const [isReplacing, setIsReplacing] = useState(false);

  function chooseSource(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    setSourcePath(file ? window.electron.getPathForFile(file) : "");
    setMessage("");
  }

  async function replaceSource(): Promise<void> {
    if (!sourcePath) {
      setMessage("Choose a replacement source file.");
      return;
    }
    setIsReplacing(true);
    setMessage("");
    try {
      await assetService.replaceAssetSource(assetId, sourcePath);
      await CacheUtils.invalidateQueries([[HookKeysEnum.listAssetsQuery]]);
      onReplaced();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsReplacing(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-md border border-border bg-card p-3">
      <div>
        <p className="text-sm font-semibold">Replace source image</p>
        <p className="text-xs text-muted-foreground">Keeps the stable asset slug and updates dimensions and file metadata.</p>
      </div>
      <div className="flex items-center gap-2">
        <Input accept="image/*" disabled={disabled || isReplacing} onChange={chooseSource} type="file" />
        <Button disabled={disabled || isReplacing || !sourcePath} onClick={replaceSource} type="button" variant="outline">
          <RefreshCw />
          Replace
        </Button>
      </div>
      {message && <p className="text-xs text-destructive">{message}</p>}
    </section>
  );
};
