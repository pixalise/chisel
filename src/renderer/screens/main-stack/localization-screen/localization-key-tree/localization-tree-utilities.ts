import { LocalizationKey } from "../../../../../shared/localization";
import { LocalizationKeyTreeNode } from "@/screens/main-stack/localization-screen/localization-key-tree/types";

class LocalizationTreeUtilities {
  public filterLocalizationKeys(keys: LocalizationKey[], search: string): LocalizationKey[] {
    if (search.length === 0) {
      return keys;
    }
    const normalizedSearch = search.toUpperCase();
    return keys.filter((key) => key.path.includes(normalizedSearch));
  }

  public sortLocalizationKeyTree(node: LocalizationKeyTreeNode): void {
    node.children.sort((left, right) => left.segment.localeCompare(right.segment));
    for (const child of node.children) {
      this.sortLocalizationKeyTree(child);
    }
  }

  public buildLocalizationKeyTree(keys: LocalizationKey[]): LocalizationKeyTreeNode {
    const root: LocalizationKeyTreeNode = { children: [], path: "", segment: "root" };
    const childrenByPath = new Map<string, Map<string, LocalizationKeyTreeNode>>();

    function childrenFor(path: string, node: LocalizationKeyTreeNode): Map<string, LocalizationKeyTreeNode> {
      let children = childrenByPath.get(path);
      if (!children) {
        children = new Map(node.children.map((child) => [child.segment, child]));
        childrenByPath.set(path, children);
      }
      return children;
    }

    for (const key of keys) {
      let node = root;
      let path = "";
      for (const segment of key.path.split(".")) {
        const nextPath = path ? `${path}.${segment}` : segment;
        const children = childrenFor(path, node);
        let child = children.get(segment);
        if (!child) {
          child = { children: [], path: nextPath, segment };
          children.set(segment, child);
          node.children.push(child);
        }
        node = child;
        path = nextPath;
      }
      node.key = key;
    }

    this.sortLocalizationKeyTree(root);
    return root;
  }
}
const localizationTreeUtilities = new LocalizationTreeUtilities();
export default localizationTreeUtilities;
