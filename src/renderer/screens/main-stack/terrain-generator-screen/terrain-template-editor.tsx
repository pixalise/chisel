import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dices, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { type FC, useEffect, useState } from "react";
import {
  createTerrainTemplateCells,
  type TerrainDirection,
  type TerrainPiece,
  type TerrainPieceSet,
  type TerrainSiteTemplate,
  type TerrainSocketDefinition,
  type TerrainTilesetView
} from "../../../../shared/terrain-authoring";
import type { TerrainCandidate } from "../../../../shared/terrain-wfc";
import {
  finalizeTerrainSlug,
  isTerrainSlugAvailable,
  normalizeTerrainSlugDraft,
  parseTerrainSlugList
} from "../../../../shared/terrain-slug";
import { TerrainTemplateConstraintCards } from "./terrain-template-constraint-cards";
import { type TerrainConstraintHighlight, TerrainTemplateConstraintPreview } from "./terrain-template-constraint-preview";

interface TerrainTemplateEditorProps {
  onChange: (templates: TerrainSiteTemplate[]) => void;
  onGenerate: (template: TerrainSiteTemplate) => void;
  onSelect: (index?: number) => void;
  pieces: TerrainPiece[];
  previewCandidate?: TerrainCandidate;
  selectedTemplate?: TerrainSiteTemplate;
  selectedTemplateIndex?: number;
  sets: TerrainPieceSet[];
  sockets: TerrainSocketDefinition[];
  templates: TerrainSiteTemplate[];
  tilesets: TerrainTilesetView[];
}

export const TerrainTemplateEditor: FC<TerrainTemplateEditorProps> = (props) => {
  const {
    onChange,
    onGenerate,
    onSelect,
    pieces,
    previewCandidate,
    selectedTemplate,
    selectedTemplateIndex,
    sets,
    sockets,
    templates,
    tilesets
  } = props;
  const [width, setWidth] = useState(12);
  const [height, setHeight] = useState(12);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [anchorKind, setAnchorKind] = useState<"ENTRANCE" | "EXIT" | "EXTENSION">("ENTRANCE");
  const [anchorDirection, setAnchorDirection] = useState<TerrainDirection>("north");
  const [anchorSocket, setAnchorSocket] = useState("");
  const [stampPiece, setStampPiece] = useState("");
  const [stampOrientation, setStampOrientation] = useState(0);
  const [zoneWidth, setZoneWidth] = useState(3);
  const [zoneHeight, setZoneHeight] = useState(3);
  const [zoneTags, setZoneTags] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [focusedConstraint, setFocusedConstraint] = useState<TerrainConstraintHighlight>();
  const [slugDraft, setSlugDraft] = useState(selectedTemplate?.slug ?? "");

  useEffect(() => setSlugDraft(selectedTemplate?.slug ?? ""), [selectedTemplate?.slug, selectedTemplateIndex]);

  const committedSlug = selectedTemplate ? finalizeTerrainSlug(slugDraft, selectedTemplate.slug) : "";
  const slugIsDuplicate =
    selectedTemplate && typeof selectedTemplateIndex === "number" && committedSlug !== selectedTemplate.slug
      ? !isTerrainSlugAvailable(
          committedSlug,
          templates.map((entry) => entry.slug),
          selectedTemplateIndex
        )
      : false;

  function update(updateValue: Partial<TerrainSiteTemplate>): void {
    if (!selectedTemplate || typeof selectedTemplateIndex !== "number") return;
    onChange(templates.map((entry, index) => (index === selectedTemplateIndex ? { ...entry, ...updateValue } : entry)));
  }

  function commitSlug(): void {
    if (!selectedTemplate) return;
    if (slugIsDuplicate) {
      setSlugDraft(selectedTemplate.slug);
      return;
    }
    setSlugDraft(committedSlug);
    if (committedSlug !== selectedTemplate.slug) update({ slug: committedSlug });
  }

  function createTemplate(): void {
    const pieceSet = sets[0];
    if (!pieceSet) return;
    let index = templates.length + 1;
    while (templates.some((entry) => entry.slug === `SITE_TEMPLATE_${index}`)) index += 1;
    const next: TerrainSiteTemplate = {
      slug: `SITE_TEMPLATE_${index}`,
      width,
      height,
      pieceSet: pieceSet.slug,
      candidateCount: 12,
      cells: createTerrainTemplateCells(width, height),
      anchors: [],
      stamps: [],
      zones: []
    };
    onChange([...templates, next]);
    onSelect(templates.length);
  }

  const selectedX = selectedTemplate ? selectedIndex % selectedTemplate.width : 0;
  const selectedY = selectedTemplate ? Math.floor(selectedIndex / selectedTemplate.width) : 0;
  const selectedCell = selectedTemplate?.cells[selectedIndex];

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Macro site templates</h3>
          <p className="text-xs text-muted-foreground">
            Define bounds, a terrain collection, required stamps, anchors, validation zones, and optional cell tag constraints.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <select
            className="h-9 min-w-48 rounded border border-input bg-background px-2 text-sm"
            onChange={(event) => {
              setFocusedConstraint(undefined);
              setSelectedIndex(0);
              onSelect(event.target.value ? Number(event.target.value) : undefined);
            }}
            value={typeof selectedTemplateIndex === "number" ? String(selectedTemplateIndex) : ""}
          >
            <option value="">Choose template…</option>
            {templates.map((entry, index) => (
              <option key={index} value={index}>
                {entry.slug} — {entry.width}×{entry.height}
              </option>
            ))}
          </select>
          <Label className="space-y-1 text-xs">
            Width
            <Input max={64} min={3} onChange={(event) => setWidth(Number(event.target.value))} type="number" value={width} />
          </Label>
          <Label className="space-y-1 text-xs">
            Height
            <Input max={64} min={3} onChange={(event) => setHeight(Number(event.target.value))} type="number" value={height} />
          </Label>
          <Button disabled={sets.length === 0} onClick={createTemplate} size="sm" type="button">
            <Plus className="size-4" /> Create
          </Button>
        </div>
      </div>
      {selectedTemplate && (
        <>
          <div className="grid gap-2 lg:grid-cols-[minmax(10rem,1fr)_14rem_7rem_auto_auto] lg:items-end">
            <Label className="space-y-1 text-xs">
              Stable slug
              <Input
                aria-invalid={slugIsDuplicate}
                onBlur={commitSlug}
                onChange={(event) => setSlugDraft(normalizeTerrainSlugDraft(event.target.value))}
                value={slugDraft}
              />
              {slugIsDuplicate && <span className="block text-xs text-destructive">That slug belongs to another template.</span>}
            </Label>
            <Label className="space-y-1 text-xs">
              Collection
              <select
                className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
                onChange={(event) => update({ pieceSet: event.target.value })}
                value={selectedTemplate.pieceSet}
              >
                {sets.map((entry, index) => (
                  <option key={index} value={entry.slug}>
                    {entry.slug}
                  </option>
                ))}
              </select>
            </Label>
            <Label className="space-y-1 text-xs">
              Batch
              <Input
                max={24}
                min={1}
                onChange={(event) => update({ candidateCount: Number(event.target.value) })}
                type="number"
                value={selectedTemplate.candidateCount}
              />
            </Label>
            <Button onClick={() => onGenerate(selectedTemplate)} type="button">
              <Dices className="size-4" /> Generate
            </Button>
            <Button
              onClick={() => {
                onChange(templates.filter((_, index) => index !== selectedTemplateIndex));
                onSelect(undefined);
              }}
              size="icon"
              type="button"
              variant="destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-muted/30 p-3">
            <div>
              <p className="text-sm font-medium">Optional site constraints</p>
              <p className="text-xs text-muted-foreground">
                {selectedTemplate.anchors.length} anchors · {selectedTemplate.stamps.length} stamps · {selectedTemplate.zones.length} zones
                {" · "}
                {selectedTemplate.cells.filter((cell) => cell.requiredTags.length > 0 || cell.forbiddenTags.length > 0).length} constrained
                cells
              </p>
            </div>
            <Button onClick={() => setShowAdvanced((value) => !value)} type="button" variant="outline">
              <SlidersHorizontal className="size-4" /> {showAdvanced ? "Hide advanced constraints" : "Edit advanced constraints"}
            </Button>
          </div>
          {showAdvanced && (
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <div className="min-w-0 space-y-3">
                <TerrainTemplateConstraintPreview
                  candidate={previewCandidate}
                  highlight={focusedConstraint}
                  onSelectCell={(index) => {
                    setFocusedConstraint(undefined);
                    setSelectedIndex(index);
                  }}
                  pieces={pieces}
                  selectedIndex={selectedIndex}
                  template={selectedTemplate}
                  tilesets={tilesets}
                />
                <TerrainTemplateConstraintCards
                  focusedKey={focusedConstraint?.key}
                  onChange={(updateValue) => {
                    setFocusedConstraint(undefined);
                    update(updateValue);
                  }}
                  onFocus={(highlight, index) => {
                    setFocusedConstraint(highlight);
                    setSelectedIndex(index);
                  }}
                  pieces={pieces}
                  template={selectedTemplate}
                />
              </div>
              <div className="space-y-3 rounded border border-border p-3">
                <p className="text-xs font-semibold">
                  Selected cell {selectedX},{selectedY}
                </p>
                {selectedCell && (
                  <div className="space-y-2">
                    <Label className="space-y-1 text-xs">
                      Required terrain tags
                      <Input
                        onChange={(event) =>
                          update({
                            cells: selectedTemplate.cells.map((cell, index) =>
                              index === selectedIndex ? { ...cell, requiredTags: parseTerrainSlugList(event.target.value) } : cell
                            )
                          })
                        }
                        value={selectedCell.requiredTags.join(", ")}
                      />
                    </Label>
                    <Label className="space-y-1 text-xs">
                      Forbidden terrain tags
                      <Input
                        onChange={(event) =>
                          update({
                            cells: selectedTemplate.cells.map((cell, index) =>
                              index === selectedIndex ? { ...cell, forbiddenTags: parseTerrainSlugList(event.target.value) } : cell
                            )
                          })
                        }
                        value={selectedCell.forbiddenTags.join(", ")}
                      />
                    </Label>
                  </div>
                )}
                <div className="space-y-2 border-t border-border pt-2">
                  <p className="text-xs font-semibold">Add anchor at selected cell</p>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className="h-8 rounded border border-input bg-background px-2 text-xs"
                      onChange={(event) => setAnchorKind(event.target.value as typeof anchorKind)}
                      value={anchorKind}
                    >
                      <option value="ENTRANCE">Entrance</option>
                      <option value="EXIT">Exit</option>
                      <option value="EXTENSION">Extension</option>
                    </select>
                    <select
                      className="h-8 rounded border border-input bg-background px-2 text-xs"
                      onChange={(event) => setAnchorDirection(event.target.value as TerrainDirection)}
                      value={anchorDirection}
                    >
                      <option value="north">North</option>
                      <option value="east">East</option>
                      <option value="south">South</option>
                      <option value="west">West</option>
                    </select>
                    <select
                      className="col-span-2 h-8 rounded border border-input bg-background px-2 text-xs"
                      onChange={(event) => setAnchorSocket(event.target.value)}
                      value={anchorSocket}
                    >
                      <option value="">Socket…</option>
                      {sockets.map((entry, index) => (
                        <option key={index} value={entry.slug}>
                          {entry.slug}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    disabled={!anchorSocket}
                    onClick={() =>
                      update({
                        anchors: [
                          ...selectedTemplate.anchors,
                          {
                            slug: `ANCHOR_${selectedTemplate.anchors.length + 1}`,
                            kind: anchorKind,
                            x: selectedX,
                            y: selectedY,
                            direction: anchorDirection,
                            socket: anchorSocket
                          }
                        ]
                      })
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Plus className="size-3" /> Anchor
                  </Button>
                </div>
                <div className="space-y-2 border-t border-border pt-2">
                  <p className="text-xs font-semibold">Required stamp at selected cell</p>
                  <select
                    className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                    onChange={(event) => {
                      setStampPiece(event.target.value);
                      setStampOrientation(0);
                    }}
                    value={stampPiece}
                  >
                    <option value="">Piece…</option>
                    {pieces
                      .filter((entry) => sets.find((set) => set.slug === selectedTemplate.pieceSet)?.pieceSlugs.includes(entry.slug))
                      .map((entry, index) => (
                        <option key={index} value={entry.slug}>
                          {entry.slug}
                        </option>
                      ))}
                  </select>
                  <select
                    className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                    onChange={(event) => setStampOrientation(Number(event.target.value))}
                    value={stampOrientation}
                  >
                    {(pieces.find((entry) => entry.slug === stampPiece)?.allowReflections
                      ? [0, 1, 2, 3, 4, 5, 6, 7]
                      : pieces.find((entry) => entry.slug === stampPiece)?.allowRotations
                        ? [0, 1, 2, 3]
                        : [0]
                    ).map((orientation) => (
                      <option key={orientation} value={orientation}>
                        Orientation {orientation}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={!stampPiece}
                    onClick={() =>
                      update({
                        stamps: [
                          ...selectedTemplate.stamps,
                          { piece: stampPiece, x: selectedX, y: selectedY, orientation: stampOrientation }
                        ]
                      })
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Plus className="size-3" /> Stamp
                  </Button>
                </div>
                <div className="space-y-2 border-t border-border pt-2">
                  <p className="text-xs font-semibold">Validation zone from selected cell</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      max={selectedTemplate.width - selectedX}
                      min={1}
                      onChange={(event) => setZoneWidth(Number(event.target.value))}
                      type="number"
                      value={zoneWidth}
                    />
                    <Input
                      max={selectedTemplate.height - selectedY}
                      min={1}
                      onChange={(event) => setZoneHeight(Number(event.target.value))}
                      type="number"
                      value={zoneHeight}
                    />
                  </div>
                  <Input onChange={(event) => setZoneTags(event.target.value)} placeholder="Required tags" value={zoneTags} />
                  <Button
                    onClick={() =>
                      update({
                        zones: [
                          ...selectedTemplate.zones,
                          {
                            slug: `ZONE_${selectedTemplate.zones.length + 1}`,
                            x: selectedX,
                            y: selectedY,
                            width: zoneWidth,
                            height: zoneHeight,
                            requiredTags: parseTerrainSlugList(zoneTags),
                            minCount: 1,
                            maxCount: zoneWidth * zoneHeight
                          }
                        ]
                      })
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Plus className="size-3" /> Zone
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
