import { type FC, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/layout/section";
import useExportProjectMutation from "@/hooks/use-export-project-mutation";
import useSourceCommitsQuery from "@/hooks/use-source-commits-query";
import useSourceStateMutations from "@/hooks/use-source-state-mutations";
import { useToast } from "@/hooks/use-toast";
import { ExportTarget, type ExportProjectResult } from "@/services/export-service";
import useAppStore from "@/stores/app-store";

const exportTargetLabels: Record<ExportTarget, string> = {
  [ExportTarget.godot]: "Godot",
  [ExportTarget.haxeFlixel]: "HaxeFlixel",
  [ExportTarget.love2d]: "LÖVE",
  [ExportTarget.teal]: "Teal"
};

export const SettingsScreen: FC = () => {
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<ExportProjectResult | null>(null);
  const {
    computed: { project }
  } = useAppStore();
  const { exportProject, isExportProjectLoading } = useExportProjectMutation();
  const { commits } = useSourceCommitsQuery();
  const { commitDraft, isSourceStateMutating, rollbackToCommit } = useSourceStateMutations();
  const { toast } = useToast();

  async function onCommitDraft(): Promise<void> {
    try {
      const commit = await commitDraft();
      toast({
        title: "Draft committed",
        description: `Committed ${commit.tables.length} tables, ${commit.assets.assets.length} assets, ${commit.localization.keys.length} translations, and ${commit.localization.locales.length} locales.`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Commit failed",
        description: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function onRollbackCommit(commitId: string): Promise<void> {
    const shouldRollback = window.confirm("Roll back the current draft to this committed Chisel source state?");
    if (!shouldRollback) {
      return;
    }
    try {
      const commit = await rollbackToCommit(commitId);
      toast({
        title: "Draft rolled back",
        description: `Restored commit from ${commit.committedAt}.`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Rollback failed",
        description: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function onExportProject(target: ExportTarget): Promise<void> {
    setExportError(null);

    try {
      const result = await exportProject(target);
      setLastExport(result);
      toast({
        title: `${exportTargetLabels[target]} data exported`,
        description: `${result.fileCount} files written to ${result.outputPath}.`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExportError(message);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: message
      });
    }
  }

  return (
    <section className="flex min-h-full w-full min-w-0 flex-col gap-4">
      <Section title="Settings" copy="Inspect the active Chisel project and its authoritative Chisel files.">
        <div className="grid grid-cols-2 gap-4 max-[1120px]:grid-cols-1">
          <Section title="Authoring Data" copy="Each Chisel domain is stored independently inside .chisel.">
            <SettingsRow label="Project" value=".chisel/chisel.json" />
            <SettingsRow label="Assets" value=".chisel/assets.json" />
            <SettingsRow label="Localization" value=".chisel/localization.json" />
            <SettingsRow label="Table definitions" value=".chisel/tables.json" />
            <SettingsRow label="Table rows" value=".chisel/tables/<table_id>_rows.json" />
            <SettingsRow label="Commits" value=".chisel/commits.json" />
          </Section>
          <Section title="Current Project" copy="Exports are generated beside .chisel from the latest committed source state.">
            <SettingsRow label="Name" value={project.name} />
            <SettingsRow label="Project path" value={project.path} />
            <SettingsRow label="Project id" value={project.id} />
          </Section>
          <Section title="Source State" copy="Draft data is editable. Export uses the latest committed source state.">
            <SettingsRow label="Latest commit" value={commits[0]?.committedAt ?? "No committed source state"} />
            <div className="space-y-2 pt-3">
              <Button disabled={isSourceStateMutating} onClick={onCommitDraft} type="button" variant="secondary">
                {isSourceStateMutating ? "Working..." : "Commit Draft"}
              </Button>
              <div className="space-y-2">
                {commits.slice(0, 5).map((commit) => (
                  <div className="flex items-center gap-3 border border-border p-2" key={commit.id}>
                    <div className="min-w-0 flex-1">
                      <code className="block truncate text-xs">{commit.id}</code>
                      <p className="m-0 text-xs text-muted-foreground">
                        {commit.committedAt} · {commit.tables.length} tables · {commit.assets.assets.length} assets ·{" "}
                        {commit.localization.keys.length} translations · {commit.localization.locales.length} locales
                      </p>
                    </div>
                    <Button
                      disabled={isSourceStateMutating}
                      onClick={() => onRollbackCommit(commit.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Rollback
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </Section>
          <Section title="Game Data Export" copy="Generate data-oriented runtime modules from the latest committed Chisel state.">
            <SettingsRow label="Godot" value="game_data/manifest.gd" />
            <SettingsRow label="HaxeFlixel" value="source/gamedata/ChiselManifest.hx" />
            <SettingsRow label="LÖVE" value="gamedata/manifest.lua" />
            <SettingsRow label="Teal" value="gamedata/manifest.tl" />
            {lastExport && <SettingsRow label="Last target" value={exportTargetLabels[lastExport.target]} />}
            {lastExport && <SettingsRow label="Last export" value={lastExport.exportedAt} />}
            {lastExport && <SettingsRow label="Files" value={String(lastExport.fileCount)} />}
            {lastExport && <SettingsRow label="Output folder" value={lastExport.outputPath} />}
            {exportError && <SettingsRow label="Export error" value={exportError} />}
            <div className="flex flex-wrap gap-2 pt-3">
              <Button disabled={isExportProjectLoading} onClick={() => onExportProject(ExportTarget.godot)} type="button">
                {isExportProjectLoading ? "Exporting..." : "Export Godot"}
              </Button>
              <Button
                disabled={isExportProjectLoading}
                onClick={() => onExportProject(ExportTarget.haxeFlixel)}
                type="button"
                variant="secondary"
              >
                {isExportProjectLoading ? "Exporting..." : "Export HaxeFlixel"}
              </Button>
              <Button
                disabled={isExportProjectLoading}
                onClick={() => onExportProject(ExportTarget.love2d)}
                type="button"
                variant="secondary"
              >
                {isExportProjectLoading ? "Exporting..." : "Export LÖVE"}
              </Button>
              <Button
                disabled={isExportProjectLoading}
                onClick={() => onExportProject(ExportTarget.teal)}
                type="button"
                variant="secondary"
              >
                {isExportProjectLoading ? "Exporting..." : "Export Teal"}
              </Button>
            </div>
          </Section>
        </div>
      </Section>
    </section>
  );
};

const SettingsRow: FC<{ children?: ReactNode; label: string; value: string }> = (props) => {
  const { children, label, value } = props;
  return (
    <div className="flex items-center gap-3 border-b border-border py-3 first:border-t">
      <span className="w-36 shrink-0 font-mono text-xs uppercase text-muted-foreground">{label}</span>
      <code className="min-w-0 flex-1 truncate text-xs">{value}</code>
      {children}
    </div>
  );
};
