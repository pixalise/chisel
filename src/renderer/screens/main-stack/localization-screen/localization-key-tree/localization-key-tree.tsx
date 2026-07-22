import { FC, useMemo, useState } from "react";
import type { LocalizationDocument } from "../../../../../shared/localization";
import { Input } from "@/components/ui/input";
import LocalizationKeyTreeBranch from "@/screens/main-stack/localization-screen/localization-key-tree/localization-key-tree-branch";
import localizationTreeUtilities from "@/screens/main-stack/localization-screen/localization-key-tree/localization-tree-utilities";
import { isEmpty } from "lodash";

export interface LocalizationKeyTreeProps {
  document: LocalizationDocument;
  filteredKeyPath?: string;
  onToggleKeyFilter: (path: string) => void;
  selectedKeyPath?: string;
}

const LocalizationKeyTree: FC<LocalizationKeyTreeProps> = (props) => {
  const { document, filteredKeyPath, onToggleKeyFilter, selectedKeyPath } = props;
  const [search, setSearch] = useState("");
  const visibleKeys = useMemo(() => localizationTreeUtilities.filterLocalizationKeys(document.keys, search), [document.keys, search]);
  const tree = useMemo(() => localizationTreeUtilities.buildLocalizationKeyTree(visibleKeys), [visibleKeys]);

  if (isEmpty(document.keys)) {
    return <p className="m-0 border border-dashed border-border p-3 text-sm text-muted-foreground">No key tree.</p>;
  }

  return (
    <div className="max-h-[32rem] overflow-auto border border-border p-2">
      <div className="mb-2 grid gap-2">
        <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Tree</div>
        <Input
          className="h-8 font-mono text-xs"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search keys"
          value={search}
        />
      </div>
      <div className="space-y-1">
        {!isEmpty(tree.children) &&
          tree.children.map((node) => (
            <LocalizationKeyTreeBranch
              filteredKeyPath={filteredKeyPath}
              key={node.path}
              node={node}
              onToggleKeyFilter={onToggleKeyFilter}
              selectedKeyPath={selectedKeyPath}
            />
          ))}
        {isEmpty(tree.children) && <p className="m-0 p-2 text-xs text-muted-foreground">No matching keys.</p>}
      </div>
    </div>
  );
};
export default LocalizationKeyTree;
