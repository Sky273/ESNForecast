export type AuthRole = "admin" | "manager" | "user" | "readonly" | "direction" | "finance" | "commercial";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: AuthRole;
  organizationId?: string | null;
};

export type LoginCredentials = {
  email: string;
  password: string;
  remember: boolean;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};
