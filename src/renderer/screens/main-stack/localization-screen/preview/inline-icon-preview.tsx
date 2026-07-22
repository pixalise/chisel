import { type FC, useEffect, useState } from "react";
import type { Asset } from "../../../../../shared/schemas";
import { assetPreviewPath } from "@/screens/main-stack/localization-screen/preview/localization-preview-utilities";

export interface InlineIconPreviewProps {
  asset: Asset;
  projectPath: string;
  title?: string;
}

const InlineIconPreview: FC<InlineIconPreviewProps> = (props) => {
  const { asset, projectPath, title } = props;
  const path = assetPreviewPath(asset, projectPath);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    window.electron
      .createImageConversionPreview(path)
      .then((nextSource) => {
        if (!cancelled) {
          setSource(nextSource);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSource("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!source) {
    return (
      <span
        className="mx-1 inline-flex items-center border border-border px-1 font-mono text-[0.7rem] leading-5"
        title={title ?? asset.name}
      >
        {asset.name}
      </span>
    );
  }

  return (
    <img alt={asset.name} className="mx-1 inline-block size-5 align-[-0.25rem] object-contain" src={source} title={title ?? asset.name} />
  );
};
export default InlineIconPreview;
