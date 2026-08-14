import { type FC, useEffect, useState } from "react";
import { isEmpty, isNil } from "lodash";
import Loader from "@/components/loader";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { File } from "lucide-react";

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setConvertedPreview(null);

    if (!path || isDataUrl) {
      return;
    }

    setIsLoading(true);

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

    setIsLoading(false);

    return () => {
      cancelled = true;
    };
  }, [isDataUrl, path]);

  const convertedSource = convertedPreview && convertedPreview.path === path ? convertedPreview.source : undefined;
  const source = isDataUrl ? path : convertedSource;

  return (
    <div className="min-w-0 h-full relative">
      {!isEmpty(path) && (
        <div className="absolute right-2 top-2">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-muted text-muted-foreground p-2 overflow-hidden hover:bg-primary hover:text-primary-foreground cursor-wait">
                  <File className="w-4 h-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <code>{path}</code>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
      <div className="grid place-items-center bg-muted text-xs text-muted-foreground">
        {source && <img onLoad={() => setIsLoading(false)} alt={path} className="object-contain" src={source} />}
        {!isNil(convertedSource) && isLoading && <Loader />}
        {isNil(convertedSource) && <span>No source.</span>}
      </div>
    </div>
  );
};

export default ImagePreview;
