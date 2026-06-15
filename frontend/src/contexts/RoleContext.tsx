import { createContext, useContext, ReactNode, useMemo } from "react";
import { useAuth } from "./AuthContext";

export type UserRole = "Super Admin" | "Admin" | "Viewer";

interface RoleContextType {
  role: UserRole;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

const RoleContext = createContext<RoleContextType>({
  role: "Viewer",
  canEdit: false,
  canDelete: false,
  canExport: false,
  isAdmin: false,
  isSuperAdmin: false,
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const role: UserRole = user?.role || "Viewer";

  const permissions = useMemo(() => {
    const roleNormalized = (role || "").toLowerCase().replace(/\s+/g, "");
    const isSuperAdmin = roleNormalized === "superadmin";
    const isAdmin = roleNormalized === "admin";

    return {
      role,
      isSuperAdmin,
      isAdmin: isSuperAdmin || isAdmin,
      canEdit: isSuperAdmin || isAdmin,
      canDelete: isSuperAdmin,
      canExport: isSuperAdmin || isAdmin,
    };
  }, [role]);

  return (
    <RoleContext.Provider value={permissions}>
      {children}
    </RoleContext.Provider>
  );
}

export const useRole = () => useContext(RoleContext);
