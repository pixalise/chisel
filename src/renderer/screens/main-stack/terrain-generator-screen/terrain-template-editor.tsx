import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dices, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { type FC, useState } from "react";
import {
  createTerrainTemplateCells,
  type TerrainDirection,
  type TerrainPiece,
  type TerrainPieceSet,
  type TerrainSiteTemplate,
  type TerrainSocketDefinition
} from "../../../../shared/terrain-authoring";

interface TerrainTemplateEditorProps {
  onChange: (templates: TerrainSiteTemplate[]) => void;
  onGenerate: (template: TerrainSiteTemplate) => void;
  onSelect: (slug?: string) => void;
  pieces: TerrainPiece[];
  selectedTemplate?: TerrainSiteTemplate;
  sets: TerrainPieceSet[];
  sockets: TerrainSocketDefinition[];
  templates: TerrainSiteTemplate[];
}

export const TerrainTemplateEditor: FC<TerrainTemplateEditorProps> = (props) => {
  const { onChange, onGenerate, onSelect, pieces, selectedTemplate, sets, sockets, templates } = props;
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

  function update(updateValue: Partial<TerrainSiteTemplate>): void {
    if (!selectedTemplate) return;
    onChange(templates.map((entry) => (entry.slug === selectedTemplate.slug ? { ...entry, ...updateValue } : entry)));
    if (updateValue.slug) onSelect(updateValue.slug);
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
    onSelect(next.slug);
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
            Define bounds, a terrain collection, required stamps, anchors, semantic zones, and optional cell tag constraints.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <select
            className="h-9 min-w-48 rounded border border-input bg-background px-2 text-sm"
            onChange={(event) => onSelect(event.target.value || undefined)}
            value={selectedTemplate?.slug ?? ""}
          >
            <option value="">Choose template…</option>
            {templates.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
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
          <div className="grid gap-2 lg:grid-cols-[minmax(10rem,1fr)_14rem_8rem_auto_auto] lg:items-end">
            <Label className="space-y-1 text-xs">
              Stable slug
              <Input onChange={(event) => update({ slug: normalizeSlug(event.target.value) })} value={selectedTemplate.slug} />
            </Label>
            <Label className="space-y-1 text-xs">
              Collection
              <select
                className="h-9 w-full rounded border border-input bg-background px-2 text-sm"
                onChange={(event) => update({ pieceSet: event.target.value })}
                value={selectedTemplate.pieceSet}
              >
                {sets.map((entry) => (
                  <option key={entry.slug} value={entry.slug}>
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
              <Dices className="size-4" /> Generate batch
            </Button>
            <Button
              onClick={() => {
                onChange(templates.filter((entry) => entry.slug !== selectedTemplate.slug));
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
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium">Cell tag constraints</span>
                  <span className="text-xs text-muted-foreground">
                    Select a cell to require or forbid semantic terrain tags · selected {selectedX},{selectedY}
                  </span>
                </div>
                <div className="max-h-[34rem] overflow-auto rounded bg-slate-950 p-3">
                  <div className="grid w-max gap-px" style={{ gridTemplateColumns: `repeat(${selectedTemplate.width}, 1.4rem)` }}>
                    {selectedTemplate.cells.map((cell, index) => (
                      <button
                        className="size-[1.4rem] border border-white/10 text-[8px]"
                        key={index}
                        onClick={() => setSelectedIndex(index)}
                        style={{
                          backgroundColor: cell.requiredTags.length > 0 ? "#3f7f58" : cell.forbiddenTags.length > 0 ? "#914646" : "#1a1a18",
                          outline: index === selectedIndex ? "2px solid #d0c4aa" : undefined
                        }}
                        title={`${index % selectedTemplate.width},${Math.floor(index / selectedTemplate.width)} · required: ${cell.requiredTags.join(", ") || "none"} · forbidden: ${cell.forbiddenTags.join(", ") || "none"}`}
                        type="button"
                      >
                        {cell.requiredTags.length > 0 ? "+" : cell.forbiddenTags.length > 0 ? "−" : ""}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-3 rounded border border-border p-3">
                {selectedCell && (
                  <div className="space-y-2">
                    <Label className="space-y-1 text-xs">
                      Required terrain tags
                      <Input
                        onChange={(event) =>
                          update({
                            cells: selectedTemplate.cells.map((cell, index) =>
                              index === selectedIndex ? { ...cell, requiredTags: slugList(event.target.value) } : cell
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
                              index === selectedIndex ? { ...cell, forbiddenTags: slugList(event.target.value) } : cell
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
                      {sockets.map((entry) => (
                        <option key={entry.slug} value={entry.slug}>
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
                      .map((entry) => (
                        <option key={entry.slug} value={entry.slug}>
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
                  <p className="text-xs font-semibold">Semantic zone from selected cell</p>
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
                            requiredTags: slugList(zoneTags),
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
                <div className="space-y-2 border-t border-border pt-2">
                  <p className="text-xs font-semibold">Authored constraints</p>
                  {selectedTemplate.anchors.map((anchor, index) => (
                    <div
                      className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1 text-[11px]"
                      key={anchor.slug}
                    >
                      <span>
                        {anchor.slug} · {anchor.kind} · {anchor.x},{anchor.y} {anchor.direction}/{anchor.socket}
                      </span>
                      <Button
                        aria-label={`Delete ${anchor.slug}`}
                        onClick={() => update({ anchors: selectedTemplate.anchors.filter((_, entryIndex) => entryIndex !== index) })}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  ))}
                  {selectedTemplate.stamps.map((stamp, index) => (
                    <div
                      className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1 text-[11px]"
                      key={`${stamp.piece}-${stamp.x}-${stamp.y}-${index}`}
                    >
                      <span>
                        {stamp.piece}@{stamp.orientation} · {stamp.x},{stamp.y}
                      </span>
                      <Button
                        aria-label={`Delete ${stamp.piece} stamp`}
                        onClick={() => update({ stamps: selectedTemplate.stamps.filter((_, entryIndex) => entryIndex !== index) })}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  ))}
                  {selectedTemplate.zones.map((zone, index) => (
                    <div className="space-y-1 rounded border border-border p-2 text-[11px]" key={zone.slug}>
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          {zone.slug} · {zone.x},{zone.y} · {zone.width}×{zone.height} · {zone.requiredTags.join(", ") || "any tags"}
                        </span>
                        <Button
                          aria-label={`Delete ${zone.slug}`}
                          onClick={() => update({ zones: selectedTemplate.zones.filter((_, entryIndex) => entryIndex !== index) })}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <Label className="space-y-1">
                          Minimum
                          <Input
                            min={0}
                            onChange={(event) =>
                              update({
                                zones: selectedTemplate.zones.map((entry, entryIndex) =>
                                  entryIndex === index ? { ...entry, minCount: Number(event.target.value) } : entry
                                )
                              })
                            }
                            type="number"
                            value={zone.minCount}
                          />
                        </Label>
                        <Label className="space-y-1">
                          Maximum
                          <Input
                            min={0}
                            onChange={(event) =>
                              update({
                                zones: selectedTemplate.zones.map((entry, entryIndex) =>
                                  entryIndex === index ? { ...entry, maxCount: Number(event.target.value) } : entry
                                )
                              })
                            }
                            type="number"
                            value={zone.maxCount}
                          />
                        </Label>
                      </div>
                    </div>
                  ))}
                  {selectedTemplate.anchors.length === 0 && selectedTemplate.stamps.length === 0 && selectedTemplate.zones.length === 0 && (
                    <p className="text-xs text-muted-foreground">No anchors, stamps, or zones.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

function normalizeSlug(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+/, "");
}

function slugList(value: string): string[] {
  return value.split(",").map(normalizeSlug).filter(Boolean);
}
