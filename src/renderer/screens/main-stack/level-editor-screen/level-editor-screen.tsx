import { type FC } from "react";
import PageHeader from "@/components/page-header";

const LevelEditorScreen: FC = () => {
  return (
    <section className="flex min-h-full min-w-0 flex-col gap-4">
      <PageHeader
        title="Level Editor"
        description="Compose level recipes from data tables, stamp passes, terrain, lighting, foliage, and preview snapshots."
      />

      <section className="flex min-h-96 items-center justify-center border border-border bg-background p-6">
        <div className="max-w-xl text-center">
          <p className="text-sm font-semibold">Level recipe authoring comes after stamp editing.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Use the global Preview button in the header. Screens now push their own Graphite snapshots into that shared runtime.
          </p>
        </div>
      </section>
    </section>
  );
};

export default LevelEditorScreen;
