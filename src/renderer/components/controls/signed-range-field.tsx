import { type CSSProperties, type FC } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface SignedRangeFieldProps {
  className?: string;
  id: string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
}

function signedRangeClamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function signedRangePercent(value: number, min: number, max: number): number {
  if (max <= min) {
    return 0;
  }
  return signedRangeClamp(((value - min) / (max - min)) * 100, 0, 100);
}

function signedRangeLabel(value: number): string {
  if (Math.abs(value) >= 10) {
    return value.toFixed(0);
  }
  return value.toFixed(2);
}

function signedRangeNumberFromInput(value: string, fallback: number): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

const SignedRangeField: FC<SignedRangeFieldProps> = (props) => {
  const { className, id, label, max, min, onChange, step, value } = props;
  const clampedValue = signedRangeClamp(value, min, max);
  const zeroPercent = signedRangePercent(0, min, max);
  const valuePercent = signedRangePercent(clampedValue, min, max);
  const fillStyle: CSSProperties =
    clampedValue >= 0
      ? {
          left: `${zeroPercent}%`,
          width: `${Math.max(0, valuePercent - zeroPercent)}%`
        }
      : {
          left: `${valuePercent}%`,
          width: `${Math.max(0, zeroPercent - valuePercent)}%`
        };

  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <Label className="text-xs text-muted-foreground" htmlFor={id}>
        {label}
      </Label>
      <div className="grid grid-cols-3 font-mono text-[0.6rem] uppercase text-muted-foreground">
        <span>{signedRangeLabel(min)}</span>
        <span className="text-center">0.00</span>
        <span className="text-right">{signedRangeLabel(max)}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <SliderPrimitive.Root
          className="relative flex h-5 min-w-0 flex-1 touch-none select-none items-center"
          id={id}
          max={max}
          min={min}
          step={step}
          value={[clampedValue]}
          onValueChange={(nextValue) => onChange(signedRangeClamp(nextValue[0] ?? 0, min, max))}
        >
          <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full border border-border bg-input">
            <div
              className={cn("absolute top-0 h-full rounded-full", clampedValue >= 0 ? "bg-primary" : "bg-destructive")}
              style={fillStyle}
            />
            <div className="absolute top-0 h-full w-px bg-foreground/60" style={{ left: `${zeroPercent}%` }} />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-background bg-foreground shadow-[0_0_0_1px_var(--border)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
        </SliderPrimitive.Root>
        <Input
          className="h-8 w-20 min-w-0"
          id={`${id}-value`}
          max={max}
          min={min}
          step={step}
          type="number"
          value={clampedValue}
          onChange={(event) => onChange(signedRangeClamp(signedRangeNumberFromInput(event.target.value, clampedValue), min, max))}
        />
      </div>
    </div>
  );
};

export default SignedRangeField;
