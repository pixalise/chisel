import { FC, useState } from "react";
import useListAssetsQuery from "@/hooks/use-list-assets-query";
import { Asset } from "../../../../shared/schemas";
import { Nullish } from "../../../../shared/nullish";
import { isNil } from "lodash";
import AssetTable from "@/screens/main-stack/asset-library-screen/asset-table/asset-table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Section } from "@/components/layout/section";
import { AssetPreview } from "@/screens/main-stack/asset-library-screen/asset-table/asset-preview";
import AddAssetDialogButton from "@/components/asset-dialog/add-asset-dialog-button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export const AssetLibraryScreen: FC = () => {
  const { assets } = useListAssetsQuery();
  const [selectedAsset, setSelectedAsset] = useState<Nullish<Asset>>();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredAssets = assets.filter((asset) => {
    if (!normalizedQuery) {
      return true;
    }
    return (
      asset.name.toLowerCase().includes(normalizedQuery) ||
      asset.category.toLowerCase().includes(normalizedQuery) ||
      asset.relativePath.toLowerCase().includes(normalizedQuery) ||
      (asset.note ?? "").toLowerCase().includes(normalizedQuery)
    );
  });

  return (
    <section className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4">
      <div className="flex min-h-0 min-w-0 flex-1 gap-4 max-[1120px]:flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Section
            title="Asset Library"
            copy={`${filteredAssets.length} of ${assets.length} imported assets`}
            actions={[<AddAssetDialogButton key="import-asset" />]}
          >
            <div className="mb-3 flex items-center gap-2 border border-input bg-background px-2">
              <Search className="size-4 text-muted-foreground" />
              <Input
                className="border-0 px-0 shadow-none focus-visible:ring-0"
                placeholder="Search by name, category, path, or note"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <ScrollArea className="h-[calc(100vh-13rem)] min-h-72 border border-border">
              <AssetTable assets={filteredAssets} selectedAsset={selectedAsset} onSelectAsset={setSelectedAsset} />
            </ScrollArea>
          </Section>
        </div>
        {!isNil(selectedAsset) && (
          <div className="min-h-0 w-96 max-[1120px]:w-full">
            <Section title="Selected Asset" copy={selectedAsset.name}>
              <ScrollArea className="h-[calc(100vh-13rem)] min-h-80 border border-border">
                <div className="p-3">
                  <AssetPreview asset={selectedAsset} />
                </div>
              </ScrollArea>
            </Section>
          </div>
        )}
      </div>
    </section>
  );
};
