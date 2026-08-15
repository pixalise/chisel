import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { type FC } from "react";
import type { TerrainSocketDefinition } from "../../../../shared/terrain-authoring";

interface TerrainSocketCatalogProps {
  onChange: (sockets: TerrainSocketDefinition[]) => void;
  sockets: TerrainSocketDefinition[];
}

export const TerrainSocketCatalog: FC<TerrainSocketCatalogProps> = (props) => {
  const { onChange, sockets } = props;

  function update(index: number, updateValue: Partial<TerrainSocketDefinition>): void {
    onChange(sockets.map((socket, socketIndex) => (socketIndex === index ? { ...socket, ...updateValue } : socket)));
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Wang socket catalog</h3>
          <p className="text-xs text-muted-foreground">Opposing edge segments connect only when their stable socket slugs match exactly.</p>
        </div>
        <Button
          onClick={() =>
            onChange([
              ...sockets,
              {
                slug: uniqueSlug(sockets),
                label: "New socket",
                color: "#8B9D5C",
                description: ""
              }
            ])
          }
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus className="size-4" /> Add socket
        </Button>
      </div>
      {sockets.length === 0 && (
        <p className="rounded border border-dashed p-4 text-center text-sm text-muted-foreground">Define the first edge socket.</p>
      )}
      <div className="grid gap-2">
        {sockets.map((socket, index) => (
          <div
            className="grid gap-2 rounded border border-border p-2 lg:grid-cols-[3rem_12rem_12rem_minmax(12rem,1fr)_auto] lg:items-center"
            key={`${socket.slug}-${index}`}
          >
            <Input
              aria-label={`${socket.slug} color`}
              onChange={(event) => update(index, { color: event.target.value })}
              type="color"
              value={socket.color}
            />
            <Input
              aria-label="Socket slug"
              onChange={(event) => update(index, { slug: normalizeSlug(event.target.value) })}
              value={socket.slug}
            />
            <Input aria-label="Socket label" onChange={(event) => update(index, { label: event.target.value })} value={socket.label} />
            <Input
              aria-label="Socket description"
              onChange={(event) => update(index, { description: event.target.value })}
              placeholder="What physical boundary does this represent?"
              value={socket.description}
            />
            <Button
              aria-label={`Delete ${socket.slug}`}
              onClick={() => onChange(sockets.filter((_, entryIndex) => entryIndex !== index))}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

function normalizeSlug(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+/, "");
}

function uniqueSlug(sockets: TerrainSocketDefinition[]): string {
  let index = sockets.length + 1;
  while (sockets.some((entry) => entry.slug === `SOCKET_${index}`)) index += 1;
  return `SOCKET_${index}`;
}
