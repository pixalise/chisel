import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type FC } from "react";
import type { TerrainRole } from "../../../../shared/terrain-authoring";

interface TerrainRoleEditorProps {
  disabled: boolean;
  onChange: (roles: TerrainRole[]) => void;
  onSave: () => void;
  roles: TerrainRole[];
}

function roleId(index: number): string {
  return `ROLE_${index + 1}`;
}

export const TerrainRoleEditor: FC<TerrainRoleEditorProps> = (props) => {
  const { disabled, onChange, onSave, roles } = props;
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Tile roles</h3>
          <p className="text-xs text-muted-foreground">Semantic roles shared by every tileset.</p>
        </div>
        <div className="flex gap-2">
          <Button
            disabled={disabled}
            onClick={() => onChange([...roles, { id: roleId(roles.length), label: "New role", color: "#888888" }])}
            size="sm"
            type="button"
            variant="outline"
          >
            Add role
          </Button>
          <Button disabled={disabled} onClick={onSave} size="sm" type="button">
            Save roles
          </Button>
        </div>
      </div>
      <div className="grid gap-2">
        {roles.map((role, index) => (
          <div className="grid grid-cols-[minmax(8rem,1fr)_minmax(8rem,1fr)_5rem_auto] gap-2" key={`${role.id}-${index}`}>
            <div className="space-y-1">
              <Label className="sr-only" htmlFor={`role-id-${index}`}>
                Role id
              </Label>
              <Input
                id={`role-id-${index}`}
                onChange={(event) =>
                  onChange(
                    roles.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, id: event.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, "_") } : entry
                    )
                  )
                }
                value={role.id}
              />
            </div>
            <Input
              onChange={(event) =>
                onChange(roles.map((entry, entryIndex) => (entryIndex === index ? { ...entry, label: event.target.value } : entry)))
              }
              value={role.label}
            />
            <Input
              onChange={(event) =>
                onChange(roles.map((entry, entryIndex) => (entryIndex === index ? { ...entry, color: event.target.value } : entry)))
              }
              type="color"
              value={role.color}
            />
            <Button
              disabled={disabled}
              onClick={() => onChange(roles.filter((_, entryIndex) => entryIndex !== index))}
              type="button"
              variant="ghost"
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
