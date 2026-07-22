import { FC } from "react";
import useAppStore from "@/stores/app-store";
import type { LocalizationDocument, LocalizationKey } from "../../../../../shared/localization";
import type { Asset } from "../../../../../shared/schemas";
import LocalizationPreviewContent from "@/screens/main-stack/localization-screen/preview/localization-preview-content";

export interface LocalizationPreviewProps {
  assets: Asset[];
  document: LocalizationDocument;
  keyEntry: LocalizationKey;
}

const LocalizationPreview: FC<LocalizationPreviewProps> = (props) => {
  const { assets, document, keyEntry } = props;
  const project = useAppStore((state) => state._project);
  return (
    <div className="space-y-2">
      <code className="block truncate text-xs">{keyEntry.path}</code>
      <div className="border border-border p-3 text-sm leading-relaxed">
        <LocalizationPreviewContent assets={assets} document={document} keyEntry={keyEntry} projectPath={project?.path} />
      </div>
    </div>
  );
};
export default LocalizationPreview;
