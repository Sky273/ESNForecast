import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { API_URL, api } from "../../api";
import { CrudPage } from "../../components/CrudPage";
import { Badge, money, percent } from "../../components/Format";
import { KpiCard } from "../../components/KpiCard";

type V3Context = { scenarioId: string; horizon: number };

export function ConnectedFinanceDashboard({ scenarioId, horizon }: V3Context) {
  const { data } = useObject(`/financial/situation?scenarioId=${scenarioId}&horizon=${horizon}`);
  return (
    <section className="space-y-5">
      <PageTitle title="Dashboard V3 finance connectée" subtitle="Trésorerie bancaire, Écarts, rapprochement, fiabilité, runway et qualité des données." />
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Cash bancaire" value={money(data?.bankSummary?.currentCash ?? 0)} />
        <KpiCard label="Comptes actifs" value={String(data?.bankSummary?.accounts ?? 0)} />
        <KpiCard label="Connecteurs actifs" value={String(data?.connectorHealth?.active ?? 0)} tone={(data?.connectorHealth?.active ?? 0) > 0 ? "good" : "risk"} />
        <KpiCard label="Connecteurs expires" value={String(data?.connectorHealth?.expired ?? 0)} tone={(data?.connectorHealth?.expired ?? 0) > 0 ? "risk" : "good"} />
        <KpiCard label="Suggestions" value={String(data?.reconciliationSuggestions?.length ?? 0)} />
        <KpiCard label="Anomalies" value={String(data?.anomalies?.length ?? 0)} tone={(data?.anomalies?.length ?? 0) > 0 ? "risk" : "good"} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Trésorerie prévue / réelle / recalibrée">
          <LineChart data={data?.treasury ?? []}>
            <CartesianGrid stroke="#e5e7eb" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
            <Tooltip formatter={(value) => money(Number(value))} />
            <Legend />
            <Line dataKey="forecastClosingCash" name="Prévu" stroke="#64748b" strokeWidth={2} />
            <Line dataKey="actualClosingCash" name="Réel bancaire" stroke="#0f766e" strokeWidth={2} />
            <Line dataKey="recalibratedClosingCash" name={"Recalibr\u00e9"} stroke="#2563eb" strokeWidth={2} />
          </LineChart>
        </ChartCard>
        <ChartCard title="Fiabilité prévisionnelle">
          <BarChart data={data?.reliabilityScores ?? []}>
            <CartesianGrid stroke="#e5e7eb" />
            <XAxis dataKey="month" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Bar dataKey="score" name="Score" fill="#0f766e" />
          </BarChart>
        </ChartCard>
      </div>
      <SimpleTable rows={data?.dataQualityIssues ?? []} columns={[
        ["severity", "Sévérité", severityBadge],
        ["type", "Type"],
        ["message", "Message"],
        ["suggestedFix", "Correction"]
      ]} />
    </section>
  );
}

export function BankAccountsPage() {
  return <CrudPage title="Banque - comptes" path="/bank/accounts" initial={{ organizationId: "", companyId: "", bankConnectionId: "", externalAccountId: "", name: "", ibanMasked: "FR76********1234", currency: "EUR", type: "checking", currentBalance: 0, availableBalance: 0, balanceDate: "2026-06-30", isActive: true }} fields={[
    { name: "organizationId", label: "Organisation", type: "select", optionsPath: "/organizations", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une organisation" }, { name: "companyId", label: "Société", type: "select", optionsPath: "/companies", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une société" }, { name: "bankConnectionId", label: "Connexion bancaire", type: "select", optionsPath: "/bank/connections", optionLabelKey: "provider", optionValueKey: "id", placeholder: "Sélectionner une connexion" }, { name: "externalAccountId", label: "Compte externe" }, { name: "name", label: "Nom" }, { name: "ibanMasked", label: "IBAN masqué" }, { name: "currentBalance", label: "Solde", type: "number" }, { name: "availableBalance", label: "Disponible", type: "number" }, { name: "balanceDate", label: "Date solde", type: "date" }, { name: "type", label: "Type", type: "select", options: ["checking", "savings", "credit", "other"].map((value) => ({ label: value, value })) }, { name: "isActive", label: "Actif", type: "checkbox" }
  ]} columns={[{ key: "name", label: "Compte" }, { key: "ibanMasked", label: "IBAN masqué" }, { key: "currentBalance", label: "Solde", render: (row: any) => money(row.currentBalance) }, { key: "availableBalance", label: "Disponible", render: (row: any) => money(row.availableBalance) }, { key: "balanceDate", label: "Date" }]} />;
}

export function BankTransactionsPage() {
  return <CrudPage title="Transactions bancaires" path="/bank/transactions" initial={{ organizationId: "", companyId: "", bankAccountId: "", externalTransactionId: "", transactionDate: "2026-06-30", bookingDate: "2026-06-30", label: "", amount: 0, currency: "EUR", direction: "debit", status: "booked", categorizationStatus: "uncategorized", reconciliationStatus: "unreconciled", confidenceScore: 0 }} fields={[
    { name: "organizationId", label: "Organisation", type: "select", optionsPath: "/organizations", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une organisation" }, { name: "companyId", label: "Société", type: "select", optionsPath: "/companies", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une société" }, { name: "bankAccountId", label: "Compte", type: "select", optionsPath: "/bank/accounts", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner un compte" }, { name: "externalTransactionId", label: "ID externe" }, { name: "transactionDate", label: "Date", type: "date" }, { name: "label", label: "Libellé" }, { name: "counterpartyName", label: "Contrepartie" }, { name: "amount", label: "Montant", type: "number" }, { name: "direction", label: "Sens", type: "select", options: ["credit", "debit"].map((value) => ({ label: value, value })) }, { name: "status", label: "Statut", type: "select", options: ["pending", "booked", "cancelled"].map((value) => ({ label: value, value })) }, { name: "categoryId", label: "Catégorie", type: "select", optionsPath: "/financial-categories", optionLabelKey: "name", optionValueKey: "id", placeholder: "Aucune catégorie" }, { name: "categorizationStatus", label: "Categorisation", type: "select", options: ["uncategorized", "auto_categorized", "manually_categorized", "rule_categorized"].map((value) => ({ label: value, value })) }, { name: "reconciliationStatus", label: "Rapprochement", type: "select", options: ["unreconciled", "suggested", "reconciled", "ignored"].map((value) => ({ label: value, value })) }
  ]} columns={[{ key: "transactionDate", label: "Date" }, { key: "label", label: "Libellé" }, { key: "counterpartyName", label: "Contrepartie" }, { key: "amount", label: "Montant", render: (row: any) => money(row.amount) }, { key: "categorizationStatus", label: "Catégorie" }, { key: "reconciliationStatus", label: "Rapprochement" }]} />;
}

export function BankReconciliationPage() {
  const { rows, reload } = useRows("/reconciliation/suggestions");
  const accept = async (id: string) => { await api(`/reconciliation/suggestions/${id}/accept`, { method: "POST", body: JSON.stringify({}) }); await reload(); };
  const reject = async (id: string) => { await api(`/reconciliation/suggestions/${id}/reject`, { method: "POST", body: JSON.stringify({}) }); await reload(); };
  return <TablePage title="Rapprochement bancaire" subtitle="Suggestions entre transactions, factures, paiements, coûts et taxes." rows={rows} columns={[
    ["confidenceScore", "Score", percent],
    ["transactionId", "Transaction"],
    ["targetType", "Cible"],
    ["targetId", "Cible ID"],
    ["reason", "Raison"],
    ["status", "Statut"],
    ["id", "Actions", (_value: string, row: any) => row.status === "pending" ? <div className="flex gap-2"><button className="rounded border border-line px-2 py-1 text-xs" onClick={() => void accept(row.id)}>Accepter</button><button className="rounded border border-line px-2 py-1 text-xs text-red-700" onClick={() => void reject(row.id)}>Rejeter</button></div> : ""]
  ]} />;
}

export function ImportedAccountingPage() {
  const { rows } = useRows("/accounting/imports/invoices");
  return <TablePage title="Comptabilite importee" subtitle="Factures et paiements importes depuis connectéur mock ou CSV." rows={rows} columns={[
    ["invoiceNumber", "Facture"],
    ["type", "Type"],
    ["clientOrSupplierName", "Tiers"],
    ["invoiceDate", "Date"],
    ["amountTTC", "TTC", money],
    ["paidAmount", "Paye", money],
    ["status", "Statut"]
  ]} />;
}

export function RealTreasuryPage({ scenarioId, horizon }: V3Context) {
  const { rows } = useRows(`/treasury/actual-vs-forecast?scenarioId=${scenarioId}&horizon=${horizon}`);
  return <TablePage title="Trésorerie réelle vs prévisionnelle" subtitle="Solde bancaire, solde prévu, Écart et projection recalibrée." rows={rows} columns={[
    ["month", "Mois"],
    ["forecastClosingCash", "Prévu", money],
    ["actualClosingCash", "Réel bancaire", money],
    ["recalibratedClosingCash", "Recalibr\u00e9", money],
    ["variance", "Écart", money],
    ["reliabilityScore", "Fiabilité", (value: number) => `${value}/100`]
  ]} />;
}

export function ReforecastPage({ scenarioId, horizon }: V3Context) {
  const { rows } = useRows(`/treasury/actual-vs-forecast?scenarioId=${scenarioId}&horizon=${horizon}`);
  const [jobResult, setJobResult] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const runReforecast = async () => {
    setIsRunning(true);
    setError("");
    try {
      setJobResult(await api("/reforecast/recalculate", { method: "POST", body: JSON.stringify({ scenarioId, horizon }) }));
    } catch {
      setError("Le job reforecast n'a pas pu être lancé.");
    } finally {
      setIsRunning(false);
    }
  };
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle title="Reforecast" subtitle="Calcul controle des écarts de trésorerie et génération de suggestions traçables." />
        <button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={runReforecast} disabled={isRunning}>
          {isRunning ? "Recalcul en cours..." : "Lancer le reforecast"}
        </button>
      </div>
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {jobResult ? <div className="rounded-lg border border-line bg-white p-4 text-sm"><div className="font-medium">Job {jobResult.job?.status ?? "termine"}</div><div className="mt-1 text-muted">{jobResult.suggestions?.length ?? 0} suggestion(s) generee(s). Impact total : {money(jobResult.job?.resultSummary?.totalImpactAmount ?? 0)}.</div></div> : null}
      <SimpleTable rows={rows} columns={[
        ["month", "Mois"],
        ["forecastClosingCash", "Prevu", money],
        ["actualClosingCash", "Reel bancaire", money],
        ["recalibratedClosingCash", "Recalibre", money],
        ["variance", "Ecart", money],
        ["reliabilityScore", "Fiabilité", (value: number) => `${value}/100`]
      ]} />
    </section>
  );
}

export function RunwayPage({ scenarioId, horizon }: V3Context) {
  const { data } = useObject(`/treasury/runway?scenarioId=${scenarioId}&horizon=${horizon}`);
  return (
    <section className="space-y-5">
      <PageTitle title="Cash runway" subtitle="Runway basé sur cash bancaire réel, burn et cash-in pondéré." />
      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Cash actuel" value={money(data?.currentCash ?? 0)} />
        <KpiCard label="Burn moyen" value={money(data?.averageMonthlyBurn ?? 0)} />
        <KpiCard label="Runway sans nouveau CA" value={`${data?.runwayWithoutNewRevenueMonths ?? 0} mois`} tone={(data?.runwayWithoutNewRevenueMonths ?? 0) < 3 ? "risk" : "good"} />
        <KpiCard label="Date critique" value={data?.criticalDate ?? "-"} />
      </div>
      <SimpleTable rows={(data?.recommendedActions ?? []).map((action: string, id: number) => ({ id, action }))} columns={[["action", "Action recommandée"]]} />
    </section>
  );
}

export function ForecastReliabilityPage() {
  const { rows } = useRows("/forecast-reliability");
  return <TablePage title="Fiabilité prévisionnelle" subtitle="Score par mois et facteurs de penalisation." rows={rows} columns={[
    ["month", "Mois"], ["score", "Score"], ["confidenceLevel", "Niveau"], ["explanation", "Explication"]
  ]} />;
}

export function ClientPaymentProfilesPage() {
  const { rows } = useRows("/client-payment-profiles");
  return <TablePage title="Paiements clients" subtitle="Delais réels, retards et fiabilité de paiement." rows={rows} columns={[
    ["clientName", "Client"],
    ["averagePaymentDelayDays", "Delai moyen"],
    ["averageLateDays", "Retard moyen"],
    ["latePaymentRate", "Taux retard", percent],
    ["totalLateAmount", "Montant retard", money],
    ["reliabilityScore", "Fiabilité"]
  ]} />;
}

export function FinancialAnomaliesPage() {
  const { rows, reload } = useRows("/financial-anomalies");
  const detect = async () => { await api("/financial-anomalies/detect", { method: "POST", body: JSON.stringify({}) }); await reload(); };
  const update = async (id: string, action: "review" | "resolve" | "ignore") => { await api("/financial-anomalies/" + id + "/" + action, { method: "POST", body: JSON.stringify({}) }); await reload(); };
  return <TablePage title={"Anomalies financi\u00e8res"} subtitle={"Transactions inhabituelles, doublons, retards et \u00e9carts."} actions={<button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={() => void detect()}>{"D\u00e9tecter"}</button>} rows={rows} columns={[
    ["severity", "S\u00e9v\u00e9rit\u00e9", severityBadge],
    ["type", "Type"],
    ["amount", "Montant", money],
    ["explanation", "Explication"],
    ["suggestedAction", "Action"],
    ["status", "Statut"],
    ["id", "Traitement", (_value: string, row: any) => ["resolved", "ignored"].includes(row.status) ? "" : (
      <div className="flex flex-wrap gap-2">
        <button className="rounded border border-line px-2 py-1 text-xs" onClick={() => void update(row.id, "review")}>{"\u00c0 revoir"}</button>
        <button className="rounded border border-line px-2 py-1 text-xs" onClick={() => void update(row.id, "resolve")}>{"R\u00e9soudre"}</button>
        <button className="rounded border border-line px-2 py-1 text-xs" onClick={() => void update(row.id, "ignore")}>Ignorer</button>
      </div>
    )]
  ]} />;
}

export function DataQualityPage() {
  const { data, reload } = useObject("/data-quality");
  const recalculate = async () => { await api("/data-quality/recalculate", { method: "POST", body: JSON.stringify({}) }); await reload(); };
  const update = async (id: string, action: "resolve" | "ignore") => { await api("/data-quality/issues/" + id + "/" + action, { method: "POST", body: JSON.stringify({}) }); await reload(); };
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle title={"Sant\u00e9 des donn\u00e9es"} subtitle={"Qualit\u00e9 des donn\u00e9es banque, compta, factures et rapprochements."} />
        <button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={() => void recalculate()}>Recalculer</button>
      </div>
      <KpiCard label={"Score qualit\u00e9"} value={String(data?.score ?? 0) + "/100"} tone={(data?.score ?? 0) < 70 ? "risk" : "good"} />
      <SimpleTable rows={data?.issues ?? []} columns={[
        ["severity", "S\u00e9v\u00e9rit\u00e9", severityBadge], ["type", "Type"], ["message", "Message"], ["suggestedFix", "Correction"], ["status", "Statut"],
        ["id", "Traitement", (_value: string, row: any) => ["fixed", "ignored"].includes(row.status) ? "" : (
          <div className="flex gap-2">
            <button className="rounded border border-line px-2 py-1 text-xs" onClick={() => void update(row.id, "resolve")}>{"R\u00e9soudre"}</button>
            <button className="rounded border border-line px-2 py-1 text-xs" onClick={() => void update(row.id, "ignore")}>Ignorer</button>
          </div>
        )]
      ]} />
    </section>
  );
}

export function ConnectorSupervisionPage() {
  const { data, reload } = useObject("/connector-health");
  const [message, setMessage] = useState("");
  const run = async (id: string, action: "incremental-sync" | "full-sync" | "reconnect" | "revoke") => {
    setMessage("");
    const result = await api<any>("/connectors/" + id + "/" + action, { method: "POST", body: JSON.stringify({ returnUrl: window.location.origin + "/#/provider-connection" }) });
    await reload();
    if (result?.authorizationUrl) {
      window.location.assign(result.authorizationUrl);
      return;
    }
    setMessage(result?.status === "failed" ? "La synchronisation a échoué. Consultez les erreurs provider." : action === "revoke" ? "Connecteur révoqué." : "Action envoyée au connecteur.");
  };
  return (
    <section className="space-y-5">
      <PageTitle title="Supervision connecteurs" subtitle={"Pilotage op\u00e9rationnel des connecteurs, synchronisations et erreurs."} />
      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div> : null}
      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label={"Connect\u00e9s"} value={String(data?.summary?.connected ?? 0)} tone="good" />
        <KpiCard label="En erreur" value={String(data?.summary?.errors ?? 0)} tone={(data?.summary?.errors ?? 0) > 0 ? "risk" : "good"} />
        <KpiCard label={"Expir\u00e9s"} value={String(data?.summary?.expired ?? 0)} tone={(data?.summary?.expired ?? 0) > 0 ? "risk" : "good"} />
        <KpiCard label={"D\u00e9connect\u00e9s"} value={String(data?.summary?.disconnected ?? 0)} />
      </div>
      <SimpleTable rows={data?.connectors ?? []} columns={[
        ["provider", "Provider"], ["type", "Type"], ["name", "Nom"], ["status", "Statut"], ["lastSyncAt", "Dernier sync"], ["errorMessage", "Erreur"],
        ["id", "Actions", (_value: string, row: any) => (
          <div className="flex flex-wrap gap-2">
            <button className="rounded border border-line px-2 py-1 text-xs" onClick={() => void run(row.id, "incremental-sync")}>Sync</button>
            <button className="rounded border border-line px-2 py-1 text-xs" onClick={() => void run(row.id, "full-sync")}>Full sync</button>
            <button className="rounded border border-line px-2 py-1 text-xs" onClick={() => void run(row.id, "reconnect")}>Reconnecter</button>
            <button className="rounded border border-line px-2 py-1 text-xs text-red-700" onClick={() => void run(row.id, "revoke")}>{"R\u00e9voquer"}</button>
          </div>
        )]
      ]} />
      <SimpleTable rows={data?.runs ?? []} columns={[
        ["connectorId", "Connecteur"], ["status", "Statut"], ["startedAt", "D\u00e9but"], ["finishedAt", "Fin"], ["importedCount", "Import\u00e9s"], ["updatedCount", "Mis \u00e0 jour"], ["errorCount", "Erreurs"]
      ]} />
    </section>
  );
}

export function BankConsentsPage() {
  const { rows } = useRows("/bank/connections");
  return <TablePage title="Consentements bancaires" subtitle="Gouvernance des consentements de lecture bancaire, sans stockage d'identifiants." rows={rows} columns={[
    ["provider", "Provider"], ["status", "Statut"], ["consentExpiresAt", "Expiration"], ["lastSyncAt", "Dernier sync"], ["createdBy", "Créé par"]
  ]} />;
}

export function CodirReportPage({ scenarioId, horizon }: V3Context) {
  const month = new Date().toISOString().slice(0, 7);
  const query = `month=${encodeURIComponent(month)}&scenarioId=${encodeURIComponent(scenarioId)}&horizon=${horizon}`;
  const { data } = useObject(`/reports/codir.json?${query}`);
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle title="Rapport CODIR connecté" subtitle="Rapport mensuel basé sur le réel bancaire, les écarts, les anomalies et la prévision recalibrée." />
        <div className="flex flex-wrap gap-2">
          <a className="rounded-md border border-line bg-white px-3 py-2 text-sm font-medium" href={`${API_URL}/reports/codir.json?${query}`} target="_blank" rel="noreferrer">Exporter JSON</a>
          <a className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" href={`${API_URL}/reports/codir.pdf?${query}`} target="_blank" rel="noreferrer">Exporter PDF</a>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard label="Cash" value={money(data?.payload?.bankSummary?.currentCash ?? 0)} />
        <KpiCard label="Anomalies" value={String(data?.payload?.anomalies?.length ?? 0)} />
        <KpiCard label="Runway" value={`${data?.payload?.runway?.runwayWeightedMonths ?? 0} mois`} />
      </div>
      <SimpleTable rows={(data?.payload?.recommendations ?? []).map((recommendation: string, id: number) => ({ id, recommendation }))} columns={[["recommendation", "Décision / action"]]} />
    </section>
  );
}

export function FinancialAuditPage() {
  const { rows } = useRows("/audit/financial");
  return <TablePage title="Audit financier" subtitle="Actions sensibles liées banque, compta, rapprochement, imports et exports." rows={rows} columns={[
    ["createdAt", "Date"], ["entityType", "Entité"], ["entityId", "ID"], ["action", "Action"]
  ]} />;
}

export function FinancialRulesPage() {
  return <CrudPage title="Règles de catégorisation bancaire" path="/bank/categorization-rules" initial={{ organizationId: "", name: "", priority: 10, isActive: true, condition: { labelContains: "URSSAF" }, targetCategoryId: "", autoApply: "if_high_confidence" }} fields={[
    { name: "organizationId", label: "Organisation", type: "select", optionsPath: "/organizations", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une organisation" }, { name: "name", label: "Nom" }, { name: "priority", label: "Priorité", type: "number" }, { name: "targetCategoryId", label: "Catégorie cible", type: "select", optionsPath: "/financial-categories", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une catégorie" }, { name: "autoApply", label: "Auto apply" }, { name: "isActive", label: "Active", type: "checkbox" }
  ]} columns={[{ key: "priority", label: "Priorité" }, { key: "name", label: "Regle" }, { key: "targetCategoryId", label: "Catégorie" }, { key: "autoApply", label: "Mode" }, { key: "isActive", label: "Active", render: (row: any) => row.isActive ? "Oui" : "Non" }]} />;
}

function TablePage({ title, subtitle, actions, rows, columns }: { title: string; subtitle: string; actions?: React.ReactNode; rows: any[]; columns: any[] }) {
  return <section className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><PageTitle title={title} subtitle={subtitle} />{actions}</div><SimpleTable rows={rows} columns={columns} /></section>;
}

function useRows(path: string) {
  const [rows, setRows] = useState<any[]>([]);
  const reload = async () => setRows(normalizeRows(await api<unknown>(path)));
  useEffect(() => { void reload().catch(() => setRows([])); }, [path]);
  return { rows, reload };
}

function normalizeRows(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["rows", "data", "items", "resources", "connectors", "issues", "suggestions"]) {
      if (Array.isArray(record[key])) return record[key] as any[];
    }
  }
  return [];
}

function useObject(path: string) {
  const [data, setData] = useState<any>(null);
  const reload = async () => setData(await api<any>(path));
  useEffect(() => { void reload().catch(() => setData(null)); }, [path]);
  return { data, reload };
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h1 className="text-2xl font-semibold tracking-normal">{title}</h1><p className="text-sm text-muted">{subtitle}</p></div>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return <div className="rounded-lg border border-line bg-white p-4"><h2 className="mb-4 text-base font-semibold">{title}</h2><div className="h-80"><ResponsiveContainer>{children}</ResponsiveContainer></div></div>;
}

function severityBadge(value: string) {
  return <Badge tone={value === "critical" ? "risk" : value === "warning" ? "warn" : "neutral"}>{value}</Badge>;
}

function SimpleTable({ rows, columns }: { rows: any[]; columns: any[] }) {
  const normalized = useMemo(() => rows ?? [], [rows]);
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-surface text-left text-xs uppercase text-muted"><tr>{columns.map((column: any) => <th key={column[0]} className="px-3 py-3">{column[1]}</th>)}</tr></thead>
        <tbody>
          {normalized.map((row, index) => <tr key={row.id ?? row.month ?? index} className="border-t border-line">{columns.map((column: any) => <td key={column[0]} className="px-3 py-3">{column[2] ? column[2](row[column[0]], row) : String(row[column[0]] ?? "")}</td>)}</tr>)}
          {!normalized.length ? <tr><td className="px-3 py-8 text-center text-muted" colSpan={columns.length}>Aucune donnée</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
