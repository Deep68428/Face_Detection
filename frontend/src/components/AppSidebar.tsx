import {
  LayoutDashboard,
  Camera,
  Users,
  UserCheck,
  UserCog,
  Activity,
  FileBarChart,
  Shield,
  Settings,
  ScanFace,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useRole } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { role, isAdmin, isSuperAdmin } = useRole();
  const { user } = useAuth();
  
  const mainItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, visible: true },
    { title: "Cameras", url: "/cameras", icon: Camera, visible: isAdmin },
    { title: "Employees", url: "/employees", icon: Users, visible: isAdmin },
    { title: "Face Mapping", url: "/face-mapping", icon: UserCheck, visible: isAdmin },
    { title: "Movement Logs", url: "/movement-logs", icon: Activity, visible: true },
    { title: "Reports", url: "/reports", icon: FileBarChart, visible: true },
  ];

  const systemItems = [
    { title: "Roles & Permissions", url: "/roles", icon: Shield, visible: isSuperAdmin },
    { title: "User Management", url: "/users", icon: UserCog, visible: isAdmin },
    { title: "Settings", url: "/settings", icon: Settings, visible: isAdmin },
  ];

  const getInitials = (name: string) => {
    return name?.split(" ").map(n => n[0]).join("").toUpperCase() || "??";
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white overflow-hidden p-1 shadow-sm border border-sidebar-border/50">
            <img src="/logo.jpg?v=2" alt="Logo" className="w-full h-full object-contain" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">Attendance System</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.filter(i => i.visible).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-accent/60"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {role !== "Viewer" && (
          <SidebarGroup>
            <SidebarGroupLabel>System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {systemItems.filter(i => i.visible).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-accent/60"
                        activeClassName="bg-accent text-accent-foreground font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && user && (
          <div className="flex items-center gap-2 rounded-md bg-accent/50 px-3 py-2">
            <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-[10px] font-semibold text-primary-foreground">
              {getInitials(user.name)}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-[11px] font-medium text-foreground truncate">{user.name}</span>
              <span className="text-[9px] text-muted-foreground">{user.role}</span>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
