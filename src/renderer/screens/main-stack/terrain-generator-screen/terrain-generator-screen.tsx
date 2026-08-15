import { Section } from "@/components/layout/section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TerrainApprovedLibrary } from "@/screens/main-stack/terrain-generator-screen/terrain-approved-library";
import { TerrainCandidateBatch } from "@/screens/main-stack/terrain-generator-screen/terrain-candidate-batch";
import { TerrainCompatibilityInspector } from "@/screens/main-stack/terrain-generator-screen/terrain-compatibility-inspector";
import { TerrainExampleGuide } from "@/screens/main-stack/terrain-generator-screen/terrain-example-guide";
import { TerrainPieceEditor } from "@/screens/main-stack/terrain-generator-screen/terrain-piece-editor";
import { TerrainPiecePainter } from "@/screens/main-stack/terrain-generator-screen/terrain-piece-painter";
import { TerrainPieceSetEditor } from "@/screens/main-stack/terrain-generator-screen/terrain-piece-set-editor";
import { TerrainProblemList } from "@/screens/main-stack/terrain-generator-screen/terrain-problem-list";
import { TerrainSocketCatalog } from "@/screens/main-stack/terrain-generator-screen/terrain-socket-catalog";
import { TerrainTemplateEditor } from "@/screens/main-stack/terrain-generator-screen/terrain-template-editor";
import { TerrainTileCatalog } from "@/screens/main-stack/terrain-generator-screen/terrain-tile-catalog";
import terrainGeneratorService from "@/services/terrain-generator-service";
import { AlertTriangle, BookOpen, CheckSquare2, Dices, Layers3, Library, Save, Tags } from "lucide-react";
import { type FC, useEffect, useMemo, useState } from "react";
import type {
  TerrainApprovedAsset,
  TerrainPiece,
  TerrainSiteTemplate,
  TerrainTileRef,
  TerrainWorkspaceView
} from "../../../../shared/terrain-authoring";
import { installCompleteTerrainExample, terrainExampleTemplateSlug } from "../../../../shared/terrain-example";
import {
  compileTerrainPieceLibrary,
  generateTerrainCandidateBatch,
  inspectTerrainPieceCompatibility,
  type TerrainCandidateResult,
  type TerrainPieceCompatibility
} from "../../../../shared/terrain-wfc";

type TerrainPage = "catalog" | "pieces" | "collections" | "generate" | "library";

export const TerrainGeneratorScreen: FC = () => {
  const [workspace, setWorkspace] = useState<TerrainWorkspaceView>();
  const [activePage, setActivePage] = useState<TerrainPage>("catalog");
  const [selectedPieceSlug, setSelectedPieceSlug] = useState<string>();
  const [selectedTemplateSlug, setSelectedTemplateSlug] = useState<string>();
  const [selectedTile, setSelectedTile] = useState<TerrainTileRef>();
  const [compatibility, setCompatibility] = useState<TerrainPieceCompatibility>();
  const [candidateResults, setCandidateResults] = useState<TerrainCandidateResult[]>([]);
  const [generatedTemplateSlug, setGeneratedTemplateSlug] = useState<string>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const piece = useMemo(() => workspace?.pieces.find((entry) => entry.slug === selectedPieceSlug), [selectedPieceSlug, workspace?.pieces]);
  const template = useMemo(
    () => workspace?.templates.find((entry) => entry.slug === selectedTemplateSlug),
    [selectedTemplateSlug, workspace?.templates]
  );
  const hasExample = workspace?.templates.some((entry) => entry.slug === terrainExampleTemplateSlug) === true;

  useEffect(() => {
    let cancelled = false;
    setIsBusy(true);
    terrainGeneratorService
      .load()
      .then((loaded) => {
        if (cancelled) return;
        const shouldInstallExample =
          loaded.templates.length === 0 && loaded.pieceSets.length === 0 && Object.keys(loaded.tileBindings).length > 0;
        const ready = shouldInstallExample ? installCompleteTerrainExample(loaded) : loaded;
        setWorkspace(ready);
        const exampleTemplate = ready.templates.find((entry) => entry.slug === terrainExampleTemplateSlug);
        if (exampleTemplate) {
          setSelectedTemplateSlug(exampleTemplate.slug);
          setSelectedPieceSlug(ready.pieces.find((entry) => entry.slug === "EXAMPLE_OPEN_GROUND")?.slug);
          setActivePage("generate");
          if (shouldInstallExample)
            setMessage("Loaded an unsaved complete forest example. Hit Generate batch, then inspect the five pages.");
        }
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

  function loadExample(): void {
    if (!workspace) return;
    setError("");
    try {
      const ready = installCompleteTerrainExample(workspace);
      setWorkspace(ready);
      setSelectedTemplateSlug(terrainExampleTemplateSlug);
      setSelectedPieceSlug("EXAMPLE_OPEN_GROUND");
      setCandidateResults([]);
      setGeneratedTemplateSlug(undefined);
      setCompatibility(undefined);
      setActivePage("generate");
      setMessage("Loaded the complete forest example into the editor. It remains unsaved until you choose Save authoring.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
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
    setGeneratedTemplateSlug(undefined);
  }

  function analyzePiece(): void {
    if (!workspace || !piece) return;
    setError("");
    try {
      const pieces = workspace.pieces.map((entry) => (entry.slug === piece.slug ? piece : entry));
      const containingSet = workspace.pieceSets.find((entry) => entry.pieceSlugs.includes(piece.slug));
      const inspectionSet = containingSet ?? {
        slug: "CURRENT_INSPECTION",
        label: "Current inspection",
        pieceSlugs: pieces.map((entry) => entry.slug),
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

  function generateBatch(source: TerrainSiteTemplate, append: boolean): void {
    if (!workspace) return;
    setError("");
    try {
      const continuing = append && generatedTemplateSlug === source.slug && candidateResults.length > 0;
      const firstSeed = continuing ? (candidateResults[candidateResults.length - 1].seed + 1) >>> 0 : source.firstSeed;
      const generated = generateTerrainCandidateBatch(workspace, source, firstSeed);
      setCandidateResults(continuing ? [...candidateResults, ...generated] : generated);
      setGeneratedTemplateSlug(source.slug);
      setMessage(
        `${continuing ? "Added" : "Generated"} ${generated.length} candidates for '${source.slug}' using seeds ${generated[0].seed}-${generated[generated.length - 1].seed}.`
      );
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
      setActivePage("library");
      setMessage(`Frozen approved ${asset.kind.toLowerCase()} '${asset.slug}'.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function deleteApprovedAsset(slug: string): Promise<void> {
    if (!workspace) return;
    setError("");
    try {
      const saved = await terrainGeneratorService.saveApprovedAssets(workspace.approvedAssets.filter((entry) => entry.slug !== slug));
      setWorkspace(saved);
      setMessage(`Removed approved asset '${slug}'.`);
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
                <Button disabled={Object.keys(workspace.tileBindings).length === 0} onClick={loadExample} type="button" variant="outline">
                  <BookOpen className="size-4" /> {hasExample ? "Reset full example" : "Load full example"}
                </Button>
                <Button disabled={isBusy} onClick={() => void saveWorkspace()} type="button">
                  <Save className="size-4" /> Save authoring
                </Button>
              </div>
            </div>
            {workspace.problems.length > 0 && <TerrainProblemList problems={workspace.problems} />}
            <Tabs onValueChange={(value) => setActivePage(value as TerrainPage)} value={activePage}>
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 md:grid-cols-5">
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
                <TabsTrigger className="gap-2 py-2" value="library">
                  <CheckSquare2 className="size-4" /> 5 · Approved
                </TabsTrigger>
              </TabsList>
              <TabsContent className="space-y-4" value="catalog">
                <div className="rounded border border-border bg-muted/30 p-3">
                  <h2 className="text-sm font-semibold">First: identify sprites and define edge language</h2>
                  <p className="text-xs text-muted-foreground">
                    Tile bindings describe what a sprite means. Sockets describe which outer piece edges may touch. Most natural terrain
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
              </TabsContent>
              <TabsContent className="space-y-4" value="pieces">
                <div className="rounded border border-border bg-muted/30 p-3">
                  <h2 className="text-sm font-semibold">Second: paint reusable local terrain pieces</h2>
                  <p className="text-xs text-muted-foreground">
                    A piece may be one tile or a mixed-size module. Paint it, tag every outer edge, then use the cart icon to inspect its
                    current unsaved compatibility.
                  </p>
                </div>
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
                      const renamed =
                        current.pieceSets.length === pieceSets.length
                          ? current.pieceSets.find((entry, index) => pieceSets[index] && entry.slug !== pieceSets[index].slug)
                          : undefined;
                      const replacement = renamed ? pieceSets[current.pieceSets.indexOf(renamed)]?.slug : undefined;
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
                {hasExample && <TerrainExampleGuide />}
                <TerrainTemplateEditor
                  canGenerateMore={generatedTemplateSlug === template?.slug && candidateResults.length > 0}
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
                  previewCandidate={
                    generatedTemplateSlug === template?.slug
                      ? [...candidateResults].reverse().find((entry) => entry.candidate)?.candidate
                      : undefined
                  }
                  selectedTemplate={template}
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
              <TabsContent value="library">
                <TerrainApprovedLibrary assets={workspace.approvedAssets} onDelete={deleteApprovedAsset} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </Section>
  );
};
