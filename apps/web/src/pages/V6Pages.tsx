import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart, CartesianGrid, Legend } from "recharts";
import { useState } from "react";
import { api } from "../api";
import { KpiCard } from "../components/KpiCard";
import { PageHeader, StatusBadge } from "../components/PageHeader";
import { useApi } from "../hooks/useApi";

const money = (value: number | null | undefined) => `${Math.round(value ?? 0).toLocaleString("fr-FR")} EUR`;
const percent = (value: number | null | undefined) => `${Math.round((value ?? 0) * 100)} %`;
const tone = (status: string) => {
  if (["achieved", "on_track", "satisfied", "overperforming", "done", "locked", "approved", "active"].includes(status)) return "good" as const;
  if (["critical", "not_satisfied", "missed", "blocked"].includes(status)) return "risk" as const;
  if (["warning", "at_risk", "slight_variance", "in_progress", "in_review"].includes(status)) return "warn" as const;
  return "neutral" as const;
};

function Table({ rows, columns }: { rows: any[]; columns: { key: string; label: string; render?: (row: any) => any }[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="min-w-full divide-y divide-line text-sm">
        <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
          <tr>{columns.map((column) => <th key={column.key} className="px-3 py-2 font-medium">{column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, index) => (
            <tr key={row.id ?? `${row.month}-${row.category}-${index}`} className="hover:bg-surface/60">
              {columns.map((column) => <td key={column.key} className="px-3 py-2 align-top">{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
          {!rows.length ? <tr><td className="px-3 py-8 text-center text-muted" colSpan={columns.length}>Aucune donnee.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-5"><h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>{children}</section>;
}

export function TrajectoryDashboardPage() {
  const { data: landing } = useApi<any>("/annual-landing?fiscalYear=2026");
  const { data: objectives } = useApi<any[]>("/objectives/status?fiscalYear=2026");
  const { data: variances } = useApi<any[]>("/variance-analyses");
  const { data: actions } = useApi<any[]>("/action-plans");
  const { data: pipeline } = useApi<any>("/required-pipeline?fiscalYear=2026");
  const { data: staffing } = useApi<any[]>("/budget-staffing?fiscalYear=2026");
  const { data: conditions } = useApi<any[]>("/what-must-be-true?fiscalYear=2026");
  const chart = [
    { label: "Budget", revenue: landing?.budgetRevenue ?? 0, margin: landing?.budgetGrossMargin ?? 0, cash: landing?.budgetClosingCash ?? 0 },
    { label: "Atterrissage", revenue: landing?.projectedAnnualRevenue ?? 0, margin: landing?.projectedGrossMargin ?? 0, cash: landing?.projectedClosingCash ?? 0 }
  ];

  return (
    <>
      <PageHeader title="Trajectoire" description="Budget, reel, forecast, atterrissage probable, ecarts et actions correctives." />
      <div className="mb-5 grid gap-3 md:grid-cols-6">
        <KpiCard label="Budget CA" value={money(landing?.budgetRevenue)} />
        <KpiCard label="Realise a date" value={money(landing?.actualRevenueToDate)} />
        <KpiCard label="Forecast restant" value={money(landing?.forecastRevenueRemaining)} />
        <KpiCard label="Atterrissage CA" value={money(landing?.projectedAnnualRevenue)} tone={(landing?.revenueGap ?? 0) < 0 ? "risk" : "good"} />
        <KpiCard label="Ecart probable" value={money(landing?.revenueGap)} tone={(landing?.revenueGap ?? 0) < 0 ? "risk" : "good"} />
        <KpiCard label="Probabilite" value={percent(landing?.achievementProbability)} />
      </div>
      <div className="mb-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-line bg-white p-4">
          <h2 className="mb-4 font-semibold">Budget vs atterrissage</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Legend />
                <Bar dataKey="revenue" name="CA" fill="#0f766e" />
                <Bar dataKey="margin" name="Marge" fill="#2563eb" />
                <Bar dataKey="cash" name="Cash" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg border border-line bg-white p-4">
          <h2 className="mb-3 font-semibold">Pipeline necessaire</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Gap CA</span><strong>{money(pipeline?.revenueGap)}</strong></div>
            <div className="flex justify-between"><span>Pipeline brut requis</span><strong>{money(pipeline?.requiredGrossPipeline)}</strong></div>
            <div className="flex justify-between"><span>Opportunites necessaires</span><strong>{pipeline?.opportunitiesNeeded ?? "-"}</strong></div>
            <div className="flex justify-between"><span>Conversion historique</span><strong>{percent(pipeline?.historicalConversionRate)}</strong></div>
          </div>
        </div>
      </div>
      <Panel title="Objectifs">
        <Table rows={objectives ?? []} columns={[
          { key: "name", label: "Objectif" },
          { key: "type", label: "Type" },
          { key: "targetValue", label: "Cible", render: (row) => row.unit === "percentage" ? percent(row.targetValue) : money(row.targetValue) },
          { key: "currentValue", label: "Actuel / probable", render: (row) => row.unit === "percentage" ? percent(row.currentValue) : money(row.currentValue) },
          { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }
        ]} />
      </Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Ecarts principaux">
          <Table rows={(variances ?? []).slice(0, 5)} columns={[
            { key: "category", label: "Categorie" },
            { key: "varianceAmount", label: "Ecart", render: (row) => money(row.varianceAmount) },
            { key: "severity", label: "Severite", render: (row) => <StatusBadge label={row.severity} tone={tone(row.severity)} /> },
            { key: "status", label: "Traitement", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }
          ]} />
        </Panel>
        <Panel title="Conditions de reussite">
          <Table rows={conditions ?? []} columns={[
            { key: "description", label: "Condition" },
            { key: "gap", label: "Gap", render: (row) => row.targetValue && row.targetValue < 2 ? percent(row.gap) : money(row.gap) },
            { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }
          ]} />
        </Panel>
      </div>
      <Panel title="Plans d'action">
        <Table rows={actions ?? []} columns={[
          { key: "title", label: "Plan" },
          { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> },
          { key: "ownerUserId", label: "Responsable" }
        ]} />
      </Panel>
      <Panel title="Staffing budgetaire">
        <Table rows={(staffing ?? []).slice(6, 12)} columns={[
          { key: "month", label: "Mois" },
          { key: "requiredBillableDays", label: "Jours requis" },
          { key: "gapDays", label: "Gap jours" },
          { key: "staffingGapFTE", label: "Gap ETP" },
          { key: "missingSkills", label: "Competences", render: (row) => (row.missingSkills ?? []).join(", ") }
        ]} />
      </Panel>
    </>
  );
}

export function BudgetsPage() {
  const { data: budgets, refetch } = useApi<any[]>("/budgets");
  const duplicate = async (id: string) => { await api(`/budgets/${id}/duplicate`, { method: "POST", body: JSON.stringify({}) }); refetch(); };
  const lock = async (id: string) => { await api(`/budgets/${id}/lock`, { method: "POST" }); refetch(); };
  return (
    <>
      <PageHeader title="Budgets" description="Versions budgetaires annuelles, validation, verrouillage et duplication." />
      <Table rows={budgets ?? []} columns={[
        { key: "name", label: "Budget" },
        { key: "fiscalYear", label: "Annee" },
        { key: "budgetType", label: "Type" },
        { key: "versionNumber", label: "Version" },
        { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> },
        { key: "actions", label: "Actions", render: (row) => <div className="flex gap-2"><button className="rounded-md border border-line px-2 py-1 text-xs" onClick={() => duplicate(row.id)}>Dupliquer</button><button className="rounded-md border border-line px-2 py-1 text-xs" onClick={() => lock(row.id)}>Verrouiller</button></div> }
      ]} />
    </>
  );
}

export function BudgetDetailPage() {
  const { data: budgets } = useApi<any[]>("/budgets");
  const budget = budgets?.[0];
  const { data } = useApi<any>(budget ? `/budgets/${budget.id}` : "");
  const monthlyRevenue = (data?.lines ?? []).filter((line: any) => line.category === "revenue").map((line: any) => ({ month: `${line.year}-${String(line.month).padStart(2, "0")}`, revenue: line.amount }));
  return (
    <>
      <PageHeader title="Detail budget" description="Lignes mensuelles budgetees par categorie." />
      <div className="mb-5 rounded-lg border border-line bg-white p-4">
        <h2 className="mb-4 font-semibold">{data?.name ?? "Budget"}</h2>
        <div className="h-64"><ResponsiveContainer><LineChart data={monthlyRevenue}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(value) => money(Number(value))} /><Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
      </div>
      <Table rows={(data?.lines ?? []).slice(0, 80)} columns={[
        { key: "month", label: "Mois" },
        { key: "category", label: "Categorie" },
        { key: "amount", label: "Montant", render: (row) => row.category === "utilization_rate" ? percent(row.amount) : money(row.amount) },
        { key: "comment", label: "Commentaire" }
      ]} />
    </>
  );
}

export function ObjectivesPage() {
  const { data } = useApi<any[]>("/objectives/status?fiscalYear=2026");
  return (
    <>
      <PageHeader title="Objectifs" description="Objectifs financiers, commerciaux, operationnels et staffing compares a la trajectoire probable." />
      <Table rows={data ?? []} columns={[
        { key: "name", label: "Objectif" },
        { key: "type", label: "Type" },
        { key: "period", label: "Periode" },
        { key: "targetValue", label: "Cible", render: (row) => row.unit === "percentage" ? percent(row.targetValue) : money(row.targetValue) },
        { key: "achievementRate", label: "Atteinte", render: (row) => percent(row.achievementRate) },
        { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }
      ]} />
    </>
  );
}

export function RollingForecastPage() {
  const { data: forecasts } = useApi<any[]>("/rolling-forecasts");
  const forecast = forecasts?.[0];
  const { data: lines } = useApi<any[]>(forecast ? `/rolling-forecasts/${forecast.id}/lines` : "");
  return (
    <>
      <PageHeader title="Rolling Forecast" description="Reel pour les mois passes, reforecast pour les mois futurs et niveau de confiance." />
      <Table rows={forecasts ?? []} columns={[{ key: "name", label: "Nom" }, { key: "baseMonth", label: "Base" }, { key: "horizonMonths", label: "Horizon" }, { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }]} />
      <div className="mt-5">
        <Table rows={(lines ?? []).slice(0, 80)} columns={[{ key: "month", label: "Mois" }, { key: "category", label: "Categorie" }, { key: "amount", label: "Montant", render: (row) => row.category === "utilization_rate" ? percent(row.amount) : money(row.amount) }, { key: "source", label: "Source" }, { key: "confidenceScore", label: "Confiance", render: (row) => percent(row.confidenceScore) }]} />
      </div>
    </>
  );
}

export function AnnualLandingPage() {
  const { data } = useApi<any>("/annual-landing?fiscalYear=2026");
  return (
    <>
      <PageHeader title="Atterrissage annuel" description="Estimation de fin d'annee a partir du reel a date et du forecast restant." />
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <KpiCard label="CA budget" value={money(data?.budgetRevenue)} />
        <KpiCard label="CA probable" value={money(data?.projectedAnnualRevenue)} tone={(data?.revenueGap ?? 0) < 0 ? "risk" : "good"} />
        <KpiCard label="Marge probable" value={money(data?.projectedGrossMargin)} />
        <KpiCard label="Cash probable" value={money(data?.projectedClosingCash)} tone={(data?.cashGap ?? 0) < 0 ? "risk" : "good"} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {["lowCase", "medianCase", "highCase"].map((key) => <div key={key} className="rounded-lg border border-line bg-white p-4"><div className="text-sm text-muted">{key}</div><div className="mt-2 text-xl font-semibold">{money(data?.[key]?.revenue)}</div><div className="text-sm text-muted">Cash {money(data?.[key]?.cash)}</div></div>)}
      </div>
    </>
  );
}

export function BudgetForecastActualPage() {
  const [calculated, setCalculated] = useState<any[] | null>(null);
  const recalculate = async () => {
    const result = await api<any[]>("/variance-analyses/recalculate", { method: "POST", body: JSON.stringify({ fiscalYear: 2026 }) });
    setCalculated(result);
  };
  const { data: report } = useApi<any>("/reports/budget-forecast-actual.json?fiscalYear=2026");
  return (
    <>
      <PageHeader title="Budget / Forecast / Actual" description="Comparaison mensuelle budget, rolling forecast, reforecast et reel." actions={<button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={recalculate}>Recalculer</button>} />
      <Table rows={calculated ?? report?.variances ?? []} columns={[
        { key: "month", label: "Mois" },
        { key: "category", label: "Categorie" },
        { key: "budgetValue", label: "Budget", render: (row) => money(row.budgetValue) },
        { key: "actualValue", label: "Reel", render: (row) => money(row.actualValue) },
        { key: "varianceAmount", label: "Ecart", render: (row) => money(row.varianceAmount) },
        { key: "severity", label: "Statut", render: (row) => <StatusBadge label={row.severity ?? row.status} tone={tone(row.severity ?? row.status)} /> }
      ]} />
    </>
  );
}

export function VarianceAnalysesPage() {
  const { data } = useApi<any[]>("/variance-analyses");
  return (
    <>
      <PageHeader title="Ecarts commentes" description="Ecarts budgetaires rattaches a des causes, commentaires et responsables." />
      <Table rows={data ?? []} columns={[
        { key: "month", label: "Mois" },
        { key: "category", label: "Categorie" },
        { key: "varianceAmount", label: "Ecart", render: (row) => money(row.varianceAmount) },
        { key: "variancePercent", label: "Ecart %", render: (row) => percent(row.variancePercent) },
        { key: "severity", label: "Severite", render: (row) => <StatusBadge label={row.severity} tone={tone(row.severity)} /> },
        { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }
      ]} />
    </>
  );
}

export function ActionPlansPage() {
  const { data: plans } = useApi<any[]>("/action-plans");
  const plan = plans?.[0];
  const { data: detail } = useApi<any>(plan ? `/action-plans/${plan.id}` : "");
  const { data: suggestions } = useApi<any[]>("/action-suggestions");
  return (
    <>
      <PageHeader title="Plans d'action" description="Actions correctives rattachees aux objectifs et ecarts, avec impact attendu." />
      <Panel title="Plans">
        <Table rows={plans ?? []} columns={[{ key: "title", label: "Plan" }, { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }, { key: "ownerUserId", label: "Responsable" }]} />
      </Panel>
      <Panel title="Actions">
        <Table rows={detail?.items ?? []} columns={[{ key: "title", label: "Action" }, { key: "priority", label: "Priorite", render: (row) => <StatusBadge label={row.priority} tone={tone(row.priority)} /> }, { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }, { key: "expectedImpactAmount", label: "Impact attendu", render: (row) => money(row.expectedImpactAmount) }, { key: "dueDate", label: "Echeance" }]} />
      </Panel>
      <Panel title="Suggestions">
        <Table rows={suggestions ?? []} columns={[{ key: "title", label: "Suggestion" }, { key: "priority", label: "Priorite" }, { key: "expectedImpactAmount", label: "Impact", render: (row) => money(row.expectedImpactAmount) }, { key: "confidenceScore", label: "Confiance", render: (row) => percent(row.confidenceScore) }]} />
      </Panel>
    </>
  );
}

export function RequiredPipelinePage() {
  const { data } = useApi<any>("/required-pipeline?fiscalYear=2026");
  return (
    <>
      <PageHeader title="Pipeline necessaire" description="Pipeline commercial brut et opportunites necessaires pour atteindre le budget." />
      <div className="mb-5 grid gap-3 md:grid-cols-5">
        <KpiCard label="Objectif CA" value={money(data?.targetRevenue)} />
        <KpiCard label="CA realise" value={money(data?.actualRevenue)} />
        <KpiCard label="Gap CA" value={money(data?.revenueGap)} tone={(data?.revenueGap ?? 0) > 0 ? "risk" : "good"} />
        <KpiCard label="Pipeline requis" value={money(data?.requiredGrossPipeline)} />
        <KpiCard label="Opportunites" value={String(data?.opportunitiesNeeded ?? "-")} />
      </div>
      <Table rows={(data?.recommendations ?? []).map((label: string) => ({ label }))} columns={[{ key: "label", label: "Recommandation" }]} />
    </>
  );
}

export function BudgetStaffingPage() {
  const { data } = useApi<any[]>("/budget-staffing?fiscalYear=2026");
  return (
    <>
      <PageHeader title="Staffing budgetaire" description="Capacite disponible vs jours facturables necessaires pour atteindre la trajectoire budgetaire." />
      <Table rows={data ?? []} columns={[
        { key: "month", label: "Mois" },
        { key: "requiredBillableDays", label: "Jours requis" },
        { key: "internalCapacityDays", label: "Capacite interne" },
        { key: "externalCapacityDays", label: "Capacite externe" },
        { key: "gapDays", label: "Gap jours" },
        { key: "staffingGapFTE", label: "Gap ETP" },
        { key: "missingSkills", label: "Competences", render: (row) => (row.missingSkills ?? []).join(", ") }
      ]} />
    </>
  );
}

export function WhatMustBeTruePage() {
  const { data } = useApi<any[]>("/what-must-be-true?fiscalYear=2026");
  return (
    <>
      <PageHeader title="Conditions de reussite" description="Ce qui doit etre vrai pour atteindre le budget et les objectifs annuels." />
      <Table rows={data ?? []} columns={[
        { key: "conditionType", label: "Type" },
        { key: "description", label: "Condition" },
        { key: "targetValue", label: "Cible", render: (row) => row.targetValue && row.targetValue < 2 ? percent(row.targetValue) : money(row.targetValue) },
        { key: "currentValue", label: "Actuel", render: (row) => row.currentValue && row.currentValue < 2 ? percent(row.currentValue) : money(row.currentValue) },
        { key: "riskLevel", label: "Risque", render: (row) => <StatusBadge label={row.riskLevel} tone={tone(row.riskLevel)} /> },
        { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }
      ]} />
    </>
  );
}
