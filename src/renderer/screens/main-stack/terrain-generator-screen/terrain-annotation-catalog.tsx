import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { FC } from "react";
import type { TerrainAnnotationDefinition, TerrainSpatialLayout } from "../../../../shared/terrain-authoring";
import { isTerrainAnnotationReferenced, renameTerrainAnnotationReferences } from "../../../../shared/terrain-cell-annotations";
import { TerrainAnnotationDefinitionRow } from "./terrain-annotation-definition-row";

interface TerrainAnnotationCatalogProps {
  annotations: TerrainAnnotationDefinition[];
  layouts: TerrainSpatialLayout[];
  onAnnotationsChange: (annotations: TerrainAnnotationDefinition[]) => void;
  onLayoutsChange: (layouts: TerrainSpatialLayout[]) => void;
}

const colors = ["#22D3EE", "#F59E0B", "#A78BFA", "#34D399", "#FB7185", "#60A5FA"];

export const TerrainAnnotationCatalog: FC<TerrainAnnotationCatalogProps> = (props) => {
  const { annotations, layouts, onAnnotationsChange, onLayoutsChange } = props;
  const slugs = annotations.map((annotation) => annotation.slug);

  function addAnnotation(): void {
    const base = "ANNOTATION";
    let slug = base;
    let suffix = 2;
    while (slugs.includes(slug)) {
      slug = `${base}_${suffix}`;
      suffix += 1;
    }
    onAnnotationsChange([...annotations, { slug, color: colors[annotations.length % colors.length] }]);
  }

  function changeAnnotation(index: number, definition: TerrainAnnotationDefinition): void {
    const previousSlug = annotations[index]?.slug;
    if (!previousSlug) return;
    onAnnotationsChange(annotations.map((entry, entryIndex) => (entryIndex === index ? definition : entry)));
    if (previousSlug !== definition.slug) {
      onLayoutsChange(renameTerrainAnnotationReferences(layouts, previousSlug, definition.slug));
    }
  }

  function isReferenced(slug: string): boolean {
    return isTerrainAnnotationReferenced(layouts, slug);
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Global cell annotations</h3>
          <p className="text-xs text-muted-foreground">These slugs become engine enum IDs. Referenced annotations cannot be deleted.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{annotations.length}</Badge>
          <Button onClick={addAnnotation} size="sm" type="button" variant="outline">
            <Plus className="size-4" /> Annotation
          </Button>
        </div>
      </div>
      {annotations.length === 0 && <p className="text-sm text-muted-foreground">No annotation slugs have been defined.</p>}
      <div className="grid gap-2 lg:grid-cols-2">
        {annotations.map((definition, index) => (
          <TerrainAnnotationDefinitionRow
            definition={definition}
            index={index}
            isReferenced={isReferenced(definition.slug)}
            key={index}
            onChange={changeAnnotation}
            onDelete={(deleteIndex) => onAnnotationsChange(annotations.filter((_, entryIndex) => entryIndex !== deleteIndex))}
            slugs={slugs}
          />
        ))}
      </div>
    </div>
  );
};
