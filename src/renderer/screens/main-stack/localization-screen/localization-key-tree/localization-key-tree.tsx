import { FC, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import LocalizationKeyTreeBranch from "@/screens/main-stack/localization-screen/localization-key-tree/localization-key-tree-branch";
import localizationTreeUtilities from "@/screens/main-stack/localization-screen/localization-key-tree/localization-tree-utilities";
import { isEmpty } from "lodash";
import { useLocalizationContext } from "@/screens/main-stack/localization-screen/localization-context";

const LocalizationKeyTree: FC = () => {
  const { document, filteredKeyPath, selectedKeyPath, toggleKeyFilter } = useLocalizationContext();
  const [search, setSearch] = useState("");
  const visibleKeys = useMemo(() => localizationTreeUtilities.filterLocalizationKeys(document.keys, search), [document.keys, search]);
  const tree = useMemo(() => localizationTreeUtilities.buildLocalizationKeyTree(visibleKeys), [visibleKeys]);

  if (isEmpty(document.keys)) {
    return <p className="m-0 border border-dashed border-border p-3 text-sm text-muted-foreground">No key tree.</p>;
  }

  return (
    <div className="sticky top-2 max-h-[48rem] border border-border p-2 overflow-hidden flex flex-col w-full items-start gap-2">
      <Input className="font-mono" onChange={(event) => setSearch(event.target.value)} placeholder="Search keys" value={search} />
      <div className="space-y-1 overflow-y-auto h-full w-full">
        {!isEmpty(tree.children) &&
          tree.children.map((node) => (
            <LocalizationKeyTreeBranch
              filteredKeyPath={filteredKeyPath}
              key={node.path}
              node={node}
              onToggleKeyFilter={toggleKeyFilter}
              selectedKeyPath={selectedKeyPath}
            />
          ))}
        {isEmpty(tree.children) && <p className="m-0 p-2 text-xs text-muted-foreground">No matching keys.</p>}
      </div>
    </div>
  );
};
export default LocalizationKeyTree;
