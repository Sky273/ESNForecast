import { DataOriginBadge, type DataOriginDescriptor } from "./DataOriginBadge";

export function KpiCard({ label, value, sub, tone = "default", origin }: { label: string; value: string | number; sub?: string; tone?: "default" | "risk" | "good"; origin?: DataOriginDescriptor }) {
  const toneClass = tone === "risk" ? "border-red-200 bg-red-50" : tone === "good" ? "border-emerald-200 bg-emerald-50" : "border-line bg-white";
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm text-muted">{label}</div>
        {origin ? <DataOriginBadge {...origin} /> : null}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-normal">{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}
