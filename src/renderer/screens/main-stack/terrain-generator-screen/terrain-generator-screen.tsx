import { Section } from "@/components/layout/section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TerrainCandidateBatch } from "@/screens/main-stack/terrain-generator-screen/terrain-candidate-batch";
import { TerrainCompatibilityInspector } from "@/screens/main-stack/terrain-generator-screen/terrain-compatibility-inspector";
import { TerrainPieceEditor } from "@/screens/main-stack/terrain-generator-screen/terrain-piece-editor";
import { TerrainPiecePainter } from "@/screens/main-stack/terrain-generator-screen/terrain-piece-painter";
import { TerrainPieceSetEditor } from "@/screens/main-stack/terrain-generator-screen/terrain-piece-set-editor";
import { TerrainProblemList } from "@/screens/main-stack/terrain-generator-screen/terrain-problem-list";
import { TerrainSocketCatalog } from "@/screens/main-stack/terrain-generator-screen/terrain-socket-catalog";
import { TerrainTemplateEditor } from "@/screens/main-stack/terrain-generator-screen/terrain-template-editor";
import { TerrainTileCatalog } from "@/screens/main-stack/terrain-generator-screen/terrain-tile-catalog";
import terrainGeneratorService from "@/services/terrain-generator-service";
import { AlertTriangle, Save } from "lucide-react";
import { type FC, useEffect, useMemo, useState } from "react";
import type {
  TerrainApprovedAsset,
  TerrainPiece,
  TerrainSiteTemplate,
  TerrainTileRef,
  TerrainWorkspaceView
} from "../../../../shared/terrain-authoring";
import {
  compileTerrainPieceLibrary,
  generateTerrainCandidateBatch,
  inspectTerrainPieceCompatibility,
  type TerrainCandidateResult,
  type TerrainPieceCompatibility
} from "../../../../shared/terrain-wfc";

export const TerrainGeneratorScreen: FC = () => {
  const [workspace, setWorkspace] = useState<TerrainWorkspaceView>();
  const [selectedPieceSlug, setSelectedPieceSlug] = useState<string>();
  const [selectedTemplateSlug, setSelectedTemplateSlug] = useState<string>();
  const [selectedTile, setSelectedTile] = useState<TerrainTileRef>();
  const [compatibility, setCompatibility] = useState<TerrainPieceCompatibility>();
  const [candidateResults, setCandidateResults] = useState<TerrainCandidateResult[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const piece = useMemo(() => workspace?.pieces.find((entry) => entry.slug === selectedPieceSlug), [selectedPieceSlug, workspace?.pieces]);
  const template = useMemo(
    () => workspace?.templates.find((entry) => entry.slug === selectedTemplateSlug),
    [selectedTemplateSlug, workspace?.templates]
  );

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

  function mutateWorkspace(update: (current: TerrainWorkspaceView) => TerrainWorkspaceView): void {
    setWorkspace((current) => (current ? update(current) : current));
  }

  async function saveWorkspace(): Promise<void> {
    if (!workspace) return;
    setIsBusy(true);
    setError("");
    try {
      const saved = await terrainGeneratorService.save(workspace);
      setWorkspace(saved);
      setMessage(saved.problems.length === 0 ? "Saved socket-WFC authoring." : "Saved terrain authoring; validation problems remain.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsBusy(false);
    }
  }

  function updatePiece(next: TerrainPiece): void {
    if (!piece) return;
    const previousSlug = piece.slug;
    mutateWorkspace((current) => ({
      ...current,
      pieces: current.pieces.map((entry) => (entry.slug === previousSlug ? next : entry)),
      pieceSets: current.pieceSets.map((entry) => ({
        ...entry,
        pieceSlugs: entry.pieceSlugs.map((slug) => (slug === previousSlug ? next.slug : slug))
      })),
      adjacencyOverrides: current.adjacencyOverrides.map((entry) => ({
        ...entry,
        sourcePiece: entry.sourcePiece === previousSlug ? next.slug : entry.sourcePiece,
        targetPiece: entry.targetPiece === previousSlug ? next.slug : entry.targetPiece
      })),
      templates: current.templates.map((entry) => ({
        ...entry,
        stamps: entry.stamps.map((stamp) => ({ ...stamp, piece: stamp.piece === previousSlug ? next.slug : stamp.piece }))
      }))
    }));
    setSelectedPieceSlug(next.slug);
    setCompatibility(undefined);
    setCandidateResults([]);
  }

  function analyzePiece(): void {
    if (!workspace || !piece) return;
    setError("");
    try {
      const pieces = workspace.pieces.map((entry) => (entry.slug === piece.slug ? piece : entry));
      const containingSet = workspace.pieceSets.find((entry) => entry.pass === piece.pass && entry.pieceSlugs.includes(piece.slug));
      const inspectionSet = containingSet ?? {
        slug: "CURRENT_INSPECTION",
        label: "Current inspection",
        pass: piece.pass,
        pieceSlugs: pieces.filter((entry) => entry.pass === piece.pass).map((entry) => entry.slug),
        biomeTags: [],
        siteTags: []
      };
      const library = compileTerrainPieceLibrary(pieces, inspectionSet, workspace.adjacencyOverrides);
      setCompatibility(inspectTerrainPieceCompatibility(library, piece.slug));
    } catch (caught) {
      setCompatibility(undefined);
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  function generateBatch(source: TerrainSiteTemplate): void {
    if (!workspace) return;
    setError("");
    try {
      setCandidateResults(generateTerrainCandidateBatch(workspace, source, 1));
      setMessage(`Generated ${source.candidateCount} deterministic candidates for '${source.slug}'.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function approveAsset(asset: TerrainApprovedAsset): Promise<void> {
    if (!workspace) return;
    if (workspace.approvedAssets.some((entry) => entry.slug === asset.slug))
      throw new Error(`Approved asset '${asset.slug}' already exists`);
    const saved = await terrainGeneratorService.saveApprovedAssets([...workspace.approvedAssets, asset]);
    setWorkspace(saved);
    setMessage(`Frozen approved ${asset.kind.toLowerCase()} '${asset.slug}'.`);
  }

  async function deleteApprovedAsset(slug: string): Promise<void> {
    if (!workspace) return;
    const saved = await terrainGeneratorService.saveApprovedAssets(workspace.approvedAssets.filter((entry) => entry.slug !== slug));
    setWorkspace(saved);
    setMessage(`Removed approved asset '${slug}'.`);
  }

  return (
    <Section
      title="Terrain Generator"
      copy="Author explicit Wang-socket modules, solve base and cliff passes, validate candidate batches, and freeze geography worth keeping."
    >
      <div className="space-y-4">
        {error && (
          <Alert className="py-2" variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Terrain authoring error</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap text-xs">{error}</AlertDescription>
          </Alert>
        )}
        {message && !error && <p className="text-sm text-muted-foreground">{message}</p>}
        {workspace && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{workspace.tilesets.length} tilesets</Badge>
                <Badge variant="secondary">{workspace.sockets.length} sockets</Badge>
                <Badge variant="secondary">{workspace.pieces.length} pieces</Badge>
                <Badge variant="outline">{workspace.templates.length} templates</Badge>
                <Badge variant="outline">{workspace.approvedAssets.length} approved</Badge>
              </div>
              <Button disabled={isBusy} onClick={() => void saveWorkspace()} type="button">
                <Save className="size-4" /> Save authoring
              </Button>
            </div>
            {workspace.problems.length > 0 && <TerrainProblemList problems={workspace.problems} />}
            <TerrainSocketCatalog
              onChange={(sockets) =>
                mutateWorkspace((current) => {
                  const renamed =
                    current.sockets.length === sockets.length
                      ? current.sockets.find((entry, index) => sockets[index] && entry.slug !== sockets[index].slug)
                      : undefined;
                  const replacement = renamed ? sockets[current.sockets.indexOf(renamed)]?.slug : undefined;
                  return {
                    ...current,
                    sockets,
                    pieces:
                      renamed && replacement
                        ? current.pieces.map((entry) => ({
                            ...entry,
                            sockets: Object.fromEntries(
                              Object.entries(entry.sockets).map(([direction, profile]) => [
                                direction,
                                profile.map((socket) => (socket === renamed.slug ? replacement : socket))
                              ])
                            ) as TerrainPiece["sockets"]
                          }))
                        : current.pieces,
                    templates:
                      renamed && replacement
                        ? current.templates.map((entry) => ({
                            ...entry,
                            anchors: entry.anchors.map((anchor) => ({
                              ...anchor,
                              socket: anchor.socket === renamed.slug ? replacement : anchor.socket
                            }))
                          }))
                        : current.templates
                  };
                })
              }
              sockets={workspace.sockets}
            />
            <TerrainPieceEditor
              onAnalyze={analyzePiece}
              onChange={updatePiece}
              onCreate={(next) => {
                mutateWorkspace((current) => ({ ...current, pieces: [...current.pieces, next] }));
                setSelectedPieceSlug(next.slug);
              }}
              onDelete={() => {
                if (!piece) return;
                mutateWorkspace((current) => ({
                  ...current,
                  pieces: current.pieces.filter((entry) => entry.slug !== piece.slug),
                  pieceSets: current.pieceSets.map((entry) => ({
                    ...entry,
                    pieceSlugs: entry.pieceSlugs.filter((slug) => slug !== piece.slug)
                  })),
                  adjacencyOverrides: current.adjacencyOverrides.filter(
                    (entry) => entry.sourcePiece !== piece.slug && entry.targetPiece !== piece.slug
                  ),
                  templates: current.templates.map((entry) => ({
                    ...entry,
                    stamps: entry.stamps.filter((stamp) => stamp.piece !== piece.slug)
                  }))
                }));
                setSelectedPieceSlug(undefined);
                setCompatibility(undefined);
              }}
              onSelect={(slug) => {
                setSelectedPieceSlug(slug);
                setCompatibility(undefined);
              }}
              piece={piece}
              pieces={workspace.pieces}
              sockets={workspace.sockets}
            />
            {compatibility && <TerrainCompatibilityInspector compatibility={compatibility} sockets={workspace.sockets} />}
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(28rem,1fr)] xl:items-start">
              <TerrainPiecePainter
                onChange={updatePiece}
                piece={piece}
                selectedTile={selectedTile}
                sockets={workspace.sockets}
                tilesets={workspace.tilesets}
              />
              <TerrainTileCatalog
                onBindingsChange={(tileBindings) => mutateWorkspace((current) => ({ ...current, tileBindings }))}
                onSelectTile={setSelectedTile}
                selectedTile={selectedTile}
                workspace={workspace}
              />
            </div>
            <TerrainPieceSetEditor
              onOverridesChange={(adjacencyOverrides) => mutateWorkspace((current) => ({ ...current, adjacencyOverrides }))}
              onSetsChange={(pieceSets) =>
                mutateWorkspace((current) => {
                  const renamed =
                    current.pieceSets.length === pieceSets.length
                      ? current.pieceSets.find(
                          (entry, index) => pieceSets[index] && entry.slug !== pieceSets[index].slug && entry.pass === pieceSets[index].pass
                        )
                      : undefined;
                  const replacement = renamed ? pieceSets[current.pieceSets.indexOf(renamed)]?.slug : undefined;
                  return {
                    ...current,
                    pieceSets,
                    templates:
                      renamed && replacement
                        ? current.templates.map((entry) => ({
                            ...entry,
                            basePieceSet: entry.basePieceSet === renamed.slug ? replacement : entry.basePieceSet,
                            cliffPieceSet: entry.cliffPieceSet === renamed.slug ? replacement : entry.cliffPieceSet
                          }))
                        : current.templates
                  };
                })
              }
              overrides={workspace.adjacencyOverrides}
              pieces={workspace.pieces}
              sets={workspace.pieceSets}
            />
            <TerrainTemplateEditor
              onChange={(templates) =>
                mutateWorkspace((current) => {
                  const renamed =
                    current.templates.length === templates.length
                      ? current.templates.find((entry, index) => templates[index] && entry.slug !== templates[index].slug)
                      : undefined;
                  const replacement = renamed ? templates[current.templates.indexOf(renamed)]?.slug : undefined;
                  return {
                    ...current,
                    templates,
                    approvedAssets:
                      renamed && replacement
                        ? current.approvedAssets.map((entry) => ({
                            ...entry,
                            sourceTemplate: entry.sourceTemplate === renamed.slug ? replacement : entry.sourceTemplate
                          }))
                        : current.approvedAssets
                  };
                })
              }
              onGenerate={generateBatch}
              onSelect={setSelectedTemplateSlug}
              pieces={workspace.pieces}
              selectedTemplate={template}
              sets={workspace.pieceSets}
              sockets={workspace.sockets}
              templates={workspace.templates}
            />
            <TerrainCandidateBatch
              approvedAssets={workspace.approvedAssets}
              onApprove={approveAsset}
              onDeleteApproved={deleteApprovedAsset}
              results={candidateResults}
              tilesets={workspace.tilesets}
            />
          </>
        )}
      </div>
    </Section>
  );
};
