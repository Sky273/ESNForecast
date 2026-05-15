export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

const TOKEN_KEY = "esn-forecast-auth-token";
const USER_KEY = "esn-forecast-auth-user";

type ApiAuthHandlers = {
  onUnauthorized?: () => void;
  onForbidden?: () => void;
};

let authHandlers: ApiAuthHandlers = {};

export class ApiError extends Error {
  status: number;
  correlationId?: string;
  payload: unknown;

  constructor(status: number, message: string, payload?: unknown, correlationId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.correlationId = correlationId;
  }
}

export function setApiAuthHandlers(handlers: ApiAuthHandlers) {
  authHandlers = handlers;
}

export function getStoredAuthToken() {
  return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
}

export function getStoredAuthUser<T = unknown>(): T | null {
  const raw = sessionStorage.getItem(USER_KEY) ?? localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function storeAuthSession(token: string, user: unknown, remember: boolean) {
  clearStoredAuthSession();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(USER_KEY, JSON.stringify(user));
}

export function updateStoredAuthUser(user: unknown) {
  const storage = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
  storage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredAuthToken();
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    const message = extractErrorMessage(payload) ?? "Une erreur est survenue.";
    const correlationId = extractCorrelationId(payload);
    if (response.status === 401) {
      clearStoredAuthSession();
      authHandlers.onUnauthorized?.();
    }
    if (response.status === 403) authHandlers.onForbidden?.();
    throw new ApiError(response.status, message, payload, correlationId);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function readErrorPayload(response: Response) {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorMessage(payload: unknown) {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    return String(record.message ?? record.error ?? "");
  }
  return "";
}

function extractCorrelationId(payload: unknown) {
  if (payload && typeof payload === "object") {
    const value = (payload as Record<string, unknown>).correlationId;
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

export const endpoints = {
  employees: "/employees",
  partners: "/partners",
  partnerResources: "/partner-resources",
  freelancers: "/freelancers",
  clients: "/clients",
  missions: "/missions",
  fixedCosts: "/fixed-costs",
  variableCosts: "/variable-costs"
};
