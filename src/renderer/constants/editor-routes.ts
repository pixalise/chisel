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
  { id: RouteEnum.imageConversion, label: "Image Conversion", section: "Tools", hint: "Convert images to PNG" },
  { id: RouteEnum.texturePacking, label: "Texture Packing", section: "Tools", hint: "Pack material channels" },
  { id: RouteEnum.settings, label: "Settings", section: "Project", hint: "Output and projects" }
];

export const editorSections = Array.from(new Set(editorRoutes.map((route) => route.section)));
