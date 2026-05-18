import { useMemo, useState } from "react";
import { Badge, money, percent } from "../../components/Format";
import { useProjection } from "../../hooks/useApi";
import type { MonthProjection } from "../../types";

export function Projections({ horizon, scenarioId }: { horizon: number; scenarioId?: string }) {
  const { projection, loading, error } = useProjection(horizon, scenarioId);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const month: MonthProjection | undefined = useMemo(
    () => projection?.months.find((item: MonthProjection) => item.month === selectedMonth) ?? projection?.months[0],
    [projection, selectedMonth]
  );

  if (loading) return <div className="text-muted">Chargement des projections...</div>;
  if (error || !projection) return <div className="text-risk">{error ?? "Projection indisponible"}</div>;

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Projection mensuelle</h1>
        <p className="text-sm text-muted">Projection calculée sur le scénario actif. Cliquez une ligne pour inspecter le détail du mois.</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase text-muted">
            <tr>
              {["Mois", "Revenus signés", "Prévus pondérés", "Total revenus", "Coûts salariés", "Partenaires", "Indépendants", "Frais fixes", "Frais variables", "Total coûts", "Marge brute", "Solde", "Cumulé", "Taux marge"].map((head) => (
                <th key={head} className="px-3 py-3">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projection.months.map((row: MonthProjection) => (
              <tr key={row.month} className={`cursor-pointer border-t border-line ${month?.month === row.month ? "bg-emerald-50" : ""}`} onClick={() => setSelectedMonth(row.month)}>
                <td className="px-3 py-3 font-medium">{row.month}</td>
                <td className="px-3 py-3">{money(row.revenue.signed)}</td>
                <td className="px-3 py-3">{money(row.revenue.weighted)}</td>
                <td className="px-3 py-3">{money(row.revenue.total)}</td>
                <td className="px-3 py-3">{money(row.costs.employees)}</td>
                <td className="px-3 py-3">{money(row.costs.partners)}</td>
                <td className="px-3 py-3">{money(row.costs.freelancers)}</td>
                <td className="px-3 py-3">{money(row.costs.fixed)}</td>
                <td className="px-3 py-3">{money(row.costs.variable)}</td>
                <td className="px-3 py-3">{money(row.costs.total)}</td>
                <td className="px-3 py-3">{money(row.margins.gross)}</td>
                <td className={`px-3 py-3 font-medium ${row.balance.monthly < 0 ? "text-risk" : "text-brand"}`}>{money(row.balance.monthly)}</td>
                <td className="px-3 py-3">{money(row.balance.cumulative)}</td>
                <td className="px-3 py-3">{percent(row.margins.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {month ? <MonthDetail month={month} /> : null}
    </section>
  );
}

function MonthDetail({ month }: { month: MonthProjection }) {
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="rounded-lg border border-line bg-white p-4 xl:col-span-2">
        <h2 className="mb-3 text-base font-semibold">Détail missions - {month.month}</h2>
        <div className="space-y-2">
          {month.details.missions.map((mission) => (
            <div key={mission.missionId} className="grid grid-cols-4 gap-2 rounded-md border border-line p-3 text-sm">
              <div className="col-span-2 font-medium">{mission.title}</div>
              <div>{money(mission.revenue)} CA</div>
              <div className={mission.margin < 0 ? "text-risk" : "text-brand"}>{money(mission.margin)} marge</div>
            </div>
          ))}
          {!month.details.missions.length ? <div className="text-sm text-muted">Aucune mission contributrice.</div> : null}
        </div>
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <h2 className="mb-3 text-base font-semibold">Sorties et alertes</h2>
        <div className="space-y-2 text-sm">
          <div>Total entrées: <strong>{money(month.revenue.total)}</strong></div>
          <div>Total sorties: <strong>{money(month.costs.total)}</strong></div>
          <div>Balance finale: <strong>{money(month.balance.monthly)}</strong></div>
          {month.alerts.map((alert, index) => <div key={index}><Badge tone={alert.severity === "critical" ? "risk" : "warn"}>{alert.message}</Badge></div>)}
        </div>
      </div>
    </div>
  );
}
