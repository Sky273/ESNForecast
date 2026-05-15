import type { ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";

export function ProtectedRoute({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-muted">Chargement de la session...</div>;
  if (!user) return <>{fallback}</>;
  return <>{children}</>;
}
