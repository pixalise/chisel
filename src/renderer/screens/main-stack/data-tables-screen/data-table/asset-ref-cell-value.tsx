import { type FC } from "react";
import { Badge } from "@/components/ui/badge";
import useListAssetsQuery from "@/hooks/use-list-assets-query";

export interface AssetRefCellValueProps {
  value: unknown;
}

const AssetRefCellValue: FC<AssetRefCellValueProps> = (props) => {
  const { value } = props;
  const { assets } = useListAssetsQuery();
  const assetId = typeof value === "string" ? value : "";
  const asset = assets.find((entry) => entry.id === assetId);

  if (!assetId) {
    return <span className="text-muted-foreground/65">-</span>;
  }

  if (asset) {
    return (
      <span className="flex items-center gap-1.5">
        <Badge variant="secondary">{asset.category}</Badge>
        <span className="font-mono text-xs">{asset.name}</span>
      </span>
    );
  }

  return <span className="font-mono text-xs text-muted-foreground">{assetId}</span>;
};

export default AssetRefCellValue;
