import { Calculator, Database, FileSpreadsheet, Pencil, RefreshCcw, Server, Sparkles } from "lucide-react";

export type DataOriginKind =
  | "manual"
  | "csv"
  | "provider"
  | "calculated"
  | "reforecast"
  | "mock"
  | "unknown";

export type DataOriginDescriptor = {
  kind?: DataOriginKind | string | null;
  provider?: string | null;
  label?: string | null;
  details?: Array<string | null | undefined>;
};

type DataOriginBadgeProps = DataOriginDescriptor;

const toneByKind: Record<DataOriginKind, string> = {
  manual: "border-slate-200 bg-slate-50 text-slate-700",
  csv: "border-indigo-200 bg-indigo-50 text-indigo-800",
  provider: "border-sky-200 bg-sky-50 text-sky-800",
  calculated: "border-amber-200 bg-amber-50 text-amber-800",
  reforecast: "border-orange-200 bg-orange-50 text-orange-800",
  mock: "border-red-200 bg-red-50 text-red-800",
  unknown: "border-slate-200 bg-white text-slate-600"
};

const labelByKind: Record<DataOriginKind, string> = {
  manual: "Saisie",
  csv: "CSV",
  provider: "Provider",
  calculated: "Calculé",
  reforecast: "Reforecast",
  mock: "Démo",
  unknown: "Source inconnue"
};

const legendItems: DataOriginDescriptor[] = [
  { kind: "manual" },
  { kind: "csv" },
  { kind: "provider" },
  { kind: "calculated" },
  { kind: "reforecast" },
  { kind: "mock" }
];

const iconByKind = {
  manual: Pencil,
  csv: FileSpreadsheet,
  provider: Server,
  calculated: Calculator,
  reforecast: RefreshCcw,
  mock: Sparkles,
  unknown: Database
};

export function DataOriginBadge({ kind, provider, label, details = [] }: DataOriginBadgeProps) {
  const normalized = normalizeOriginKind(kind, provider);
  const Icon = iconByKind[normalized];
  const displayLabel = label || (normalized === "provider" && provider ? provider : labelByKind[normalized]);
  const title = buildOriginTitle(normalized, displayLabel, details);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${toneByKind[normalized]}`}
      title={title}
      aria-label={title}
    >
      <Icon size={12} />
      {displayLabel}
    </span>
  );
}

export function DataOriginLegend({ items = legendItems, compact = false }: { items?: DataOriginDescriptor[]; compact?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "rounded-lg border border-line bg-white px-3 py-2"}`}>
      {!compact ? <span className="text-xs font-medium uppercase tracking-wide text-muted">Origine des données</span> : null}
      {items.map((item, index) => <DataOriginBadge key={`${item.kind}-${item.label ?? ""}-${index}`} {...item} />)}
    </div>
  );
}

export function inferOriginFromRow(row: Record<string, any>): { kind: DataOriginKind; provider?: string; details: string[] } {
  const source = String(row.source ?? row.sourceType ?? row.origin ?? row.primarySource ?? "").toLowerCase();
  const provider = row.provider ?? row.connectorProvider ?? row.bankProvider ?? row.accountingProvider;
  const rawPayload = row.rawPayload;
  const details = [
    row.createdAt ? `Créé le ${formatDate(row.createdAt)}` : undefined,
    row.updatedAt ? `Mis à jour le ${formatDate(row.updatedAt)}` : undefined,
    row.lastSyncAt ? `Synchronisé le ${formatDate(row.lastSyncAt)}` : undefined,
    row.generatedAt ? `Généré le ${formatDate(row.generatedAt)}` : undefined,
    row.calculatedAt ? `Calculé le ${formatDate(row.calculatedAt)}` : undefined
  ].filter(Boolean) as string[];

  if (rawPayload?.mock || row.isMock || source.includes("mock") || source.includes("demo")) return { kind: "mock", provider, details };
  if (provider || source.includes("provider") || source.includes("bridge") || source.includes("bank") || source.includes("accounting")) return { kind: "provider", provider: provider || row.source, details };
  if (source.includes("csv")) return { kind: "csv", details };
  if (source.includes("reforecast")) return { kind: "reforecast", details };
  if (source.includes("forecast") || source.includes("budget") || source.includes("invoice") || source.includes("actual")) return { kind: "calculated", details };
  if (source.includes("manual") || source.includes("saisie")) return { kind: "manual", details };
  if (row.calculatedAt || row.generatedAt || row.confidenceScore !== undefined || row.achievementRate !== undefined) return { kind: "calculated", details };
  return { kind: "unknown", details };
}

export function normalizeOriginKind(kind?: DataOriginKind | string | null, provider?: string | null): DataOriginKind {
  const value = String(kind ?? "").toLowerCase();
  if (value.includes("mock") || value.includes("demo") || value.includes("sandbox")) return "mock";
  if (provider || ["bridge", "powens", "tink", "plaid", "pennylane", "sage", "accounting", "bank", "provider"].some((token) => value.includes(token))) return "provider";
  if (value.includes("csv") || value.includes("import")) return "csv";
  if (value.includes("reforecast")) return "reforecast";
  if (value.includes("manual") || value.includes("saisie")) return "manual";
  if (value.includes("calcul") || value.includes("forecast") || value.includes("budget") || value.includes("actual") || value.includes("invoice")) return "calculated";
  return "unknown";
}

function buildOriginTitle(kind: DataOriginKind, label: string, details: Array<string | null | undefined>) {
  return [`Source : ${labelByKind[kind] === label ? label : `${labelByKind[kind]} (${label})`}`, ...details.filter(Boolean)].join("\n");
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("fr-FR");
}
