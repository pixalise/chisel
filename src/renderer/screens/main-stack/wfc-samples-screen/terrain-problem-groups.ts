export interface TerrainProblemGroup {
  count: number;
  examples: string[];
  label: string;
}

function problemLabel(problem: string): string {
  if (problem.includes("needs a slug and role")) return "Tiles need metadata";
  if (problem.includes("is orphaned")) return "Tile bindings are orphaned";
  if (problem.includes("uses missing role")) return "Tiles use missing roles";
  if (problem.includes("duplicated tile slug")) return "Tile slugs are duplicated";
  if (problem.includes("unpainted cells")) return "Samples have unpainted cells";
  if (problem.includes("uses missing tile")) return "Samples use missing tiles";
  if (problem.startsWith("Painted cell")) return "Painted cells are invalid";
  if (problem.includes("duplicate painted cell")) return "Sample cells are duplicated";
  return "Other terrain problems";
}

export function groupTerrainProblems(problems: string[]): TerrainProblemGroup[] {
  const groups = new Map<string, TerrainProblemGroup>();
  for (const problem of problems) {
    const label = problemLabel(problem);
    const group = groups.get(label) ?? { count: 0, examples: [], label };
    group.count += 1;
    if (group.examples.length < 8) group.examples.push(problem);
    groups.set(label, group);
  }
  return [...groups.values()];
}
