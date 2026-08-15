import { Section } from "@/components/layout/section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TerrainProblemList } from "@/screens/main-stack/wfc-samples-screen/terrain-problem-list";
import { TerrainSampleInspector, type TerrainSampleCreation } from "@/screens/main-stack/wfc-samples-screen/terrain-sample-inspector";
import { TerrainSamplePainter } from "@/screens/main-stack/wfc-samples-screen/terrain-sample-painter";
import { TerrainTileCatalog } from "@/screens/main-stack/wfc-samples-screen/terrain-tile-catalog";
import { TerrainWfcPreview } from "@/screens/main-stack/wfc-samples-screen/terrain-wfc-preview";
import terrainSampleService from "@/services/terrain-sample-service";
import { AlertTriangle, Save } from "lucide-react";
import { type FC, useEffect, useMemo, useState } from "react";
import type { TerrainApprovedPatch, TerrainSample, TerrainTileRef, TerrainWorkspaceView } from "../../../../shared/terrain-authoring";

export const WfcSamplesScreen: FC = () => {
  const [workspace, setWorkspace] = useState<TerrainWorkspaceView>();
  const [selectedSampleSlug, setSelectedSampleSlug] = useState<string>();
  const [selectedTile, setSelectedTile] = useState<TerrainTileRef>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const sample = useMemo(
    () => workspace?.samples.find((entry) => entry.slug === selectedSampleSlug),
    [selectedSampleSlug, workspace?.samples]
  );

  useEffect(() => {
    let cancelled = false;
    setIsBusy(true);
    terrainSampleService
      .load()
      .then((loaded) => {
        if (cancelled) return;
        setWorkspace(loaded);
        setSelectedSampleSlug(undefined);
        setSelectedTile(undefined);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => {
        if (!cancelled) setIsBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function mutateWorkspace(update: (current: TerrainWorkspaceView) => TerrainWorkspaceView): void {
    setWorkspace((current) => (current ? update(current) : current));
  }

  async function saveWorkspace(): Promise<void> {
    if (!workspace) return;
    setIsBusy(true);
    setError("");
    try {
      const saved = await terrainSampleService.save(workspace);
      setWorkspace(saved);
      setSelectedSampleSlug((current) => (saved.samples.some((entry) => entry.slug === current) ? current : undefined));
      setMessage(
        saved.problems.length === 0
          ? "Saved terrain authoring and runtime tilesets."
          : "Saved terrain data; blocking validation problems remain."
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsBusy(false);
    }
  }

  async function approvePatch(patch: TerrainApprovedPatch): Promise<void> {
    if (!workspace) return;
    if (workspace.approvedPatches.some((entry) => entry.slug === patch.slug)) {
      throw new Error(`Approved patch '${patch.slug}' already exists`);
    }
    setIsBusy(true);
    setError("");
    try {
      await terrainSampleService.save(workspace);
      const saved = await terrainSampleService.saveApprovedPatches([...workspace.approvedPatches, patch]);
      setWorkspace(saved);
      setMessage(`Approved '${patch.slug}' for runtime export.`);
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteApprovedPatch(slug: string): Promise<void> {
    if (!workspace) return;
    setIsBusy(true);
    setError("");
    try {
      const nextPatches = workspace.approvedPatches.filter((entry) => entry.slug !== slug);
      const saved = await terrainSampleService.saveApprovedPatches(nextPatches);
      setWorkspace((current) => (current ? { ...current, approvedPatches: saved.approvedPatches } : saved));
      setMessage(`Removed approved patch '${slug}'.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsBusy(false);
    }
  }

  function createSample(creation: TerrainSampleCreation): void {
    if (!workspace) return;
    const { width, height, layerCount } = creation;
    let index = workspace.samples.length + 1;
    while (workspace.samples.some((entry) => entry.slug === `SAMPLE_${index}`)) index += 1;
    const next: TerrainSample = {
      slug: `SAMPLE_${index}`,
      width,
      height,
      layerCount,
      cells: Array.from({ length: width * height }, () => Array<TerrainTileRef | null>(layerCount).fill(null)),
      periodicInput: false,
      allowRotations: false,
      allowReflections: false
    };
    mutateWorkspace((current) => ({ ...current, samples: [...current.samples, next] }));
    setSelectedSampleSlug(next.slug);
  }

  function updateSample(next: TerrainSample): void {
    if (!sample) return;
    const previousSlug = sample.slug;
    mutateWorkspace((current) => ({
      ...current,
      samples: current.samples.map((entry) => (entry.slug === previousSlug ? next : entry))
    }));
    setSelectedSampleSlug(next.slug);
  }

  return (
    <Section
      title="WFC Samples"
      copy="Author training samples, generate terrain candidates, and approve only the patches shipped to the game."
    >
      <div className="space-y-4">
        {error && (
          <Alert className="py-2" variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Terrain workspace error</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap text-xs">{error}</AlertDescription>
          </Alert>
        )}
        {message && !error && <p className="text-sm text-muted-foreground">{message}</p>}
        {workspace && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{workspace.tilesets.length} tilesets</Badge>
                <Badge variant="secondary">{workspace.samples.length} samples</Badge>
                <Badge variant="outline">{Object.keys(workspace.tileBindings).length} tagged tiles</Badge>
              </div>
              <Button disabled={isBusy} onClick={() => void saveWorkspace()} type="button">
                <Save className="size-4" />
                Save authoring
              </Button>
            </div>
            {workspace.problems.length > 0 && <TerrainProblemList problems={workspace.problems} />}
            <TerrainSampleInspector
              onChange={updateSample}
              onCreate={createSample}
              onDelete={() => {
                mutateWorkspace((current) => ({
                  ...current,
                  samples: current.samples.filter((entry) => entry.slug !== sample?.slug)
                }));
                setSelectedSampleSlug(undefined);
              }}
              onSelect={setSelectedSampleSlug}
              sample={sample}
              samples={workspace.samples}
            />
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(28rem,1fr)] xl:items-start">
              <TerrainSamplePainter onChange={updateSample} sample={sample} selectedTile={selectedTile} tilesets={workspace.tilesets} />
              <TerrainTileCatalog
                onBindingsChange={(tileBindings) => mutateWorkspace((current) => ({ ...current, tileBindings }))}
                onSelectTile={setSelectedTile}
                selectedTile={selectedTile}
                workspace={workspace}
              />
            </div>
            <TerrainWfcPreview isBusy={isBusy} onApprove={approvePatch} onDeleteApproved={deleteApprovedPatch} workspace={workspace} />
          </>
        )}
      </div>
    </Section>
  );
};
