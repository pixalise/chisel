import { FC } from "react";
import { Asset } from "../../../../../shared/schemas";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import EditAssetDialogButton from "@/components/asset-dialog/edit-asset-dialog-button";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import useRemoveAssetMutation from "@/hooks/use-remove-asset-mutation";

export interface AssetRowProps {
  asset: Asset;
  isSelected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
}

const AssetRow: FC<AssetRowProps> = (props) => {
  const { asset, isSelected, onSelect } = props;
  const { id, relativePath, formattedBytes, category, name, note } = asset;
  const { removeAsset, isRemoveAssetLoading } = useRemoveAssetMutation(id);

  return (
    <TableRow className={cn("cursor-pointer", isSelected && "bg-muted")} onClick={onSelect}>
      <TableCell className="font-medium">{name}</TableCell>
      <TableCell>
        <Badge variant="secondary">{category}</Badge>
      </TableCell>
      <TableCell className="max-w-[24rem] truncate font-mono text-xs text-muted-foreground">{relativePath}</TableCell>
      <TableCell className="max-w-64 truncate text-xs text-muted-foreground">{note || "-"}</TableCell>
      <TableCell className="text-right font-mono text-xs text-muted-foreground">{formattedBytes}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <EditAssetDialogButton asset={asset} />
          <Button
            disabled={isRemoveAssetLoading}
            onClick={() => confirm(`Remove ${name} permanently?`) && removeAsset()}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};
export default AssetRow;
