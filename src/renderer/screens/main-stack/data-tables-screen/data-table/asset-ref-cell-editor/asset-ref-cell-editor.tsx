import { type FC, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import useListAssetsQuery from "@/hooks/use-list-assets-query";
import { cn } from "@/lib/utils";
import type { DataColumnDefinition } from "../../../../../../shared/schemas";

export interface AssetRefCellEditorProps {
  column: DataColumnDefinition;
  value: unknown;
  onCommit: (value: unknown) => void;
}

const AssetRefCellEditor: FC<AssetRefCellEditorProps> = (props) => {
  const { column, value, onCommit } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { assets } = useListAssetsQuery();
  const assetId = typeof value === "string" ? value : "";
  const selectedAsset = assets.find((asset) => asset.id === assetId);
  const filteredAssets = assets.filter((asset) => {
    if (column.assetCategory && asset.category !== column.assetCategory) {
      return false;
    }
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return true;
    }
    return (
      asset.name.toLowerCase().includes(normalizedQuery) ||
      asset.relativePath.toLowerCase().includes(normalizedQuery) ||
      (asset.note ?? "").toLowerCase().includes(normalizedQuery)
    );
  });

  return (
    <div className="flex min-w-56 items-center gap-1.5">
      <Button
        className="h-7 w-full justify-start px-2 font-mono text-[0.7rem]"
        onClick={() => setIsOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        {selectedAsset ? selectedAsset.name : "Choose asset"}
      </Button>
      {assetId && (
        <Button className="h-7 px-2" onClick={() => onCommit("")} size="sm" type="button" variant="ghost">
          Clear
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pick Asset</DialogTitle>
            <DialogDescription>
              {column.assetCategory
                ? `Showing ${column.assetCategory} assets for ${column.name}.`
                : `Showing all assets for ${column.name}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 border border-input bg-background px-2">
            <Search className="size-4 text-muted-foreground" />
            <Input
              className="border-0 px-0 shadow-none focus-visible:ring-0"
              placeholder="Search by name, path, or note"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <ScrollArea className="max-h-80 border border-border">
            <div className="divide-y divide-border">
              {filteredAssets.map((asset) => (
                <button
                  className={cn(
                    "flex w-full items-center justify-between gap-3 p-2 text-left hover:bg-muted",
                    asset.id === assetId && "bg-accent/35"
                  )}
                  key={asset.id}
                  onClick={() => {
                    onCommit(asset.id);
                    setIsOpen(false);
                  }}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{asset.name}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{asset.relativePath}</span>
                    {asset.note && <span className="block truncate text-xs text-muted-foreground">{asset.note}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="border border-border px-2 py-0.5 text-xs text-muted-foreground">{asset.category}</span>
                  </span>
                </button>
              ))}
              {filteredAssets.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No matching assets.</div>}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssetRefCellEditor;
