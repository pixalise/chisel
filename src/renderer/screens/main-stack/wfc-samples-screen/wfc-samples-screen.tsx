import { Section } from "@/components/layout/section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TiledBoardCanvas } from "@/screens/main-stack/wfc-samples-screen/tiled-board-canvas";
import { TiledBoardImport } from "@/screens/main-stack/wfc-samples-screen/tiled-board-import";
import { TiledRoleEditor } from "@/screens/main-stack/wfc-samples-screen/tiled-role-editor";
import { TiledSampleInspector } from "@/screens/main-stack/wfc-samples-screen/tiled-sample-inspector";
import { TiledTileCatalog } from "@/screens/main-stack/wfc-samples-screen/tiled-tile-catalog";
import { TiledProblemList } from "@/screens/main-stack/wfc-samples-screen/tiled-problem-list";
import tiledSampleService from "@/services/tiled-sample-service";
import { AlertTriangle, RefreshCw, Save } from "lucide-react";
import { type FC, useEffect, useMemo, useState } from "react";
import type { TiledBoardView, TiledRole, TiledSample, TiledWorkspaceView } from "../../../../shared/tiled-samples";

export const WfcSamplesScreen: FC = () => {
  const [workspace, setWorkspace] = useState<TiledWorkspaceView>();
  const [selectedBoardId, setSelectedBoardId] = useState<string>();
  const [selectedSampleSlug, setSelectedSampleSlug] = useState<string>();
  const [roles, setRoles] = useState<TiledRole[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const board = useMemo(() => workspace?.boards.find((entry) => entry.id === selectedBoardId), [selectedBoardId, workspace]);
  const sample = board?.enrichment.samples.find((entry) => entry.slug === selectedSampleSlug);

  useEffect(() => {
    let cancelled = false;
    setIsBusy(true);
    tiledSampleService
      .load()
      .then((loaded) => {
        if (cancelled) return;
        setWorkspace(loaded);
        setRoles(loaded.config.roles);
        setSelectedBoardId(undefined);
        setSelectedSampleSlug(undefined);
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

  function replaceBoard(next: TiledBoardView): void {
    setWorkspace((current) =>
      current ? { ...current, boards: current.boards.map((entry) => (entry.id === next.id ? next : entry)) } : current
    );
  }

  function mutateBoard(update: (current: TiledBoardView) => TiledBoardView): void {
    if (!board) return;
    replaceBoard(update(board));
  }

  async function saveRoles(): Promise<void> {
    if (!workspace) return;
    setIsBusy(true);
    setError("");
    try {
      const loaded = await tiledSampleService.saveConfig({ ...workspace.config, roles });
      setWorkspace(loaded);
      setMessage("Saved project tile roles.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsBusy(false);
    }
  }

  async function saveBoard(): Promise<void> {
    if (!board) return;
    setIsBusy(true);
    setError("");
    try {
      const saved = await tiledSampleService.saveEnrichment(board);
      replaceBoard(saved);
      setMessage(saved.problems.length === 0 ? "Saved enrichment metadata." : "Saved metadata; blocking validation problems remain.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsBusy(false);
    }
  }

  async function reloadBoard(): Promise<void> {
    if (!board) return;
    setIsBusy(true);
    setError("");
    try {
      const loaded = await tiledSampleService.reloadBoard(board.id);
      replaceBoard(loaded);
      setSelectedSampleSlug((current) => (loaded.enrichment.samples.some((entry) => entry.slug === current) ? current : undefined));
      setMessage(
        loaded.problems.length === 0
          ? "Reloaded the managed Tiled board."
          : "Reloaded; metadata was preserved and orphan problems are listed below."
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsBusy(false);
    }
  }

  function createSample(bounds: { x: number; y: number; width: number; height: number }): void {
    if (!board) return;
    let index = board.enrichment.samples.length + 1;
    while (board.enrichment.samples.some((entry) => entry.slug === `SAMPLE_${index}`)) index += 1;
    const next: TiledSample = {
      slug: `SAMPLE_${index}`,
      layerIds: board.layers.map((layer) => layer.id),
      ...bounds,
      allowRotations: false,
      allowReflections: false
    };
    mutateBoard((current) => ({ ...current, enrichment: { ...current.enrichment, samples: [...current.enrichment.samples, next] } }));
    setSelectedSampleSlug(next.slug);
  }

  function updateSample(next: TiledSample): void {
    if (!sample) return;
    const previousSlug = sample.slug;
    mutateBoard((current) => ({
      ...current,
      enrichment: {
        ...current.enrichment,
        samples: current.enrichment.samples.map((entry) => (entry.slug === previousSlug ? next : entry))
      }
    }));
    setSelectedSampleSlug(next.slug);
  }

  return (
    <Section
      title="WFC Samples"
      copy="Import Tiled sample boards, assign semantic tile metadata, and mark reusable regions for future terrain generation."
    >
      <div className="space-y-4">
        <TiledBoardImport
          disabled={isBusy}
          onError={setError}
          onImported={(loaded) => {
            setWorkspace(loaded);
            setRoles(loaded.config.roles);
            setSelectedBoardId(loaded.boards.at(-1)?.id);
            setMessage("Imported and validated a managed Tiled board.");
          }}
        />
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>WFC sample workspace error</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
          </Alert>
        )}
        {message && !error && <p className="text-sm text-muted-foreground">{message}</p>}
        <TiledRoleEditor disabled={isBusy} onChange={setRoles} onSave={() => void saveRoles()} roles={roles} />

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="wfc-board-selection">
            Board to edit
          </label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm md:max-w-md"
            disabled={isBusy || !workspace || workspace.boards.length === 0}
            id="wfc-board-selection"
            onChange={(event) => {
              setSelectedBoardId(event.target.value || undefined);
              setSelectedSampleSlug(undefined);
            }}
            value={selectedBoardId ?? ""}
          >
            <option value="">Choose a board to edit…</option>
            {workspace?.boards.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} ({entry.id})
              </option>
            ))}
          </select>
          {workspace && workspace.boards.length === 0 && (
            <p className="text-sm text-muted-foreground">No boards yet. Import a Tiled map above.</p>
          )}
        </div>

        {board && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{board.name}</h2>
                  <Badge variant="secondary">
                    {board.width}×{board.height}
                  </Badge>
                  <Badge variant="outline">
                    {board.tileWidth}×{board.tileHeight}px
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {board.layers.length} layers · {board.tilesets.length} external spritesheet tilesets
                </p>
              </div>
              <div className="flex gap-2">
                <Button disabled={isBusy} onClick={() => void reloadBoard()} type="button" variant="outline">
                  <RefreshCw className="size-4" />
                  Reload from managed files
                </Button>
                <Button disabled={isBusy} onClick={() => void saveBoard()} type="button">
                  <Save className="size-4" />
                  Save enrichment
                </Button>
              </div>
            </div>
            {board.problems.length > 0 && <TiledProblemList problems={board.problems} />}
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
              <TiledBoardCanvas
                board={board}
                onCreateBounds={createSample}
                onSelectSample={setSelectedSampleSlug}
                selectedSampleSlug={selectedSampleSlug}
              />
              <TiledSampleInspector
                board={board}
                onChange={updateSample}
                onDelete={() => {
                  mutateBoard((current) => ({
                    ...current,
                    enrichment: {
                      ...current.enrichment,
                      samples: current.enrichment.samples.filter((entry) => entry.slug !== sample?.slug)
                    }
                  }));
                  setSelectedSampleSlug(undefined);
                }}
                onSelect={setSelectedSampleSlug}
                sample={sample}
              />
            </div>
            <TiledTileCatalog
              board={board}
              onChange={(tileBindings) => mutateBoard((current) => ({ ...current, enrichment: { ...current.enrichment, tileBindings } }))}
              roles={roles}
            />
          </div>
        )}
      </div>
    </Section>
  );
};
