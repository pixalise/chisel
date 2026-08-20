import type { TerrainCellAnnotations, TerrainSpatialLayout } from "./terrain-authoring";

export function setTerrainCellAnnotation(
  cells: TerrainCellAnnotations[],
  index: number,
  annotation: string,
  erase: boolean
): TerrainCellAnnotations[] {
  const current = cells.find((cell) => cell.index === index);
  const annotations = new Set(current?.annotations ?? []);
  if (erase) annotations.delete(annotation);
  else annotations.add(annotation);
  return cells
    .filter((cell) => cell.index !== index)
    .concat(annotations.size > 0 ? [{ index, annotations: [...annotations] }] : [])
    .sort((left, right) => left.index - right.index);
}

export function isTerrainAnnotationReferenced(layouts: TerrainSpatialLayout[], annotation: string): boolean {
  return layouts.some((layout) => layout.cells.some((cell) => cell.annotations.includes(annotation)));
}

export function renameTerrainAnnotationReferences(
  layouts: TerrainSpatialLayout[],
  previousAnnotation: string,
  nextAnnotation: string
): TerrainSpatialLayout[] {
  return layouts.map((layout) => ({
    ...layout,
    cells: layout.cells.map((cell) => ({
      ...cell,
      annotations: cell.annotations.map((annotation) => (annotation === previousAnnotation ? nextAnnotation : annotation))
    }))
  }));
}
