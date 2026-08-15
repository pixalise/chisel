import { Badge } from "@/components/ui/badge";
import { BookOpen, CheckCircle2 } from "lucide-react";
import { type FC } from "react";

export const TerrainExampleGuide: FC = () => (
  <div className="space-y-3 rounded-md border border-emerald-700/50 bg-emerald-950/10 p-3">
    <div className="flex items-start gap-2">
      <BookOpen className="mt-0.5 size-4 text-emerald-500" />
      <div>
        <h3 className="text-sm font-semibold">Complete forest example</h3>
        <p className="text-xs text-muted-foreground">
          This is a disposable, generation-ready grammar. Hit Generate batch now, then inspect each page to see why it works.
        </p>
      </div>
      <Badge className="ml-auto" variant="secondary">
        All features used
      </Badge>
    </div>
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
      {[
        ["1 · Catalog", "A GROUND socket plus bound ground, tree, bush, and rock sprites."],
        ["2 · Pieces", "Weighted 1×1 details, a forced 2×2 grove, a rotating log, tile layers, and gameplay metadata."],
        ["3 · Collections", "One forest vocabulary plus visual deny and allow-only adjacency examples."],
        ["4 · Generate", "Three anchors, a required grove stamp, a tree-count zone, and per-cell terrain tag constraints."],
        ["5 · Library", "Select any valid result, freeze it, and verify that the approved geography no longer changes."]
      ].map(([title, copy]) => (
        <div className="rounded border border-border bg-background/70 p-2" key={title}>
          <p className="flex items-center gap-1 text-xs font-semibold">
            <CheckCircle2 className="size-3 text-emerald-500" /> {title}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{copy}</p>
        </div>
      ))}
    </div>
  </div>
);
