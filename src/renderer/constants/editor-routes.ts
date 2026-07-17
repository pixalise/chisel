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
  { id: RouteEnum.stampEditor, label: "Stamp Editor", section: "Terrain", hint: "Author stamp footprints" },
  { id: RouteEnum.biomeEditor, label: "Splat Editor", section: "Terrain", hint: "Author procedural terrain splats" },
  { id: RouteEnum.levelEditor, label: "Level Editor", section: "Terrain", hint: "Preview level snapshots" },
  { id: RouteEnum.terrainTextures, label: "Texture Packing", section: "Terrain", hint: "Create Terrain Texture packages" },
  { id: RouteEnum.imageConversion, label: "Image Conversion", section: "Tools", hint: "Convert images to PNG" },
  { id: RouteEnum.settings, label: "Settings", section: "Project", hint: "Output and projects" }
];

export const editorSections = Array.from(new Set(editorRoutes.map((route) => route.section)));
