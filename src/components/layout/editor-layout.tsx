import EditorSidebar from "@/components/layout/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { editorRoutes } from "@/constants/editor-routes"
import { RouteEnum } from "@/enums/route-enum"
import { AssetLibraryPage } from "@/pages/asset-library-page"
import { DataTablesPage } from "@/pages/data-tables-page"
import { ImageConversionPage } from "@/pages/image-conversion-page"
import LocalizationPage from "@/pages/localization-page"
import { SettingsPage } from "@/pages/settings-page"
import TodoPage from "@/pages/todo-page"
import type { FC } from "react"
import { Navigate, Route, Routes, useLocation } from "react-router"
const EditorLayout: FC = () => {
  const { pathname } = useLocation()
  const activeRoute = editorRoutes.find((route) => route.id.includes(pathname)) ?? editorRoutes[0]
  return (
    <SidebarProvider>
      <EditorSidebar />
      <SidebarInset className="h-svh min-w-0 overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
          <SidebarTrigger />
          <Separator className="h-4" orientation="vertical" />
          <h1 className="truncate text-sm font-semibold">{activeRoute.label}</h1>
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <div className="min-h-full p-4">
            <Routes>
              <Route element={<AssetLibraryPage />} path={RouteEnum.ASSETS} />
              <Route element={<DataTablesPage />} path={RouteEnum.DATABASE} />
              <Route element={<LocalizationPage />} path={RouteEnum.LOCALIZATION} />
              <Route element={<ImageConversionPage />} path={RouteEnum.IMAGE_CONVERSION} />
              <Route element={<SettingsPage />} path={RouteEnum.SETTINGS} />
              <Route element={<TodoPage />} path={RouteEnum.TODOS} />
              <Route element={<Navigate replace to={RouteEnum.ASSETS} />} path="*" />
            </Routes>
          </div>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  )
}
export default EditorLayout
