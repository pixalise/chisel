import type {
  GraphitePreviewCameraConfig,
  GraphitePreviewOptionsConfig,
  GraphitePreviewResetViewInput,
  GraphitePreviewSettingsConfig,
  GraphitePreviewSettingsState,
  GraphitePreviewSnapshotConfig,
  GraphitePreviewStartInput,
  GraphitePreviewState,
  GraphitePreviewViewPreset
} from "../../shared/types";

const previewViewCameraPresets: Record<GraphitePreviewViewPreset, GraphitePreviewCameraConfig> = {
  default: {
    distance: 48,
    fovDegrees: 42,
    pitchDegrees: 55,
    target: [0, 0.45, 0],
    yawDegrees: 45
  },
  stamp: {
    distance: 48,
    fovDegrees: 42,
    pitchDegrees: 55,
    target: [0, 0.4, 0],
    yawDegrees: 45
  },
  level: {
    distance: 720,
    fovDegrees: 42,
    pitchDegrees: 55,
    target: [0, 8, 0],
    yawDegrees: 45
  },
  biome: {
    distance: 30,
    fovDegrees: 38,
    pitchDegrees: 54,
    target: [0, 0.45, 0],
    yawDegrees: 35
  },
  foliage: {
    distance: 18,
    fovDegrees: 36,
    pitchDegrees: 38,
    target: [0, 1, 0],
    yawDegrees: 45
  }
};

class PreviewService {
  public getStatus(): Promise<GraphitePreviewState> {
    return window.electron.getGraphitePreviewStatus();
  }

  public getSettings(): Promise<GraphitePreviewSettingsState> {
    return window.electron.getGraphitePreviewSettings();
  }

  public start(input: GraphitePreviewStartInput): Promise<GraphitePreviewState> {
    return window.electron.startGraphitePreview(input);
  }

  public stop(): Promise<GraphitePreviewState> {
    return window.electron.stopGraphitePreview();
  }

  public updateOptions(previewOptions: GraphitePreviewOptionsConfig): Promise<GraphitePreviewState> {
    return window.electron.updateGraphitePreviewOptions({ previewOptions });
  }

  public updateSettings(settings: GraphitePreviewSettingsConfig): Promise<GraphitePreviewSettingsState> {
    return window.electron.updateGraphitePreviewSettings({ settings });
  }

  public updateSnapshot(snapshot: GraphitePreviewSnapshotConfig): Promise<GraphitePreviewState> {
    return window.electron.updateGraphitePreviewSnapshot({ snapshot });
  }

  public resetView(preset: GraphitePreviewViewPreset): Promise<GraphitePreviewState> {
    const input: GraphitePreviewResetViewInput = {
      camera: previewViewCameraPresets[preset],
      preset
    };
    return window.electron.resetGraphitePreviewView(input);
  }
}

const previewService = new PreviewService();
export default previewService;
