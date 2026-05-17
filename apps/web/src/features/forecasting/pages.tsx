import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { API_URL, api } from "../../api";
import { Badge, money, percent } from "../../components/Format";
import { KpiCard } from "../../components/KpiCard";
import { CrudPage } from "../../components/CrudPage";

type V1Context = { scenarioId: string; horizon: number };

export const cashForecastStatusOptions = ["planned", "paid", "late", "cancelled"];

export function TreasuryPage({ scenarioId, horizon }: V1Context) {
  const { data, error } = useV1Projection(scenarioId, horizon);
  if (error) return <ErrorState error={error} />;
  if (!data) return <LoadingState />;
  return (
    <section className="space-y-5">
      <PageTitle title="Trésorerie prévisionnelle" subtitle="Encaissements, décaissements et solde final pondéré." />
      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Cash-in" value={money(data.summary.totalCashIn)} />
        <KpiCard label="Cash-out" value={money(data.summary.totalCashOut)} />
        <KpiCard label="Trésorerie finale" value={money(data.summary.finalClosingCash)} tone={data.summary.finalClosingCash < 0 ? "risk" : "good"} />
        <KpiCard label="Mois à risque" value={String(data.summary.riskMonths.length)} />
      </div>
      <ChartCard title="Courbe de trésorerie">
        <LineChart data={data.cashflow}>
          <CartesianGrid stroke="#e5e7eb" />
          <XAxis dataKey="month" />
          <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
          <Tooltip formatter={(value) => money(Number(value))} />
          <Legend />
          <Line dataKey="closingCash" name="Solde final" stroke="#2563eb" strokeWidth={2} />
          <Line dataKey="cashIn" name="Cash-in" stroke="#0f766e" strokeWidth={2} />
          <Line dataKey="cashOut" name="Cash-out" stroke="#b42318" strokeWidth={2} />
        </LineChart>
      </ChartCard>
      <SimpleTable rows={data.cashflow} columns={[
        ["month", "Mois"],
        ["openingCash", "Solde initial", money],
        ["cashIn", "Cash-in", money],
        ["cashOut", "Cash-out", money],
        ["variation", "Variation", money],
        ["closingCash", "Solde final", money],
        ["status", "Statut", (v: string) => <Badge tone={v === "critical" ? "risk" : v === "watch" ? "warn" : "good"}>{v}</Badge>]
      ]} />
    </section>
  );
}

export function ScenariosPage({ scenarioId, horizon }: V1Context) {
  const [rows, setRows] = useState<any[]>([]);
  const [compare, setCompare] = useState<any>(null);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState({ name: "", type: "custom", riskLevel: "medium", author: "", notes: "" });
  const loadRows = async () => setRows(await api<any[]>("/scenarios"));
  useEffect(() => { void loadRows(); }, []);
  useEffect(() => {
    if (rows.length >= 2) void api(`/scenarios/compare?scenarioA=${rows[0].id}&scenarioB=${rows[1].id}&horizon=${horizon}`).then(setCompare);
  }, [rows, horizon]);
  const resetDraft = () => {
    setEditingId("");
    setDraft({ name: "", type: "custom", riskLevel: "medium", author: "", notes: "" });
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    await api(editingId ? `/scenarios/${editingId}` : "/scenarios", { method: editingId ? "PUT" : "POST", body: JSON.stringify(draft) });
    resetDraft();
    await loadRows();
  };
  const edit = (row: any) => {
    setEditingId(row.id);
    setDraft({ name: row.name ?? "", type: row.type ?? "custom", riskLevel: row.riskLevel ?? "medium", author: row.author ?? "", notes: row.notes ?? "" });
  };
  const duplicate = async (row: any) => {
    await api(`/scenarios/${row.id}/duplicate`, { method: "POST", body: JSON.stringify({ name: `${row.name} copie`, type: "custom" }) });
    await loadRows();
  };
  const setActive = async (row: any) => {
    await api(`/scenarios/${row.id}/set-active`, { method: "POST" });
    await loadRows();
  };
  const archive = async (row: any) => {
    await api(`/scenarios/${row.id}`, { method: "DELETE" });
    await loadRows();
  };
  return (
    <section className="space-y-5">
      <PageTitle title="Scénarios" subtitle="Référence, pessimiste, optimiste et personnalisés." />
      <form onSubmit={save} className="rounded-lg border border-line bg-white p-4">
        <h2 className="mb-4 text-base font-semibold">{editingId ? "Modifier le scénario" : "Nouveau scénario"}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label>
            <span className="mb-1 block text-xs font-medium text-muted">Nom</span>
            <input className="w-full rounded-md border border-line px-3 py-2" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-muted">Type</span>
            <select className="w-full rounded-md border border-line px-3 py-2" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>
              {["reference", "pessimistic", "realistic", "optimistic", "custom"].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-muted">Risque</span>
            <select className="w-full rounded-md border border-line px-3 py-2" value={draft.riskLevel} onChange={(event) => setDraft({ ...draft, riskLevel: event.target.value })}>
              {["low", "medium", "high", "critical"].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-muted">Auteur</span>
            <input className="w-full rounded-md border border-line px-3 py-2" value={draft.author} onChange={(event) => setDraft({ ...draft, author: event.target.value })} />
          </label>
          <label className="md:col-span-3">
            <span className="mb-1 block text-xs font-medium text-muted">Notes</span>
            <textarea className="min-h-20 w-full rounded-md border border-line px-3 py-2" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white" type="submit">{editingId ? "Enregistrer" : "Créer"}</button>
          {editingId ? <button className="rounded-md border border-line px-4 py-2 text-sm" type="button" onClick={resetDraft}>Annuler</button> : null}
        </div>
      </form>
      <SimpleTable rows={rows} columns={[
        ["name", "Nom"],
        ["type", "Type"],
        ["isActive", "Actif", (v: boolean) => v ? "Oui" : "Non"],
        ["riskLevel", "Risque", (v: string) => <Badge tone={v === "high" || v === "critical" ? "risk" : v === "medium" ? "warn" : "good"}>{v}</Badge>],
        ["totalRevenue", "CA projeté", money],
        ["totalCosts", "Coûts", money],
        ["grossMargin", "Marge", money],
        ["finalBalance", "Solde final", money],
        ["riskMonths", "Mois risque"],
        ["actions", "Actions", (_: any, row: any) => <div className="flex flex-wrap gap-2"><button className="rounded-md border border-line px-2 py-1 text-xs" onClick={() => edit(row)}>Éditer</button><button className="rounded-md border border-line px-2 py-1 text-xs" onClick={() => duplicate(row)}>Dupliquer</button><button className="rounded-md border border-line px-2 py-1 text-xs" onClick={() => setActive(row)}>Activer</button><button className="rounded-md border border-line px-2 py-1 text-xs text-risk" onClick={() => archive(row)}>Archiver</button></div>]
      ]} />
      {compare ? (
        <ChartCard title="Comparaison de scénarios">
          <BarChart data={compare.deltas}>
            <CartesianGrid stroke="#e5e7eb" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
            <Tooltip formatter={(value) => money(Number(value))} />
            <Legend />
            <Bar dataKey="revenueDelta" name="Écart CA" fill="#0f766e" />
            <Bar dataKey="costDelta" name="Écart coûts" fill="#b42318" />
            <Bar dataKey="cashDelta" name="Écart cash" fill="#2563eb" />
          </BarChart>
        </ChartCard>
      ) : null}
    </section>
  );
}

export function ProfitabilityMissionsPage({ scenarioId, horizon }: V1Context) {
  const { rows } = useEndpoint(`/profitability/missions?scenarioId=${scenarioId}&horizon=${horizon}`);
  return <ProfitabilityTable title="Rentabilité missions" rows={rows} columns={[
    ["title", "Mission"],
    ["status", "Statut"],
    ["revenueWeighted", "CA pondéré", money],
    ["internalCosts", "Coûts internes", money],
    ["externalCosts", "Coûts externes", money],
    ["grossMargin", "Marge", money],
    ["marginRate", "Taux marge", percent],
    ["profitabilityBadge", "Badge", (v: string) => <Badge tone={v === "nenegative" ? "risk" : v === "weak" ? "warn" : "good"}>{v}</Badge>]
  ]} />;
}

export function ProfitabilityResourcesPage({ scenarioId, horizon }: V1Context) {
  const { rows } = useEndpoint(`/profitability/resources?scenarioId=${scenarioId}&horizon=${horizon}`);
  return <ProfitabilityTable title="Rentabilité ressources" rows={rows} columns={[
    ["name", "Ressource"],
    ["resourceType", "Type"],
    ["revenueGenerated", "CA généré", money],
    ["costGenerated", "Coût", money],
    ["marginGenerated", "Marge", money],
    ["utilizationRate", "Occupation", percent],
    ["billedDays", "Jours facturés"],
    ["benchCost", "Intercontrat", money]
  ]} />;
}

export function BenchPage({ scenarioId, horizon }: V1Context) {
  const { data } = useEndpointObject(`/bench?scenarioId=${scenarioId}&horizon=${horizon}`);
  return (
    <section className="space-y-5">
      <PageTitle title="Intercontrat" subtitle="Coût projeté des salariés plaçables non utilisés." />
      <KpiCard label="Coût intercontrat total" value={money(data?.totalBenchCost ?? 0)} tone={(data?.totalBenchCost ?? 0) > 0 ? "risk" : "good"} />
      <SimpleTable rows={data?.months ?? []} columns={[["month", "Mois"], ["benchCost", "Coût intercontrat", money], ["utilizationRate", "Occupation", percent]]} />
    </section>
  );
}

export function AlertsPage({ scenarioId, horizon }: V1Context) {
  const { rows } = useEndpoint(`/alerts?scenarioId=${scenarioId}&horizon=${horizon}`);
  return <ProfitabilityTable title="Alertes" rows={rows} columns={[
    ["severity", "Sévérité", (v: string) => <Badge tone={v === "critical" ? "risk" : v === "warning" ? "warn" : "neutral"}>{v}</Badge>],
    ["type", "Type"],
    ["month", "Mois"],
    ["message", "Message"],
    ["recommendedAction", "Action recommandée"],
    ["status", "Statut"]
  ]} />;
}

export function ReportsPage({ scenarioId, horizon }: V1Context) {
  const month = new Date().toISOString().slice(0, 7);
  return (
    <section className="space-y-5">
      <PageTitle title="Centre de rapports" subtitle="Exports PDF, JSON et CSV regroup\u00e9s par usage de direction, budget, pricing et exploitation." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <ReportLink title="Rapport direction" description="Synth\u00e8se ex\u00e9cutive sc\u00e9nario, projection, cash et risques." href={`${API_URL}/reports/executive.pdf?scenarioId=${scenarioId}&horizon=${horizon}`} />
        <ReportLink title="Rapport direction JSON" description="Donn\u00e9es structur\u00e9es du rapport ex\u00e9cutif." href={`${API_URL}/reports/executive.json?scenarioId=${scenarioId}&horizon=${horizon}`} />
        <ReportLink title="Rapport CODIR connect\u00e9" description="Synth\u00e8se mensuelle bas\u00e9e sur donn\u00e9es bancaires, \u00e9carts et anomalies." href={`${API_URL}/reports/codir.pdf?month=${month}&scenarioId=${scenarioId}&horizon=${horizon}`} />
        <ReportLink title="Budget / Forecast / Actual" description="Comparaison budg\u00e9taire et \u00e9carts commentables." href={`${API_URL}/reports/budget-forecast-actual.json?fiscalYear=2026`} />
        <ReportLink title="Pricing / marge mission" description="Missions sous-marg\u00e9es, ren\u00e9gociations et impact potentiel." href={`${API_URL}/reports/pricing-margin.pdf`} />
        <ReportLink title="Projection CSV" description="Export tabulaire des projections." href={`${API_URL}/export/projection.csv`} />
        <ReportLink title="Ressources CSV" description="Export tabulaire des ressources." href={`${API_URL}/export/resources.csv`} />
      </div>
    </section>
  );
}

export function BillingPage() {
  const missionLabels = useLabelMap("/missions", (row) => row.title);
  const scenarioLabels = useLabelMap("/scenarios", (row) => row.name);
  return <CrudPage title="Facturation pr\u00e9visionnelle" path="/invoice-forecasts" initial={{ missionId: "", scenarioId: "", invoiceDate: "2026-06-30", dueDate: "2026-07-30", expectedPaymentDate: "2026-07-30", amountHT: 10000, vatRate: 0.2, amountTTC: 12000, status: "planned", probability: 1 }} fields={[
    { name: "missionId", label: "Mission", type: "select", optionsPath: "/missions", optionLabelKey: "title", optionValueKey: "id", placeholder: "S\u00e9lectionner une mission" }, { name: "scenarioId", label: "Sc\u00e9nario", type: "select", optionsPath: "/scenarios", optionLabelKey: "name", optionValueKey: "id", placeholder: "S\u00e9lectionner un sc\u00e9nario" }, { name: "invoiceDate", label: "Date facture", type: "date" }, { name: "dueDate", label: "\u00c9ch\u00e9ance", type: "date" }, { name: "expectedPaymentDate", label: "Encaissement pr\u00e9vu", type: "date" }, { name: "amountHT", label: "Montant HT", type: "number" }, { name: "vatRate", label: "TVA", type: "number" }, { name: "amountTTC", label: "Montant TTC", type: "number" }, { name: "status", label: "Statut", type: "select", options: ["planned", "issued", "cancelled", "late"].map((value) => ({ label: value, value })) }, { name: "probability", label: "Probabilit\u00e9", type: "number" }
  ]} columns={[{ key: "invoiceDate", label: "Date" }, { key: "missionId", label: "Mission", render: (r: any) => missionLabels.get(r.missionId) ?? r.mission?.title ?? r.missionId }, { key: "scenarioId", label: "Sc\u00e9nario", render: (r: any) => scenarioLabels.get(r.scenarioId) ?? r.scenario?.name ?? r.scenarioId }, { key: "amountHT", label: "HT", render: (r: any) => money(r.amountHT) }, { key: "expectedPaymentDate", label: "Encaissement" }, { key: "status", label: "Statut" }]} />;
}

export function CashInPage() {
  const scenarioLabels = useLabelMap("/scenarios", (row) => row.name);
  const invoiceLabels = useLabelMap("/invoice-forecasts", invoiceForecastLabel);
  return <CrudPage title="Encaissements pr\u00e9visionnels" path="/cash-in-forecasts" initial={{ scenarioId: "", sourceType: "invoice", sourceId: "", expectedDate: "2026-07-30", amount: 10000, probability: 1, weightedAmount: 10000, status: "planned" }} fields={[
    { name: "scenarioId", label: "Sc\u00e9nario", type: "select", optionsPath: "/scenarios", optionLabelKey: "name", optionValueKey: "id", placeholder: "S\u00e9lectionner un sc\u00e9nario" }, { name: "sourceType", label: "Type de source", type: "select", options: [{ label: "Facture pr\u00e9visionnelle", value: "invoice" }, { label: "Saisie manuelle", value: "manual" }, { label: "Autre", value: "other" }] }, { name: "sourceId", label: "Source", type: "select", optionsPath: "/invoice-forecasts", optionLabelFields: ["invoiceDate", "amountTTC"], optionValueKey: "id", placeholder: "S\u00e9lectionner une facture pr\u00e9visionnelle" }, { name: "expectedDate", label: "Date pr\u00e9vue", type: "date" }, { name: "amount", label: "Montant", type: "number" }, { name: "probability", label: "Probabilit\u00e9", type: "number" }, { name: "weightedAmount", label: "Montant pond\u00e9r\u00e9", type: "number" }, { name: "status", label: "Statut", type: "select", options: cashForecastStatusOptions.map((value) => ({ label: value, value })) }
  ]} columns={[{ key: "expectedDate", label: "Date" }, { key: "scenarioId", label: "Sc\u00e9nario", render: (r: any) => scenarioLabels.get(r.scenarioId) ?? r.scenarioId }, { key: "sourceType", label: "Type de source" }, { key: "sourceId", label: "Source", render: (r: any) => r.sourceType === "invoice" ? invoiceLabels.get(r.sourceId) ?? r.sourceId : sourceFallback(r) }, { key: "amount", label: "Montant", render: (r: any) => money(r.amount) }, { key: "weightedAmount", label: "Pond\u00e9r\u00e9", render: (r: any) => money(r.weightedAmount) }, { key: "status", label: "Statut" }]} />;
}

export function CashOutPage() {
  const scenarioLabels = useLabelMap("/scenarios", (row) => row.name);
  const employeeLabels = useLabelMap("/employees", fullNameLabel);
  const freelancerLabels = useLabelMap("/freelancers", fullNameLabel);
  const partnerResourceLabels = useLabelMap("/partner-resources", fullNameLabel);
  const fixedCostLabels = useLabelMap("/fixed-costs", (row) => row.label ?? row.name);
  const variableCostLabels = useLabelMap("/variable-costs", (row) => row.label ?? row.name);
  const sourceLabel = (row: any) => {
    if (row.sourceType === "salary" || row.sourceType === "employer_tax") return employeeLabels.get(row.sourceId) ?? row.sourceId;
    if (row.sourceType === "freelancer_invoice") return freelancerLabels.get(row.sourceId) ?? row.sourceId;
    if (row.sourceType === "partner_invoice") return partnerResourceLabels.get(row.sourceId) ?? row.sourceId;
    if (row.sourceType === "fixed_cost") return fixedCostLabels.get(row.sourceId) ?? row.sourceId;
    if (row.sourceType === "variable_cost") return variableCostLabels.get(row.sourceId) ?? row.sourceId;
    return sourceFallback(row);
  };
  return <CrudPage title="D\u00e9caissements pr\u00e9visionnels" path="/cash-out-forecasts" initial={{ scenarioId: "", sourceType: "fixed_cost", sourceId: "", expectedDate: "2026-07-30", amount: 10000, status: "planned" }} fields={[
    { name: "scenarioId", label: "Sc\u00e9nario", type: "select", optionsPath: "/scenarios", optionLabelKey: "name", optionValueKey: "id", placeholder: "S\u00e9lectionner un sc\u00e9nario" },
    { name: "sourceType", label: "Type de source", type: "select", options: [
      { label: "Salaire", value: "salary" },
      { label: "Charges employeur", value: "employer_tax" },
      { label: "Facture freelance", value: "freelancer_invoice" },
      { label: "Facture partenaire", value: "partner_invoice" },
      { label: "Frais fixe", value: "fixed_cost" },
      { label: "Frais variable", value: "variable_cost" },
      { label: "Taxe", value: "tax" },
      { label: "Saisie manuelle", value: "manual" },
      { label: "Autre", value: "other" }
    ] },
    { name: "sourceId", label: "Source", type: "select", optionDependsOn: "sourceType", optionSourcesByValue: {
      salary: { path: "/employees", optionLabelFields: ["firstName", "lastName"] },
      freelancer_invoice: { path: "/freelancers", optionLabelFields: ["firstName", "lastName"] },
      partner_invoice: { path: "/partner-resources", optionLabelFields: ["firstName", "lastName"] },
      fixed_cost: { path: "/fixed-costs", optionLabelKey: "label" },
      variable_cost: { path: "/variable-costs", optionLabelKey: "label" }
    }, placeholder: "S\u00e9lectionner la source" },
    { name: "expectedDate", label: "Date pr\u00e9vue", type: "date" }, { name: "amount", label: "Montant", type: "number" }, { name: "status", label: "Statut", type: "select", options: cashForecastStatusOptions.map((value) => ({ label: value, value })) }
  ]} columns={[{ key: "expectedDate", label: "Date" }, { key: "scenarioId", label: "Sc\u00e9nario", render: (r: any) => scenarioLabels.get(r.scenarioId) ?? r.scenarioId }, { key: "sourceType", label: "Type de source" }, { key: "sourceId", label: "Source", render: sourceLabel }, { key: "amount", label: "Montant", render: (r: any) => money(r.amount) }, { key: "status", label: "Statut" }]} />;
}

export function SimulationsPage() {
  const scenarioLabels = useLabelMap("/scenarios", (row) => row.name);
  const missionLabels = useLabelMap("/missions", (row) => row.title);
  return <CrudPage title="Simulations" path="/simulation-events" initial={{ scenarioId: "", type: "exceptional_cost", label: "", startDate: "2026-08-01", amount: 10000, percentage: 0, parameters: {}, isActive: true }} fields={[
    { name: "scenarioId", label: "Sc\u00e9nario", type: "select", optionsPath: "/scenarios", optionLabelKey: "name", optionValueKey: "id", placeholder: "S\u00e9lectionner un sc\u00e9nario" },
    { name: "type", label: "Type", type: "select", options: ["exceptional_cost", "revenue_boost", "revenue_drop", "cost_reduction", "cost_increase", "delay", "custom"].map((value) => ({ label: value, value })) },
    { name: "label", label: "Libell\u00e9" }, { name: "startDate", label: "D\u00e9but", type: "date" }, { name: "endDate", label: "Fin", type: "date" }, { name: "amount", label: "Montant", type: "number" }, { name: "percentage", label: "Pourcentage", type: "number" }, { name: "relatedMissionId", label: "Mission li\u00e9e", type: "select", optionsPath: "/missions", optionLabelKey: "title", optionValueKey: "id", placeholder: "Aucune mission li\u00e9e" }, { name: "isActive", label: "Active", type: "checkbox" }, { name: "notes", label: "Notes", type: "textarea" }
  ]} columns={[{ key: "label", label: "Simulation" }, { key: "scenarioId", label: "Sc\u00e9nario", render: (r: any) => scenarioLabels.get(r.scenarioId) ?? r.scenarioId }, { key: "type", label: "Type" }, { key: "startDate", label: "D\u00e9but" }, { key: "amount", label: "Montant", render: (r: any) => money(r.amount ?? 0) }, { key: "relatedMissionId", label: "Mission", render: (r: any) => missionLabels.get(r.relatedMissionId) ?? r.relatedMissionId ?? "" }, { key: "isActive", label: "Active", render: (r: any) => r.isActive ? "Oui" : "Non" }]} />;
}

export function AuditPage() {
  const { rows } = useEndpoint("/audit-logs");
  return <ProfitabilityTable title="Historique" rows={rows} columns={[["createdAt", "Date"], ["entityType", "Entité"], ["entityId", "ID"], ["action", "Action"]]} />;
}

export function AdminPage() {
  return <CrudPage title="Administration utilisateurs" path="/users" initial={{ email: "", name: "", role: "readonly" }} fields={[
    { name: "email", label: "Email" }, { name: "name", label: "Nom" }, { name: "role", label: "Rôle", type: "select", options: ["admin", "direction", "finance", "commercial", "readonly"].map((value) => ({ label: value, value })) }
  ]} columns={[{ key: "email", label: "Email" }, { key: "name", label: "Nom" }, { key: "role", label: "Rôle" }]} />;
}

function ProfitabilityTable({ title, rows, columns }: { title: string; rows: any[]; columns: any[] }) {
  return <section className="space-y-5"><PageTitle title={title} subtitle="Vue calculée à partir du scénario actif." /><SimpleTable rows={rows} columns={columns} /></section>;
}

function useV1Projection(scenarioId: string, horizon: number) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!scenarioId) return;
    api(`/projections/scenario/${scenarioId}?horizon=${horizon}`).then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : "Erreur API"));
  }, [scenarioId, horizon]);
  return { data, error };
}

function useEndpoint(path: string) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { void api<any[]>(path).then(setRows); }, [path]);
  return { rows };
}

function useEndpointObject(path: string) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { void api<any>(path).then(setData); }, [path]);
  return { data };
}

function useLabelMap(path: string, label: (row: any) => string | undefined) {
  const { rows } = useEndpoint(path);
  return useMemo(() => new Map(rows.map((row) => [row.id, label(row) ?? row.name ?? row.title ?? row.id])), [rows, label]);
}

function fullNameLabel(row: any) {
  return [row.firstName, row.lastName].filter(Boolean).join(" ") || row.name || row.id;
}

function invoiceForecastLabel(row: any) {
  return `${row.invoiceDate ?? "Date non définie"} - ${money(row.amountTTC ?? row.amountHT ?? 0)}`;
}

function sourceFallback(row: any) {
  if (!row.sourceId) return row.sourceType === "manual" ? "Saisie manuelle" : "";
  return row.sourceId;
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h1 className="text-2xl font-semibold tracking-normal">{title}</h1><p className="text-sm text-muted">{subtitle}</p></div>;
}

function ReportLink({ title, description, href }: { title: string; description: string; href: string }) {
  const openReport = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <a className="rounded-lg border border-line bg-white p-4 transition hover:border-brand/50 hover:shadow-sm" href={href} target="_blank" rel="noreferrer" onClick={openReport}>
      <span className="block font-semibold">{title}</span>
      <span className="mt-1 block text-sm text-muted">{description}</span>
    </a>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return <div className="rounded-lg border border-line bg-white p-4"><h2 className="mb-4 text-base font-semibold">{title}</h2><div className="h-80"><ResponsiveContainer>{children}</ResponsiveContainer></div></div>;
}

function SimpleTable({ rows, columns }: { rows: any[]; columns: any[] }) {
  const normalized = useMemo(() => rows ?? [], [rows]);
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="w-full min-w-[880px] text-sm">
        <thead className="bg-surface text-left text-xs uppercase text-muted"><tr>{columns.map((c: any) => <th key={c[0]} className="px-3 py-3">{c[1]}</th>)}</tr></thead>
        <tbody>
          {normalized.map((row, index) => <tr key={row.id ?? row.month ?? index} className="border-t border-line">{columns.map((c: any) => <td key={c[0]} className="px-3 py-3">{c[2] ? c[2](row[c[0]], row) : String(row[c[0]] ?? "")}</td>)}</tr>)}
          {!normalized.length ? <tr><td className="px-3 py-8 text-center text-muted" colSpan={columns.length}>Aucune donnée</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function LoadingState() {
  return <div className="text-muted">Chargement...</div>;
}

function ErrorState({ error }: { error: string }) {
  return <div className="text-risk">{error}</div>;
}
