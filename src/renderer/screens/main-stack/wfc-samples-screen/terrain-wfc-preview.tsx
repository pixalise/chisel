import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Dices, Play, Trash2 } from "lucide-react";
import { type FC, useEffect, useRef, useState } from "react";
import { terrainApprovedPatchSchema, type TerrainApprovedPatch, type TerrainWorkspaceView } from "../../../../shared/terrain-authoring";
import {
  compileTerrainWfcLibrary,
  generateTerrainWfcSectorOutput,
  terrainWfcAdjacencyProblem,
  terrainWfcPatternSizes,
  terrainWfcSectorSizes,
  terrainWfcViablePatternIds,
  type TerrainWfcLibrary,
  type TerrainWfcOutput,
  type TerrainWfcPatternSize,
  type TerrainWfcSectorSize
} from "../../../../shared/terrain-wfc";
import { drawTerrainCell } from "./terrain-rendering";

interface TerrainWfcPreviewProps {
  isBusy: boolean;
  onApprove: (patch: TerrainApprovedPatch) => Promise<void>;
  onDeleteApproved: (slug: string) => Promise<void>;
  workspace: TerrainWorkspaceView;
}

const basePreviewCellSize = 48;
const previewZoomLevels = [25, 50, 75, 100, 150, 200] as const;
const samplingDescriptions: Record<TerrainWfcPatternSize, string> = {
  2: "Loose: matches 1-cell edges for maximum natural recombination.",
  3: "Balanced: matches 2-cell edges to preserve small clusters.",
  4: "Strict: matches 3-cell edges to preserve larger local shapes."
};

export const TerrainWfcPreview: FC<TerrainWfcPreviewProps> = (props) => {
  const { isBusy, onApprove, onDeleteApproved, workspace } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef(new Map<string, HTMLImageElement>());
  const knownSampleSlugsRef = useRef(new Set(workspace.samples.map((sample) => sample.slug)));
  const [width, setWidth] = useState(20);
  const [height, setHeight] = useState(20);
  const [seed, setSeed] = useState(1);
  const [patternSize, setPatternSize] = useState<TerrainWfcPatternSize>(terrainWfcPatternSizes[0]);
  const [sectorSize, setSectorSize] = useState<TerrainWfcSectorSize>(8);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [library, setLibrary] = useState<TerrainWfcLibrary>();
  const [output, setOutput] = useState<TerrainWfcOutput>();
  const [error, setError] = useState("");
  const [imageRevision, setImageRevision] = useState(0);
  const [patchSlug, setPatchSlug] = useState("PATCH_1");
  const [biome, setBiome] = useState("UNASSIGNED");
  const [category, setCategory] = useState("NATURE");
  const [weight, setWeight] = useState(1);
  const [selectedSampleSlugs, setSelectedSampleSlugs] = useState<string[]>(() => workspace.samples.map((sample) => sample.slug));
  const previewCellSize = Math.round((basePreviewCellSize * zoomPercent) / 100);

  useEffect(() => {
    const availableSlugs = workspace.samples.map((sample) => sample.slug);
    const availableSlugSet = new Set(availableSlugs);
    setSelectedSampleSlugs((current) => [
      ...current.filter((slug) => availableSlugSet.has(slug)),
      ...availableSlugs.filter((slug) => !knownSampleSlugsRef.current.has(slug))
    ]);
    knownSampleSlugsRef.current = availableSlugSet;
    setLibrary(undefined);
    setOutput(undefined);
    setError("");
  }, [workspace.samples]);

  useEffect(() => {
    imagesRef.current.clear();
    let cancelled = false;
    for (const tileset of workspace.tilesets) {
      const image = new Image();
      image.onload = () => {
        if (!cancelled) setImageRevision((value) => value + 1);
      };
      image.onerror = () => {
        if (!cancelled) setImageRevision((value) => value + 1);
      };
      image.src = window.electron.toAssetUrl(tileset.imagePath);
      imagesRef.current.set(tileset.id, image);
    }
    return () => {
      cancelled = true;
    };
  }, [workspace.tilesets]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !output) return;
    canvas.width = output.width * previewCellSize;
    canvas.height = output.height * previewCellSize;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#151515";
    context.fillRect(0, 0, canvas.width, canvas.height);
    output.cells.forEach((cell, index) =>
      drawTerrainCell(
        context,
        cell,
        workspace.tilesets,
        imagesRef.current,
        (index % output.width) * previewCellSize,
        Math.floor(index / output.width) * previewCellSize,
        previewCellSize
      )
    );
  }, [imageRevision, output, previewCellSize, workspace.tilesets]);

  function generate(nextSeed: number): void {
    setError("");
    setOutput(undefined);
    let compiled: TerrainWfcLibrary | undefined;
    try {
      if (width < patternSize || width > 64 || height < patternSize || height > 64) {
        throw new Error(`Preview dimensions must be between ${patternSize} and 64 cells`);
      }
      const selectedSamples = workspace.samples.filter((sample) => selectedSampleSlugs.includes(sample.slug));
      if (selectedSamples.length === 0) throw new Error("Select at least one contributing sample");
      compiled = compileTerrainWfcLibrary({ samples: selectedSamples, tileBindings: workspace.tileBindings }, { patternSize });
      setLibrary(compiled);
      const adjacencyProblem = terrainWfcAdjacencyProblem(compiled);
      if (adjacencyProblem) throw new Error(adjacencyProblem);
      setOutput(generateTerrainWfcSectorOutput(compiled, { width, height, sectorSize, seed: nextSeed }));
      setSeed(nextSeed);
    } catch (caught) {
      if (!compiled) setLibrary(undefined);
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  function selectSamples(slugs: string[]): void {
    setSelectedSampleSlugs(slugs);
    clearCandidate();
  }

  function toggleSample(slug: string, checked: boolean): void {
    setSelectedSampleSlugs((current) =>
      checked ? [...new Set([...current, slug])] : current.filter((selectedSlug) => selectedSlug !== slug)
    );
    clearCandidate();
  }

  function clearCandidate(): void {
    setLibrary(undefined);
    setOutput(undefined);
    setError("");
  }

  async function approve(): Promise<void> {
    if (!output) return;
    setError("");
    try {
      const patch = terrainApprovedPatchSchema.parse({
        slug: patchSlug,
        biome,
        category,
        weight,
        width: output.width,
        height: output.height,
        layerCount: output.cells[0]?.length ?? 1,
        cells: output.cells.map((stack) => stack.map((tile) => (tile ? { ...tile } : null)))
      });
      await onApprove(patch);
      let index = workspace.approvedPatches.length + 2;
      while (workspace.approvedPatches.some((entry) => entry.slug === `PATCH_${index}`)) index += 1;
      setPatchSlug(`PATCH_${index}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  const missingAdjacency = library
    ? (["north", "east", "south", "west"] as const).map((direction) => ({
        direction,
        count: library.patterns.filter((pattern) => library.adjacency[direction][pattern.id].length === 0).length
      }))
    : [];

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">WFC candidate approval</h3>
          <p className="text-xs text-muted-foreground">
            Generate independent logical sectors, then solve the gaps against their fixed interiors. Sprite variants are chosen only after
            the structure is complete.
          </p>
          <p className="text-xs text-muted-foreground">{samplingDescriptions[patternSize]}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-24 space-y-1">
            <Label className="text-xs" htmlFor="wfc-preview-pattern-size">
              Sampling
            </Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              id="wfc-preview-pattern-size"
              onChange={(event) => {
                setPatternSize(Number(event.target.value) as TerrainWfcPatternSize);
                clearCandidate();
              }}
              value={patternSize}
            >
              {terrainWfcPatternSizes.map((size) => (
                <option key={size} value={size}>
                  {size}×{size}
                </option>
              ))}
            </select>
          </div>
          <div className="w-20 space-y-1">
            <Label className="text-xs" htmlFor="wfc-preview-sector-size">
              Sector
            </Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              id="wfc-preview-sector-size"
              onChange={(event) => {
                setSectorSize(Number(event.target.value) as TerrainWfcSectorSize);
                clearCandidate();
              }}
              value={sectorSize}
            >
              {terrainWfcSectorSizes.map((size) => (
                <option key={size} value={size}>
                  {size}×{size}
                </option>
              ))}
            </select>
          </div>
          <div className="w-20 space-y-1">
            <Label className="text-xs" htmlFor="wfc-preview-width">
              Width
            </Label>
            <Input
              id="wfc-preview-width"
              max="64"
              min={patternSize}
              onChange={(event) => setWidth(Number(event.target.value))}
              type="number"
              value={width}
            />
          </div>
          <div className="w-20 space-y-1">
            <Label className="text-xs" htmlFor="wfc-preview-height">
              Height
            </Label>
            <Input
              id="wfc-preview-height"
              max="64"
              min={patternSize}
              onChange={(event) => setHeight(Number(event.target.value))}
              type="number"
              value={height}
            />
          </div>
          <div className="w-28 space-y-1">
            <Label className="text-xs" htmlFor="wfc-preview-seed">
              Seed
            </Label>
            <Input
              id="wfc-preview-seed"
              min="0"
              onChange={(event) => setSeed(Number(event.target.value) >>> 0)}
              type="number"
              value={seed}
            />
          </div>
          <div className="w-24 space-y-1">
            <Label className="text-xs" htmlFor="wfc-preview-zoom">
              Zoom
            </Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              id="wfc-preview-zoom"
              onChange={(event) => setZoomPercent(Number(event.target.value))}
              value={zoomPercent}
            >
              {previewZoomLevels.map((level) => (
                <option key={level} value={level}>
                  {level}%
                </option>
              ))}
            </select>
          </div>
          <Button disabled={selectedSampleSlugs.length === 0} onClick={() => generate(seed)} type="button">
            <Play className="size-4" />
            Generate
          </Button>
          <Button disabled={selectedSampleSlugs.length === 0} onClick={() => generate((seed + 1) >>> 0)} type="button" variant="outline">
            <Dices className="size-4" />
            Next seed
          </Button>
        </div>
      </div>
      {workspace.samples.length === 0 && (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Create and paint at least one sample to enable the compiler.
        </p>
      )}
      {workspace.samples.length > 0 && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-medium">Contributing samples</h4>
              <p className="text-xs text-muted-foreground">
                Only checked samples are compiled into this candidate. Each selected sample contributes normalized pattern weight.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {selectedSampleSlugs.length}/{workspace.samples.length} selected
              </span>
              <Button
                onClick={() => selectSamples(workspace.samples.map((sample) => sample.slug))}
                size="sm"
                type="button"
                variant="outline"
              >
                All
              </Button>
              <Button onClick={() => selectSamples([])} size="sm" type="button" variant="outline">
                None
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {workspace.samples.map((sample) => (
              <Label className="flex items-center gap-2 text-sm" key={sample.slug}>
                <Checkbox
                  checked={selectedSampleSlugs.includes(sample.slug)}
                  onCheckedChange={(checked) => toggleSample(sample.slug, checked === true)}
                />
                {sample.slug}
              </Label>
            ))}
          </div>
        </div>
      )}
      {error && <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
      {library && (
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>{library.patterns.length} unique patterns</span>
            <span>
              {library.patternSize}×{library.patternSize} sampling
            </span>
            <span>{terrainWfcViablePatternIds(library).size} globally viable</span>
            <span>{library.sampleSlugs.length} samples</span>
            {output && <span>{output.attempts} generation attempts</span>}
            {output && <span>{output.sectorCount} sectors</span>}
            {output && <span>{output.seamWidth}-cell stitched gaps</span>}
            {missingAdjacency.map((entry) => (
              <span className={entry.count > 0 ? "text-amber-500" : undefined} key={entry.direction}>
                {entry.direction[0].toUpperCase()}: {entry.count} dead ends
              </span>
            ))}
          </div>
          <details className="rounded border border-border px-2 py-1">
            <summary className="cursor-pointer">Pattern contribution by sample</summary>
            <div className="mt-1 grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
              {library.sampleSlugs.map((slug) => {
                const stats = library.sampleStats[slug];
                return (
                  <span className={stats.viablePatterns === 0 ? "text-amber-500" : undefined} key={slug}>
                    {slug}: {stats.viablePatterns}/{stats.uniquePatterns} viable ({stats.extractedOccurrences} extracted)
                  </span>
                );
              })}
            </div>
          </details>
        </div>
      )}
      {output && (
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">
              {zoomPercent}% · {previewCellSize}px cells. Use the zoom selector; the mouse wheel only scrolls the page.
            </p>
            <div className="max-w-full overflow-x-auto overflow-y-visible rounded-md border border-border bg-slate-950 p-2">
              <canvas className="block max-w-none [image-rendering:pixelated]" ref={canvasRef} />
            </div>
          </div>
          <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-[1fr_1fr_1fr_7rem_auto] md:items-end">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="approved-patch-slug">
                Patch slug
              </Label>
              <Input id="approved-patch-slug" onChange={(event) => setPatchSlug(normalizeSlug(event.target.value))} value={patchSlug} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="approved-patch-biome">
                Biome
              </Label>
              <Input id="approved-patch-biome" onChange={(event) => setBiome(normalizeSlug(event.target.value))} value={biome} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="approved-patch-category">
                Category
              </Label>
              <Input id="approved-patch-category" onChange={(event) => setCategory(normalizeSlug(event.target.value))} value={category} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="approved-patch-weight">
                Weight
              </Label>
              <Input
                id="approved-patch-weight"
                min="0"
                onChange={(event) => setWeight(Number(event.target.value))}
                type="number"
                value={weight}
              />
            </div>
            <Button disabled={isBusy} onClick={() => void approve()} type="button">
              <Check className="size-4" />
              Approve candidate
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium">Approved patches</h4>
          <span className="text-xs text-muted-foreground">{workspace.approvedPatches.length} exported</span>
        </div>
        {workspace.approvedPatches.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            Generate a candidate, inspect it, then approve it to include it in game data.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {workspace.approvedPatches.map((patch) => (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border p-2" key={patch.slug}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{patch.slug}</p>
                  <p className="text-xs text-muted-foreground">
                    {patch.biome} · {patch.category} · {patch.width}×{patch.height} · weight {patch.weight}
                  </p>
                </div>
                <Button
                  aria-label={`Delete ${patch.slug}`}
                  disabled={isBusy}
                  onClick={() => void onDeleteApproved(patch.slug)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function normalizeSlug(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+/, "");
}
