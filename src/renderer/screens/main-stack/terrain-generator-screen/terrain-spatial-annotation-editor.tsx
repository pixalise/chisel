import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { type FC, useEffect, useState } from "react";
import type {
  TerrainApprovedAsset,
  TerrainDirection,
  TerrainSpatialLayout,
  TerrainTilesetView
} from "../../../../shared/terrain-authoring";
import { TerrainApprovedMapPreview } from "./terrain-approved-map-preview";

interface TerrainSpatialAnnotationEditorProps {
  asset: TerrainApprovedAsset;
  layouts: TerrainSpatialLayout[];
  onChange: (layouts: TerrainSpatialLayout[]) => void;
  tilesets: TerrainTilesetView[];
}

export const TerrainSpatialAnnotationEditor: FC<TerrainSpatialAnnotationEditorProps> = (props) => {
  const { asset, layouts, onChange, tilesets } = props;
  const assetLayouts = layouts.filter((layout) => layout.sourceAsset === asset.slug);
  const [selectedLayoutSlug, setSelectedLayoutSlug] = useState(assetLayouts[0]?.slug ?? "");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeZoneSlug, setActiveZoneSlug] = useState("");
  const [zoneSlug, setZoneSlug] = useState("PLACEMENT_ZONE");
  const [zoneKind, setZoneKind] = useState<TerrainSpatialLayout["zones"][number]["kind"]>("PLACEMENT");
  const [markerKind, setMarkerKind] = useState("POI");
  const [markerTags, setMarkerTags] = useState("");
  const [markerRadius, setMarkerRadius] = useState(1);
  const [markerDirection, setMarkerDirection] = useState<TerrainDirection>("north");
  const [placementMode, setPlacementMode] = useState<"FIXED" | "RULE">("RULE");
  const [placementWidth, setPlacementWidth] = useState(1);
  const [placementHeight, setPlacementHeight] = useState(1);
  const [placementOrientation, setPlacementOrientation] = useState(0);
  const [placementTable, setPlacementTable] = useState("");
  const [placementContent, setPlacementContent] = useState("");
  const [placementRuleSet, setPlacementRuleSet] = useState("FOREST_CURIOSITIES");
  const [placementTags, setPlacementTags] = useState("");
  const selectedLayout = assetLayouts.find((layout) => layout.slug === selectedLayoutSlug);
  const activeZone = selectedLayout?.zones.find((zone) => zone.slug === activeZoneSlug);
  const selectedX = selectedIndex % asset.width;
  const selectedY = Math.floor(selectedIndex / asset.width);
  const selectedCell = asset.cellMetadata[selectedIndex];

  useEffect(() => {
    if (assetLayouts.some((layout) => layout.slug === selectedLayoutSlug)) return;
    setSelectedLayoutSlug(assetLayouts[0]?.slug ?? "");
    setActiveZoneSlug("");
    setSelectedIndex(0);
  }, [asset.slug, assetLayouts, selectedLayoutSlug]);

  function updateLayout(update: Partial<TerrainSpatialLayout>): void {
    if (!selectedLayout) return;
    onChange(layouts.map((layout) => (layout.slug === selectedLayout.slug ? { ...layout, ...update } : layout)));
    if (update.slug) setSelectedLayoutSlug(update.slug);
  }

  function createLayout(): void {
    let slug = `${asset.slug}_LAYOUT`;
    let index = 2;
    while (layouts.some((layout) => layout.slug === slug)) {
      slug = `${asset.slug}_LAYOUT_${index}`;
      index += 1;
    }
    const next: TerrainSpatialLayout = {
      slug,
      label: `${asset.slug} spatial dressing`,
      sourceAsset: asset.slug,
      zones: [],
      markers: [],
      placements: []
    };
    onChange([...layouts, next]);
    setSelectedLayoutSlug(next.slug);
    setActiveZoneSlug("");
  }

  function addZone(): void {
    if (!selectedLayout) return;
    let slug = normalizeSlug(zoneSlug) || `ZONE_${selectedLayout.zones.length + 1}`;
    let suffix = 2;
    while (selectedLayout.zones.some((zone) => zone.slug === slug)) {
      slug = `${normalizeSlug(zoneSlug) || "ZONE"}_${suffix}`;
      suffix += 1;
    }
    updateLayout({ zones: [...selectedLayout.zones, { slug, kind: zoneKind, cells: [], tags: [], ruleSet: "" }] });
    setActiveZoneSlug(slug);
  }

  function paintZone(index: number, erase: boolean): void {
    if (!selectedLayout || !activeZone) return;
    updateLayout({
      zones: selectedLayout.zones.map((zone) => {
        if (zone.slug !== activeZone.slug) return zone;
        const cells = new Set(zone.cells);
        if (erase) cells.delete(index);
        else cells.add(index);
        return { ...zone, cells: [...cells].sort((left, right) => left - right) };
      })
    });
  }

  function addMarker(): void {
    if (!selectedLayout) return;
    const ordinal = selectedLayout.markers.length + 1;
    updateLayout({
      markers: [
        ...selectedLayout.markers,
        {
          slug: uniqueSlug(
            `MARKER_${markerKind}_${ordinal}`,
            selectedLayout.markers.map((marker) => marker.slug)
          ),
          kind: normalizeSlug(markerKind) || "POI",
          x: selectedX,
          y: selectedY,
          radius: markerRadius,
          direction: markerDirection,
          tags: slugList(markerTags)
        }
      ]
    });
  }

  function addPlacement(): void {
    if (!selectedLayout) return;
    const ordinal = selectedLayout.placements.length + 1;
    updateLayout({
      placements: [
        ...selectedLayout.placements,
        {
          slug: uniqueSlug(
            `PLACEMENT_${ordinal}`,
            selectedLayout.placements.map((placement) => placement.slug)
          ),
          mode: placementMode,
          x: selectedX,
          y: selectedY,
          width: placementWidth,
          height: placementHeight,
          orientation: placementOrientation,
          contentTable: placementMode === "FIXED" ? placementTable.trim() : "",
          contentSlug: placementMode === "FIXED" ? normalizeSlug(placementContent) : "",
          ruleSet: placementMode === "RULE" ? normalizeSlug(placementRuleSet) : "",
          tags: slugList(placementTags)
        }
      ]
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Spatial annotation editor</h3>
          <p className="text-xs text-muted-foreground">
            Frozen terrain remains unchanged. Paint reusable zones, add POI markers, and author fixed or rule-driven placements over it.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Label className="space-y-1 text-xs">
            Dressing
            <select
              className="h-9 min-w-64 rounded border border-input bg-background px-2 text-sm"
              onChange={(event) => {
                setSelectedLayoutSlug(event.target.value);
                setActiveZoneSlug("");
              }}
              value={selectedLayoutSlug}
            >
              <option value="">Choose a spatial layout…</option>
              {assetLayouts.map((layout) => (
                <option key={layout.slug} value={layout.slug}>
                  {layout.slug}
                </option>
              ))}
            </select>
          </Label>
          <Button onClick={createLayout} size="sm" type="button" variant="outline">
            <Plus className="size-4" /> New dressing
          </Button>
        </div>
      </div>
      {!selectedLayout && (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Create a spatial dressing to annotate this approved map without changing its frozen geography.
        </p>
      )}
      {selectedLayout && (
        <>
          <div className="grid gap-2 md:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_auto] md:items-end">
            <Label className="space-y-1 text-xs">
              Stable slug
              <Input onChange={(event) => updateLayout({ slug: normalizeSlug(event.target.value) })} value={selectedLayout.slug} />
            </Label>
            <Label className="space-y-1 text-xs">
              Label
              <Input onChange={(event) => updateLayout({ label: event.target.value })} value={selectedLayout.label} />
            </Label>
            <Button
              aria-label={`Delete ${selectedLayout.slug}`}
              onClick={() => {
                if (!window.confirm(`Delete spatial dressing '${selectedLayout.slug}'? The approved map remains unchanged.`)) return;
                onChange(layouts.filter((layout) => layout.slug !== selectedLayout.slug));
                setSelectedLayoutSlug("");
              }}
              size="icon"
              type="button"
              variant="destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="min-w-0 space-y-3">
              <div className="overflow-auto rounded-md bg-slate-950 p-3">
                <TerrainApprovedMapPreview
                  activeZoneSlug={activeZoneSlug}
                  asset={asset}
                  layout={selectedLayout}
                  onPaintCell={activeZone ? paintZone : undefined}
                  onSelectCell={setSelectedIndex}
                  selectedIndex={selectedIndex}
                  tilesets={tilesets}
                />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <span className="text-blue-300">Blue: placement zone</span>
                <span className="text-red-300">Red: exclusion zone</span>
                <span className="text-amber-300">Amber: reserved zone</span>
                <span className="text-cyan-300">Circle: marker</span>
                <span className="text-green-300">F: fixed placement</span>
                <span className="text-purple-300">R: rule placement</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {selectedLayout.zones.map((zone) => (
                  <button
                    className={cn(
                      "relative space-y-1 rounded border border-border p-3 pr-10 text-left hover:border-primary/60",
                      activeZoneSlug === zone.slug && "border-primary bg-primary/5 ring-1 ring-primary"
                    )}
                    data-spatial-zone={zone.slug}
                    key={zone.slug}
                    onClick={() => setActiveZoneSlug(zone.slug)}
                    type="button"
                  >
                    <Badge variant={zone.kind === "EXCLUSION" ? "destructive" : zone.kind === "RESERVED" ? "secondary" : "outline"}>
                      {zone.kind.toLowerCase()}
                    </Badge>
                    <p className="truncate font-mono text-xs font-semibold">{zone.slug}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {zone.cells.length} cells · {zone.tags.join(", ") || "no tags"}
                    </p>
                    <Button
                      aria-label={`Delete ${zone.slug}`}
                      className="absolute right-1 top-1"
                      onClick={(event) => {
                        event.stopPropagation();
                        updateLayout({ zones: selectedLayout.zones.filter((entry) => entry.slug !== zone.slug) });
                        if (activeZoneSlug === zone.slug) setActiveZoneSlug("");
                      }}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </button>
                ))}
                {selectedLayout.markers.map((marker) => (
                  <div
                    className="relative space-y-1 rounded border border-border p-3 pr-10"
                    data-spatial-marker={marker.slug}
                    key={marker.slug}
                  >
                    <Badge variant="outline">{marker.kind}</Badge>
                    <p className="truncate font-mono text-xs font-semibold">{marker.slug}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Cell {marker.x},{marker.y} · radius {marker.radius} · {marker.tags.join(", ") || "no tags"}
                    </p>
                    <Button
                      aria-label={`Delete ${marker.slug}`}
                      className="absolute right-1 top-1"
                      onClick={() => updateLayout({ markers: selectedLayout.markers.filter((entry) => entry.slug !== marker.slug) })}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
                {selectedLayout.placements.map((placement) => (
                  <div
                    className="relative space-y-1 rounded border border-border p-3 pr-10"
                    data-spatial-placement={placement.slug}
                    key={placement.slug}
                  >
                    <Badge variant="secondary">{placement.mode === "FIXED" ? "Fixed" : "Rule slot"}</Badge>
                    <p className="truncate font-mono text-xs font-semibold">{placement.slug}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Cell {placement.x},{placement.y} · {placement.width}×{placement.height} ·{" "}
                      {placement.mode === "FIXED" ? `${placement.contentTable}/${placement.contentSlug}` : placement.ruleSet}
                    </p>
                    <Button
                      aria-label={`Delete ${placement.slug}`}
                      className="absolute right-1 top-1"
                      onClick={() =>
                        updateLayout({ placements: selectedLayout.placements.filter((entry) => entry.slug !== placement.slug) })
                      }
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3 rounded-md border border-border p-3">
              <div>
                <p className="text-xs font-semibold">
                  Selected cell {selectedX},{selectedY}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {selectedCell?.blocking ? "Blocking terrain" : "Walkable terrain"} · {selectedCell?.tags.join(", ") || "no terrain tags"}
                </p>
              </div>
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-semibold">Paint a zone</p>
                <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
                  <Input onChange={(event) => setZoneSlug(event.target.value)} placeholder="ZONE_SLUG" value={zoneSlug} />
                  <select
                    className="h-9 rounded border border-input bg-background px-2 text-xs"
                    onChange={(event) => setZoneKind(event.target.value as typeof zoneKind)}
                    value={zoneKind}
                  >
                    <option value="PLACEMENT">Placement</option>
                    <option value="EXCLUSION">Exclusion</option>
                    <option value="RESERVED">Reserved</option>
                  </select>
                </div>
                <Button onClick={addZone} size="sm" type="button" variant="outline">
                  <Plus className="size-3" /> Create zone
                </Button>
                {activeZone && (
                  <div className="space-y-2 rounded border border-primary/50 bg-primary/5 p-2">
                    <p className="text-[11px] font-semibold">Painting {activeZone.slug}</p>
                    <p className="text-[10px] text-muted-foreground">Left-drag adds cells. Right-drag or Ctrl-drag removes cells.</p>
                    <Label className="space-y-1 text-[10px]">
                      Zone kind
                      <select
                        className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                        onChange={(event) =>
                          updateLayout({
                            zones: selectedLayout.zones.map((zone) =>
                              zone.slug === activeZone.slug ? { ...zone, kind: event.target.value as typeof zone.kind } : zone
                            )
                          })
                        }
                        value={activeZone.kind}
                      >
                        <option value="PLACEMENT">Placement</option>
                        <option value="EXCLUSION">Exclusion</option>
                        <option value="RESERVED">Reserved</option>
                      </select>
                    </Label>
                    <Label className="space-y-1 text-[10px]">
                      Semantic tags
                      <Input
                        onChange={(event) =>
                          updateLayout({
                            zones: selectedLayout.zones.map((zone) =>
                              zone.slug === activeZone.slug ? { ...zone, tags: slugList(event.target.value) } : zone
                            )
                          })
                        }
                        value={activeZone.tags.join(", ")}
                      />
                    </Label>
                    <Label className="space-y-1 text-[10px]">
                      Placement rule set
                      <Input
                        onChange={(event) =>
                          updateLayout({
                            zones: selectedLayout.zones.map((zone) =>
                              zone.slug === activeZone.slug ? { ...zone, ruleSet: normalizeSlug(event.target.value) } : zone
                            )
                          })
                        }
                        value={activeZone.ruleSet}
                      />
                    </Label>
                    <Button
                      onClick={() =>
                        updateLayout({
                          zones: selectedLayout.zones.map((zone) => (zone.slug === activeZone.slug ? { ...zone, cells: [] } : zone))
                        })
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Clear painted cells
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-semibold">Add marker at selected cell</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input onChange={(event) => setMarkerKind(event.target.value)} placeholder="POI" value={markerKind} />
                  <Input min={0} onChange={(event) => setMarkerRadius(Number(event.target.value))} type="number" value={markerRadius} />
                  <select
                    className="h-9 rounded border border-input bg-background px-2 text-xs"
                    onChange={(event) => setMarkerDirection(event.target.value as TerrainDirection)}
                    value={markerDirection}
                  >
                    <option value="north">North</option>
                    <option value="east">East</option>
                    <option value="south">South</option>
                    <option value="west">West</option>
                  </select>
                  <Input onChange={(event) => setMarkerTags(event.target.value)} placeholder="Tags" value={markerTags} />
                </div>
                <Button onClick={addMarker} size="sm" type="button" variant="outline">
                  <Plus className="size-3" /> Marker
                </Button>
              </div>
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-semibold">Add placement at selected cell</p>
                <select
                  className="h-9 w-full rounded border border-input bg-background px-2 text-xs"
                  onChange={(event) => setPlacementMode(event.target.value as typeof placementMode)}
                  value={placementMode}
                >
                  <option value="RULE">Runtime rule slot</option>
                  <option value="FIXED">Fixed content row</option>
                </select>
                <div className="grid grid-cols-3 gap-2">
                  <Label className="space-y-1 text-[10px]">
                    Width
                    <Input
                      max={Math.min(8, asset.width - selectedX)}
                      min={1}
                      onChange={(event) => setPlacementWidth(Number(event.target.value))}
                      type="number"
                      value={placementWidth}
                    />
                  </Label>
                  <Label className="space-y-1 text-[10px]">
                    Height
                    <Input
                      max={Math.min(8, asset.height - selectedY)}
                      min={1}
                      onChange={(event) => setPlacementHeight(Number(event.target.value))}
                      type="number"
                      value={placementHeight}
                    />
                  </Label>
                  <Label className="space-y-1 text-[10px]">
                    Orientation
                    <Input
                      max={7}
                      min={0}
                      onChange={(event) => setPlacementOrientation(Number(event.target.value))}
                      type="number"
                      value={placementOrientation}
                    />
                  </Label>
                </div>
                {placementMode === "FIXED" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      onChange={(event) => setPlacementTable(event.target.value)}
                      placeholder="Content table ID"
                      value={placementTable}
                    />
                    <Input onChange={(event) => setPlacementContent(event.target.value)} placeholder="ROW_SLUG" value={placementContent} />
                  </div>
                )}
                {placementMode === "RULE" && (
                  <Input onChange={(event) => setPlacementRuleSet(event.target.value)} placeholder="RULE_SET" value={placementRuleSet} />
                )}
                <Input onChange={(event) => setPlacementTags(event.target.value)} placeholder="Placement tags" value={placementTags} />
                <Button
                  disabled={
                    selectedX + placementWidth > asset.width ||
                    selectedY + placementHeight > asset.height ||
                    (placementMode === "FIXED"
                      ? !placementTable.trim() || !normalizeSlug(placementContent)
                      : !normalizeSlug(placementRuleSet))
                  }
                  onClick={addPlacement}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Plus className="size-3" /> Placement
                </Button>
              </div>
            </div>
          </div>
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

function uniqueSlug(base: string, existing: string[]): string {
  const normalized = normalizeSlug(base);
  if (!existing.includes(normalized)) return normalized;
  let index = 2;
  while (existing.includes(`${normalized}_${index}`)) index += 1;
  return `${normalized}_${index}`;
}
