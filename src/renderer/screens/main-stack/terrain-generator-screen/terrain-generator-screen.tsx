import { Section } from "@/components/layout/section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RouteEnum } from "@/constants/route-enum";
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
import { AlertTriangle, Dices, Layers3, Library, Save, Tags } from "lucide-react";
import { type FC, useEffect, useState } from "react";
import { useNavigate } from "react-router";
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

type TerrainPage = "catalog" | "pieces" | "collections" | "generate";

function randomTerrainSeed(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0];
}

export const TerrainGeneratorScreen: FC = () => {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<TerrainWorkspaceView>();
  const [activePage, setActivePage] = useState<TerrainPage>("catalog");
  const [selectedPieceIndex, setSelectedPieceIndex] = useState<number>();
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number>();
  const [selectedTile, setSelectedTile] = useState<TerrainTileRef>();
  const [compatibility, setCompatibility] = useState<TerrainPieceCompatibility>();
  const [candidateResults, setCandidateResults] = useState<TerrainCandidateResult[]>([]);
  const [generatedTemplateSlug, setGeneratedTemplateSlug] = useState<string>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const piece = typeof selectedPieceIndex === "number" ? workspace?.pieces[selectedPieceIndex] : undefined;
  const template = typeof selectedTemplateIndex === "number" ? workspace?.templates[selectedTemplateIndex] : undefined;
  useEffect(() => {
    let cancelled = false;
    setIsBusy(true);
    terrainGeneratorService
      .load()
      .then((loaded) => {
        if (cancelled) return;
        setWorkspace(loaded);
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
      setMessage(saved.problems.length === 0 ? "Saved terrain authoring." : "Saved terrain authoring; validation problems remain.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsBusy(false);
    }
  }

  function updatePiece(next: TerrainPiece): void {
    if (!piece || typeof selectedPieceIndex !== "number") return;
    const previousSlug = piece.slug;
    mutateWorkspace((current) => ({
      ...current,
      pieces: current.pieces.map((entry, index) => (index === selectedPieceIndex ? next : entry)),
      pieceSets: current.pieceSets.map((entry) => ({
        ...entry,
        pieceSlugs: entry.pieceSlugs.map((slug) => (slug === previousSlug ? next.slug : slug)),
        pieceWeights: Object.fromEntries(
          Object.entries(entry.pieceWeights).map(([slug, weight]) => [slug === previousSlug ? next.slug : slug, weight])
        )
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
    setCompatibility(undefined);
    setCandidateResults([]);
    setGeneratedTemplateSlug(undefined);
  }

  function analyzePiece(): void {
    if (!workspace || !piece || typeof selectedPieceIndex !== "number") return;
    setError("");
    try {
      const pieces = workspace.pieces.map((entry, index) => (index === selectedPieceIndex ? piece : entry));
      const containingSet = workspace.pieceSets.find((entry) => entry.pieceSlugs.includes(piece.slug));
      const inspectionSet = containingSet ?? {
        slug: "CURRENT_INSPECTION",
        pieceSlugs: pieces.map((entry) => entry.slug),
        pieceWeights: Object.fromEntries(pieces.map((entry) => [entry.slug, entry.weight])),
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
      const generated = generateTerrainCandidateBatch(workspace, source, randomTerrainSeed());
      setCandidateResults(generated);
      setGeneratedTemplateSlug(source.slug);
      setMessage(`Generated ${generated.length} fresh random candidates for '${source.slug}'.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function approveAsset(asset: TerrainApprovedAsset): Promise<void> {
    if (!workspace) return;
    setError("");
    try {
      if (workspace.approvedAssets.some((entry) => entry.slug === asset.slug)) {
        throw new Error(`Approved asset '${asset.slug}' already exists`);
      }
      const saved = await terrainGeneratorService.saveApprovedAssets([...workspace.approvedAssets, asset]);
      setWorkspace(saved);
      void navigate(RouteEnum.terrainAnnotations);
      setMessage(`Frozen approved ${asset.kind.toLowerCase()} '${asset.slug}'.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <Section
      title="Terrain Generator"
      copy="Build local terrain pieces, organize them into collections, generate sites, and approve only useful geography."
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
                <Badge variant="outline">{workspace.pieceSets.length} collections</Badge>
                <Badge variant="outline">{workspace.approvedAssets.length} approved</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={isBusy} onClick={() => void saveWorkspace()} type="button">
                  <Save className="size-4" /> Save authoring
                </Button>
              </div>
            </div>
            {workspace.problems.length > 0 && <TerrainProblemList problems={workspace.problems} />}
            <Tabs onValueChange={(value) => setActivePage(value as TerrainPage)} value={activePage}>
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 md:grid-cols-4">
                <TabsTrigger className="gap-2 py-2" value="catalog">
                  <Tags className="size-4" /> 1 · Catalog
                </TabsTrigger>
                <TabsTrigger className="gap-2 py-2" value="pieces">
                  <Layers3 className="size-4" /> 2 · Pieces
                </TabsTrigger>
                <TabsTrigger className="gap-2 py-2" value="collections">
                  <Library className="size-4" /> 3 · Collections
                </TabsTrigger>
                <TabsTrigger className="gap-2 py-2" value="generate">
                  <Dices className="size-4" /> 4 · Generate
                </TabsTrigger>
              </TabsList>
              <TabsContent className="space-y-4" value="catalog">
                <div className="rounded border border-border bg-muted/30 p-3">
                  <h2 className="text-sm font-semibold">First: identify sprites and define edge language</h2>
                  <p className="text-xs text-muted-foreground">
                    Sprite metadata describes what art means. Sockets describe which outer piece edges may touch. Most natural terrain
                    starts with one GROUND socket.
                  </p>
                </div>
                <TerrainTileCatalog
                  onBindingsChange={(tileBindings) => mutateWorkspace((current) => ({ ...current, tileBindings }))}
                  onSelectTile={setSelectedTile}
                  selectedTile={selectedTile}
                  workspace={workspace}
                />
                <TerrainSocketCatalog
                  onChange={(sockets) =>
                    mutateWorkspace((current) => {
                      const renamedIndex =
                        current.sockets.length === sockets.length
                          ? current.sockets.findIndex((entry, index) => sockets[index] && entry.slug !== sockets[index].slug)
                          : -1;
                      const renamed = renamedIndex >= 0 ? current.sockets[renamedIndex] : undefined;
                      const replacement = renamedIndex >= 0 ? sockets[renamedIndex]?.slug : undefined;
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
              </TabsContent>
              <TabsContent className="space-y-4" value="pieces">
                <div className="rounded border border-border bg-muted/30 p-3">
                  <h2 className="text-sm font-semibold">Second: paint reusable local terrain pieces</h2>
                  <p className="text-xs text-muted-foreground">
                    A piece may be one tile or a mixed-size module. Paint its terrain and per-cell collision mask, tag every outer edge,
                    then use the cart icon to inspect its current unsaved compatibility.
                  </p>
                </div>
                <TerrainPieceEditor
                  onAnalyze={analyzePiece}
                  onChange={updatePiece}
                  onCreate={(next) => {
                    setSelectedPieceIndex(workspace.pieces.length);
                    mutateWorkspace((current) => ({ ...current, pieces: [...current.pieces, next] }));
                  }}
                  onDelete={() => {
                    if (!piece || typeof selectedPieceIndex !== "number") return;
                    mutateWorkspace((current) => ({
                      ...current,
                      pieces: current.pieces.filter((_, index) => index !== selectedPieceIndex),
                      pieceSets: current.pieceSets.map((entry) => ({
                        ...entry,
                        pieceSlugs: entry.pieceSlugs.filter((slug) => slug !== piece.slug),
                        pieceWeights: Object.fromEntries(Object.entries(entry.pieceWeights).filter(([slug]) => slug !== piece.slug))
                      })),
                      adjacencyOverrides: current.adjacencyOverrides.filter(
                        (entry) => entry.sourcePiece !== piece.slug && entry.targetPiece !== piece.slug
                      ),
                      templates: current.templates.map((entry) => ({
                        ...entry,
                        stamps: entry.stamps.filter((stamp) => stamp.piece !== piece.slug)
                      }))
                    }));
                    setSelectedPieceIndex(undefined);
                    setCompatibility(undefined);
                  }}
                  onSelect={(index) => {
                    setSelectedPieceIndex(index);
                    setCompatibility(undefined);
                  }}
                  piece={piece}
                  pieces={workspace.pieces}
                  selectedIndex={selectedPieceIndex}
                  sockets={workspace.sockets}
                />
                {compatibility && <TerrainCompatibilityInspector compatibility={compatibility} sockets={workspace.sockets} />}
                <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.8fr)] xl:items-start">
                  <TerrainPiecePainter
                    onChange={updatePiece}
                    piece={piece}
                    selectedTile={selectedTile}
                    sockets={workspace.sockets}
                    tilesets={workspace.tilesets}
                  />
                  <TerrainTileCatalog
                    compact
                    onBindingsChange={(tileBindings) => mutateWorkspace((current) => ({ ...current, tileBindings }))}
                    onSelectTile={setSelectedTile}
                    selectedTile={selectedTile}
                    workspace={workspace}
                  />
                </div>
              </TabsContent>
              <TabsContent className="space-y-4" value="collections">
                <div className="rounded border border-border bg-muted/30 p-3">
                  <h2 className="text-sm font-semibold">Third: choose which pieces belong together</h2>
                  <p className="text-xs text-muted-foreground">
                    A collection is the palette used by one solve. Adjacency exceptions are advanced and should be rare; matching sockets
                    remain the normal rule.
                  </p>
                </div>
                <TerrainPieceSetEditor
                  onOverridesChange={(adjacencyOverrides) => mutateWorkspace((current) => ({ ...current, adjacencyOverrides }))}
                  onSetsChange={(pieceSets) =>
                    mutateWorkspace((current) => {
                      const renamedIndex =
                        current.pieceSets.length === pieceSets.length
                          ? current.pieceSets.findIndex((entry, index) => pieceSets[index] && entry.slug !== pieceSets[index].slug)
                          : -1;
                      const renamed = renamedIndex >= 0 ? current.pieceSets[renamedIndex] : undefined;
                      const replacement = renamedIndex >= 0 ? pieceSets[renamedIndex]?.slug : undefined;
                      return {
                        ...current,
                        pieceSets,
                        templates:
                          renamed && replacement
                            ? current.templates.map((entry) => ({
                                ...entry,
                                pieceSet: entry.pieceSet === renamed.slug ? replacement : entry.pieceSet
                              }))
                            : current.templates
                      };
                    })
                  }
                  overrides={workspace.adjacencyOverrides}
                  pieces={workspace.pieces}
                  sets={workspace.pieceSets}
                  tilesets={workspace.tilesets}
                />
              </TabsContent>
              <TabsContent className="space-y-4" value="generate">
                <TerrainTemplateEditor
                  onChange={(templates) =>
                    mutateWorkspace((current) => {
                      const renamedIndex =
                        current.templates.length === templates.length
                          ? current.templates.findIndex((entry, index) => templates[index] && entry.slug !== templates[index].slug)
                          : -1;
                      const renamed = renamedIndex >= 0 ? current.templates[renamedIndex] : undefined;
                      const replacement = renamedIndex >= 0 ? templates[renamedIndex]?.slug : undefined;
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
                  onSelect={setSelectedTemplateIndex}
                  pieces={workspace.pieces}
                  previewCandidate={
                    generatedTemplateSlug === template?.slug
                      ? [...candidateResults].reverse().find((entry) => entry.candidate)?.candidate
                      : undefined
                  }
                  selectedTemplate={template}
                  selectedTemplateIndex={selectedTemplateIndex}
                  sets={workspace.pieceSets}
                  sockets={workspace.sockets}
                  templates={workspace.templates}
                  tilesets={workspace.tilesets}
                />
                <TerrainCandidateBatch
                  approvedAssets={workspace.approvedAssets}
                  onApprove={approveAsset}
                  results={generatedTemplateSlug === template?.slug ? candidateResults : []}
                  tilesets={workspace.tilesets}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </Section>
  );
};
