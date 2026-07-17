import { type FC, useEffect, useState } from "react";
import { Play, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RouteEnum } from "@/constants/route-enum";
import previewService from "@/services/preview-service";
import useAppStore from "@/stores/app-store";
import { useLocation } from "react-router";
import type { GraphitePreviewState } from "../../../shared/types";

const GlobalPreviewControl: FC = () => {
  const { pathname } = useLocation();
  const project = useAppStore((state) => state.computed.project);
  const [previewState, setPreviewState] = useState<GraphitePreviewState>({
    message: "Graphite preview runtime is stopped.",
    running: false,
    status: "stopped"
  });
  const [isPending, setIsPending] = useState(false);
  const canStart = !previewState.running && previewState.status !== "starting" && !isPending;
  const canStop = (previewState.running || previewState.status === "starting") && !isPending;
  const statusVariant = previewState.status === "error" ? "destructive" : "outline";

  useEffect(() => {
    let mounted = true;
    void previewService.getStatus().then((state) => {
      if (mounted) {
        setPreviewState(state);
      }
    });
    const unsubscribe = window.electron.onGraphitePreviewEvent((event) => {
      if (event.type !== "log") {
        setPreviewState(event);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  async function startPreview(): Promise<void> {
    setIsPending(true);
    try {
      const state = await previewService.start({
        projectPath: project.path,
        settingsMode: pathname === RouteEnum.biomeEditor ? "splat" : "default",
        snapshotKind: "fixed_scene"
      });
      setPreviewState(state);
    } finally {
      setIsPending(false);
    }
  }

  async function stopPreview(): Promise<void> {
    setIsPending(true);
    try {
      const state = await previewService.stop();
      setPreviewState(state);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="ml-auto flex min-w-0 items-center gap-2">
      <Badge className="hidden w-40 justify-center truncate md:inline-flex" title={previewState.message} variant={statusVariant}>
        Preview {previewState.status}
      </Badge>
      <Button disabled={!canStart} onClick={startPreview} size="sm" type="button" variant="secondary">
        <Play className="size-3.5" />
        Preview
      </Button>
      <Button disabled={!canStop} onClick={stopPreview} size="sm" type="button" variant="outline">
        <Square className="size-3.5" />
        Stop
      </Button>
    </div>
  );
};

export default GlobalPreviewControl;
