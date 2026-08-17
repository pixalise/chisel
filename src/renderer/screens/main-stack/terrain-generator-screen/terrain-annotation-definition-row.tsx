import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { type FC, useEffect, useState } from "react";
import type { TerrainAnnotationDefinition } from "../../../../shared/terrain-authoring";
import { finalizeTerrainSlug, isTerrainSlugAvailable, normalizeTerrainSlugDraft } from "../../../../shared/terrain-slug";

interface TerrainAnnotationDefinitionRowProps {
  definition: TerrainAnnotationDefinition;
  index: number;
  isReferenced: boolean;
  onChange: (index: number, definition: TerrainAnnotationDefinition) => void;
  onDelete: (index: number) => void;
  slugs: string[];
}

export const TerrainAnnotationDefinitionRow: FC<TerrainAnnotationDefinitionRowProps> = (props) => {
  const { definition, index, isReferenced, onChange, onDelete, slugs } = props;
  const [slugDraft, setSlugDraft] = useState(definition.slug);
  const committedSlug = finalizeTerrainSlug(slugDraft, definition.slug);
  const duplicate = committedSlug !== definition.slug && !isTerrainSlugAvailable(committedSlug, slugs, index);

  useEffect(() => setSlugDraft(definition.slug), [definition.slug]);

  function commitSlug(): void {
    if (duplicate) {
      setSlugDraft(definition.slug);
      return;
    }
    setSlugDraft(committedSlug);
    if (committedSlug !== definition.slug) onChange(index, { ...definition, slug: committedSlug });
  }

  return (
    <div className="grid gap-2 rounded border border-border p-2 sm:grid-cols-[3rem_minmax(10rem,1fr)_auto] sm:items-center">
      <Input
        aria-label={`${definition.slug} color`}
        className="h-9 w-12 cursor-pointer p-1"
        onChange={(event) => onChange(index, { ...definition, color: event.target.value })}
        type="color"
        value={definition.color}
      />
      <div>
        <Input
          aria-invalid={duplicate}
          aria-label={`${definition.slug} slug`}
          onBlur={commitSlug}
          onChange={(event) => setSlugDraft(normalizeTerrainSlugDraft(event.target.value))}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setSlugDraft(definition.slug);
              event.currentTarget.blur();
            }
          }}
          value={slugDraft}
        />
        {duplicate && <p className="mt-1 text-xs text-destructive">That annotation slug already exists.</p>}
      </div>
      <Button
        aria-label={`Delete ${definition.slug}`}
        disabled={isReferenced}
        onClick={() => onDelete(index)}
        size="icon"
        title={isReferenced ? "Remove this annotation from every map cell before deleting it" : `Delete ${definition.slug}`}
        type="button"
        variant="ghost"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
};
