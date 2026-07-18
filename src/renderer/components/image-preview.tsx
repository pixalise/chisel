import { type FC, useEffect, useState } from "react";
import { isNil } from "lodash";
import Loader from "@/components/loader";

export interface ImagePreviewProps {
  path?: string;
  preview?: "albedoHeight" | "normalRoughness";
}

interface ConvertedPreview {
  path: string;
  preview?: ImagePreviewProps["preview"];
  source: string | null;
}

const ImagePreview: FC<ImagePreviewProps> = (props) => {
  const { path, preview } = props;
  const [convertedPreview, setConvertedPreview] = useState<ConvertedPreview | null>(null);
  const isDataUrl = path?.startsWith("data:image/") ?? false;
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setConvertedPreview(null);

    if (!path || isDataUrl) {
      return;
    }

    setIsLoading(true);

    let cancelled = false;
    window.electron
      .createImageConversionPreview(path, preview)
      .then((source) => {
        if (!cancelled) {
          setConvertedPreview({ path, preview, source });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConvertedPreview({ path, preview, source: null });
        }
      });

    setIsLoading(false);

    return () => {
      cancelled = true;
    };
  }, [isDataUrl, path, preview]);

  const convertedSource =
    convertedPreview && convertedPreview.path === path && convertedPreview.preview === preview ? convertedPreview.source : undefined;
  const source = isDataUrl ? path : convertedSource;

  return (
    <div className="min-w-0 space-y-2">
      <code className="block truncate text-xs">{path}</code>
      <div className="grid min-h-28 place-items-center overflow-hidden bg-muted text-xs text-muted-foreground">
        {source && <img onLoad={() => setIsLoading(false)} alt={path} className="object-contain" src={source} />}
        {!isNil(convertedSource) && isLoading && <Loader />}
        {isNil(convertedSource) && <span>No source.</span>}
      </div>
    </div>
  );
};

export default ImagePreview;
