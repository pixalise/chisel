import { AlertTriangle, ChevronRight } from "lucide-react";
import { type FC, useMemo } from "react";
import { groupTiledProblems } from "./tiled-problem-groups";

interface TiledProblemListProps {
  problems: string[];
}

export const TiledProblemList: FC<TiledProblemListProps> = (props) => {
  const { problems } = props;
  const groups = useMemo(() => groupTiledProblems(problems), [problems]);

  return (
    <div className="space-y-1.5 rounded-md border border-destructive/50 bg-destructive/5 p-2 text-destructive">
      <div className="flex items-center gap-2 text-xs font-medium">
        <AlertTriangle className="size-3.5 shrink-0" />
        <span>
          {problems.length} blocking problem{problems.length === 1 ? "" : "s"} · {groups.length} type
          {groups.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="space-y-1 pl-5 text-xs">
        {groups.map((group) =>
          group.problems.length > 1 ? (
            <details className="group" key={group.id}>
              <summary className="flex cursor-pointer list-none items-center gap-1 text-foreground marker:hidden">
                <ChevronRight className="size-3 shrink-0 transition-transform group-open:rotate-90" />
                <span>{group.label}</span>
                <span className="text-muted-foreground">({group.problems.length})</span>
              </summary>
              <ul className="ml-4 mt-1 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-4 text-muted-foreground">
                {group.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="text-foreground" key={group.id}>
              {group.label}
            </p>
          )
        )}
      </div>
    </div>
  );
};
