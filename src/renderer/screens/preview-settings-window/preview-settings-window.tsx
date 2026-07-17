import { type FC, useEffect, useMemo, useState } from "react";
import { debounce } from "lodash";
import RangeField from "@/components/controls/range-field";
import SignedRangeField from "@/components/controls/signed-range-field";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import previewService from "@/services/preview-service";
import type { GraphitePreviewSettingsConfig, GraphitePreviewSettingsState } from "../../../shared/types";

function channelToHex(value: number): string {
  const clamped = Math.min(255, Math.max(0, Math.round(value * 255)));
  return clamped.toString(16).padStart(2, "0");
}

function vec3ToHex(value: [number, number, number]): string {
  return `#${channelToHex(value[0])}${channelToHex(value[1])}${channelToHex(value[2])}`;
}

function hexToVec3(value: string, fallback: [number, number, number]): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(value);
  if (!match) {
    return fallback;
  }
  const parsed = Number.parseInt(match[1], 16);
  return [((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255];
}

const PreviewSettingsWindow: FC = () => {
  const [state, setState] = useState<GraphitePreviewSettingsState | null>(null);
  const debouncedUpdate = useMemo(
    () =>
      debounce(async (settings: GraphitePreviewSettingsConfig) => {
        const nextState = await previewService.updateSettings(settings);
        setState(nextState);
      }, 120),
    []
  );

  useEffect(() => {
    void previewService.getSettings().then(setState);
    const unsubscribe = window.electron.onGraphitePreviewEvent((event) => {
      setState((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          previewState: {
            ...current.previewState,
            message: event.message,
            running: event.running,
            status: event.status
          }
        };
      });
    });
    return () => {
      unsubscribe();
      debouncedUpdate.cancel();
    };
  }, [debouncedUpdate]);

  function updateSettings(updater: (settings: GraphitePreviewSettingsConfig) => GraphitePreviewSettingsConfig): void {
    setState((current) => {
      if (!current) {
        return current;
      }
      const nextSettings = updater(current.settings);
      void debouncedUpdate(nextSettings);
      return {
        ...current,
        settings: nextSettings
      };
    });
  }

  if (!state) {
    return (
      <main className="grid h-screen place-items-center bg-background p-6 text-sm text-muted-foreground">Loading preview settings...</main>
    );
  }

  const { hdriOptions, previewState, settings, settingsMode } = state;
  const showSeedAndBiomeControls = settingsMode !== "splat";

  return (
    <main className="h-screen overflow-y-auto bg-background p-5 pb-10 text-foreground">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Preview Settings Window</p>
          <h1 className="text-xl font-semibold">Graphite preview controls</h1>
          <p className="max-w-sm text-sm text-muted-foreground">Live settings for lighting, HDRI, and preview terrain scale.</p>
        </div>
        <Badge variant={previewState.running ? "default" : "secondary"}>{previewState.status}</Badge>
      </div>

      <div className="space-y-6">
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Environment</h2>
            <p className="text-xs text-muted-foreground">
              The selected HDRI is loaded by Graphite for preview reflections and ambient feel.
            </p>
          </div>
          <div className="grid gap-2">
            <Label className="text-xs text-muted-foreground">Preview HDRI</Label>
            <Select value={settings.hdriPath} onValueChange={(value) => updateSettings((current) => ({ ...current, hdriPath: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {hdriOptions.map((option) => (
                  <SelectItem key={option.id} value={option.path}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <RangeField
            id="hdri-intensity"
            label="HDRI intensity"
            max={8}
            min={0}
            step={0.01}
            value={settings.hdriIntensity}
            onChange={(value) => updateSettings((current) => ({ ...current, hdriIntensity: value }))}
          />
          <RangeField
            id="reflection-intensity"
            label="Reflection intensity"
            max={4}
            min={0}
            step={0.01}
            value={settings.reflectionIntensity}
            onChange={(value) => updateSettings((current) => ({ ...current, reflectionIntensity: value }))}
          />
        </section>

        <Separator />

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Ambient</h2>
            <p className="text-xs text-muted-foreground">Raises or lowers the broad non-directional fill light in the preview.</p>
          </div>
          <div className="grid gap-2">
            <Label className="text-xs text-muted-foreground">Ambient color</Label>
            <Input
              className="h-10 p-1"
              type="color"
              value={vec3ToHex(settings.ambientColor)}
              onChange={(event) =>
                updateSettings((current) => ({
                  ...current,
                  ambientColor: hexToVec3(event.target.value, current.ambientColor)
                }))
              }
            />
          </div>
          <RangeField
            id="ambient-intensity"
            label="Ambient intensity"
            max={8}
            min={0}
            step={0.01}
            value={settings.ambientIntensity}
            onChange={(value) => updateSettings((current) => ({ ...current, ambientIntensity: value }))}
          />
        </section>

        <Separator />

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Sun</h2>
            <p className="text-xs text-muted-foreground">Controls the single directional preview light used for material readability.</p>
          </div>
          <div className="grid gap-2">
            <Label className="text-xs text-muted-foreground">Sun color</Label>
            <Input
              className="h-10 p-1"
              type="color"
              value={vec3ToHex(settings.sunColor)}
              onChange={(event) =>
                updateSettings((current) => ({
                  ...current,
                  sunColor: hexToVec3(event.target.value, current.sunColor)
                }))
              }
            />
          </div>
          <RangeField
            id="sun-intensity"
            label="Sun intensity"
            max={16}
            min={0}
            step={0.01}
            value={settings.sunIntensity}
            onChange={(value) => updateSettings((current) => ({ ...current, sunIntensity: value }))}
          />
          <div className="grid gap-3">
            <SignedRangeField
              id="sun-direction-x"
              label="Sun direction X"
              max={1}
              min={-1}
              step={0.01}
              value={settings.sunDirection[0]}
              onChange={(value) =>
                updateSettings((current) => ({ ...current, sunDirection: [value, current.sunDirection[1], current.sunDirection[2]] }))
              }
            />
            <SignedRangeField
              id="sun-direction-y"
              label="Sun direction Y"
              max={1}
              min={-1}
              step={0.01}
              value={settings.sunDirection[1]}
              onChange={(value) =>
                updateSettings((current) => ({ ...current, sunDirection: [current.sunDirection[0], value, current.sunDirection[2]] }))
              }
            />
            <SignedRangeField
              id="sun-direction-z"
              label="Sun direction Z"
              max={1}
              min={-1}
              step={0.01}
              value={settings.sunDirection[2]}
              onChange={(value) =>
                updateSettings((current) => ({ ...current, sunDirection: [current.sunDirection[0], current.sunDirection[1], value] }))
              }
            />
          </div>
        </section>

        <Separator />

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Tone Mapping</h2>
            <p className="text-xs text-muted-foreground">Preview-only exposure and contrast for checking material response.</p>
          </div>
          <RangeField
            id="exposure"
            label="Exposure"
            max={8}
            min={0.05}
            step={0.01}
            value={settings.exposure}
            onChange={(value) => updateSettings((current) => ({ ...current, exposure: value }))}
          />
          <RangeField
            id="contrast"
            label="Contrast"
            max={4}
            min={0.25}
            step={0.01}
            value={settings.contrast}
            onChange={(value) => updateSettings((current) => ({ ...current, contrast: value }))}
          />
        </section>

        <Separator />

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Preview Terrain</h2>
            <p className="text-xs text-muted-foreground">Changes the preview terrain area without changing authored stamp or biome data.</p>
          </div>
          <RangeField
            id="chunk-count-x"
            label="Chunk count X"
            max={9}
            min={1}
            step={1}
            value={settings.chunkCount[0]}
            onChange={(value) => updateSettings((current) => ({ ...current, chunkCount: [Math.round(value), current.chunkCount[1]] }))}
          />
          <RangeField
            id="chunk-count-z"
            label="Chunk count Z"
            max={9}
            min={1}
            step={1}
            value={settings.chunkCount[1]}
            onChange={(value) => updateSettings((current) => ({ ...current, chunkCount: [current.chunkCount[0], Math.round(value)] }))}
          />
          <RangeField
            id="chunk-world-size"
            label="Chunk world size"
            max={512}
            min={2}
            step={1}
            value={settings.chunkWorldSize}
            onChange={(value) => updateSettings((current) => ({ ...current, chunkWorldSize: value }))}
          />
          {showSeedAndBiomeControls && (
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground" htmlFor="preview-seed">
                Seed
              </Label>
              <Input
                id="preview-seed"
                min={0}
                step={1}
                type="number"
                value={settings.seed}
                onChange={(event) =>
                  updateSettings((current) => ({
                    ...current,
                    seed: Math.max(0, Math.round(Number(event.target.value) || 0))
                  }))
                }
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default PreviewSettingsWindow;
