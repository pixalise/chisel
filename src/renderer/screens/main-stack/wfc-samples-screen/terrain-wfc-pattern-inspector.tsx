import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { type FC, useEffect, useMemo, useState } from "react";
import type { TerrainTilesetView } from "../../../../shared/terrain-authoring";
import { terrainWfcPatternDiagnostics, type TerrainWfcLibrary } from "../../../../shared/terrain-wfc";
import { TerrainWfcPatternCard } from "./terrain-wfc-pattern-card";

interface TerrainWfcPatternInspectorProps {
  library: TerrainWfcLibrary;
  tilesets: TerrainTilesetView[];
}

type PatternFilter = "all" | "valid" | "invalid";

const pageSize = 48;

export const TerrainWfcPatternInspector: FC<TerrainWfcPatternInspectorProps> = (props) => {
  const { library, tilesets } = props;
  const diagnostics = useMemo(() => terrainWfcPatternDiagnostics(library), [library]);
  const validCount = diagnostics.filter((entry) => entry.viable).length;
  const invalidCount = diagnostics.length - validCount;
  const [images] = useState(() => new Map<string, HTMLImageElement>());
  const [imageRevision, setImageRevision] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const [filter, setFilter] = useState<PatternFilter>(invalidCount > 0 ? "invalid" : "valid");
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    images.clear();
    let cancelled = false;
    for (const tileset of tilesets) {
      const image = new Image();
      image.onload = () => {
        if (!cancelled) setImageRevision((value) => value + 1);
      };
      image.onerror = () => {
        if (!cancelled) setImageRevision((value) => value + 1);
      };
      image.src = window.electron.toAssetUrl(tileset.imagePath);
      images.set(tileset.id, image);
    }
    return () => {
      cancelled = true;
    };
  }, [images, tilesets]);

  useEffect(() => {
    setIsOpen(true);
    setFilter(invalidCount > 0 ? "invalid" : "valid");
    setVisibleCount(pageSize);
  }, [invalidCount, library]);

  const filteredDiagnostics = diagnostics.filter((entry) => {
    if (filter === "valid") return entry.viable;
    if (filter === "invalid") return !entry.viable;
    return true;
  });
  const visibleDiagnostics = filteredDiagnostics.slice(0, visibleCount);

  function changeFilter(nextFilter: PatternFilter): void {
    setFilter(nextFilter);
    setVisibleCount(pageSize);
  }

  return (
    <div className="rounded border border-border">
      <button
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/50"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        <span className="flex items-center gap-2 text-xs font-medium">
          <ChevronRight className={cn("size-4 transition-transform", isOpen && "rotate-90")} />
          Pattern inspector
        </span>
        <span className="flex items-center gap-3 text-xs">
          <span className="text-emerald-500">{validCount} valid</span>
          <span className={cn(invalidCount > 0 ? "text-destructive" : "text-muted-foreground")}>{invalidCount} invalid</span>
        </span>
      </button>
      {isOpen && (
        <div className="space-y-3 border-t border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-3xl text-xs text-muted-foreground">
              Valid patterns can continue through globally valid neighbors in every direction. A red 0 marks the direction that makes an
              invalid pattern unusable for repeatable biome interiors.
            </p>
            <div className="flex gap-1">
              <Button
                onClick={() => changeFilter("invalid")}
                size="sm"
                type="button"
                variant={filter === "invalid" ? "secondary" : "ghost"}
              >
                Invalid ({invalidCount})
              </Button>
              <Button onClick={() => changeFilter("valid")} size="sm" type="button" variant={filter === "valid" ? "secondary" : "ghost"}>
                Valid ({validCount})
              </Button>
              <Button onClick={() => changeFilter("all")} size="sm" type="button" variant={filter === "all" ? "secondary" : "ghost"}>
                All ({diagnostics.length})
              </Button>
            </div>
          </div>
          {filteredDiagnostics.length === 0 && (
            <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No {filter} patterns in this library.
            </p>
          )}
          {visibleDiagnostics.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {visibleDiagnostics.map((diagnostic) => (
                <TerrainWfcPatternCard
                  diagnostic={diagnostic}
                  imageRevision={imageRevision}
                  images={images}
                  key={diagnostic.patternId}
                  library={library}
                  tilesets={tilesets}
                />
              ))}
            </div>
          )}
          {visibleCount < filteredDiagnostics.length && (
            <div className="flex justify-center">
              <Button onClick={() => setVisibleCount((count) => count + pageSize)} size="sm" type="button" variant="outline">
                Show {Math.min(pageSize, filteredDiagnostics.length - visibleCount)} more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
