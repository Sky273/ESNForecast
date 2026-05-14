const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });
  if (!response.ok) throw new Error(await response.text());
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
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
