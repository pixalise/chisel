import { FC } from "react";
import { LocalizationKeyTreeNode } from "@/screens/main-stack/localization-screen/localization-key-tree/types";
import { isEmpty } from "lodash";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";

const LocalizationKeyTreeBranch: FC<{
  filteredKeyPath?: string;
  node: LocalizationKeyTreeNode;
  onToggleKeyFilter: (path: string) => void;
  selectedKeyPath?: string;
}> = (props) => {
  const { filteredKeyPath, node, onToggleKeyFilter, selectedKeyPath } = props;

  const isSelected = selectedKeyPath === node.path;

  if (isEmpty(node.children)) {
    return (
      <button
        className={cn(
          "w-full flex-shrink text-left text-xs font-mono text-muted-foreground flex flex-row items-center",
          isSelected && "text-foreground font-bold underline"
        )}
        onClick={() => node.key && onToggleKeyFilter(node.key.path)}
      >
        <span>{node.segment}</span>
        {isSelected && <ChevronLeft className="w-4 h-4" strokeWidth={3} />}
      </button>
    );
  }

  return (
    <details className="group" open>
      <summary className="cursor-pointer select-none px-2 py-1 font-mono text-xs text-muted-foreground">{node.segment}</summary>
      <div className="ml-3 border-l border-border pl-2 flex flex-col space-y-1">
        {node.children.map((child) => (
          <LocalizationKeyTreeBranch
            filteredKeyPath={filteredKeyPath}
            key={child.path}
            node={child}
            onToggleKeyFilter={onToggleKeyFilter}
            selectedKeyPath={selectedKeyPath}
          />
        ))}
      </div>
    </details>
  );
};
export default LocalizationKeyTreeBranch;
