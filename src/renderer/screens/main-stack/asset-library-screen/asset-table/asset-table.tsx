import { FC } from "react";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Asset } from "../../../../../shared/schemas";
import { Nullish } from "../../../../../shared/nullish";
import AssetRow from "@/screens/main-stack/asset-library-screen/asset-table/asset-row";

export interface AssetTableProps {
  assets: Asset[];
  onSelectAsset: (asset: Nullish<Asset>) => void;
  selectedAsset?: Nullish<Asset>;
}

const AssetTable: FC<AssetTableProps> = (props) => {
  const { assets, onSelectAsset, selectedAsset } = props;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Path</TableHead>
          <TableHead>Note</TableHead>
          <TableHead className="text-right">Size</TableHead>
          <TableHead className="w-24 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => (
          <AssetRow
            key={asset.id}
            asset={asset}
            onSelect={() => onSelectAsset(asset)}
            isSelected={selectedAsset?.id === asset.id}
            onRemove={() => selectedAsset?.id === asset.id && onSelectAsset(undefined)}
          />
        ))}
      </TableBody>
    </Table>
  );
};
export default AssetTable;
