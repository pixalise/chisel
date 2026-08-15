import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import { type FC } from "react";
import { terrainDirections, type TerrainSocketDefinition } from "../../../../shared/terrain-authoring";
import type { TerrainPieceCompatibility } from "../../../../shared/terrain-wfc";

interface TerrainCompatibilityInspectorProps {
  compatibility: TerrainPieceCompatibility;
  sockets: TerrainSocketDefinition[];
}

export const TerrainCompatibilityInspector: FC<TerrainCompatibilityInspectorProps> = (props) => {
  const { compatibility, sockets } = props;
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        {compatibility.viable ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-destructive" />}
        <div>
          <h3 className="text-sm font-semibold">Current piece compatibility</h3>
          <p className="text-xs text-muted-foreground">{compatibility.pieceSlug} · analyzed from the current unsaved editor state</p>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {terrainDirections.map((direction) => {
          const result = compatibility.directions[direction];
          return (
            <div className="space-y-2 rounded border border-border p-2" key={direction}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase">{direction}</span>
                <Badge variant={result.compatibleStates > 0 ? "secondary" : "destructive"}>{result.compatibleStates} states</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {result.socketSegments.map((slug) => (
                  <span
                    className="rounded border px-1.5 py-0.5 text-[10px]"
                    key={slug}
                    style={{ borderColor: sockets.find((entry) => entry.slug === slug)?.color }}
                  >
                    {slug || "MISSING"}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {result.compatiblePieces.length > 0 ? result.compatiblePieces.join(", ") : "No compatible neighbor variants"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
