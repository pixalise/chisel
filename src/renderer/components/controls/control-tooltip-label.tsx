import { type FC } from "react";
import { HelpCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface ControlTooltipLabelProps {
  className?: string;
  htmlFor?: string;
  label: string;
  tooltip: string;
}

const ControlTooltipLabel: FC<ControlTooltipLabelProps> = (props) => {
  const { className, htmlFor, label, tooltip } = props;

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Label className={cn("min-w-0 text-xs text-muted-foreground", className)} htmlFor={htmlFor}>
        {label}
      </Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label={`${label} help`}
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            type="button"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-80 text-xs leading-relaxed">{tooltip}</TooltipContent>
      </Tooltip>
    </div>
  );
};

export default ControlTooltipLabel;
