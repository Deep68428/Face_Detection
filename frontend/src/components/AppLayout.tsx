import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell, Search, LogOut, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

interface AppLayoutProps {
  children: React.ReactNode;
}

/** Returns up to 2 initials from a full name, e.g. "John Doe" → "JD" */
function getInitials(name: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();

      // Smart Navigation (Command Palette style)
      if (["logs", "movement logs", "movement"].includes(query)) {
        navigate("/movement-logs");
        setSearchQuery("");
        return;
      }
      if (["employees", "employee", "directory"].includes(query)) {
        navigate("/employees");
        setSearchQuery("");
        return;
      }
      if (["dashboard", "home"].includes(query)) {
        navigate("/");
        setSearchQuery("");
        return;
      }
      if (["reports", "report"].includes(query)) {
        navigate("/reports");
        setSearchQuery("");
        return;
      }

      // Context-aware Search
      const targetPath = location.pathname.includes("/movement-logs") 
        ? "/movement-logs" 
        : "/employees";
      
      navigate(`${targetPath}?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border bg-card px-4 sticky top-0 z-30">
            {/* Left — sidebar trigger + search */}
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground" />
              <div className="relative hidden md:block group">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Search employees, cameras..."
                  className="pl-8 pr-8 h-8 w-64 text-sm bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted text-muted-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Right — notifications + user + logout */}
            <div className="flex items-center gap-2">

              {/* User info */}
              {user && (
                <div className="flex items-center gap-2 pl-1 border-l border-border ml-1">
                  {/* Avatar */}
                  <div
                    title={user.name}
                    className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground select-none cursor-default"
                  >
                    {getInitials(user.name)}
                  </div>

                  {/* Name + role — hidden on small screens */}
                  <div className="hidden md:block leading-none">
                    <p className="text-sm font-medium text-foreground leading-none">{user.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{user.role}</p>
                  </div>

                  {/* Logout */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Sign out"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </header>

          <main className="flex-1 overflow-auto bg-muted/30">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
