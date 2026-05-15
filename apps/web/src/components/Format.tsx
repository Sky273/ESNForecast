import { translateStatusKey, useI18n } from "../i18n";

export const money = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value ?? 0);

export const percent = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(value ?? 0);

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "risk" }) {
  const { t } = useI18n();
  const colors = {
    neutral: "bg-slate-100 text-slate-700",
    good: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-800",
    risk: "bg-red-50 text-risk"
  };
  const label = typeof children === "string" ? t(translateStatusKey(children), children) : children;
  return <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${colors[tone]}`}>{label}</span>;
}
