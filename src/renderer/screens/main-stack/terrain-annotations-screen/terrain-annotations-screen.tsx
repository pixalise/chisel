import { Section } from "@/components/layout/section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TerrainApprovedLibrary } from "@/screens/main-stack/terrain-generator-screen/terrain-approved-library";
import terrainGeneratorService from "@/services/terrain-generator-service";
import { AlertTriangle, Save } from "lucide-react";
import { type FC, useEffect, useState } from "react";
import type { TerrainWorkspaceView } from "../../../../shared/terrain-authoring";

export const TerrainAnnotationsScreen: FC = () => {
  const [workspace, setWorkspace] = useState<TerrainWorkspaceView>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsBusy(true);
    terrainGeneratorService
      .load()
      .then((loaded) => {
        if (!cancelled) setWorkspace(loaded);
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

  async function saveApprovedTerrain(): Promise<void> {
    if (!workspace) return;
    setIsBusy(true);
    setError("");
    try {
      const saved = await terrainGeneratorService.save(workspace);
      setWorkspace(saved);
      setMessage("Saved approved terrain polish and annotations.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteApprovedAsset(slug: string): Promise<void> {
    if (!workspace) return;
    setIsBusy(true);
    setError("");
    try {
      const saved = await terrainGeneratorService.save({
        ...workspace,
        approvedAssets: workspace.approvedAssets.filter((entry) => entry.slug !== slug),
        spatialLayouts: workspace.spatialLayouts.filter((entry) => entry.sourceAsset !== slug)
      });
      setWorkspace(saved);
      setMessage(`Removed approved asset '${slug}' and its spatial annotations.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Section title="Terrain Annotations" copy="Polish approved geography, then author separate spatial meaning over the final terrain.">
      <div className="space-y-4">
        {error && (
          <Alert className="py-2" variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Terrain annotation error</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap text-xs">{error}</AlertDescription>
          </Alert>
        )}
        {message && !error && <p className="text-sm text-muted-foreground">{message}</p>}
        {workspace && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{workspace.approvedAssets.length} approved maps</Badge>
                <Badge variant="outline">
                  {workspace.approvedAssets.reduce((count, asset) => count + asset.cellOverrides.length, 0)} terrain overrides
                </Badge>
                <Badge variant="outline">{workspace.spatialLayouts.length} annotation layouts</Badge>
              </div>
              <Button disabled={isBusy} onClick={() => void saveApprovedTerrain()} type="button">
                <Save className="size-4" /> Save terrain work
              </Button>
            </div>
            <TerrainApprovedLibrary
              assets={workspace.approvedAssets}
              layouts={workspace.spatialLayouts}
              onAssetsChange={(approvedAssets) => setWorkspace((current) => (current ? { ...current, approvedAssets } : current))}
              onBindingsChange={(tileBindings) => setWorkspace((current) => (current ? { ...current, tileBindings } : current))}
              onDelete={deleteApprovedAsset}
              onLayoutsChange={(spatialLayouts) => setWorkspace((current) => (current ? { ...current, spatialLayouts } : current))}
              workspace={workspace}
            />
          </>
        )}
      </div>
    </Section>
  );
};
