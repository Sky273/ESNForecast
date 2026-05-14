import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { CrudPage } from "../components/CrudPage";
import { Badge, money, percent } from "../components/Format";
import { KpiCard } from "../components/KpiCard";

type V2Context = { scenarioId: string; horizon: number };

export function ExecutiveCockpitPage({ scenarioId, horizon }: V2Context) {
  const { data } = useObject(`/executive/situation?scenarioId=${scenarioId}&horizon=${horizon}`);
  const months = data?.forecast?.months ?? [];
  return (
    <section className="space-y-5">
      <PageTitle title="Cockpit direction V2" subtitle="Synthese previsionnel, reel, ecarts, risques et capacite." />
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="CA previsionnel" value={money(data?.summary?.forecastRevenue ?? 0)} />
        <KpiCard label="CA reel" value={money(data?.summary?.actualRevenue ?? 0)} />
        <KpiCard label="Ecart CA" value={money(data?.summary?.revenueVariance ?? 0)} tone={(data?.summary?.revenueVariance ?? 0) < 0 ? "risk" : "good"} />
        <KpiCard label="Tresorerie finale" value={money(data?.summary?.finalClosingCash ?? 0)} />
        <KpiCard label="Alertes critiques" value={String(data?.summary?.criticalAlerts ?? 0)} tone={(data?.summary?.criticalAlerts ?? 0) > 0 ? "risk" : "good"} />
        <KpiCard label="Gaps capacite" value={String(data?.summary?.capacityShortages ?? 0)} tone={(data?.summary?.capacityShortages ?? 0) > 0 ? "risk" : "good"} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="CA, couts et cash">
          <LineChart data={months}>
            <CartesianGrid stroke="#e5e7eb" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
            <Tooltip formatter={(value) => money(Number(value))} />
            <Legend />
            <Line dataKey="revenueGenerated" name="CA genere" stroke="#0f766e" strokeWidth={2} />
            <Line dataKey="totalCosts" name="Couts" stroke="#b42318" strokeWidth={2} />
            <Line dataKey="closingCash" name="Cash final" stroke="#2563eb" strokeWidth={2} />
          </LineChart>
        </ChartCard>
        <ChartCard title="Ecarts reel / previsionnel">
          <BarChart data={data?.variances ?? []}>
            <CartesianGrid stroke="#e5e7eb" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
            <Tooltip formatter={(value) => money(Number(value))} />
            <Legend />
            <Bar dataKey="revenueVariance" name="Ecart CA" fill="#0f766e" />
            <Bar dataKey="costsVariance" name="Ecart couts" fill="#b42318" />
            <Bar dataKey="cashVariance" name="Ecart cash" fill="#2563eb" />
          </BarChart>
        </ChartCard>
      </div>
      <SimpleTable rows={data?.alerts ?? []} columns={[
        ["severity", "Severite", (value: string) => <Badge tone={value === "critical" ? "risk" : value === "warning" ? "warn" : "neutral"}>{value}</Badge>],
        ["month", "Mois"],
        ["message", "Message"],
        ["explanation", "Explication"]
      ]} />
    </section>
  );
}

export function TimesheetsPage() {
  return <CrudPage title="CRA et temps reellement produit" path="/timesheets" initial={{ resourceType: "employee", resourceId: "", missionId: "", month: 6, year: 2026, workedDays: 20, billableDays: 18, nonBillableDays: 2, absenceDays: 0, vacationDays: 0, sickLeaveDays: 0, trainingDays: 0, internalDays: 0, status: "draft" }} fields={[
    { name: "resourceType", label: "Type ressource" }, { name: "resourceId", label: "Ressource ID" }, { name: "missionId", label: "Mission ID" }, { name: "month", label: "Mois", type: "number" }, { name: "year", label: "Annee", type: "number" }, { name: "workedDays", label: "Jours travailles", type: "number" }, { name: "billableDays", label: "Jours facturables", type: "number" }, { name: "nonBillableDays", label: "Non facturables", type: "number" }, { name: "absenceDays", label: "Absences", type: "number" }, { name: "status", label: "Statut" }, { name: "notes", label: "Notes", type: "textarea" }
  ]} columns={[{ key: "year", label: "Annee" }, { key: "month", label: "Mois" }, { key: "resourceType", label: "Type" }, { key: "resourceId", label: "Ressource" }, { key: "missionId", label: "Mission" }, { key: "billableDays", label: "Facturables" }, { key: "status", label: "Statut" }]} />;
}

export function ActualsVariancesPage({ scenarioId, horizon }: V2Context) {
  const { rows: actuals } = useRows("/actuals/monthly");
  const { rows: variances } = useRows(`/variances/monthly?scenarioId=${scenarioId}&horizon=${horizon}`);
  return (
    <section className="space-y-5">
      <PageTitle title="Reel et ecarts" subtitle="Comparaison entre previsionnel, reel constate, marge et tresorerie." />
      <SimpleTable rows={variances} columns={[
        ["month", "Mois"],
        ["forecastRevenue", "CA prevu", money],
        ["actualRevenue", "CA reel", money],
        ["revenueVariance", "Ecart CA", money],
        ["forecastCosts", "Couts prevus", money],
        ["actualCosts", "Couts reels", money],
        ["marginVariance", "Ecart marge", money],
        ["cashVariance", "Ecart cash", money]
      ]} />
      <CrudPage title="Saisie mensuelle du reel" path="/actuals/monthly" initial={{ companyId: "", month: 6, year: 2026, actualRevenueGenerated: 0, actualRevenueInvoiced: 0, actualCashIn: 0, actualEmployeeCosts: 0, actualExternalCosts: 0, actualFixedCosts: 0, actualVariableCosts: 0, actualCashOut: 0, actualGrossMargin: 0, actualNetMargin: 0, actualClosingCash: 0 }} fields={[
        { name: "companyId", label: "Societe ID" }, { name: "month", label: "Mois", type: "number" }, { name: "year", label: "Annee", type: "number" }, { name: "actualRevenueGenerated", label: "CA reel", type: "number" }, { name: "actualRevenueInvoiced", label: "CA facture", type: "number" }, { name: "actualCashIn", label: "Encaisse", type: "number" }, { name: "actualCashOut", label: "Decaisse", type: "number" }, { name: "actualClosingCash", label: "Cash final", type: "number" }
      ]} columns={actualsColumns} />
      <div className="hidden">{actuals.length}</div>
    </section>
  );
}

export function MonthlyClosePage() {
  return <CrudPage title="Cloture mensuelle" path="/monthly-closes" initial={{ companyId: "", month: 6, year: 2026, status: "open", notes: "" }} fields={[
    { name: "companyId", label: "Societe ID" }, { name: "month", label: "Mois", type: "number" }, { name: "year", label: "Annee", type: "number" }, { name: "status", label: "Statut" }, { name: "notes", label: "Notes", type: "textarea" }
  ]} columns={[{ key: "year", label: "Annee" }, { key: "month", label: "Mois" }, { key: "status", label: "Statut" }, { key: "closedAt", label: "Cloture le" }, { key: "reopenedAt", label: "Rouverte le" }]} />;
}

export function RealInvoicesPage() {
  return <CrudPage title="Factures reelles" path="/invoices" initial={{ companyId: "", clientId: "", missionId: "", invoiceNumber: "", invoiceDate: "2026-06-30", dueDate: "2026-07-30", amountHT: 10000, vatRate: 0.2, amountTTC: 12000, status: "issued", paidAmount: 0, source: "manual" }} fields={[
    { name: "companyId", label: "Societe ID" }, { name: "clientId", label: "Client ID" }, { name: "missionId", label: "Mission ID" }, { name: "invoiceNumber", label: "Numero" }, { name: "invoiceDate", label: "Date facture", type: "date" }, { name: "dueDate", label: "Echeance", type: "date" }, { name: "amountHT", label: "HT", type: "number" }, { name: "amountTTC", label: "TTC", type: "number" }, { name: "status", label: "Statut" }, { name: "paidAmount", label: "Paye", type: "number" }
  ]} columns={[{ key: "invoiceNumber", label: "Numero" }, { key: "invoiceDate", label: "Date" }, { key: "clientId", label: "Client" }, { key: "amountTTC", label: "TTC", render: (row: any) => money(row.amountTTC) }, { key: "paidAmount", label: "Paye", render: (row: any) => money(row.paidAmount) }, { key: "status", label: "Statut" }]} />;
}

export function PaymentsPage() {
  return <CrudPage title="Paiements" path="/payments" initial={{ invoiceId: "", clientId: "", paymentDate: "2026-07-30", amount: 10000, paymentMethod: "wire", status: "received" }} fields={[
    { name: "invoiceId", label: "Facture ID" }, { name: "clientId", label: "Client ID" }, { name: "paymentDate", label: "Date paiement", type: "date" }, { name: "amount", label: "Montant", type: "number" }, { name: "paymentMethod", label: "Methode" }, { name: "status", label: "Statut" }
  ]} columns={[{ key: "paymentDate", label: "Date" }, { key: "invoiceId", label: "Facture" }, { key: "amount", label: "Montant", render: (row: any) => money(row.amount) }, { key: "status", label: "Statut" }]} />;
}

export function ReconciliationPage() {
  const { data } = useObject("/reconciliation/billing");
  return (
    <section className="space-y-5">
      <PageTitle title="Rapprochement facturation" subtitle="Factures prevues, factures reelles et paiements associes." />
      <SimpleTable rows={data?.suggestions ?? []} columns={[["invoiceForecastId", "Facture prevue"], ["invoiceId", "Facture reelle"], ["amountVariance", "Ecart montant", money], ["dateVarianceDays", "Ecart jours"]]} />
    </section>
  );
}

export function CapacityPage({ scenarioId, horizon }: V2Context) {
  const { rows } = useRows(`/capacity?scenarioId=${scenarioId}&horizon=${horizon}`);
  return <TablePage title="Capacity planning" subtitle="Capacite disponible, besoins par competence et gaps mensuels." rows={rows} columns={[
    ["month", "Mois"], ["skillId", "Competence"], ["availableFTE", "Dispo FTE"], ["requiredFTE", "Besoin FTE"], ["gapFTE", "Gap"], ["status", "Statut", (value: string) => <Badge tone={value === "shortage" ? "risk" : value === "surplus" ? "warn" : "good"}>{value}</Badge>]
  ]} />;
}

export function MonteCarloPage({ scenarioId, horizon }: V2Context) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { if (scenarioId) void api("/monte-carlo/run", { method: "POST", body: JSON.stringify({ scenarioId, horizon, iterations: 500 }) }).then(setData); }, [scenarioId, horizon]);
  return (
    <section className="space-y-5">
      <PageTitle title="Monte Carlo simplifie" subtitle="Fourchettes P10/P50/P90 et risque de tresorerie negative." />
      <SimpleTable rows={data?.months ?? []} columns={[
        ["month", "Mois"],
        ["revenue", "CA P50", (value: any) => money(value?.p50 ?? 0)],
        ["margin", "Marge P50", (value: any) => money(value?.p50 ?? 0)],
        ["closingCash", "Cash P10/P50/P90", (value: any) => `${money(value?.p10 ?? 0)} / ${money(value?.p50 ?? 0)} / ${money(value?.p90 ?? 0)}`],
        ["riskBelowZero", "Risque cash < 0", percent]
      ]} />
    </section>
  );
}

export function StrategicRisksPage({ scenarioId, horizon }: V2Context) {
  const { data } = useObject(`/risks/strategic?scenarioId=${scenarioId}&horizon=${horizon}`);
  return <TablePage title="Risques strategiques" subtitle="Concentration client et dependances majeures." rows={data?.clientConcentration ?? []} columns={[
    ["clientName", "Client"], ["revenue", "CA", money], ["revenueShare", "Part CA", percent], ["severity", "Severite", (value: string) => <Badge tone={value === "critical" ? "risk" : value === "warning" ? "warn" : "neutral"}>{value}</Badge>]
  ]} />;
}

export function AiAnalysisPage({ scenarioId, horizon }: V2Context) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { if (scenarioId) void api("/ai/analyze/scenario", { method: "POST", body: JSON.stringify({ scenarioId, horizon }) }).then(setData); }, [scenarioId, horizon]);
  return (
    <section className="space-y-5">
      <PageTitle title="Analyse IA encadree" subtitle="Synthese basee uniquement sur les donnees calculees par ESN Forecast." />
      <div className="rounded-lg border border-line bg-white p-4">
        <h2 className="text-base font-semibold">Resume executif</h2>
        <p className="mt-2 text-sm text-slate-700">{data?.executiveSummary ?? "Analyse non disponible."}</p>
      </div>
      <SimpleTable rows={(data?.sourceFacts ?? []).map((fact: string, index: number) => ({ id: index, fact }))} columns={[["fact", "Chiffre source"]]} />
      <SimpleTable rows={(data?.recommendations ?? []).map((recommendation: string, index: number) => ({ id: index, recommendation }))} columns={[["recommendation", "Recommandation"]]} />
    </section>
  );
}

export function V2CrudPage({ kind }: { kind: "plannedHires" | "rules" | "notifications" | "documents" | "offers" | "connectors" }) {
  if (kind === "plannedHires") return <CrudPage title="Recrutements previsionnels" path="/planned-hires" initial={{ scenarioId: "", title: "", targetRole: "", expectedStartDate: "2026-09-01", expectedMonthlyCost: 5000, expectedEmployerCharges: 2200, expectedFullCost: 7600, expectedTJM: 850, expectedUtilizationRate: 0.8, probability: 0.7, status: "planned" }} fields={[
    { name: "scenarioId", label: "Scenario ID" }, { name: "title", label: "Titre" }, { name: "targetRole", label: "Role" }, { name: "expectedStartDate", label: "Debut", type: "date" }, { name: "expectedFullCost", label: "Cout complet", type: "number" }, { name: "expectedTJM", label: "TJM attendu", type: "number" }, { name: "expectedUtilizationRate", label: "Occupation", type: "number" }, { name: "status", label: "Statut" }
  ]} columns={[{ key: "title", label: "Recrutement" }, { key: "expectedStartDate", label: "Debut" }, { key: "expectedFullCost", label: "Cout", render: (row: any) => money(row.expectedFullCost) }, { key: "expectedTJM", label: "TJM", render: (row: any) => money(row.expectedTJM) }, { key: "status", label: "Statut" }]} />;
  if (kind === "rules") return <CrudPage title="Regles metier" path="/business-rules" initial={{ name: "", triggerType: "monthly_projection", condition: { metric: "closingCash", operator: "lt", value: 50000 }, action: { type: "alert", message: "Alerte" }, severity: "warning", isActive: true }} fields={[
    { name: "name", label: "Nom" }, { name: "triggerType", label: "Declencheur" }, { name: "severity", label: "Severite" }, { name: "isActive", label: "Active", type: "checkbox" }
  ]} columns={[{ key: "name", label: "Regle" }, { key: "triggerType", label: "Declencheur" }, { key: "severity", label: "Severite" }, { key: "isActive", label: "Active", render: (row: any) => row.isActive ? "Oui" : "Non" }]} />;
  if (kind === "notifications") return <CrudPage title="Notifications" path="/notifications" initial={{ type: "manual", severity: "info", title: "", message: "", status: "unread" }} fields={[{ name: "type", label: "Type" }, { name: "severity", label: "Severite" }, { name: "title", label: "Titre" }, { name: "message", label: "Message", type: "textarea" }, { name: "status", label: "Statut" }]} columns={[{ key: "createdAt", label: "Date" }, { key: "severity", label: "Severite" }, { key: "title", label: "Titre" }, { key: "status", label: "Statut" }]} />;
  if (kind === "documents") return <CrudPage title="Documents" path="/documents" initial={{ companyId: "", entityType: "mission", entityId: "", fileName: "", mimeType: "application/pdf", size: 0, storagePath: "", category: "contract" }} fields={[{ name: "companyId", label: "Societe ID" }, { name: "entityType", label: "Entite" }, { name: "entityId", label: "Entite ID" }, { name: "fileName", label: "Fichier" }, { name: "mimeType", label: "MIME" }, { name: "size", label: "Taille", type: "number" }, { name: "storagePath", label: "Chemin" }, { name: "category", label: "Categorie" }]} columns={[{ key: "fileName", label: "Fichier" }, { key: "entityType", label: "Entite" }, { key: "category", label: "Categorie" }, { key: "uploadedAt", label: "Ajoute le" }]} />;
  if (kind === "offers") return <CrudPage title="Offres et devis" path="/offers" initial={{ clientId: "", title: "", status: "draft", pricingMode: "daily_rate", totalAmount: 100000, expectedMargin: 30000, probability: 0.5 }} fields={[{ name: "clientId", label: "Client ID" }, { name: "title", label: "Titre" }, { name: "status", label: "Statut" }, { name: "pricingMode", label: "Prix" }, { name: "totalAmount", label: "Montant", type: "number" }, { name: "expectedMargin", label: "Marge", type: "number" }, { name: "probability", label: "Probabilite", type: "number" }]} columns={[{ key: "title", label: "Offre" }, { key: "status", label: "Statut" }, { key: "totalAmount", label: "Montant", render: (row: any) => money(row.totalAmount) }, { key: "expectedMargin", label: "Marge", render: (row: any) => money(row.expectedMargin) }]} />;
  return <ConnectorsPage />;
}

function ConnectorsPage() {
  const { data } = useObject("/connectors");
  const rows = [...(data?.accounting ?? []), ...(data?.hr ?? []), ...(data?.crm ?? [])];
  return <TablePage title="Connecteurs" subtitle="Architecture de synchronisation CSV/CRM/compta/RH optionnelle." rows={rows} columns={[["provider", "Provider"], ["externalSource", "Source"], ["status", "Statut"], ["lastSyncAt", "Derniere synchro"], ["opportunityName", "Opportunite"]]} />;
}

const actualsColumns = [
  { key: "year", label: "Annee" }, { key: "month", label: "Mois" }, { key: "actualRevenueGenerated", label: "CA", render: (row: any) => money(row.actualRevenueGenerated) }, { key: "actualCashIn", label: "Cash-in", render: (row: any) => money(row.actualCashIn) }, { key: "actualCashOut", label: "Cash-out", render: (row: any) => money(row.actualCashOut) }, { key: "actualClosingCash", label: "Cash final", render: (row: any) => money(row.actualClosingCash) }
];

function TablePage({ title, subtitle, rows, columns }: { title: string; subtitle: string; rows: any[]; columns: any[] }) {
  return <section className="space-y-5"><PageTitle title={title} subtitle={subtitle} /><SimpleTable rows={rows} columns={columns} /></section>;
}

function useRows(path: string) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { void api<any[]>(path).then(setRows).catch(() => setRows([])); }, [path]);
  return { rows };
}

function useObject(path: string) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { void api<any>(path).then(setData).catch(() => setData(null)); }, [path]);
  return { data };
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h1 className="text-2xl font-semibold tracking-normal">{title}</h1><p className="text-sm text-muted">{subtitle}</p></div>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return <div className="rounded-lg border border-line bg-white p-4"><h2 className="mb-4 text-base font-semibold">{title}</h2><div className="h-80"><ResponsiveContainer>{children}</ResponsiveContainer></div></div>;
}

function SimpleTable({ rows, columns }: { rows: any[]; columns: any[] }) {
  const normalized = useMemo(() => rows ?? [], [rows]);
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="w-full min-w-[880px] text-sm">
        <thead className="bg-surface text-left text-xs uppercase text-muted"><tr>{columns.map((column: any) => <th key={column[0]} className="px-3 py-3">{column[1]}</th>)}</tr></thead>
        <tbody>
          {normalized.map((row, index) => <tr key={row.id ?? row.month ?? row.skillId ?? index} className="border-t border-line">{columns.map((column: any) => <td key={column[0]} className="px-3 py-3">{column[2] ? column[2](row[column[0]], row) : String(row[column[0]] ?? "")}</td>)}</tr>)}
          {!normalized.length ? <tr><td className="px-3 py-8 text-center text-muted" colSpan={columns.length}>Aucune donnee</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
