import { FC } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LoaderProps {
  className?: string;
}

const Loader: FC<LoaderProps> = (props) => <Loader2 className={cn("animate-spin w-6 h-6", props.className)} />;
export default Loader;
