import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../api";
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
            <Line dataKey="recalibratedClosingCash" name="Recalibr?" stroke="#2563eb" strokeWidth={2} />
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
    { name: "organizationId", label: "Organisation", type: "select", optionsPath: "/organizations", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une organisation" }, { name: "companyId", label: "Société", type: "select", optionsPath: "/companies", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une société" }, { name: "bankConnectionId", label: "Connexion bancaire", type: "select", optionsPath: "/bank/connections", optionLabelKey: "provider", optionValueKey: "id", placeholder: "Sélectionner une connexion" }, { name: "externalAccountId", label: "Compte externe" }, { name: "name", label: "Nom" }, { name: "ibanMasked", label: "IBAN masqu?" }, { name: "currentBalance", label: "Solde", type: "number" }, { name: "availableBalance", label: "Disponible", type: "number" }, { name: "balanceDate", label: "Date solde", type: "date" }, { name: "type", label: "Type", type: "select", options: ["checking", "savings", "credit", "other"].map((value) => ({ label: value, value })) }, { name: "isActive", label: "Actif", type: "checkbox" }
  ]} columns={[{ key: "name", label: "Compte" }, { key: "ibanMasked", label: "IBAN masqu?" }, { key: "currentBalance", label: "Solde", render: (row: any) => money(row.currentBalance) }, { key: "availableBalance", label: "Disponible", render: (row: any) => money(row.availableBalance) }, { key: "balanceDate", label: "Date" }]} />;
}

export function BankTransactionsPage() {
  return <CrudPage title="Transactions bancaires" path="/bank/transactions" initial={{ organizationId: "", companyId: "", bankAccountId: "", externalTransactionId: "", transactionDate: "2026-06-30", bookingDate: "2026-06-30", label: "", amount: 0, currency: "EUR", direction: "debit", status: "booked", categorizationStatus: "uncategorized", reconciliationStatus: "unreconciled", confidenceScore: 0 }} fields={[
    { name: "organizationId", label: "Organisation", type: "select", optionsPath: "/organizations", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une organisation" }, { name: "companyId", label: "Société", type: "select", optionsPath: "/companies", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une société" }, { name: "bankAccountId", label: "Compte", type: "select", optionsPath: "/bank/accounts", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner un compte" }, { name: "externalTransactionId", label: "ID externe" }, { name: "transactionDate", label: "Date", type: "date" }, { name: "label", label: "Libellé" }, { name: "counterpartyName", label: "Contrepartie" }, { name: "amount", label: "Montant", type: "number" }, { name: "direction", label: "Sens", type: "select", options: ["credit", "debit"].map((value) => ({ label: value, value })) }, { name: "status", label: "Statut", type: "select", options: ["pending", "booked", "cancelled"].map((value) => ({ label: value, value })) }, { name: "categoryId", label: "Catégorie", type: "select", optionsPath: "/financial-categories", optionLabelKey: "name", optionValueKey: "id", placeholder: "Aucune catégorie" }, { name: "categorizationStatus", label: "Categorisation", type: "select", options: ["uncategorized", "auto_categorized", "manually_categorized", "rule_categorized"].map((value) => ({ label: value, value })) }, { name: "reconciliationStatus", label: "Rapprochement", type: "select", options: ["unreconciled", "suggested", "reconciled", "ignored"].map((value) => ({ label: value, value })) }
  ]} columns={[{ key: "transactionDate", label: "Date" }, { key: "label", label: "Libellé" }, { key: "counterpartyName", label: "Contrepartie" }, { key: "amount", label: "Montant", render: (row: any) => money(row.amount) }, { key: "categorizationStatus", label: "Catégorie" }, { key: "reconciliationStatus", label: "Rapprochement" }]} />;
}

export function BankReconciliationPage() {
  const { rows } = useRows("/reconciliation/suggestions");
  return <TablePage title="Rapprochement bancaire" subtitle="Suggestions entre transactions, factures, paiements, coûts et taxes." rows={rows} columns={[
    ["confidenceScore", "Score", percent],
    ["transactionId", "Transaction"],
    ["targetType", "Cible"],
    ["targetId", "Cible ID"],
    ["reason", "Raison"],
    ["status", "Statut"]
  ]} />;
}

export function ImportedAccountingPage() {
  const { rows } = useRows("/accounting/imports/invoices");
  return <TablePage title="Comptabilite importee" subtitle="Factures et paiements importes depuis connectéur mock ou CSV." rows={rows} columns={[
    ["invoiceNumber", "Facture"],
    ["type", "Type"],
    ["clientOrSuppliérName", "Tiers"],
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
    ["recalibratedClosingCash", "Recalibr?", money],
    ["variance", "Écart", money],
    ["reliabilityScore", "Fiabilité", (value: number) => `${value}/100`]
  ]} />;
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
    ["clientId", "Client"],
    ["averagePaymentDelayDays", "Delai moyen"],
    ["averageLateDays", "Retard moyen"],
    ["latePaymentRate", "Taux retard", percent],
    ["totalLateAmount", "Montant retard", money],
    ["reliabilityScore", "Fiabilité"]
  ]} />;
}

export function FinancialAnomaliesPage() {
  const { rows } = useRows("/financial-anomalies");
  return <TablePage title="Anomalies financières" subtitle="Transactions inhabituelles, doublons, retards et Écarts." rows={rows} columns={[
    ["severity", "Sévérité", severityBadge],
    ["type", "Type"],
    ["amount", "Montant", money],
    ["explanation", "Explication"],
    ["suggestedAction", "Action"],
    ["status", "Statut"]
  ]} />;
}

export function DataQualityPage() {
  const { data } = useObject("/data-quality");
  return (
    <section className="space-y-5">
      <PageTitle title="Santé des données" subtitle="Qualité des données banque, compta, factures et rapprochements." />
      <KpiCard label="Score qualité" value={`${data?.score ?? 0}/100`} tone={(data?.score ?? 0) < 70 ? "risk" : "good"} />
      <SimpleTable rows={data?.issues ?? []} columns={[["severity", "Sévérité", severityBadge], ["type", "Type"], ["message", "Message"], ["suggestedFix", "Correction"], ["status", "Statut"]]} />
    </section>
  );
}

export function ConnectorSupervisionPage() {
  return <CrudPage title="Supervision connectéurs" path="/connectors" initial={{ organizationId: "", companyId: "", type: "banking", provider: "mock_bank_provider", name: "", status: "inactive", configuration: {} }} fields={[
    { name: "organizationId", label: "Organisation", type: "select", optionsPath: "/organizations", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une organisation" }, { name: "companyId", label: "Société", type: "select", optionsPath: "/companies", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une société" }, { name: "type", label: "Type", type: "select", options: ["accounting", "banking", "invoicing", "crm", "hr", "generic_csv"].map((value) => ({ label: value, value })) }, { name: "provider", label: "Provider", type: "select", options: ["mock_bank_provider", "csv_bank_import", "mock_accounting_provider", "csv_accounting_import", "bridge", "powens", "tink", "plaid", "pennylane", "sage"].map((value) => ({ label: value, value })) }, { name: "name", label: "Nom" }, { name: "status", label: "Statut", type: "select", options: ["inactive", "connectéd", "error", "expired", "syncing", "disconnectéd"].map((value) => ({ label: value, value })) }, { name: "errorMessage", label: "Erreur" }
  ]} columns={[{ key: "type", label: "Type" }, { key: "provider", label: "Provider" }, { key: "name", label: "Nom" }, { key: "status", label: "Statut" }, { key: "lastSyncAt", label: "Dernier sync" }, { key: "errorMessage", label: "Erreur" }]} />;
}

export function BankConsentsPage() {
  const { rows } = useRows("/bank/connections");
  return <TablePage title="Consentements bancaires" subtitle="Gouvernance des consentements de lecture bancaire, sans stockage d'identifiants." rows={rows} columns={[
    ["provider", "Provider"], ["status", "Statut"], ["consentExpiresAt", "Expiration"], ["lastSyncAt", "Dernier sync"], ["createdBy", "Créé par"]
  ]} />;
}

export function CodirReportPage({ scenarioId, horizon }: V3Context) {
  const { data } = useObject(`/reports/codir.json?month=2026-06&scenarioId=${scenarioId}&horizon=${horizon}`);
  return (
    <section className="space-y-5">
      <PageTitle title="Rapport CODIR connecté" subtitle="Rapport mensuel basé sur réel bancaire, Écarts, anomalies et prévision recalibrée." />
      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard label="Cash" value={money(data?.payload?.bankSummary?.currentCash ?? 0)} />
        <KpiCard label="Anomalies" value={String(data?.payload?.anomalies?.length ?? 0)} />
        <KpiCard label="Runway" value={`${data?.payload?.runway?.runwayWeightedMonths ?? 0} mois`} />
      </div>
      <SimpleTable rows={(data?.payload?.recommendations ?? []).map((recommendation: string, id: number) => ({ id, recommendation }))} columns={[["recommendation", "Decision / action"]]} />
    </section>
  );
}

export function FinancialAuditPage() {
  const { rows } = useRows("/audit/financial");
  return <TablePage title="Audit financier" subtitle="Actions sensibles liées banque, compta, rapprochement, imports et exports." rows={rows} columns={[
    ["createdAt", "Date"], ["entityType", "Entite"], ["entityId", "ID"], ["action", "Action"]
  ]} />;
}

export function FinancialRulesPage() {
  return <CrudPage title="Règles de catégorisation bancaire" path="/bank/categorization-rules" initial={{ organizationId: "", name: "", priority: 10, isActive: true, condition: { labelContains: "URSSAF" }, targetCategoryId: "", autoApply: "if_high_confidence" }} fields={[
    { name: "organizationId", label: "Organisation", type: "select", optionsPath: "/organizations", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une organisation" }, { name: "name", label: "Nom" }, { name: "priority", label: "Priorité", type: "number" }, { name: "targetCategoryId", label: "Catégorie cible", type: "select", optionsPath: "/financial-categories", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une catégorie" }, { name: "autoApply", label: "Auto apply" }, { name: "isActive", label: "Active", type: "checkbox" }
  ]} columns={[{ key: "priority", label: "Priorité" }, { key: "name", label: "Regle" }, { key: "targetCategoryId", label: "Catégorie" }, { key: "autoApply", label: "Mode" }, { key: "isActive", label: "Active", render: (row: any) => row.isActive ? "Oui" : "Non" }]} />;
}

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
          {!normalized.length ? <tr><td className="px-3 py-8 text-center text-muted" colSpan={columns.length}>Aucune donnee</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
