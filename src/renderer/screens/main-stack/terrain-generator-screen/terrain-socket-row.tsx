import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { type FC, useEffect, useState } from "react";
import type { TerrainSocketDefinition } from "../../../../shared/terrain-authoring";
import { finalizeTerrainSlug, normalizeTerrainSlugDraft } from "../../../../shared/terrain-slug";

interface TerrainSocketRowProps {
  fallbackSlug: string;
  onDelete: () => void;
  onUpdate: (update: Partial<TerrainSocketDefinition>) => void;
  socket: TerrainSocketDefinition;
}

export const TerrainSocketRow: FC<TerrainSocketRowProps> = (props) => {
  const { fallbackSlug, onDelete, onUpdate, socket } = props;
  const [slugDraft, setSlugDraft] = useState(socket.slug);

  useEffect(() => setSlugDraft(socket.slug), [socket.slug]);

  function commitSlug(): void {
    const slug = finalizeTerrainSlug(slugDraft, fallbackSlug);
    setSlugDraft(slug);
    if (slug !== socket.slug) onUpdate({ slug });
  }

  return (
    <div className="grid gap-2 rounded border border-border p-2 lg:grid-cols-[3rem_12rem_minmax(12rem,1fr)_auto] lg:items-center">
      <Input
        aria-label={`${socket.slug} color`}
        onChange={(event) => onUpdate({ color: event.target.value })}
        type="color"
        value={socket.color}
      />
      <Input
        aria-label="Socket slug"
        onBlur={commitSlug}
        onChange={(event) => setSlugDraft(normalizeTerrainSlugDraft(event.target.value))}
        value={slugDraft}
      />
      <Input
        aria-label="Socket description"
        onChange={(event) => onUpdate({ description: event.target.value })}
        placeholder="What physical boundary does this represent?"
        value={socket.description}
      />
      <Button aria-label={`Delete ${socket.slug}`} onClick={onDelete} size="icon" type="button" variant="ghost">
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
};
