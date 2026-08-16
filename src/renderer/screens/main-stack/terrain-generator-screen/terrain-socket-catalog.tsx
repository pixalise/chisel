import { Button } from "@/components/ui/button";
import { TerrainSocketRow } from "@/screens/main-stack/terrain-generator-screen/terrain-socket-row";
import { Plus } from "lucide-react";
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
          <TerrainSocketRow
            fallbackSlug={uniqueSlug(sockets)}
            key={index}
            onDelete={() => onChange(sockets.filter((_, entryIndex) => entryIndex !== index))}
            onUpdate={(updateValue) => update(index, updateValue)}
            socket={socket}
          />
        ))}
      </div>
    </div>
  );
};

function uniqueSlug(sockets: TerrainSocketDefinition[]): string {
  let index = sockets.length + 1;
  while (sockets.some((entry) => entry.slug === `SOCKET_${index}`)) index += 1;
  return `SOCKET_${index}`;
}
