import { type FC, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/layout/section";
import useExportProjectMutation from "@/hooks/use-export-project-mutation";
import { useToast } from "@/hooks/use-toast";
import { type ExportProjectResult } from "@/services/export-service";
import useAppStore from "@/stores/app-store";

export const SettingsScreen: FC = () => {
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<ExportProjectResult | null>(null);
  const {
    computed: { project }
  } = useAppStore();
  const { exportProject, isExportProjectLoading } = useExportProjectMutation();
  const { toast } = useToast();

  async function onExportProject(): Promise<void> {
    setExportError(null);

    try {
      const result = await exportProject();
      setLastExport(result);
      toast({
        title: "Game data exported",
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
            <SettingsRow label="Table definitions" value=".chisel/tables.json" />
            <SettingsRow label="Table rows" value=".chisel/tables/<table_id>_rows.json" />
          </Section>
          <Section title="Current Project" copy="Runtime export will be added as a separate workflow.">
            <SettingsRow label="Name" value={project.name} />
            <SettingsRow label="Project path" value={project.path} />
            <SettingsRow label="Project id" value={project.id} />
          </Section>
          <Section title="Game Data Export" copy="Generated Godot scripts are written beside .chisel.">
            <SettingsRow label="Export root" value="game_data" />
            <SettingsRow label="Manifest" value="game_data/manifest.gd" />
            {lastExport && <SettingsRow label="Last export" value={lastExport.exportedAt} />}
            {lastExport && <SettingsRow label="Files" value={String(lastExport.fileCount)} />}
            {lastExport && <SettingsRow label="Output folder" value={lastExport.outputPath} />}
            {exportError && <SettingsRow label="Export error" value={exportError} />}
            <div className="pt-3">
              <Button disabled={isExportProjectLoading} onClick={onExportProject} type="button">
                {isExportProjectLoading ? "Exporting..." : "Export Game Data"}
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
