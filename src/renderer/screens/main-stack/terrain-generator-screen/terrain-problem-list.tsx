import { AlertTriangle, ChevronRight } from "lucide-react";
import { type FC, useMemo } from "react";
import { groupTerrainProblems } from "./terrain-problem-groups";

interface TerrainProblemListProps {
  problems: string[];
}

export const TerrainProblemList: FC<TerrainProblemListProps> = (props) => {
  const { problems } = props;
  const groups = useMemo(() => groupTerrainProblems(problems), [problems]);
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
      <div className="flex items-center gap-2 font-medium text-destructive">
        <AlertTriangle className="size-3.5" />
        {problems.length} blocking {problems.length === 1 ? "problem" : "problems"} · {groups.length}{" "}
        {groups.length === 1 ? "type" : "types"}
      </div>
      <div className="mt-1 space-y-0.5">
        {groups.map((group) => (
          <details key={group.label}>
            <summary className="flex cursor-pointer list-none items-center gap-1 py-0.5 text-muted-foreground">
              <ChevronRight className="size-3 transition-transform [[open]>&]:rotate-90" />
              {group.label} ({group.count})
            </summary>
            <ul className="ml-5 list-disc space-y-0.5 pb-1 text-muted-foreground">
              {group.examples.map((example) => (
                <li key={example}>{example}</li>
              ))}
              {group.count > group.examples.length && <li>…and {group.count - group.examples.length} more</li>}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
};
