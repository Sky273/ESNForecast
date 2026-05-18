import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FormEvent, ReactNode, useMemo, useState } from "react";
import { InfoPanel } from "../../components/InfoPanel";
import { api } from "../../api";
import { DataOriginBadge, DataOriginLegend } from "../../components/DataOriginBadge";
import { KpiCard } from "../../components/KpiCard";
import { PageHeader, StatusBadge } from "../../components/PageHeader";
import { useApi } from "../../hooks/useApi";

const YEAR = 2026;
const money = (value: number | null | undefined) => `${Math.round(value ?? 0).toLocaleString("fr-FR")} EUR`;
const percent = (value: number | null | undefined) => `${Math.round((value ?? 0) * 100)} %`;
const tone = (status: string) => {
  if (["achieved", "on_track", "satisfied", "overperforming", "done", "locked", "approved", "active", "low"].includes(status)) return "good" as const;
  if (["critical", "not_satisfied", "missed", "blocked", "high"].includes(status)) return "risk" as const;
  if (["warning", "at_risk", "slight_variance", "in_progress", "in_review", "medium"].includes(status)) return "warn" as const;
  return "neutral" as const;
};

const budgetCatégories = ["revenue", "employee_costs", "partner_costs", "freelancer_costs", "fixed_costs", "variable_costs", "cash_in", "cash_out", "gross_margin", "net_margin", "closing_cash", "utilization_rate", "bench_cost", "commercial_pipeline"];
const objectiveTypes = ["revenue", "gross_margin", "net_margin", "cash", "cash_in", "cash_out", "profitability", "utilization", "bench", "pipeline", "staffing", "client_concentration", "custom"];
const objectiveUnits = ["amount", "percentage", "days", "count", "ratio"];
const objectivePeriods = ["annual", "quarterly", "monthly"];

function Table({ rows, columns, onSelect, selectedId }: { rows: any[]; columns: { key: string; label: string; render?: (row: any) => ReactNode }[]; onSelect?: (row: any) => void; selectedId?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="min-w-full divide-y divide-line text-sm">
        <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
          <tr>{columns.map((column) => <th key={column.key} className="px-3 py-2 font-medium">{column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, index) => (
            <tr key={row.id ?? `${row.month}-${row.category}-${index}`} onClick={() => onSelect?.(row)} className={`${onSelect ? "cursor-pointer" : ""} ${selectedId === row.id ? "bg-emerald-50" : "hover:bg-surface/60"}`}>
              {columns.map((column) => <td key={column.key} className="px-3 py-2 align-top">{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
          {!rows.length ? <tr><td className="px-3 py-8 text-center text-muted" colSpan={columns.length}>Aucune donnée.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function ActionButton({ children, tone = "neutral", onClick }: { children: ReactNode; tone?: "neutral" | "risk"; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`rounded-md border border-line px-2 py-1 text-xs ${tone === "risk" ? "text-risk" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mb-5"><h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>{children}</section>;
}

function FormPanel({ title, children, onSubmit, submitLabel = "Enregistrer" }: { title: string; children: ReactNode; onSubmit: (event: FormEvent) => void; submitLabel?: string }) {
  return (
    <form onSubmit={onSubmit} className="mb-5 rounded-lg border border-line bg-white p-4">
      <h2 className="mb-4 font-semibold">{title}</h2>
      <div className="grid gap-3 md:grid-cols-3">{children}</div>
      <button className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white" type="submit">{submitLabel}</button>
    </form>
  );
}

function TextInput({ label, value, onChange, type = "text" }: { label: string; value: any; onChange: (value: any) => void; type?: string }) {
  return <label><span className="mb-1 block text-xs font-medium text-muted">{label}</span><input className="w-full rounded-md border border-line px-3 py-2" type={type} step={type === "number" ? "any" : undefined} value={value ?? ""} onChange={(event) => onChange(type === "number" ? Number(event.target.value) : event.target.value)} /></label>;
}

function SelectInput({ label, value, onChange, options }: { label: string; value: any; onChange: (value: string) => void; options: Array<string | { label: string; value: string | number }> }) {
  return <label><span className="mb-1 block text-xs font-medium text-muted">{label}</span><select className="w-full rounded-md border border-line px-3 py-2" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>{options.map((option) => typeof option === "string" ? <option key={option} value={option}>{option}</option> : <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select></label>;
}

function TextArea({ label, value, onChange }: { label: string; value: any; onChange: (value: string) => void }) {
  return <label className="md:col-span-3"><span className="mb-1 block text-xs font-medium text-muted">{label}</span><textarea className="min-h-20 w-full rounded-md border border-line px-3 py-2" value={value ?? ""} onChange={(event) => onChange(event.target.value)} /></label>;
}

function dateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

export function TrajectoryDashboardPage() {
  const { data: landing } = useApi<any>(`/annual-landing?fiscalYear=${YEAR}`);
  const { data: objectives } = useApi<any[]>(`/objectives/status?fiscalYear=${YEAR}`);
  const { data: variances } = useApi<any[]>("/variance-analyses");
  const { data: actions } = useApi<any[]>("/action-plans");
  const { data: pipeline } = useApi<any>(`/required-pipeline?fiscalYear=${YEAR}`);
  const { data: staffing } = useApi<any[]>(`/budget-staffing?fiscalYear=${YEAR}`);
  const { data: conditions } = useApi<any[]>(`/what-must-be-true?fiscalYear=${YEAR}`);
  const chart = [
    { label: "Budget", revenue: landing?.budgetRevenue ?? 0, margin: landing?.budgetGrossMargin ?? 0, cash: landing?.budgetClosingCash ?? 0 },
    { label: "Atterrissage", revenue: landing?.projectedAnnualRevenue ?? 0, margin: landing?.projectedGrossMargin ?? 0, cash: landing?.projectedClosingCash ?? 0 }
  ];
  return (
    <>
      <PageHeader title="Trajectoire" description="Budget, réel, forecast, atterrissage probable, Écarts et actions correctives." />
      <DataOriginLegend items={[{ kind: "manual", label: "Budget" }, { kind: "provider", label: "R?el" }, { kind: "calculated", label: "Forecast" }, { kind: "reforecast", label: "Atterrissage" }]} />
      <InfoPanel title="Données calculées">Cet écran consolide budget, réel, forecast, atterrissage probable, pipeline, staffing et plans d'action. Il sert à piloter la trajectoire, pas à saisir les données sources.</InfoPanel>
      <div className="mb-5 grid gap-3 md:grid-cols-6">
        <KpiCard label="Budget CA" value={money(landing?.budgetRevenue)} origin={{ kind: "manual", label: "Budget" }} />
        <KpiCard label="R?alis? ? date" value={money(landing?.actualRevenueToDate)} origin={{ kind: "provider", label: "R?el" }} />
        <KpiCard label="Forecast restant" value={money(landing?.forecastRevenueRemaining)} origin={{ kind: "calculated", label: "Forecast" }} />
        <KpiCard label="Atterrissage CA" value={money(landing?.projectedAnnualRevenue)} tone={(landing?.revenueGap ?? 0) < 0 ? "risk" : "good"} origin={{ kind: "reforecast", label: "Atterrissage" }} />
        <KpiCard label="?cart probable" value={money(landing?.revenueGap)} tone={(landing?.revenueGap ?? 0) < 0 ? "risk" : "good"} origin={{ kind: "calculated", label: "?cart" }} />
        <KpiCard label="Probabilit?" value={percent(landing?.achievementProbability)} origin={{ kind: "calculated", label: "Probabilit?" }} />
      </div>
      <div className="mb-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-line bg-white p-4">
          <h2 className="mb-4 font-semibold">Budget vs atterrissage</h2>
          <div className="h-72"><ResponsiveContainer><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip formatter={(value, name) => [money(Number(value)), `${String(name)} - Calcul?`]} /><Legend /><Bar dataKey="revenue" name="CA" fill="#0f766e" /><Bar dataKey="margin" name="Marge" fill="#2563eb" /><Bar dataKey="cash" name="Cash" fill="#f59e0b" /></BarChart></ResponsiveContainer></div>
        </div>
        <div className="rounded-lg border border-line bg-white p-4">
          <h2 className="mb-3 font-semibold">Pipeline nécessaire</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Gap CA</span><strong>{money(pipeline?.revenueGap)}</strong></div>
            <div className="flex justify-between"><span>Pipeline brut requis</span><strong>{money(pipeline?.requiredGrossPipeline)}</strong></div>
            <div className="flex justify-between"><span>Opportunités nécessaires</span><strong>{pipeline?.opportunitiesNeeded ?? "-"}</strong></div>
            <div className="flex justify-between"><span>Conversion historique</span><strong>{percent(pipeline?.historicalConversionRate)}</strong></div>
          </div>
        </div>
      </div>
      <Panel title="Objectifs"><Table rows={objectives ?? []} columns={[{ key: "name", label: "Objectif" }, { key: "type", label: "Type" }, { key: "targetValue", label: "Cible", render: (row) => row.unit === "percentage" ? percent(row.targetValue) : money(row.targetValue) }, { key: "currentValue", label: "Actuel / probable", render: (row) => row.unit === "percentage" ? percent(row.currentValue) : money(row.currentValue) }, { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }]} /></Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Écarts principaux"><Table rows={(variances ?? []).slice(0, 5)} columns={[{ key: "category", label: "Catégorie" }, { key: "varianceAmount", label: "Écart", render: (row) => money(row.varianceAmount) }, { key: "severity", label: "Sévérité", render: (row) => <StatusBadge label={row.severity} tone={tone(row.severity)} /> }, { key: "status", label: "Traitement", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }]} /></Panel>
        <Panel title="Conditions de réussite"><Table rows={conditions ?? []} columns={[{ key: "description", label: "Condition" }, { key: "gap", label: "Gap", render: (row) => row.targetValue && row.targetValue < 2 ? percent(row.gap) : money(row.gap) }, { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }]} /></Panel>
      </div>
      <Panel title="Plans d'action"><Table rows={actions ?? []} columns={[{ key: "title", label: "Plan" }, { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }, { key: "ownerUserId", label: "Responsable" }]} /></Panel>
      <Panel title="Staffing budgétaire"><Table rows={(staffing ?? []).slice(6, 12)} columns={[{ key: "month", label: "Mois" }, { key: "requiredBillableDays", label: "Jours requis" }, { key: "gapDays", label: "Gap jours" }, { key: "staffingGapFTE", label: "Gap ETP" }, { key: "missingSkills", label: "Compétences", render: (row) => (row.missingSkills ?? []).join(", ") }]} /></Panel>
    </>
  );
}

export function BudgetsPage() {
  const { data: budgets, refetch } = useApi<any[]>("/budgets");
  const [draft, setDraft] = useState({ fiscalYear: YEAR, name: "", description: "", budgetType: "initial", status: "draft" });
  const [editingId, setEditingId] = useState("");
  const save = async (event: FormEvent) => {
    event.preventDefault();
    await api(editingId ? `/budgets/${editingId}` : "/budgets", { method: editingId ? "PUT" : "POST", body: JSON.stringify(draft) });
    setDraft({ fiscalYear: YEAR, name: "", description: "", budgetType: "initial", status: "draft" });
    setEditingId("");
    refetch();
  };
  const action = async (id: string, kind: string) => { await api(`/budgets/${id}/${kind}`, { method: "POST", body: JSON.stringify({}) }); refetch(); };
  const duplicate = async (id: string) => { await api(`/budgets/${id}/duplicate`, { method: "POST", body: JSON.stringify({}) }); refetch(); };
  const removeBudget = async (id: string) => {
    await api(`/budgets/${id}`, { method: "DELETE" });
    if (editingId === id) {
      setEditingId("");
      setDraft({ fiscalYear: YEAR, name: "", description: "", budgetType: "initial", status: "draft" });
    }
    refetch();
  };
  return (
    <>
      <PageHeader title="Budgets" description="Création, validation, verrouillage et duplication des versions budgétaires." />
      <FormPanel title={editingId ? "Modifier le budget" : "Nouveau budget"} onSubmit={save} submitLabel={editingId ? "Enregistrer" : "Créer le budget"}>
        <TextInput label="Nom" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
        <TextInput label="Année fiscale" type="number" value={draft.fiscalYear} onChange={(value) => setDraft({ ...draft, fiscalYear: value })} />
        <SelectInput label="Type" value={draft.budgetType} onChange={(value) => setDraft({ ...draft, budgetType: value })} options={["initial", "revised", "scenario"]} />
        <SelectInput label="Statut" value={draft.status} onChange={(value) => setDraft({ ...draft, status: value })} options={["draft", "in_review", "approved", "locked", "archived"]} />
        <TextArea label="Description" value={draft.description} onChange={(value) => setDraft({ ...draft, description: value })} />
      </FormPanel>
      <Table rows={budgets ?? []} onSelect={(row) => { setEditingId(row.id); setDraft({ fiscalYear: row.fiscalYear, name: row.name, description: row.description ?? "", budgetType: row.budgetType, status: row.status }); }} selectedId={editingId} columns={[
        { key: "name", label: "Budget" },
        { key: "fiscalYear", label: "Année" },
        { key: "budgetType", label: "Type" },
        { key: "versionNumber", label: "Version" },
        { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> },
        { key: "actions", label: "Actions", render: (row) => <div className="flex flex-wrap gap-2"><ActionButton onClick={() => duplicate(row.id)}>Dupliquer</ActionButton><ActionButton onClick={() => action(row.id, "submit-review")}>Review</ActionButton><ActionButton onClick={() => action(row.id, "approve")}>Approuver</ActionButton><ActionButton onClick={() => action(row.id, "lock")}>Verrouiller</ActionButton><ActionButton onClick={() => action(row.id, "archive")}>Archiver</ActionButton><ActionButton tone="risk" onClick={() => removeBudget(row.id)}>Supprimer</ActionButton></div> }
      ]} />
    </>
  );
}

export function BudgetDetailPage() {
  const { data: budgets } = useApi<any[]>("/budgets");
  const [budgetId, setBudgetId] = useState("");
  const activeBudgetId = budgetId || budgets?.[0]?.id || "";
  const { data, refetch } = useApi<any>(activeBudgetId ? `/budgets/${activeBudgetId}` : "");
  const [line, setLine] = useState({ month: 1, year: YEAR, category: "revenue", amount: 0, comment: "" });
  const [editingLineId, setEditingLineId] = useState("");
  const monthlyRevenue = (data?.lines ?? []).filter((item: any) => item.category === "revenue").map((item: any) => ({ month: `${item.year}-${String(item.month).padStart(2, "0")}`, revenue: item.amount }));
  const saveLine = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeBudgetId) return;
    const url = editingLineId ? `/budget-lines/${editingLineId}` : `/budgets/${activeBudgetId}/lines`;
    await api(url, { method: editingLineId ? "PUT" : "POST", body: JSON.stringify(line) });
    setLine({ month: 1, year: YEAR, category: "revenue", amount: 0, comment: "" });
    setEditingLineId("");
    refetch();
  };
  const generate = async () => { if (activeBudgetId) { await api(`/budgets/${activeBudgetId}/generate`, { method: "POST", body: JSON.stringify({ revenueGrowth: 0.06 }) }); refetch(); } };
  const removeLine = async (id: string) => {
    await api(`/budget-lines/${id}`, { method: "DELETE" });
    if (editingLineId === id) {
      setEditingLineId("");
      setLine({ month: 1, year: YEAR, category: "revenue", amount: 0, comment: "" });
    }
    refetch();
  };
  return (
    <>
      <PageHeader title="Détail budget" description="Édition des lignes mensuelles budgétées par catégorie." actions={<button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={generate}>Générer les lignes</button>} />
      <div className="mb-5 rounded-lg border border-line bg-white p-4">
        <SelectInput label="Budget" value={activeBudgetId} onChange={setBudgetId} options={(budgets ?? []).map((budget) => ({ label: `${budget.name} v${budget.versionNumber}`, value: budget.id }))} />
        <h2 className="mb-4 mt-4 font-semibold">{data?.name ?? "Budget"}</h2>
        <div className="h-64"><ResponsiveContainer><LineChart data={monthlyRevenue}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(value, name) => [money(Number(value)), `${String(name)} - Calcul?`]} /><Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
      </div>
      <FormPanel title={editingLineId ? "Modifier une ligne" : "Ajouter une ligne"} onSubmit={saveLine}>
        <TextInput label="Mois" type="number" value={line.month} onChange={(value) => setLine({ ...line, month: value })} />
        <TextInput label="Année" type="number" value={line.year} onChange={(value) => setLine({ ...line, year: value })} />
        <SelectInput label="Catégorie" value={line.category} onChange={(value) => setLine({ ...line, category: value })} options={budgetCatégories} />
        <TextInput label="Montant" type="number" value={line.amount} onChange={(value) => setLine({ ...line, amount: value })} />
        <TextArea label="Commentaire" value={line.comment} onChange={(value) => setLine({ ...line, comment: value })} />
      </FormPanel>
      <Table rows={(data?.lines ?? []).slice(0, 200)} onSelect={(row) => { setEditingLineId(row.id); setLine({ month: row.month, year: row.year, category: row.category, amount: row.amount, comment: row.comment ?? "" }); }} selectedId={editingLineId} columns={[
        { key: "month", label: "Mois" },
        { key: "category", label: "Catégorie" },
        { key: "source", label: "Source", render: (row) => <DataOriginBadge kind={row.source ?? "manual"} label={row.source ? undefined : "Budget saisi"} details={[row.updatedAt ? `Mis à jour le ${row.updatedAt}` : undefined]} /> },
        { key: "amount", label: "Montant", render: (row) => row.category === "utilization_rate" ? percent(row.amount) : money(row.amount) },
        { key: "comment", label: "Commentaire" },
        { key: "actions", label: "Actions", render: (row) => <ActionButton tone="risk" onClick={() => removeLine(row.id)}>Supprimer</ActionButton> }
      ]} />
    </>
  );
}

export function ObjectivesPage() {
  const { data, refetch } = useApi<any[]>(`/objectives/status?fiscalYear=${YEAR}`);
  const [draft, setDraft] = useState({ name: "", type: "revenue", targetValue: 0, unit: "amount", period: "annual", fiscalYear: YEAR, status: "active" });
  const [editingId, setEditingId] = useState("");
  const save = async (event: FormEvent) => {
    event.preventDefault();
    await api(editingId ? `/objectives/${editingId}` : "/objectives", { method: editingId ? "PUT" : "POST", body: JSON.stringify(draft) });
    setDraft({ name: "", type: "revenue", targetValue: 0, unit: "amount", period: "annual", fiscalYear: YEAR, status: "active" });
    setEditingId("");
    refetch();
  };
  const removeObjective = async (id: string) => {
    await api(`/objectives/${id}`, { method: "DELETE" });
    if (editingId === id) {
      setEditingId("");
      setDraft({ name: "", type: "revenue", targetValue: 0, unit: "amount", period: "annual", fiscalYear: YEAR, status: "active" });
    }
    refetch();
  };
  return (
    <>
      <PageHeader title="Objectifs" description="Création et suivi des objectifs financiers, commerciaux, opérationnels et staffing." />
      <InfoPanel title="Provenance et rôle">Les objectifs sont saisis dans cet écran. Leur statut est ensuite recalculé par comparaison avec le réel, le budget et le forecast disponibles pour l'année fiscale.</InfoPanel>
      <FormPanel title={editingId ? "Modifier un objectif" : "Nouvel objectif"} onSubmit={save}>
        <TextInput label="Nom" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
        <SelectInput label="Type" value={draft.type} onChange={(value) => setDraft({ ...draft, type: value })} options={objectiveTypes} />
        <TextInput label="Cible" type="number" value={draft.targetValue} onChange={(value) => setDraft({ ...draft, targetValue: value })} />
        <SelectInput label="Unité" value={draft.unit} onChange={(value) => setDraft({ ...draft, unit: value })} options={objectiveUnits} />
        <SelectInput label="Période" value={draft.period} onChange={(value) => setDraft({ ...draft, period: value })} options={objectivePeriods} />
        <SelectInput label="Statut" value={draft.status} onChange={(value) => setDraft({ ...draft, status: value })} options={["draft", "active", "achieved", "at_risk", "missed", "archived"]} />
      </FormPanel>
      <Table rows={data ?? []} onSelect={(row) => { setEditingId(row.id); setDraft({ name: row.name, type: row.type, targetValue: row.targetValue, unit: row.unit, period: row.period, fiscalYear: row.fiscalYear, status: row.status }); }} selectedId={editingId} columns={[
        { key: "name", label: "Objectif" },
        { key: "source", label: "Source", render: (row) => <DataOriginBadge kind="manual" details={[row.updatedAt ? `Mis à jour le ${row.updatedAt}` : undefined, row.achievementRate !== undefined ? `Atteinte calculée ${percent(row.achievementRate)}` : undefined]} /> },
        { key: "type", label: "Type" },
        { key: "period", label: "Période" },
        { key: "targetValue", label: "Cible", render: (row) => row.unit === "percentage" ? percent(row.targetValue) : money(row.targetValue) },
        { key: "achievementRate", label: "Atteinte", render: (row) => percent(row.achievementRate) },
        { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> },
        { key: "actions", label: "Actions", render: (row) => <ActionButton tone="risk" onClick={() => removeObjective(row.id)}>Supprimer</ActionButton> }
      ]} />
    </>
  );
}

export function RollingForecastPage() {
  const { data: budgets } = useApi<any[]>("/budgets");
  const { data: forecasts, refetch } = useApi<any[]>("/rolling-forecasts");
  const [selectedId, setSelectedId] = useState("");
  const activeId = selectedId || forecasts?.[0]?.id || "";
  const { data: lines, refetch: refetchLines } = useApi<any[]>(activeId ? `/rolling-forecasts/${activeId}/lines` : "");
  const [draft, setDraft] = useState({ name: `Rolling forecast ${YEAR}`, fiscalYear: YEAR, baseMonth: `${YEAR}-07`, horizonMonths: 12, sourceBudgetId: "" });
  const [forecastEdit, setForecastEdit] = useState({ name: "", baseMonth: "", horizonMonths: 12, status: "active", notes: "" });
  const [line, setLine] = useState<any | null>(null);
  const generate = async (event: FormEvent) => {
    event.preventDefault();
    await api("/rolling-forecasts/generate", { method: "POST", body: JSON.stringify({ ...draft, sourceBudgetId: draft.sourceBudgetId || budgets?.[0]?.id }) });
    refetch();
  };
  const saveForecast = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeId) return;
    const current = forecasts?.find((item) => item.id === activeId);
    await api(`/rolling-forecasts/${activeId}`, {
      method: "PUT",
      body: JSON.stringify({
        name: forecastEdit.name || current?.name,
        baseMonth: forecastEdit.baseMonth || current?.baseMonth,
        horizonMonths: forecastEdit.horizonMonths || current?.horizonMonths,
        status: forecastEdit.status || current?.status,
        notes: forecastEdit.notes
      })
    });
    refetch();
  };
  const saveLine = async (event: FormEvent) => {
    event.preventDefault();
    if (!line) return;
    const url = line.id ? `/rolling-forecast-lines/${line.id}` : `/rolling-forecasts/${activeId}/lines`;
    await api(url, { method: line.id ? "PUT" : "POST", body: JSON.stringify(line) });
    setLine(null);
    refetchLines();
  };
  const archive = async () => { if (activeId) { await api(`/rolling-forecasts/${activeId}/archive`, { method: "POST" }); refetch(); } };
  const removeForecast = async (id: string) => {
    await api(`/rolling-forecasts/${id}`, { method: "DELETE" });
    if (selectedId === id) setSelectedId("");
    refetch();
  };
  const removeRollingLine = async (id: string) => {
    await api(`/rolling-forecast-lines/${id}`, { method: "DELETE" });
    if (line?.id === id) setLine(null);
    refetchLines();
  };
  return (
    <>
      <PageHeader title="Rolling Forecast" description="Génération, archivage et ajustement des lignes du rolling forecast." actions={<div className="flex gap-2"><button className="rounded-md border border-line px-3 py-2 text-sm" onClick={archive}>Archiver le forecast actif</button><button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={() => activeId && setLine({ month: 1, year: YEAR, category: "revenue", amount: 0, source: "manual_override", confidenceScore: 0.7, comment: "" })}>Ajouter une ligne</button></div>} />
      <InfoPanel title="Provenance des données">Les mois passés proviennent du réel disponible, le mois courant mélange réel partiel et forecast, et les mois futurs sont issus du forecast ou du reforecast. Les lignes peuvent être ajustées manuellement après génération.</InfoPanel>
      <FormPanel title="Générer un rolling forecast" onSubmit={generate} submitLabel="Générer">
        <TextInput label="Nom" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
        <TextInput label="Année" type="number" value={draft.fiscalYear} onChange={(value) => setDraft({ ...draft, fiscalYear: value })} />
        <TextInput label="Mois de base" value={draft.baseMonth} onChange={(value) => setDraft({ ...draft, baseMonth: value })} />
        <TextInput label="Horizon mois" type="number" value={draft.horizonMonths} onChange={(value) => setDraft({ ...draft, horizonMonths: value })} />
        <SelectInput label="Budget source" value={draft.sourceBudgetId || budgets?.[0]?.id || ""} onChange={(value) => setDraft({ ...draft, sourceBudgetId: value })} options={(budgets ?? []).map((budget) => ({ label: budget.name, value: budget.id }))} />
      </FormPanel>
      <Panel title="Forecasts"><Table rows={forecasts ?? []} onSelect={(row) => { setSelectedId(row.id); setForecastEdit({ name: row.name, baseMonth: row.baseMonth, horizonMonths: row.horizonMonths, status: row.status, notes: row.notes ?? "" }); }} selectedId={activeId} columns={[{ key: "name", label: "Nom" }, { key: "baseMonth", label: "Base" }, { key: "horizonMonths", label: "Horizon" }, { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }, { key: "actions", label: "Actions", render: (row) => <ActionButton tone="risk" onClick={() => removeForecast(row.id)}>Supprimer</ActionButton> }]} /></Panel>
      {activeId ? <FormPanel title="Modifier le forecast sélectionné" onSubmit={saveForecast}><TextInput label="Nom" value={forecastEdit.name || forecasts?.find((item) => item.id === activeId)?.name || ""} onChange={(value) => setForecastEdit({ ...forecastEdit, name: value })} /><TextInput label="Mois de base" value={forecastEdit.baseMonth || forecasts?.find((item) => item.id === activeId)?.baseMonth || ""} onChange={(value) => setForecastEdit({ ...forecastEdit, baseMonth: value })} /><TextInput label="Horizon mois" type="number" value={forecastEdit.horizonMonths || forecasts?.find((item) => item.id === activeId)?.horizonMonths || 12} onChange={(value) => setForecastEdit({ ...forecastEdit, horizonMonths: value })} /><SelectInput label="Statut" value={forecastEdit.status || forecasts?.find((item) => item.id === activeId)?.status || "active"} onChange={(value) => setForecastEdit({ ...forecastEdit, status: value })} options={["draft", "active", "archived"]} /><TextArea label="Notes" value={forecastEdit.notes} onChange={(value) => setForecastEdit({ ...forecastEdit, notes: value })} /></FormPanel> : null}
      {line ? <FormPanel title={line.id ? "Ajuster une ligne" : "Ajouter une ligne"} onSubmit={saveLine}><TextInput label="Mois" type="number" value={line.month} onChange={(value) => setLine({ ...line, month: value })} /><TextInput label="Annee" type="number" value={line.year} onChange={(value) => setLine({ ...line, year: value })} /><SelectInput label="Catégorie" value={line.category} onChange={(value) => setLine({ ...line, category: value })} options={budgetCatégories} /><TextInput label="Montant" type="number" value={line.amount} onChange={(value) => setLine({ ...line, amount: value })} /><SelectInput label="Source" value={line.source} onChange={(value) => setLine({ ...line, source: value })} options={["actual", "forecast", "reforecast", "manual_override", "budget"]} /><TextInput label="Confiance" type="number" value={line.confidenceScore} onChange={(value) => setLine({ ...line, confidenceScore: value })} /><TextArea label="Commentaire" value={line.comment ?? ""} onChange={(value) => setLine({ ...line, comment: value })} /></FormPanel> : null}
      <Table rows={(lines ?? []).slice(0, 120)} onSelect={setLine} selectedId={line?.id} columns={[{ key: "month", label: "Mois" }, { key: "category", label: "Catégorie" }, { key: "amount", label: "Montant", render: (row) => row.category === "utilization_rate" ? percent(row.amount) : money(row.amount) }, { key: "source", label: "Source", render: (row) => <DataOriginBadge kind={row.source} label={row.source} details={[row.comment]} /> }, { key: "confidenceScore", label: "Confiance", render: (row) => percent(row.confidenceScore) }, { key: "actions", label: "Actions", render: (row) => <ActionButton tone="risk" onClick={() => removeRollingLine(row.id)}>Supprimer</ActionButton> }]} />
    </>
  );
}

export function AnnualLandingPage() {
  const { data } = useApi<any>(`/annual-landing?fiscalYear=${YEAR}`);
  return (
    <>
      <PageHeader title="Atterrissage annuel" description="Estimation de fin d'ann?e ? partir du r?el ? date et du forecast restant." />
      <DataOriginLegend items={[{ kind: "manual", label: "Budget" }, { kind: "provider", label: "R?el" }, { kind: "reforecast", label: "Projection" }]} />
      <InfoPanel title="Donn?es calcul?es">Cet ?cran est calcul? ? partir du budget actif, du r?el mensuel, du rolling forecast et du sc?nario actif. Il ne remplace pas les ?crans de saisie.</InfoPanel>
      <InfoPanel title="M?thode de calcul">L'atterrissage combine le budget annuel, le r?alis? ? date et le forecast restant. Les ?carts affich?s sont des ?carts probables par rapport au budget de r?f?rence.</InfoPanel>
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <KpiCard label="CA budget" value={money(data?.budgetRevenue)} origin={{ kind: "manual", label: "Budget" }} />
        <KpiCard label="CA probable" value={money(data?.projectedAnnualRevenue)} tone={(data?.revenueGap ?? 0) < 0 ? "risk" : "good"} origin={{ kind: "reforecast", label: "Atterrissage" }} />
        <KpiCard label="Marge probable" value={money(data?.projectedGrossMargin)} origin={{ kind: "reforecast", label: "Atterrissage" }} />
        <KpiCard label="Cash probable" value={money(data?.projectedClosingCash)} tone={(data?.cashGap ?? 0) < 0 ? "risk" : "good"} origin={{ kind: "reforecast", label: "Atterrissage" }} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">{["lowCase", "medianCase", "highCase"].map((key) => <div key={key} className="rounded-lg border border-line bg-white p-4"><div className="text-sm text-muted">{key}</div><div className="mt-2 text-xl font-semibold">{money(data?.[key]?.revenue)}</div><div className="text-sm text-muted">Cash {money(data?.[key]?.cash)}</div></div>)}</div>
    </>
  );
}

export function BudgetForecastActualPage() {
  const [calculated, setCalculated] = useState<any[] | null>(null);
  const recalculate = async () => setCalculated(await api<any[]>("/variance-analyses/recalculate", { method: "POST", body: JSON.stringify({ fiscalYear: YEAR }) }));
  const { data: report } = useApi<any>(`/reports/budget-forecast-actual.json?fiscalYear=${YEAR}`);
  return (
    <>
      <PageHeader title="Budget / Forecast / Actual" description="Comparaison mensuelle budget, rolling forecast, reforecast et réel." actions={<button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={recalculate}>Recalculer</button>} />
      <InfoPanel title="Source des chiffres">Le tableau consolide les lignes budgétaires, le réel mensuel, les rolling forecasts et les recalculs de reforecast. Le bouton Recalculer régénère les écarts à partir des données applicatives disponibles.</InfoPanel>
      <InfoPanel title="Données calculées">Cet écran est calculé à partir du budget actif, du réel mensuel, du rolling forecast et du scénario actif. Il ne remplace pas les écrans de saisie.</InfoPanel>
      <Table rows={calculated ?? report?.variances ?? []} columns={[{ key: "month", label: "Mois" }, { key: "category", label: "Catégorie" }, { key: "source", label: "Source", render: (row) => <DataOriginBadge kind="calculated" details={[`Budget ${money(row.budgetValue)}`, `Réel ${money(row.actualValue)}`]} /> }, { key: "budgetValue", label: "Budget", render: (row) => money(row.budgetValue) }, { key: "actualValue", label: "Réel", render: (row) => money(row.actualValue) }, { key: "varianceAmount", label: "Écart", render: (row) => money(row.varianceAmount ?? row.varianceBudgetActual) }, { key: "severity", label: "Statut", render: (row) => <StatusBadge label={row.severity ?? row.status} tone={tone(row.severity ?? row.status)} /> }]} />
    </>
  );
}

export function VarianceAnalysesPage() {
  const { data, refetch } = useApi<any[]>("/variance-analyses");
  const [selected, setSelected] = useState<any | null>(null);
  const [comment, setComment] = useState("");
  const [cause, setCause] = useState({ causeType: "other", description: "", amountImpact: 0, confidenceScore: 0.7 });
  const recalculate = async () => { await api<any[]>("/variance-analyses/recalculate", { method: "POST", body: JSON.stringify({ fiscalYear: YEAR }) }); refetch(); };
  const saveStatus = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    await api(`/variance-analyses/${selected.id}`, { method: "PUT", body: JSON.stringify({ status: selected.status, severity: selected.severity, ownerUserId: selected.ownerUserId }) });
    refetch();
  };
  const addComment = async (event: FormEvent) => { event.preventDefault(); if (selected && comment) { await api(`/variance-analyses/${selected.id}/comments`, { method: "POST", body: JSON.stringify({ comment, visibility: "direction" }) }); setComment(""); } };
  const addCause = async (event: FormEvent) => { event.preventDefault(); if (selected) { await api(`/variance-analyses/${selected.id}/causes`, { method: "POST", body: JSON.stringify(cause) }); setCause({ causeType: "other", description: "", amountImpact: 0, confidenceScore: 0.7 }); } };
  const removeVariance = async (id: string) => {
    await api(`/variance-analyses/${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    refetch();
  };
  return (
    <>
      <PageHeader title="Écarts commentés" description="Recalcul, qualification, commentaires et causes des Écarts budgétaires." actions={<button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={recalculate}>Recalculer</button>} />
      <InfoPanel title="Lecture fonctionnelle">Les écarts sont générés par comparaison budget / réel / forecast. Une fois détectés, ils peuvent être qualifiés, commentés, reliés à des causes et transformés en actions correctives.</InfoPanel>
      {selected ? <div className="grid gap-5 xl:grid-cols-2"><FormPanel title="Qualifier l'écart" onSubmit={saveStatus}><SelectInput label="Statut" value={selected.status} onChange={(value) => setSelected({ ...selected, status: value })} options={["new", "under_review", "explained", "action_required", "resolved", "ignored"]} /><SelectInput label="Sévérité" value={selected.severity} onChange={(value) => setSelected({ ...selected, severity: value })} options={["info", "warning", "critical"]} /><TextInput label="Responsable" value={selected.ownerUserId ?? ""} onChange={(value) => setSelected({ ...selected, ownerUserId: value })} /></FormPanel><FormPanel title="Ajouter une cause" onSubmit={addCause}><TextInput label="Type" value={cause.causeType} onChange={(value) => setCause({ ...cause, causeType: value })} /><TextInput label="Impact" type="number" value={cause.amountImpact} onChange={(value) => setCause({ ...cause, amountImpact: value })} /><TextInput label="Confiance" type="number" value={cause.confidenceScore} onChange={(value) => setCause({ ...cause, confidenceScore: value })} /><TextArea label="Description" value={cause.description} onChange={(value) => setCause({ ...cause, description: value })} /></FormPanel><FormPanel title="Ajouter un commentaire" onSubmit={addComment}><TextArea label="Commentaire direction/finance" value={comment} onChange={setComment} /></FormPanel></div> : null}
      <Table rows={data ?? []} onSelect={setSelected} selectedId={selected?.id} columns={[{ key: "month", label: "Mois" }, { key: "category", label: "Catégorie" }, { key: "source", label: "Source", render: (row) => <DataOriginBadge kind="calculated" details={[`Budget ${money(row.budgetValue)}`, `Réel ${money(row.actualValue)}`]} /> }, { key: "varianceAmount", label: "Écart", render: (row) => money(row.varianceAmount) }, { key: "variancePercent", label: "Écart %", render: (row) => percent(row.variancePercent) }, { key: "severity", label: "Sévérité", render: (row) => <StatusBadge label={row.severity} tone={tone(row.severity)} /> }, { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }, { key: "actions", label: "Actions", render: (row) => <ActionButton tone="risk" onClick={() => removeVariance(row.id)}>Supprimer</ActionButton> }]} />
    </>
  );
}

export function ActionPlansPage() {
  const { data: plans, refetch } = useApi<any[]>("/action-plans");
  const [selectedId, setSelectedId] = useState("");
  const plan = plans?.find((item) => item.id === selectedId) ?? plans?.[0];
  const { data: detail, refetch: refetchDetail } = useApi<any>(plan ? `/action-plans/${plan.id}` : "");
  const { data: suggestions, refetch: refetchSuggestions } = useApi<any[]>("/action-suggestions");
  const { data: users } = useApi<any[]>("/users");
  const userLabels = useMemo(() => new Map((users ?? []).map((user) => [user.id, user.name || user.email || user.id])), [users]);
  const [draftPlan, setDraftPlan] = useState({ title: "", description: "", fiscalYear: YEAR, status: "active", ownerUserId: "" });
  const [editingPlanId, setEditingPlanId] = useState("");
  const [draftItem, setDraftItem] = useState({ title: "", description: "", actionType: "custom", ownerUserId: "", dueDate: "", status: "todo", priority: "medium", expectedImpactAmount: 0, expectedImpactMonth: "" });
  const [editingItemId, setEditingItemId] = useState("");
  const savePlan = async (event: FormEvent) => { event.preventDefault(); await api(editingPlanId ? `/action-plans/${editingPlanId}` : "/action-plans", { method: editingPlanId ? "PUT" : "POST", body: JSON.stringify(draftPlan) }); setDraftPlan({ title: "", description: "", fiscalYear: YEAR, status: "active", ownerUserId: "" }); setEditingPlanId(""); refetch(); };
  const saveItem = async (event: FormEvent) => { event.preventDefault(); if (!plan) return; await api(editingItemId ? `/action-items/${editingItemId}` : `/action-plans/${plan.id}/items`, { method: editingItemId ? "PUT" : "POST", body: JSON.stringify({ ...draftItem, dueDate: draftItem.dueDate || null }) }); setDraftItem({ title: "", description: "", actionType: "custom", ownerUserId: "", dueDate: "", status: "todo", priority: "medium", expectedImpactAmount: 0, expectedImpactMonth: "" }); setEditingItemId(""); refetchDetail(); };
  const updateItem = async (id: string, action: "complete" | "cancel") => { await api(`/action-items/${id}/${action}`, { method: "POST", body: JSON.stringify({}) }); refetchDetail(); };
  const removePlan = async (id: string) => {
    await api(`/action-plans/${id}`, { method: "DELETE" });
    if (selectedId === id) setSelectedId("");
    if (editingPlanId === id) setEditingPlanId("");
    refetch();
  };
  const removeItem = async (id: string) => {
    await api(`/action-items/${id}`, { method: "DELETE" });
    if (editingItemId === id) setEditingItemId("");
    refetchDetail();
  };
  const convertSuggestion = async (id: string) => { await api(`/action-suggestions/${id}/convert-to-action`, { method: "POST", body: JSON.stringify({ fiscalYear: YEAR }) }); refetchSuggestions(); refetchDetail(); };
  return (
    <>
      <PageHeader title="Plans d'action" description="Création de plans, ajout d'actions, conversion des suggestions et suivi d'avancement." />
      <FormPanel title={editingPlanId ? "Modifier le plan" : "Nouveau plan"} onSubmit={savePlan}><TextInput label="Titre" value={draftPlan.title} onChange={(value) => setDraftPlan({ ...draftPlan, title: value })} /><SelectInput label="Statut" value={draftPlan.status} onChange={(value) => setDraftPlan({ ...draftPlan, status: value })} options={["draft", "active", "completed", "cancelled", "archived"]} /><TextInput label="Responsable" value={draftPlan.ownerUserId} onChange={(value) => setDraftPlan({ ...draftPlan, ownerUserId: value })} /><TextArea label="Description" value={draftPlan.description} onChange={(value) => setDraftPlan({ ...draftPlan, description: value })} /></FormPanel>
      <Panel title="Plans"><Table rows={plans ?? []} onSelect={(row) => { setSelectedId(row.id); setEditingPlanId(row.id); setDraftPlan({ title: row.title, description: row.description ?? "", fiscalYear: row.fiscalYear, status: row.status, ownerUserId: row.ownerUserId ?? "" }); }} selectedId={plan?.id} columns={[{ key: "title", label: "Plan" }, { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }, { key: "ownerUserId", label: "Responsable", render: (row) => userLabels.get(row.ownerUserId) ?? row.ownerUserId ?? "-" }, { key: "actions", label: "Actions", render: (row) => <ActionButton tone="risk" onClick={() => removePlan(row.id)}>Supprimer</ActionButton> }]} /></Panel>
      <FormPanel title={`${editingItemId ? "Modifier" : "Nouvelle"} action${plan ? ` - ${plan.title}` : ""}`} onSubmit={saveItem}><TextInput label="Titre" value={draftItem.title} onChange={(value) => setDraftItem({ ...draftItem, title: value })} /><TextInput label="Type" value={draftItem.actionType} onChange={(value) => setDraftItem({ ...draftItem, actionType: value })} /><TextInput label="Responsable" value={draftItem.ownerUserId} onChange={(value) => setDraftItem({ ...draftItem, ownerUserId: value })} /><TextInput label="Échéance" type="date" value={draftItem.dueDate} onChange={(value) => setDraftItem({ ...draftItem, dueDate: value })} /><SelectInput label="Statut" value={draftItem.status} onChange={(value) => setDraftItem({ ...draftItem, status: value })} options={["todo", "in_progress", "blocked", "done", "cancelled"]} /><SelectInput label="Priorité" value={draftItem.priority} onChange={(value) => setDraftItem({ ...draftItem, priority: value })} options={["low", "medium", "high", "critical"]} /><TextInput label="Impact attendu" type="number" value={draftItem.expectedImpactAmount} onChange={(value) => setDraftItem({ ...draftItem, expectedImpactAmount: value })} /><TextInput label="Mois impact attendu" value={draftItem.expectedImpactMonth} onChange={(value) => setDraftItem({ ...draftItem, expectedImpactMonth: value })} /><TextArea label="Description" value={draftItem.description} onChange={(value) => setDraftItem({ ...draftItem, description: value })} /></FormPanel>
      <Panel title="Actions"><Table rows={detail?.items ?? []} onSelect={(row) => { setEditingItemId(row.id); setDraftItem({ title: row.title, description: row.description ?? "", actionType: row.actionType, ownerUserId: row.ownerUserId ?? "", dueDate: dateInputValue(row.dueDate), status: row.status, priority: row.priority, expectedImpactAmount: row.expectedImpactAmount ?? 0, expectedImpactMonth: row.expectedImpactMonth ?? "" }); }} selectedId={editingItemId} columns={[{ key: "title", label: "Action" }, { key: "ownerUserId", label: "Responsable", render: (row) => userLabels.get(row.ownerUserId) ?? row.ownerUserId ?? "-" }, { key: "priority", label: "Priorité", render: (row) => <StatusBadge label={row.priority} tone={tone(row.priority)} /> }, { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }, { key: "expectedImpactAmount", label: "Impact attendu", render: (row) => money(row.expectedImpactAmount) }, { key: "dueDate", label: "Échéance", render: (row) => dateInputValue(row.dueDate) }, { key: "actions", label: "Actions", render: (row) => <div className="flex gap-2"><ActionButton onClick={() => updateItem(row.id, "complete")}>Terminer</ActionButton><ActionButton onClick={() => updateItem(row.id, "cancel")}>Annuler</ActionButton><ActionButton tone="risk" onClick={() => removeItem(row.id)}>Supprimer</ActionButton></div> }]} /></Panel>
      <Panel title="Suggestions"><Table rows={suggestions ?? []} columns={[{ key: "title", label: "Suggestion" }, { key: "priority", label: "Priorité" }, { key: "expectedImpactAmount", label: "Impact", render: (row) => money(row.expectedImpactAmount) }, { key: "confidenceScore", label: "Confiance", render: (row) => percent(row.confidenceScore) }, { key: "actions", label: "Actions", render: (row) => <ActionButton onClick={() => convertSuggestion(row.id)}>Convertir</ActionButton> }]} /></Panel>
    </>
  );
}

export function RequiredPipelinePage() {
  const [params, setParams] = useState({ signedRemainingRevenue: 840000, weightedPipelineRevenue: 210000, conversionRate: 0.35, averageOpportunityAmount: 85000 });
  const query = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]))).toString();
  const { data, loading, error, setData } = useApi<any>(`/required-pipeline?fiscalYear=${YEAR}&${query}`);
  const [recalculating, setRecalculating] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const recalculate = async () => {
    setRecalculating(true);
    setMutationError("");
    try {
      setData(await api<any>("/required-pipeline/recalculate", { method: "POST", body: JSON.stringify({ fiscalYear: YEAR, ...params }) }));
    } catch (caught) {
      setMutationError(caught instanceof Error ? caught.message : "Le recalcul a échoué.");
    } finally {
      setRecalculating(false);
    }
  };
  return (
    <>
      <PageHeader title="Pipeline nécessaire" description="Paramètres commerciaux et pipeline brut nécessaire pour atteindre le budget." actions={<button type="button" className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={recalculate} disabled={recalculating}>{recalculating ? "Recalcul..." : "Recalculer"}</button>} />
      <InfoPanel title="Hypothèses utilisées">Le calcul part de l'objectif de chiffre d'affaires, retranche le réalisé, le signé restant et le pipeline pondéré, puis applique le taux de conversion pour estimer le pipeline brut à générer.</InfoPanel>
      <InfoPanel title="Données calculées">Cet écran est calculé à partir du budget actif, du réel mensuel, du rolling forecast et du scénario actif. Il ne remplace pas les écrans de saisie.</InfoPanel>
      <FormPanel title="Hypothèses commerciales" onSubmit={(event) => { event.preventDefault(); void recalculate(); }} submitLabel={recalculating ? "Recalcul..." : "Recalculer"}>
        <TextInput label="CA signé restant" type="number" value={params.signedRemainingRevenue} onChange={(value) => setParams({ ...params, signedRemainingRevenue: value })} />
        <TextInput label="Pipeline pondéré" type="number" value={params.weightedPipelineRevenue} onChange={(value) => setParams({ ...params, weightedPipelineRevenue: value })} />
        <TextInput label="Taux conversion" type="number" value={params.conversionRate} onChange={(value) => setParams({ ...params, conversionRate: value })} />
        <TextInput label="Montant moyen opportunité" type="number" value={params.averageOpportunityAmount} onChange={(value) => setParams({ ...params, averageOpportunityAmount: value })} />
      </FormPanel>
      {error || mutationError ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{mutationError || error}</div> : null}
      {loading || recalculating ? <div className="mb-4 text-sm text-muted">Calcul du pipeline nécessaire...</div> : null}
      <div className="mb-5 grid gap-3 md:grid-cols-5">
        <KpiCard label="Objectif CA" value={money(data?.targetRevenue)} origin={{ kind: "manual", label: "Objectif" }} />
        <KpiCard label="CA r?alis?" value={money(data?.actualRevenue)} origin={{ kind: "provider", label: "R?el" }} />
        <KpiCard label="Gap CA" value={money(data?.revenueGap)} tone={(data?.revenueGap ?? 0) > 0 ? "risk" : "good"} origin={{ kind: "calculated", label: "?cart" }} />
        <KpiCard label="Pipeline requis" value={money(data?.requiredGrossPipeline)} origin={{ kind: "calculated", label: "Pipeline" }} />
        <KpiCard label="Opportunit?s" value={String(data?.opportunitiesNeeded ?? "-")} origin={{ kind: "calculated", label: "Pipeline" }} />
      </div>
      {data?.calculatedAt ? <p className="mb-3 text-xs text-muted">Dernier recalcul : {new Date(data.calculatedAt).toLocaleString("fr-FR")}</p> : null}
      <Table rows={(data?.recommendations ?? []).map((label: string) => ({ label }))} columns={[{ key: "label", label: "Recommandation" }]} />
    </>
  );
}

export function BudgetStaffingPage() {
  const [params, setParams] = useState({ averageDailyRate: 780, internalCapacityBeforeSeptember: 150, internalCapacityAfterSeptember: 166, externalCapacityBeforeSeptember: 46, externalCapacityAfterSeptember: 54 });
  const query = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]))).toString();
  const { data, refetch } = useApi<any[]>(`/budget-staffing?fiscalYear=${YEAR}&${query}`);
  return (
    <>
      <PageHeader title="Staffing budgétaire" description="Hypothèses de capacité et calcul des jours/ETP nécessaires pour atteindre la trajectoire budgétaire." actions={<button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={refetch}>Recalculer</button>} />
      <InfoPanel title="Différence avec le capacity planning">Le staffing budgétaire part du budget de chiffre d'affaires et estime les jours facturables et ETP nécessaires. Le capacity planning compare ensuite ces besoins aux compétences et capacités disponibles.</InfoPanel>
      <InfoPanel title="Données calculées">Cet écran est calculé à partir du budget actif, du réel mensuel, du rolling forecast et du scénario actif. Il ne remplace pas les écrans de saisie.</InfoPanel>
      <FormPanel title="Hypothèses staffing" onSubmit={(event) => { event.preventDefault(); refetch(); }} submitLabel="Recalculer">
        <TextInput label="TJM moyen" type="number" value={params.averageDailyRate} onChange={(value) => setParams({ ...params, averageDailyRate: value })} />
        <TextInput label="Capacité interne avant sept." type="number" value={params.internalCapacityBeforeSeptember} onChange={(value) => setParams({ ...params, internalCapacityBeforeSeptember: value })} />
        <TextInput label="Capacité interne après sept." type="number" value={params.internalCapacityAfterSeptember} onChange={(value) => setParams({ ...params, internalCapacityAfterSeptember: value })} />
        <TextInput label="Capacité externe avant sept." type="number" value={params.externalCapacityBeforeSeptember} onChange={(value) => setParams({ ...params, externalCapacityBeforeSeptember: value })} />
        <TextInput label="Capacité externe après sept." type="number" value={params.externalCapacityAfterSeptember} onChange={(value) => setParams({ ...params, externalCapacityAfterSeptember: value })} />
      </FormPanel>
      <Table rows={data ?? []} columns={[{ key: "month", label: "Mois" }, { key: "requiredBillableDays", label: "Jours requis" }, { key: "internalCapacityDays", label: "Capacité interne" }, { key: "externalCapacityDays", label: "Capacité externe" }, { key: "gapDays", label: "Gap jours" }, { key: "staffingGapFTE", label: "Gap ETP" }, { key: "missingSkills", label: "Compétences", render: (row) => (row.missingSkills ?? []).join(", ") }]} />
    </>
  );
}

export function WhatMustBeTruePage() {
  const { data, refetch } = useApi<any[]>(`/what-must-be-true?fiscalYear=${YEAR}`);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState({ fiscalYear: YEAR, conditionType: "revenue_condition", description: "", targetValue: 0, currentValue: 0, gap: 0, riskLevel: "medium", status: "at_risk", relatedActions: "" });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    await api(selectedId ? `/what-must-be-true/${selectedId}` : "/what-must-be-true", { method: selectedId ? "PUT" : "POST", body: JSON.stringify(draft) });
    setSelectedId("");
    setDraft({ fiscalYear: YEAR, conditionType: "revenue_condition", description: "", targetValue: 0, currentValue: 0, gap: 0, riskLevel: "medium", status: "at_risk", relatedActions: "" });
    refetch();
  };
  const removeCondition = async (id: string) => {
    await api(`/what-must-be-true/${id}`, { method: "DELETE" });
    if (selectedId === id) {
      setSelectedId("");
      setDraft({ fiscalYear: YEAR, conditionType: "revenue_condition", description: "", targetValue: 0, currentValue: 0, gap: 0, riskLevel: "medium", status: "at_risk", relatedActions: "" });
    }
    refetch();
  };
  return (
    <>
      <PageHeader title="Conditions de réussite" description="Création, qualification et suivi des conditions nécessaires pour atteindre le budget." />
      <InfoPanel title="Rôle de cet écran">Ces conditions traduisent les prérequis concrets pour atteindre l'objectif : pipeline à signer, marge à maintenir, cash à préserver, staffing à couvrir ou coûts à contenir.</InfoPanel>
      <InfoPanel title="Données calculées et pilotables">Les conditions peuvent être générées depuis les écarts ou saisies manuellement. Elles doivent rester reliées à des objectifs, des risques et des actions concrètes.</InfoPanel>
      <FormPanel title={selectedId ? "Modifier une condition" : "Nouvelle condition"} onSubmit={save}>
        <SelectInput label="Type" value={draft.conditionType} onChange={(value) => setDraft({ ...draft, conditionType: value })} options={["revenue_condition", "margin_condition", "cash_condition", "sales_condition", "staffing_condition", "payment_condition", "cost_condition", "client_condition"]} />
        <TextInput label="Cible" type="number" value={draft.targetValue} onChange={(value) => setDraft({ ...draft, targetValue: value })} />
        <TextInput label="Actuel" type="number" value={draft.currentValue} onChange={(value) => setDraft({ ...draft, currentValue: value })} />
        <TextInput label="Gap" type="number" value={draft.gap} onChange={(value) => setDraft({ ...draft, gap: value })} />
        <SelectInput label="Risque" value={draft.riskLevel} onChange={(value) => setDraft({ ...draft, riskLevel: value })} options={["low", "medium", "high", "critical"]} />
        <SelectInput label="Statut" value={draft.status} onChange={(value) => setDraft({ ...draft, status: value })} options={["satisfied", "at_risk", "not_satisfied", "unknown"]} />
        <TextArea label="Condition" value={draft.description} onChange={(value) => setDraft({ ...draft, description: value })} />
        <TextArea label="Actions liées, une par ligne" value={draft.relatedActions} onChange={(value) => setDraft({ ...draft, relatedActions: value })} />
      </FormPanel>
      <Table rows={data ?? []} onSelect={(row) => { setSelectedId(row.id); setDraft({ fiscalYear: row.fiscalYear, conditionType: row.conditionType, description: row.description, targetValue: row.targetValue ?? 0, currentValue: row.currentValue ?? 0, gap: row.gap ?? 0, riskLevel: row.riskLevel, status: row.status, relatedActions: (row.relatedActions ?? []).join("\n") }); }} selectedId={selectedId} columns={[{ key: "conditionType", label: "Type" }, { key: "description", label: "Condition" }, { key: "targetValue", label: "Cible", render: (row) => row.targetValue && row.targetValue < 2 ? percent(row.targetValue) : money(row.targetValue) }, { key: "currentValue", label: "Actuel", render: (row) => row.currentValue && row.currentValue < 2 ? percent(row.currentValue) : money(row.currentValue) }, { key: "riskLevel", label: "Risque", render: (row) => <StatusBadge label={row.riskLevel} tone={tone(row.riskLevel)} /> }, { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }, { key: "actions", label: "Actions", render: (row) => <ActionButton tone="risk" onClick={() => removeCondition(row.id)}>Supprimer</ActionButton> }]} />
    </>
  );
}
