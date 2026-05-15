import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clearStoredAuthSession, setApiAuthHandlers } from "../../api";
import { authService } from "../services/authService";
import type { AuthUser, LoginCredentials } from "../types/auth.types";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  sessionExpired: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  logout: () => Promise<void>;
  clearSessionExpired: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => authService.getStoredUser());
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    setApiAuthHandlers({
      onUnauthorized: () => {
        sessionStorage.setItem("esn-forecast-requested-page", sessionStorage.getItem("esn-forecast-current-page") ?? "dashboard");
        clearStoredAuthSession();
        setUser(null);
        setSessionExpired(true);
        window.location.hash = "#/session-expired";
      },
      onForbidden: () => {
        window.location.hash = "#/access-denied";
      }
    });

    authService.getCurrentUser()
      .then((currentUser) => setUser(currentUser))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    sessionExpired,
    async login(credentials) {
      const session = await authService.login(credentials);
      setUser(session.user);
      setSessionExpired(false);
      return session.user;
    },
    async logout() {
      await authService.logout();
      setUser(null);
      setSessionExpired(false);
      window.location.hash = "#/login?loggedOut=1";
    },
    clearSessionExpired() {
      setSessionExpired(false);
    }
  }), [loading, sessionExpired, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
