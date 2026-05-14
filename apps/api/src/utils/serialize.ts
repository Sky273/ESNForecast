const dateKeys = new Set(["startDate", "endDate", "availableFrom", "availableTo", "estimatedEndDate", "actualEndDate", "date"]);

export const toIsoDate = (value: unknown) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  return value;
};

export function serializeDates<T>(value: T): T {
  if (Array.isArray(value)) return value.map(serializeDates) as T;
  if (value instanceof Date) return toIsoDate(value) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      dateKeys.has(key) ? toIsoDate(entry) : serializeDates(entry)
    ])
  ) as T;
}

export function coerceDates<T extends Record<string, unknown>>(body: T, keys: string[]) {
  const copy: Record<string, unknown> = { ...body };
  for (const key of keys) {
    if (typeof copy[key] === "string" && copy[key]) copy[key] = new Date(`${copy[key]}T00:00:00.000Z`);
    if (copy[key] === "") copy[key] = null;
  }
  return copy;
}
