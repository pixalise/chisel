import type { FC, ReactNode } from "react";
import { Section } from "@/components/layout/section";
import PageHeader from "@/components/page-header";
import useAppStore from "@/stores/app-store";

export const SettingsScreen: FC = () => {
  const {
    computed: { project }
  } = useAppStore();

  return (
    <section className="flex min-h-full w-full min-w-0 flex-col gap-4">
      <PageHeader title="Settings" description="Inspect the active Chisel project and its authoritative Chisel files." />
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
      </div>
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
