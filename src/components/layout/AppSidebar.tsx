import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Info, Database, Cpu, GitBranch, BookOpen, User, Workflow, Newspaper, FileText, ShieldAlert, CalendarClock } from "lucide-react";
import sonatrachLogo from "@/assets/sonatrach-logo.png";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { useI18n } from "@/contexts/I18nContext";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { t } = useI18n();

  const items = [
    { title: t("dashboard"), url: "/", icon: LayoutDashboard },
    { title: t("about"), url: "/about", icon: Info },
    { title: t("equipment"), url: "/equipment", icon: Database },
    { title: t("testSchedule"), url: "/test-schedule", icon: CalendarClock },
    { title: t("fastAlerts"),   url: "/alerts",        icon: ShieldAlert },
    { title: t("dcs"), url: "/dcs", icon: Cpu },
    { title: t("smartFlow"), url: "/smart-flow", icon: GitBranch },
    { title: t("news"), url: "/news", icon: Newspaper },
    { title: t("manuals"), url: "/manuals", icon: BookOpen },
    { title: t("author"), url: "/author", icon: User },
  ];

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded bg-white grid place-items-center shadow-accent shrink-0 p-1">
            <img src={sonatrachLogo} alt="Sonatrach" className="h-full w-full object-contain" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display font-bold text-sidebar-foreground tracking-tight leading-none">GNL1Z</div>
              <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60 mt-1">{t("appSub")}</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] tracking-widest uppercase text-sidebar-foreground/50">
              {t("modules")}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-primary data-[active=true]:border-l-2 data-[active=true]:border-sidebar-primary data-[active=true]:rounded-l-none"
                  >
                    <NavLink to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
