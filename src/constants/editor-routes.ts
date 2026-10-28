import { RouteEnum } from "@/enums/route-enum"
export interface EditorRouteDefinition {
  id: RouteEnum
  hint: string
  label: string
  section: string
}
export const editorRoutes: EditorRouteDefinition[] = [
  { id: RouteEnum.ASSETS, label: "Asset Library", section: "Workspace", hint: "Managed imports" },
  {
    id: RouteEnum.DATABASE,
    label: "Data Tables",
    section: "Workspace",
    hint: "Typed authoring data",
  },
  {
    id: RouteEnum.LOCALIZATION,
    label: "Localization",
    section: "Workspace",
    hint: "Translation source data",
  },
  {
    id: RouteEnum.IMAGE_CONVERSION,
    label: "Image Conversion",
    section: "Tools",
    hint: "Convert images to PNG",
  },
  {
    id: RouteEnum.TODOS,
    label: "Project Management",
    section: "Tools",
    hint: "Track todos and checklist items",
  },
  { id: RouteEnum.SETTINGS, label: "Settings", section: "Project", hint: "Output and projects" },
]
export const editorSections = Array.from(new Set(editorRoutes.map((route) => route.section)))
