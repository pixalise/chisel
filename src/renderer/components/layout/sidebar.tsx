import { Boxes, Database, Grid3X3, Images, Languages, Settings2, type LucideIcon, ListChecks } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from "@/components/ui/sidebar";
import { RouteEnum } from "@/constants/route-enum";
import { editorRoutes, editorSections } from "@/constants/editor-routes";
import { FC } from "react";
import { NavLink, useLocation } from "react-router";
import useAppStore from "@/stores/app-store";

const routeIcons: Record<RouteEnum, LucideIcon> = {
  [RouteEnum.assets]: Boxes,
  [RouteEnum.database]: Database,
  [RouteEnum.localization]: Languages,
  [RouteEnum.imageConversion]: Images,
  [RouteEnum.terrainGenerator]: Grid3X3,
  [RouteEnum.settings]: Settings2,
  [RouteEnum.todos]: ListChecks
};

const EditorSidebar: FC = () => {
  const { pathname } = useLocation();
  const {
    computed: { project }
  } = useAppStore();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex flex-row space-x-2 items-center">
          <img alt="" className="size-8 shrink-0" src="assets/chisel-shrinked.png" />
          <div>
            <h1 className="truncate text-sm font-bold group-data-[collapsible=icon]:hidden">Chisel Editor</h1>
            <p className="truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              Working in <strong>{project.name}</strong>
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {editorSections.map((section) => (
          <SidebarGroup key={section}>
            <SidebarGroupLabel>{section}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {editorRoutes
                  .filter((route) => route.section === section)
                  .map((route) => {
                    const Icon = routeIcons[route.id];
                    const isActive = route.id.includes(pathname);

                    return (
                      <SidebarMenuItem key={route.id}>
                        <SidebarMenuButton
                          asChild
                          className="group-data-[collapsible=icon]:justify-center"
                          isActive={isActive}
                          size="lg"
                          tooltip={`${route.label}: ${route.hint}`}
                        >
                          <NavLink to={route.id}>
                            <Icon />
                            <div className="grid min-w-0 flex-1  group-data-[collapsible=icon]:hidden">
                              <p className="truncate text-xs font-semibold">{route.label}</p>
                              <p className="truncate text-[11px] font-normal text-muted-foreground">{route.hint}</p>
                            </div>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
};

export default EditorSidebar;
