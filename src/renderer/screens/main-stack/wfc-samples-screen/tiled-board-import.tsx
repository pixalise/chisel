import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import tiledSampleService from "@/services/tiled-sample-service";
import { type FC, useState } from "react";
import type { TiledWorkspaceView } from "../../../../shared/tiled-samples";

interface TiledBoardImportProps {
  disabled: boolean;
  onError: (message: string) => void;
  onImported: (workspace: TiledWorkspaceView) => void;
}

function constantSlug(value: string): string {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

export const TiledBoardImport: FC<TiledBoardImportProps> = (props) => {
  const { disabled, onError, onImported } = props;
  const [sourcePath, setSourcePath] = useState("");
  const [boardId, setBoardId] = useState("");
  const [name, setName] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  async function chooseMap(): Promise<void> {
    const selected = await window.electron.openFileDialog({
      title: "Import native Tiled TMX sample board",
      filters: [{ name: "Tiled map files", extensions: ["tmx"] }]
    });
    if (!selected) return;
    const fileName = selected.split(/[\\/]/).pop() ?? "BOARD";
    const nextId = constantSlug(fileName);
    setSourcePath(selected);
    setBoardId(nextId);
    setName(
      nextId
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
    );
  }

  async function importBoard(): Promise<void> {
    setIsImporting(true);
    onError("");
    try {
      onImported(await tiledSampleService.importBoard({ sourcePath, boardId, name }));
      setSourcePath("");
      setBoardId("");
      setName("");
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem_auto] md:items-end">
      <div className="space-y-1">
        <Label>Finite orthogonal Tiled map (.tmx)</Label>
        <Button
          className="w-full justify-start truncate"
          disabled={disabled || isImporting}
          onClick={() => void chooseMap()}
          type="button"
          variant="outline"
        >
          {sourcePath || "Choose Tiled map…"}
        </Button>
      </div>
      <div className="space-y-1">
        <Label htmlFor="tiled-board-id">Board id</Label>
        <Input id="tiled-board-id" onChange={(event) => setBoardId(constantSlug(event.target.value))} value={boardId} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tiled-board-name">Name</Label>
        <Input id="tiled-board-name" onChange={(event) => setName(event.target.value)} value={name} />
      </div>
      <Button
        disabled={disabled || isImporting || !sourcePath || !boardId || !name.trim()}
        onClick={() => void importBoard()}
        type="button"
      >
        {isImporting ? "Importing…" : "Import board"}
      </Button>
    </div>
  );
};
