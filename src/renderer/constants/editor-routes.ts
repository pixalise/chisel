import { RouteEnum } from "@/constants/route-enum";

export interface EditorRouteDefinition {
  id: RouteEnum;
  hint: string;
  label: string;
  section: string;
}

export const editorRoutes: EditorRouteDefinition[] = [
  { id: RouteEnum.assets, label: "Asset Library", section: "Workspace", hint: "Managed imports" },
  { id: RouteEnum.database, label: "Data Tables", section: "Workspace", hint: "Typed authoring data" },
  { id: RouteEnum.localization, label: "Localization", section: "Workspace", hint: "Translation source data" },
  { id: RouteEnum.wfcSamples, label: "WFC Samples", section: "Workspace", hint: "Tiled boards and generation metadata" },
  { id: RouteEnum.imageConversion, label: "Image Conversion", section: "Tools", hint: "Convert images to PNG" },
  { id: RouteEnum.todos, label: "Project Management", section: "Tools", hint: "Track todos and checklist items" },
  { id: RouteEnum.settings, label: "Settings", section: "Project", hint: "Output and projects" }
];

export const editorSections = Array.from(new Set(editorRoutes.map((route) => route.section)));
