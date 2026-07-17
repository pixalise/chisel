import { type FC } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import ControlTooltipLabel from "@/components/controls/control-tooltip-label";
import { cn } from "@/lib/utils";

export interface RangeFieldProps {
  className?: string;
  id: string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  tooltip?: string;
  value: number;
}

function clampRangeValue(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function rangeFieldLabel(value: number): string {
  if (Math.abs(value) >= 10) {
    return value.toFixed(0);
  }
  return value.toFixed(2);
}

function rangeFieldNumberFromInput(value: string, fallback: number): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

const RangeField: FC<RangeFieldProps> = (props) => {
  const { className, id, label, max, min, onChange, step, tooltip, value } = props;
  const clampedValue = clampRangeValue(value, min, max);

  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      {tooltip && <ControlTooltipLabel htmlFor={id} label={label} tooltip={tooltip} />}
      {!tooltip && (
        <Label className="text-xs text-muted-foreground" htmlFor={id}>
          {label}
        </Label>
      )}
      <div className="flex items-center justify-between font-mono text-[0.6rem] uppercase text-muted-foreground">
        <span>min {rangeFieldLabel(min)}</span>
        <span>max {rangeFieldLabel(max)}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <Slider
          className="min-w-0 flex-1"
          id={id}
          max={max}
          min={min}
          rangeClassName="!rounded-full bg-primary/90"
          step={step}
          thumbClassName="h-4 w-4 !rounded-full border-2 border-background bg-primary shadow-[0_0_0_1px_var(--border)]"
          trackClassName="h-2 !rounded-full border border-border bg-input"
          value={[clampedValue]}
          onValueChange={(nextValue) => onChange(clampRangeValue(nextValue[0] ?? min, min, max))}
        />
        <Input
          className="h-8 w-20 min-w-0"
          id={`${id}-value`}
          max={max}
          min={min}
          step={step}
          type="number"
          value={clampedValue}
          onChange={(event) => onChange(clampRangeValue(rangeFieldNumberFromInput(event.target.value, clampedValue), min, max))}
        />
      </div>
    </div>
  );
};

export default RangeField;
