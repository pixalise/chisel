import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { type FC } from "react";

interface TerrainMapZoomControlProps {
  onChange: (zoom: number) => void;
  value: number;
}

export const terrainMapZoomDefault = 200;

export const TerrainMapZoomControl: FC<TerrainMapZoomControlProps> = (props) => {
  const { onChange, value } = props;

  return (
    <Label className="block w-56 space-y-2 text-xs">
      <span className="flex items-center justify-between gap-2">
        Map zoom
        <output className="font-mono text-muted-foreground">{value}%</output>
      </span>
      <Slider
        aria-label="Map zoom"
        max={400}
        min={100}
        onValueChange={(nextValue) => onChange(nextValue[0] ?? terrainMapZoomDefault)}
        rangeClassName="!rounded-full bg-primary/90"
        step={25}
        thumbClassName="h-4 w-4 !rounded-full border-2 border-background bg-primary shadow-[0_0_0_1px_var(--border)]"
        trackClassName="h-2 !rounded-full border border-border bg-input"
        value={[value]}
      />
    </Label>
  );
};
