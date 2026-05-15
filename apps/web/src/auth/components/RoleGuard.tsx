import type { ReactNode } from "react";
import type { AuthRole } from "../types/auth.types";
import { useAuth } from "../hooks/useAuth";

type RoleGuardProps = {
  allowedRoles: AuthRole[];
  children: ReactNode;
  fallback?: ReactNode;
};

export function hasAllowedRole(role: string | undefined, allowedRoles: string[]) {
  if (!role) return false;
  if (role === "admin") return true;
  return allowedRoles.includes(role);
}

export function RoleGuard({ allowedRoles, children, fallback = null }: RoleGuardProps) {
  const { user } = useAuth();
  return hasAllowedRole(user?.role, allowedRoles) ? <>{children}</> : <>{fallback}</>;
}
