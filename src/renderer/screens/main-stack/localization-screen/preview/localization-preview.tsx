import { FC } from "react";
import useAppStore from "@/stores/app-store";
import type { LocalizationDocument, LocalizationKey } from "../../../../../shared/localization";
import type { Asset } from "../../../../../shared/schemas";
import InlineIconPreview from "@/screens/main-stack/localization-screen/preview/inline-icon-preview";
import { previewParts, previewPartStyle } from "@/screens/main-stack/localization-screen/preview/localization-preview-utilities";

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
        {previewParts(document, keyEntry, assets).map((part, index) => (
          <span key={`${part.label}-${index}`} style={previewPartStyle(part)} title={part.tooltip}>
            {part.iconAsset && project ? (
              <InlineIconPreview asset={part.iconAsset} projectPath={project.path} title={part.tooltip ?? part.iconSlug} />
            ) : part.iconSlug ? (
              <span
                className="mx-1 inline-flex items-center border border-border px-1 font-mono text-[0.7rem] leading-5"
                title={part.tooltip ?? part.iconSlug}
              >
                {part.iconSlug}
              </span>
            ) : (
              part.label
            )}
          </span>
        ))}
      </div>
    </div>
  );
};
export default LocalizationPreview;
