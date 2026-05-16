import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../api";
import { CrudPage } from "../../components/CrudPage";
import { Badge, money, percent } from "../../components/Format";
import { KpiCard } from "../../components/KpiCard";

type V2Context = { scenarioId: string; horizon: number };

export function ExecutiveCockpitPage({ scenarioId, horizon }: V2Context) {
  const { data } = useObject(`/executive/situation?scenarioId=${scenarioId}&horizon=${horizon}`);
  const months = data?.forecast?.months ?? [];
  return (
    <section className="space-y-5">
      <PageTitle title="Cockpit direction V2" subtitle="Synthèse prévisionnel, réel, Écarts, risques et capacité." />
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="CA prévisionnel" value={money(data?.summary?.forecastRevenue ?? 0)} />
        <KpiCard label="CA réel" value={money(data?.summary?.actualRevenue ?? 0)} />
        <KpiCard label="Écart CA" value={money(data?.summary?.revenueVariance ?? 0)} tone={(data?.summary?.revenueVariance ?? 0) < 0 ? "risk" : "good"} />
        <KpiCard label="Trésorerie finale" value={money(data?.summary?.finalClosingCash ?? 0)} />
        <KpiCard label="Alertes critiques" value={String(data?.summary?.criticalAlerts ?? 0)} tone={(data?.summary?.criticalAlerts ?? 0) > 0 ? "risk" : "good"} />
        <KpiCard label="Gaps capacité" value={String(data?.summary?.capacityShortages ?? 0)} tone={(data?.summary?.capacityShortages ?? 0) > 0 ? "risk" : "good"} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="CA, coûts et cash">
          <LineChart data={months}>
            <CartesianGrid stroke="#e5e7eb" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
            <Tooltip formatter={(value) => money(Number(value))} />
            <Legend />
            <Line dataKey="revenueGenerated" name="CA généré" stroke="#0f766e" strokeWidth={2} />
            <Line dataKey="totalCosts" name="Coûts" stroke="#b42318" strokeWidth={2} />
            <Line dataKey="closingCash" name="Cash final" stroke="#2563eb" strokeWidth={2} />
          </LineChart>
        </ChartCard>
        <ChartCard title="Écarts réel / prévisionnel">
          <BarChart data={data?.variances ?? []}>
            <CartesianGrid stroke="#e5e7eb" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
            <Tooltip formatter={(value) => money(Number(value))} />
            <Legend />
            <Bar dataKey="revenueVariance" name="Écart CA" fill="#0f766e" />
            <Bar dataKey="costsVariance" name="Écart coûts" fill="#b42318" />
            <Bar dataKey="cashVariance" name="Écart cash" fill="#2563eb" />
          </BarChart>
        </ChartCard>
      </div>
      <SimpleTable rows={data?.alerts ?? []} columns={[
        ["severity", "Sévérité", (value: string) => <Badge tone={value === "critical" ? "risk" : value === "warning" ? "warn" : "neutral"}>{value}</Badge>],
        ["month", "Mois"],
        ["message", "Message"],
        ["explanation", "Explication"]
      ]} />
    </section>
  );
}

export function TimesheetsPage() {
  return <CrudPage title="CRA et temps réellement produit" path="/timesheets" initial={{ resourceType: "employee", resourceId: "", missionId: "", month: 6, year: 2026, workedDays: 20, billableDays: 18, nonBillableDays: 2, absenceDays: 0, vacationDays: 0, sickLeaveDays: 0, trainingDays: 0, internalDays: 0, status: "draft" }} fields={[
    { name: "resourceType", label: "Type ressource", type: "select", options: [{ label: "Employe", value: "employee" }] }, { name: "resourceId", label: "Employe", type: "select", optionsPath: "/employees", optionLabelFields: ["firstName", "lastName"], optionValueKey: "id", placeholder: "Sélectionner un employe" }, { name: "missionId", label: "Mission", type: "select", optionsPath: "/missions", optionLabelKey: "title", optionValueKey: "id", placeholder: "Sélectionner une mission" }, { name: "month", label: "Mois", type: "number" }, { name: "year", label: "Année", type: "number" }, { name: "workedDays", label: "Jours travailles", type: "number" }, { name: "billableDays", label: "Jours facturables", type: "number" }, { name: "nonBillableDays", label: "Non facturables", type: "number" }, { name: "absenceDays", label: "Absences", type: "number" }, { name: "status", label: "Statut", type: "select", options: ["open", "closed", "reopened", "validated"].map((value) => ({ label: value, value })) }, { name: "notes", label: "Notes", type: "textarea" }
  ]} columns={[{ key: "year", label: "Année" }, { key: "month", label: "Mois" }, { key: "resourceType", label: "Type" }, { key: "resourceId", label: "Ressource" }, { key: "missionId", label: "Mission" }, { key: "billableDays", label: "Facturables" }, { key: "status", label: "Statut" }]} />;
}

export function ActualsVariancesPage({ scenarioId, horizon }: V2Context) {
  const { rows: actuals } = useRows("/actuals/monthly");
  const { rows: variances } = useRows(`/variances/monthly?scenarioId=${scenarioId}&horizon=${horizon}`);
  return (
    <section className="space-y-5">
      <PageTitle title="Réel et Écarts" subtitle="Comparaison entre prévisionnel, réel constaté, marge et trésorerie." />
      <SimpleTable rows={variances} columns={[
        ["month", "Mois"],
        ["forecastRevenue", "CA prévu", money],
        ["actualRevenue", "CA réel", money],
        ["revenueVariance", "Écart CA", money],
        ["forecastCosts", "Coûts prévus", money],
        ["actualCosts", "Coûts réels", money],
        ["marginVariance", "Écart marge", money],
        ["cashVariance", "Écart cash", money]
      ]} />
      <CrudPage title="Saisie mensuelle du réel" path="/actuals/monthly" initial={{ companyId: "", month: 6, year: 2026, actualRevenueGenerated: 0, actualRevenueInvoiced: 0, actualCashIn: 0, actualEmployeeCosts: 0, actualExternalCosts: 0, actualFixedCosts: 0, actualVariableCosts: 0, actualCashOut: 0, actualGrossMargin: 0, actualNetMargin: 0, actualClosingCash: 0 }} fields={[
        { name: "companyId", label: "Société", type: "select", optionsPath: "/companies", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une société" }, { name: "month", label: "Mois", type: "number" }, { name: "year", label: "Année", type: "number" }, { name: "actualRevenueGenerated", label: "CA réel", type: "number" }, { name: "actualRevenueInvoiced", label: "CA facture", type: "number" }, { name: "actualCashIn", label: "Encaissé", type: "number" }, { name: "actualCashOut", label: "Décaissé", type: "number" }, { name: "actualClosingCash", label: "Cash final", type: "number" }
      ]} columns={actualsColumns} />
      <div className="hidden">{actuals.length}</div>
    </section>
  );
}

export function MonthlyClosePage() {
  return <CrudPage title="Cloture mensuelle" path="/monthly-closes" initial={{ companyId: "", month: 6, year: 2026, status: "open", notes: "" }} fields={[
    { name: "companyId", label: "Société", type: "select", optionsPath: "/companies", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une société" }, { name: "month", label: "Mois", type: "number" }, { name: "year", label: "Année", type: "number" }, { name: "status", label: "Statut", type: "select", options: ["open", "closed", "reopened", "validated"].map((value) => ({ label: value, value })) }, { name: "notes", label: "Notes", type: "textarea" }
  ]} columns={[{ key: "year", label: "Année" }, { key: "month", label: "Mois" }, { key: "status", label: "Statut" }, { key: "closedAt", label: "Cloture le" }, { key: "reopenedAt", label: "Rouverte le" }]} />;
}

export function RealInvoicesPage() {
  return <CrudPage title="Factures réelles" path="/invoices" initial={{ companyId: "", clientId: "", missionId: "", invoiceNumber: "", invoiceDate: "2026-06-30", dueDate: "2026-07-30", amountHT: 10000, vatRate: 0.2, amountTTC: 12000, status: "issued", paidAmount: 0, source: "manual" }} fields={[
    { name: "companyId", label: "Société", type: "select", optionsPath: "/companies", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une société" }, { name: "clientId", label: "Client", type: "select", optionsPath: "/clients", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner un client" }, { name: "missionId", label: "Mission", type: "select", optionsPath: "/missions", optionLabelKey: "title", optionValueKey: "id", placeholder: "Sélectionner une mission" }, { name: "invoiceNumber", label: "Numero" }, { name: "invoiceDate", label: "Date facture", type: "date" }, { name: "dueDate", label: "Échéance", type: "date" }, { name: "amountHT", label: "HT", type: "number" }, { name: "amountTTC", label: "TTC", type: "number" }, { name: "status", label: "Statut", type: "select", options: ["draft", "issued", "partially_paid", "paid", "late", "cancelled"].map((value) => ({ label: value, value })) }, { name: "paidAmount", label: "Paye", type: "number" }, { name: "source", label: "Source", type: "select", options: ["manual", "csv", "accounting", "bank_reconciliation"].map((value) => ({ label: value, value })) }
  ]} columns={[{ key: "invoiceNumber", label: "Numero" }, { key: "invoiceDate", label: "Date" }, { key: "clientId", label: "Client" }, { key: "missionId", label: "Mission" }, { key: "amountTTC", label: "TTC", render: (row: any) => money(row.amountTTC) }, { key: "paidAmount", label: "Paye", render: (row: any) => money(row.paidAmount) }, { key: "status", label: "Statut" }]} />;
}

export function PaymentsPage() {
  return <CrudPage title="Paiements" path="/payments" initial={{ invoiceId: "", clientId: "", paymentDate: "2026-07-30", amount: 10000, paymentMethod: "wire", status: "received" }} fields={[
    { name: "invoiceId", label: "Facture", type: "select", optionsPath: "/invoices", optionLabelKey: "invoiceNumber", optionValueKey: "id", placeholder: "Sélectionner une facture" }, { name: "clientId", label: "Client", type: "select", optionsPath: "/clients", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner un client" }, { name: "paymentDate", label: "Date paiement", type: "date" }, { name: "amount", label: "Montant", type: "number" }, { name: "paymentMethod", label: "Methode", type: "select", options: ["wire", "card", "check", "cash", "direct_debit", "other"].map((value) => ({ label: value, value })) }, { name: "status", label: "Statut", type: "select", options: ["pending", "received", "reconciled", "cancelled"].map((value) => ({ label: value, value })) }
  ]} columns={[{ key: "paymentDate", label: "Date" }, { key: "invoiceId", label: "Facture" }, { key: "clientId", label: "Client" }, { key: "amount", label: "Montant", render: (row: any) => money(row.amount) }, { key: "status", label: "Statut" }]} />;
}

export function ReconciliationPage() {
  const { data } = useObject("/reconciliation/billing");
  return (
    <section className="space-y-5">
      <PageTitle title="Rapprochement facturation" subtitle="Factures prévues, factures réelles et paiements associés." />
      <SimpleTable rows={data?.suggestions ?? []} columns={[["invoiceForecastId", "Facture prévue"], ["invoiceId", "Facture réelle"], ["amountVariance", "Écart montant", money], ["dateVarianceDays", "Écart jours"]]} />
    </section>
  );
}

export function CapacityPage({ scenarioId, horizon }: V2Context) {
  const { rows } = useRows(`/capacity?scenarioId=${scenarioId}&horizon=${horizon}`);
  return <TablePage title="Capacity planning" subtitle="Capacité disponible, besoins par compétence et gaps mensuels." rows={rows} columns={[
    ["month", "Mois"], ["skillLabel", "Compétence"], ["availableFTE", "Dispo FTE"], ["requiredFTE", "Besoin FTE"], ["gapFTE", "Gap"], ["status", "Statut", (value: string) => <Badge tone={value === "shortage" ? "risk" : value === "surplus" ? "warn" : "good"}>{value}</Badge>]
  ]} />;
}

export function SkillsPage() {
  const { rows: employees } = useRows("/employees");
  const { rows: partners } = useRows("/partner-resources");
  const { rows: freelancers } = useRows("/freelancers");
  const { rows: skills } = useRows("/capacity/skills");
  const { rows: missions } = useRows("/missions");
  const resourceLabels = useMemo(() => {
    const pairs = [...employees, ...partners, ...freelancers].map((resource: any) => [
      resource.id,
      `${resource.firstName ?? ""} ${resource.lastName ?? ""}`.trim() || resource.name || resource.id
    ] as [string, string]);
    return new Map(pairs);
  }, [employees, partners, freelancers]);
  const skillLabels = useMemo(() => new Map(skills.map((skill: any) => [skill.id, skill.name])), [skills]);
  const missionLabels = useMemo(() => new Map(missions.map((mission: any) => [mission.id, mission.title])), [missions]);

  return (
    <section className="space-y-8">
      <CrudPage title="Compétences" path="/capacity/skills" initial={{ name: "", category: "", aliases: "" }} fields={[
        { name: "name", label: "Nom" },
        { name: "category", label: "Catégorie" },
        { name: "aliases", label: "Alias (séparés par des virgules)" }
      ]} columns={[
        { key: "name", label: "Compétence" },
        { key: "category", label: "Catégorie" },
        { key: "aliases", label: "Alias", render: (row: any) => Array.isArray(row.aliases) ? row.aliases.join(", ") : row.aliases }
      ]} />
      <CrudPage title="Compétences des ressources" path="/capacity/resource-skills" initial={{ resourceType: "employee", resourceId: "", skillId: "", level: "intermediate", yearsExperience: 1, lastUsedAt: "" }} fields={[
        { name: "resourceType", label: "Type ressource", type: "select", options: [{ label: "Salarié", value: "employee" }, { label: "Partenaire", value: "partner" }, { label: "Indépendant", value: "freelancer" }] },
        { name: "resourceId", label: "Ressource", type: "select", optionDependsOn: "resourceType", optionSourcesByValue: { employee: { path: "/employees", optionLabelFields: ["firstName", "lastName"] }, partner: { path: "/partner-resources", optionLabelFields: ["firstName", "lastName"] }, freelancer: { path: "/freelancers", optionLabelFields: ["firstName", "lastName"] } }, placeholder: "Sélectionner une ressource" },
        { name: "skillId", label: "Compétence", type: "select", optionsPath: "/capacity/skills", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une compétence" },
        { name: "level", label: "Niveau", type: "select", options: ["junior", "intermediate", "senior", "expert"].map((value) => ({ label: value, value })) },
        { name: "yearsExperience", label: "Années d'expérience", type: "number" },
        { name: "lastUsedAt", label: "Dernière utilisation", type: "date" }
      ]} columns={[
        { key: "resourceType", label: "Type" },
        { key: "resourceId", label: "Ressource", render: (row: any) => resourceLabels.get(row.resourceId) ?? row.resourceId },
        { key: "skillId", label: "Compétence", render: (row: any) => skillLabels.get(row.skillId) ?? row.skillId },
        { key: "level", label: "Niveau" },
        { key: "yearsExperience", label: "Expérience" }
      ]} />
      <CrudPage title="Besoins de compétences mission" path="/capacity/mission-skill-needs" initial={{ missionId: "", skillId: "", requiredLevel: "intermediate", requiredFTE: 1, startDate: "2026-06-01", endDate: "", priority: "medium" }} fields={[
        { name: "missionId", label: "Mission", type: "select", optionsPath: "/missions", optionLabelKey: "title", optionValueKey: "id", placeholder: "Sélectionner une mission" },
        { name: "skillId", label: "Compétence", type: "select", optionsPath: "/capacity/skills", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une compétence" },
        { name: "requiredLevel", label: "Niveau requis", type: "select", options: ["junior", "intermediate", "senior", "expert"].map((value) => ({ label: value, value })) },
        { name: "requiredFTE", label: "ETP requis", type: "number" },
        { name: "startDate", label: "Début", type: "date" },
        { name: "endDate", label: "Fin", type: "date" },
        { name: "priority", label: "Priorité", type: "select", options: ["low", "medium", "high", "critical"].map((value) => ({ label: value, value })) }
      ]} columns={[
        { key: "missionId", label: "Mission", render: (row: any) => missionLabels.get(row.missionId) ?? row.missionId },
        { key: "skillId", label: "Compétence", render: (row: any) => skillLabels.get(row.skillId) ?? row.skillId },
        { key: "requiredLevel", label: "Niveau" },
        { key: "requiredFTE", label: "ETP" },
        { key: "priority", label: "Priorité" }
      ]} />
    </section>
  );
}

export function MonteCarloPage({ scenarioId, horizon }: V2Context) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { if (scenarioId) void api("/monte-carlo/run", { method: "POST", body: JSON.stringify({ scenarioId, horizon, iterations: 500 }) }).then(setData); }, [scenarioId, horizon]);
  return (
    <section className="space-y-5">
      <PageTitle title="Monte Carlo simplifie" subtitle="Fourchettes P10/P50/P90 et risque de trésorerie nenegative." />
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
  return <TablePage title="Risques stratégiques" subtitle="Concentration client et dépendances majeures." rows={data?.clientConcentration ?? []} columns={[
    ["clientName", "Client"], ["revenue", "CA", money], ["revenueShare", "Part CA", percent], ["severity", "Sévérité", (value: string) => <Badge tone={value === "critical" ? "risk" : value === "warning" ? "warn" : "neutral"}>{value}</Badge>]
  ]} />;
}

export function AiAnalysisPage({ scenarioId, horizon }: V2Context) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { if (scenarioId) void api("/ai/analyze/scenario", { method: "POST", body: JSON.stringify({ scenarioId, horizon }) }).then(setData); }, [scenarioId, horizon]);
  return (
    <section className="space-y-5">
      <PageTitle title="Analyse IA encadrée" subtitle="Synthèse basée uniquement sur les données calculées par ESN Forecast." />
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
  if (kind === "plannedHires") return <CrudPage title="Recrutements prévisionnels" path="/planned-hires" initial={{ scenarioId: "", title: "", targetRôle: "", expectedStartDate: "2026-09-01", expectedMonthlyCost: 5000, expectedEmployerCharges: 2200, expectedFullCost: 7600, expectedTJM: 850, expectedUtilizationRate: 0.8, probability: 0.7, status: "planned" }} fields={[
    { name: "scenarioId", label: "Scénario", type: "select", optionsPath: "/scenarios", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner un scenario" }, { name: "title", label: "Titre" }, { name: "targetRôle", label: "Rôle" }, { name: "expectedStartDate", label: "Début", type: "date" }, { name: "expectedFullCost", label: "Coût complet", type: "number" }, { name: "expectedTJM", label: "TJM attendu", type: "number" }, { name: "expectedUtilizationRate", label: "Occupation", type: "number" }, { name: "status", label: "Statut", type: "select", options: ["planned", "approved", "cancelled", "hired", "delayed"].map((value) => ({ label: value, value })) }
  ]} columns={[{ key: "title", label: "Recrutement" }, { key: "expectedStartDate", label: "Début" }, { key: "expectedFullCost", label: "Coût", render: (row: any) => money(row.expectedFullCost) }, { key: "expectedTJM", label: "TJM", render: (row: any) => money(row.expectedTJM) }, { key: "status", label: "Statut" }]} />;
  if (kind === "rules") return <CrudPage title="Règles métier" path="/business-rules" initial={{ name: "", triggerType: "monthly_projection", condition: { metric: "closingCash", operator: "lt", value: 50000 }, action: { type: "alert", message: "Alerte" }, severity: "warning", isActive: true }} fields={[
    { name: "name", label: "Nom" }, { name: "triggerType", label: "Declencheur", type: "select", options: ["monthly_projection", "cash_threshold", "margin_threshold", "connector_error", "manual"].map((value) => ({ label: value, value })) }, { name: "severity", label: "Sévérité", type: "select", options: ["info", "warning", "critical"].map((value) => ({ label: value, value })) }, { name: "isActive", label: "Active", type: "checkbox" }
  ]} columns={[{ key: "name", label: "Regle" }, { key: "triggerType", label: "Declencheur" }, { key: "severity", label: "Sévérité" }, { key: "isActive", label: "Active", render: (row: any) => row.isActive ? "Oui" : "Non" }]} />;
  if (kind === "notifications") return <CrudPage title="Notifications" path="/notifications" initial={{ type: "manual", severity: "info", title: "", message: "", status: "unread" }} fields={[{ name: "type", label: "Type", type: "select", options: ["manual", "alert", "workflow", "system"].map((value) => ({ label: value, value })) }, { name: "severity", label: "Sévérité", type: "select", options: ["info", "warning", "critical"].map((value) => ({ label: value, value })) }, { name: "title", label: "Titre" }, { name: "message", label: "Message", type: "textarea" }, { name: "status", label: "Statut", type: "select", options: ["unread", "read", "archived"].map((value) => ({ label: value, value })) }]} columns={[{ key: "createdAt", label: "Date" }, { key: "severity", label: "Sévérité" }, { key: "title", label: "Titre" }, { key: "status", label: "Statut" }]} />;
  if (kind === "documents") return <CrudPage title="Documents" path="/documents" initial={{ companyId: "", entityType: "mission", entityId: "", fileName: "", mimeType: "application/pdf", size: 0, storagePath: "", category: "contract" }} fields={[{ name: "companyId", label: "Société", type: "select", optionsPath: "/companies", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une société" }, { name: "entityType", label: "Entité", type: "select", options: [{ label: "Mission", value: "mission" }, { label: "Facture", value: "invoice" }, { label: "Client", value: "client" }, { label: "Paiement", value: "payment" }, { label: "Autre", value: "other" }] }, { name: "entityId", label: "Entité liée", type: "select", optionDependsOn: "entityType", optionSourcesByValue: { mission: { path: "/missions", optionLabelKey: "title" }, invoice: { path: "/invoices", optionLabelKey: "invoiceNumber" }, client: { path: "/clients", optionLabelKey: "name" }, payment: { path: "/payments", optionLabelFields: ["paymentDate", "amount"] } }, placeholder: "Sélectionner une entite" }, { name: "fileName", label: "Fichier" }, { name: "mimeType", label: "MIME" }, { name: "size", label: "Taille", type: "number" }, { name: "storagePath", label: "Chemin" }, { name: "category", label: "Catégorie", type: "select", options: ["contract", "invoice", "report", "support", "other"].map((value) => ({ label: value, value })) }]} columns={[{ key: "fileName", label: "Fichier" }, { key: "entityType", label: "Entité" }, { key: "entityId", label: "Entité liée" }, { key: "category", label: "Catégorie" }, { key: "uploadedAt", label: "Ajoute le" }]} />;
  if (kind === "offers") return <CrudPage title="Offres et devis" path="/offers" initial={{ clientId: "", title: "", status: "draft", pricingMode: "daily_rate", totalAmount: 100000, expectedMargin: 30000, probability: 0.5 }} fields={[{ name: "clientId", label: "Client", type: "select", optionsPath: "/clients", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner un client" }, { name: "title", label: "Titre" }, { name: "status", label: "Statut", type: "select", options: ["draft", "sent", "won", "lost", "cancelled"].map((value) => ({ label: value, value })) }, { name: "pricingMode", label: "Prix", type: "select", options: ["daily_rate", "fixed_price", "mixed"].map((value) => ({ label: value, value })) }, { name: "totalAmount", label: "Montant", type: "number" }, { name: "expectedMargin", label: "Marge", type: "number" }, { name: "probability", label: "Probabilité", type: "number" }]} columns={[{ key: "title", label: "Offre" }, { key: "status", label: "Statut" }, { key: "totalAmount", label: "Montant", render: (row: any) => money(row.totalAmount) }, { key: "expectedMargin", label: "Marge", render: (row: any) => money(row.expectedMargin) }]} />;
  return <ConnectorsPage />;
}

function ConnectorsPage() {
  const { data } = useObject("/connectors");
  const rows = [...(data?.accounting ?? []), ...(data?.hr ?? []), ...(data?.crm ?? [])];
  return <TablePage title="Connecteurs" subtitle="Architecture de synchronisation CSV/CRM/compta/RH optionnelle." rows={rows} columns={[["provider", "Provider"], ["externalSource", "Source"], ["status", "Statut"], ["lastSyncAt", "Dernière synchro"], ["opportunityName", "Opportunité"]]} />;
}

const actualsColumns = [
  { key: "year", label: "Année" }, { key: "month", label: "Mois" }, { key: "actualRevenueGenerated", label: "CA", render: (row: any) => money(row.actualRevenueGenerated) }, { key: "actualCashIn", label: "Cash-in", render: (row: any) => money(row.actualCashIn) }, { key: "actualCashOut", label: "Cash-out", render: (row: any) => money(row.actualCashOut) }, { key: "actualClosingCash", label: "Cash final", render: (row: any) => money(row.actualClosingCash) }
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
          {!normalized.length ? <tr><td className="px-3 py-8 text-center text-muted" colSpan={columns.length}>Aucune donnée</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
