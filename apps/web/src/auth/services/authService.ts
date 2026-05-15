import { api, API_URL, clearStoredAuthSession, getStoredAuthToken, getStoredAuthUser, storeAuthSession, updateStoredAuthUser } from "../../api";
import type { AuthSession, AuthUser, LoginCredentials } from "../types/auth.types";

async function postPublic<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error("AUTH_REQUEST_FAILED");
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const authService = {
  getStoredUser: () => getStoredAuthUser<AuthUser>(),
  hasToken: () => Boolean(getStoredAuthToken()),

  async login(credentials: LoginCredentials) {
    const session = await postPublic<AuthSession>("/auth/login", {
      email: credentials.email,
      password: credentials.password,
      remember: credentials.remember
    });
    storeAuthSession(session.token, session.user, credentials.remember);
    return session;
  },

  async logout() {
    try {
      if (getStoredAuthToken()) await api<void>("/auth/logout", { method: "POST" });
    } finally {
      clearStoredAuthSession();
    }
  },

  async forgotPassword(email: string) {
    return postPublic<{ ok: boolean; message: string }>("/auth/forgot-password", { email });
  },

  async resetPassword(token: string, newPassword: string) {
    return postPublic<{ ok: boolean; message: string }>("/auth/reset-password", { token, newPassword });
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return api<{ ok: boolean; user?: AuthUser }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword })
    });
  },

  async activateAccount(token: string, newPassword: string) {
    return postPublic<{ ok: boolean; message: string }>("/auth/activate", { token, newPassword });
  },

  async getCurrentUser() {
    if (!getStoredAuthToken()) return null;
    const user = await api<AuthUser>("/auth/me");
    updateStoredAuthUser(user);
    return user;
  },

  async refreshSession() {
    if (!getStoredAuthToken()) return null;
    return api<AuthSession | null>("/auth/refresh", { method: "POST" });
  }
};
