import { AlertTriangle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useProjection } from "../hooks/useApi";
import { Badge, money, percent } from "../components/Format";
import { KpiCard } from "../components/KpiCard";

export function Dashboard({ horizon, setHorizon }: { horizon: number; setHorizon: (value: number) => void }) {
  const { projection, loading, error } = useProjection(horizon);
  if (loading) return <div className="text-muted">Chargement du dashboard...</div>;
  if (error || !projection) return <div className="text-risk">{error ?? "Projection indisponible"}</div>;
  const current = projection.months[0];
  const costBreakdown = [
    { name: "Salariés", value: current.costs.employees },
    { name: "Partenaires", value: current.costs.partners },
    { name: "Indépendants", value: current.costs.freelancers },
    { name: "Fixes", value: current.costs.fixed },
    { name: "Variables", value: current.costs.variable }
  ];

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Dashboard financier</h1>
          <p className="text-sm text-muted">Projection opérationnelle mois par mois</p>
        </div>
        <select className="rounded-md border border-line bg-white px-3 py-2" value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>
          {[3, 6, 12, 24].map((value) => <option key={value} value={value}>Horizon {value} mois</option>)}
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="CA du mois" value={money(current.revenue.total)} sub={`${money(current.revenue.weighted)} pondéré`} />
        <KpiCard label="Coûts du mois" value={money(current.costs.total)} />
        <KpiCard label="Solde mensuel" value={money(current.balance.monthly)} tone={current.balance.monthly < 0 ? "risk" : "good"} />
        <KpiCard label="Solde cumulé" value={money(current.balance.cumulative)} tone={current.balance.cumulative < 0 ? "risk" : "good"} />
        <KpiCard label="Marge brute" value={money(current.margins.gross)} sub={percent(current.margins.rate)} />
        <KpiCard label="Jours vendus" value={String(current.activity.soldDays)} sub={`Utilisation interne ${percent(current.activity.internalUtilizationRate)}`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-lg border border-line bg-white p-4">
          <h2 className="mb-4 text-base font-semibold">Revenus, coûts et solde cumulé</h2>
          <div className="h-80">
            <ResponsiveContainer>
              <LineChart data={projection.months}>
                <CartesianGrid stroke="#e5e7eb" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Line type="monotone" dataKey="revenue.total" name="Revenus" stroke="#0f766e" strokeWidth={2} />
                <Line type="monotone" dataKey="costs.total" name="Coûts" stroke="#b42318" strokeWidth={2} />
                <Line type="monotone" dataKey="balance.cumulative" name="Solde cumulé" stroke="#2563eb" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg border border-line bg-white p-4">
          <h2 className="mb-4 text-base font-semibold">Répartition des coûts du mois</h2>
          <div className="h-80">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={costBreakdown} dataKey="value" nameKey="name" innerRadius={60} outerRadius={105}>
                  {["#0f766e", "#2563eb", "#7c3aed", "#f59e0b", "#b42318"].map((color) => <Cell key={color} fill={color} />)}
                </Pie>
                <Tooltip formatter={(value) => money(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-white p-4">
        <h2 className="mb-4 text-base font-semibold">Solde mensuel</h2>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={projection.months}>
              <CartesianGrid stroke="#e5e7eb" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Bar dataKey="balance.monthly" name="Solde mensuel" fill="#0f766e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle size={18} className="text-risk" />
          <h2 className="text-base font-semibold">Alertes financières</h2>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {projection.alerts.slice(0, 10).map((alert: any, index: number) => (
            <div key={`${alert.message}-${index}`} className="rounded-md border border-line p-3">
              <Badge tone={alert.severity === "critical" ? "risk" : alert.severity === "warning" ? "warn" : "neutral"}>{alert.severity}</Badge>
              <div className="mt-2 text-sm">{alert.message}</div>
            </div>
          ))}
          {!projection.alerts.length ? <div className="text-sm text-muted">Aucune alerte sur l'horizon sélectionné.</div> : null}
        </div>
      </div>
    </section>
  );
}
