export interface TiledProblemGroup {
  id: string;
  label: string;
  problems: string[];
}

const knownProblemTypes: Array<{ id: string; label: string; pattern: RegExp }> = [
  { id: "UNBOUND_TILE", label: "Tiles need a slug and role", pattern: /^Tile '.+' needs a slug and role$/ },
  { id: "ORPHANED_TILE", label: "Tile bindings are orphaned", pattern: /^Tile binding '.+' is orphaned$/ },
  { id: "MISSING_ROLE", label: "Tiles use a missing role", pattern: /^Tile '.+' uses missing role '.+'$/ },
  { id: "DUPLICATE_SLUG", label: "Tile slugs are duplicated", pattern: /^Tile slug '.+' is duplicated$/ },
  { id: "SAMPLE_OUTSIDE", label: "Samples extend outside the board", pattern: /^Sample '.+' extends outside the board$/ },
  { id: "MISSING_LAYER", label: "Samples use a missing layer", pattern: /^Sample '.+' uses missing layer \d+$/ },
  { id: "OVERLAPPING_SAMPLE", label: "Samples overlap", pattern: /^Samples '.+' and '.+' overlap$/ }
];

export function groupTiledProblems(problems: string[]): TiledProblemGroup[] {
  const groups = new Map<string, TiledProblemGroup>();
  for (const problem of problems) {
    const type = knownProblemTypes.find((entry) => entry.pattern.test(problem));
    const id = type?.id ?? problem;
    const existing = groups.get(id);
    if (existing) {
      existing.problems.push(problem);
      continue;
    }
    groups.set(id, { id, label: type?.label ?? problem, problems: [problem] });
  }
  return [...groups.values()];
}
