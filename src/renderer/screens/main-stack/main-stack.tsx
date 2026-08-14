import { FC } from "react";
import EditorSidebar from "@/components/layout/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { editorRoutes } from "@/constants/editor-routes";
import { RouteEnum } from "@/constants/route-enum";
import { AssetLibraryScreen } from "@/screens/main-stack/asset-library-screen/asset-library-screen";
import { DataTablesScreen } from "@/screens/main-stack/data-tables-screen/data-tables-screen";
import { ImageConversionScreen } from "@/screens/main-stack/image-conversion-screen/image-conversion-screen";
import LocalizationScreen from "@/screens/main-stack/localization-screen/localization-screen";
import { SettingsScreen } from "@/screens/main-stack/settings-screen";
import TodoScreen from "@/screens/main-stack/todo-screen/todo-screen";
import { WfcSamplesScreen } from "@/screens/main-stack/wfc-samples-screen/wfc-samples-screen";

const MainStack: FC = () => {
  const { pathname } = useLocation();
  const activeRoute = editorRoutes.find((route) => route.id.includes(pathname)) ?? editorRoutes[0];

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
              <Route element={<AssetLibraryScreen />} path={RouteEnum.assets} />
              <Route element={<DataTablesScreen />} path={RouteEnum.database} />
              <Route element={<LocalizationScreen />} path={RouteEnum.localization} />
              <Route element={<WfcSamplesScreen />} path={RouteEnum.wfcSamples} />
              <Route element={<ImageConversionScreen />} path={RouteEnum.imageConversion} />
              <Route element={<SettingsScreen />} path={RouteEnum.settings} />
              <Route element={<TodoScreen />} path={RouteEnum.todos} />
              <Route element={<Navigate replace to={RouteEnum.assets} />} path="*" />
            </Routes>
          </div>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  );
};
export default MainStack;
