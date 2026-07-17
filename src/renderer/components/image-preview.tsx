import { type FC, useEffect, useState } from "react";
import { isNil } from "lodash";

export interface ImagePreviewProps {
  path?: string;
}

interface ConvertedPreview {
  path: string;
  source: string | null;
}

const ImagePreview: FC<ImagePreviewProps> = (props) => {
  const { path } = props;
  const [convertedPreview, setConvertedPreview] = useState<ConvertedPreview | null>(null);
  const isDataUrl = path?.startsWith("data:image/") ?? false;

  useEffect(() => {
    if (isNil(path) || isDataUrl) {
      return;
    }

    let cancelled = false;
    window.electron
      .createImageConversionPreview(path)
      .then((source) => {
        if (!cancelled) {
          setConvertedPreview({ path, source });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConvertedPreview({ path, source: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isDataUrl, path]);

  const convertedSource = convertedPreview && convertedPreview.path === path ? convertedPreview.source : undefined;
  const source = isDataUrl ? path : convertedSource;
  const status = convertedSource === null ? "Preview unavailable." : path ? "Loading preview..." : "No preview.";

  return (
    <div className="min-w-0 space-y-2">
      <code className="block truncate text-xs">{path}</code>
      <div className="grid min-h-28 place-items-center overflow-hidden bg-muted text-xs text-muted-foreground">
        {source && <img alt={path} className="object-contain" src={source} />}
        {!source && <span>{status}</span>}
      </div>
    </div>
  );
};

export default ImagePreview;
