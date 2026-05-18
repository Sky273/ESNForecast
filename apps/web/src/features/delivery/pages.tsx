import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { API_URL, api } from "../../api";
import { CrudPage } from "../../components/CrudPage";
import { Badge, money, percent } from "../../components/Format";
import { InfoPanel } from "../../components/InfoPanel";
import { KpiCard } from "../../components/KpiCard";
import { DataOriginBadge } from "../../components/DataOriginBadge";

type DeliveryContext = { scenarioId: string; horizon: number };

export function ExecutiveCockpitPage({ scenarioId, horizon }: DeliveryContext) {
  const { data } = useObject(`/executive/situation?scenarioId=${scenarioId}&horizon=${horizon}`);
  const months = data?.forecast?.months ?? [];
  return (
    <section className="space-y-5">
      <PageTitle title="Cockpit direction" subtitle="Synthèse prévisionnel, réel, Écarts, risques et capacité." />
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
  const initial = { resourceType: "employee", resourceId: "", missionId: "", month: 6, year: 2026, workedDays: 20, billableDays: 18, nonBillableDays: 2, absenceDays: 0, vacationDays: 0, sickLeaveDays: 0, trainingDays: 0, internalDays: 0, status: "draft", notes: "" };
  const { rows, reload } = useRows("/timesheets");
  const { rows: employees } = useRows("/employees");
  const { rows: missions } = useRows("/missions");
  const employeeLabels = useMemo(() => new Map(employees.map((employee: any) => [employee.id, [employee.firstName, employee.lastName].filter(Boolean).join(" ") || employee.email || employee.id])), [employees]);
  const missionLabels = useMemo(() => new Map(missions.map((mission: any) => [mission.id, mission.title ?? mission.id])), [missions]);
  const [draft, setDraft] = useState<any>(initial);
  const [editingId, setEditingId] = useState("");
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    await api(editingId ? `/timesheets/${editingId}` : "/timesheets", { method: editingId ? "PUT" : "POST", body: JSON.stringify(draft) });
    setDraft(initial);
    setEditingId("");
    await reload();
  };
  const updateStatus = async (id: string, action: "submit" | "approve" | "reject" | "lock") => {
    await api(`/timesheets/${id}/${action}`, { method: "POST", body: JSON.stringify({}) });
    await reload();
  };
  const remove = async (id: string) => {
    await api(`/timesheets/${id}`, { method: "DELETE" });
    if (editingId === id) setEditingId("");
    await reload();
  };
  return (
    <section className="space-y-5">
      <PageTitle title="CRA et temps réellement produit" subtitle="Saisie des jours travaillés, soumission, validation, rejet et verrouillage des CRA." />
      <form onSubmit={save} className="rounded-lg border border-line bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <SelectField label="Employé" value={draft.resourceId} onChange={(value) => setDraft({ ...draft, resourceId: value })} options={employees.map((employee: any) => ({ value: employee.id, label: employeeLabels.get(employee.id) ?? employee.id }))} />
          <SelectField label="Mission" value={draft.missionId} onChange={(value) => setDraft({ ...draft, missionId: value })} options={missions.map((mission: any) => ({ value: mission.id, label: missionLabels.get(mission.id) ?? mission.id }))} />
          <NumberField label="Mois" value={draft.month} onChange={(value) => setDraft({ ...draft, month: value })} />
          <NumberField label="Année" value={draft.year} onChange={(value) => setDraft({ ...draft, year: value })} />
          <NumberField label="Jours travaillés" value={draft.workedDays} onChange={(value) => setDraft({ ...draft, workedDays: value })} />
          <NumberField label="Jours facturables" value={draft.billableDays} onChange={(value) => setDraft({ ...draft, billableDays: value })} />
          <NumberField label="Non facturables" value={draft.nonBillableDays} onChange={(value) => setDraft({ ...draft, nonBillableDays: value })} />
          <NumberField label="Absences" value={draft.absenceDays} onChange={(value) => setDraft({ ...draft, absenceDays: value })} />
          <SelectField label="Statut" value={draft.status} onChange={(value) => setDraft({ ...draft, status: value })} options={["draft", "submitted", "approved", "rejected", "locked"].map((value) => ({ label: value, value }))} />
          <label className="text-sm md:col-span-3">
            <span className="mb-1 block text-xs font-medium text-muted">Notes</span>
            <textarea className="min-h-20 w-full rounded-md border border-line px-3 py-2" value={draft.notes ?? ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white" type="submit">{editingId ? "Enregistrer" : "Créer"}</button>
          {editingId ? <button className="rounded-md border border-line px-4 py-2 text-sm" type="button" onClick={() => { setDraft(initial); setEditingId(""); }}>Annuler</button> : null}
        </div>
      </form>
      <SimpleTable rows={rows} columns={[
        ["year", "Année"], ["month", "Mois"], ["resourceId", "Ressource", (value: string) => employeeLabels.get(value) ?? value], ["missionId", "Mission", (value: string) => missionLabels.get(value) ?? value], ["billableDays", "Facturables"], ["status", "Statut", (value: string) => <Badge tone={value === "approved" || value === "locked" ? "good" : value === "rejected" ? "risk" : "warn"}>{value}</Badge>],
        ["id", "Actions", (_value: string, row: any) => <div className="flex flex-wrap gap-2"><button className="rounded border border-line px-2 py-1 text-xs" onClick={() => { setEditingId(row.id); setDraft({ ...initial, ...row }); }}>Éditer</button><button className="rounded border border-line px-2 py-1 text-xs" onClick={() => void updateStatus(row.id, "submit")}>Soumettre</button><button className="rounded border border-line px-2 py-1 text-xs" onClick={() => void updateStatus(row.id, "approve")}>Valider</button><button className="rounded border border-line px-2 py-1 text-xs" onClick={() => void updateStatus(row.id, "reject")}>Rejeter</button><button className="rounded border border-line px-2 py-1 text-xs" onClick={() => void updateStatus(row.id, "lock")}>Verrouiller</button><button className="rounded border border-line px-2 py-1 text-xs text-risk" onClick={() => void remove(row.id)}>Supprimer</button></div>]
      ]} />
    </section>
  );
}
export function ActualsVariancesPage({ scenarioId, horizon }: DeliveryContext) {
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
  const { rows, reload } = useRows("/monthly-closes");
  const { rows: companies } = useRows("/companies");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [companyId, setCompanyId] = useState("");
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState({ actuals: false, invoices: false, cash: false, anomalies: false });
  const close = rows.find((row: any) => `${row.year}-${String(row.month).padStart(2, "0")}` === selectedMonth);
  const currentCompanyId = companyId || close?.companyId || companies[0]?.id || "";
  const ready = Object.values(checks).every(Boolean);

  useEffect(() => {
    if (!close) return;
    setCompanyId(close.companyId ?? "");
    setNotes(close.notes ?? "");
  }, [close?.id]);

  const saveDraft = async (event: React.FormEvent) => {
    event.preventDefault();
    const [year, month] = selectedMonth.split("-").map(Number);
    const payload = { companyId: currentCompanyId, year, month, status: close?.status ?? "open", notes };
    await api(close ? `/monthly-closes/${close.id}` : "/monthly-closes", { method: close ? "PUT" : "POST", body: JSON.stringify(payload) });
    await reload();
  };
  const runAction = async (action: "close" | "reopen") => {
    await api(`/monthly-closes/${selectedMonth}/${action}`, { method: "POST", body: JSON.stringify({ companyId: currentCompanyId, notes }) });
    await reload();
  };

  return (
    <section className="space-y-5">
      <PageTitle title="Clôture mensuelle" subtitle="Workflow de validation du réel, des factures, des paiements et des écarts avant gel du mois." />
      <InfoPanel title="À quoi sert cet écran ?">La clôture mensuelle marque un mois comme contrôlé. Elle sert de repère pour les rapports de direction, le reforecast et les analyses d'écarts.</InfoPanel>
      <form className="rounded-lg border border-line bg-white p-4" onSubmit={saveDraft}>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">Mois<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} /></label>
          <label className="text-sm">Société<select className="mt-1 w-full rounded-md border border-line px-3 py-2" value={currentCompanyId} onChange={(event) => setCompanyId(event.target.value)}>{companies.map((company: any) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
          <label className="text-sm">Statut<input className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2" readOnly value={close?.status ?? "open"} /></label>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {[
            ["actuals", "Réel mensuel saisi et contrôlé"],
            ["invoices", "Factures et paiements vérifiés"],
            ["cash", "Trésorerie bancaire rapprochée"],
            ["anomalies", "Anomalies documentées ou traitées"]
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm">
              <input type="checkbox" checked={(checks as any)[key]} onChange={(event) => setChecks({ ...checks, [key]: event.target.checked })} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <label className="mt-4 block text-sm">Notes de clôture<textarea className="mt-1 min-h-24 w-full rounded-md border border-line px-3 py-2" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded-md border border-line px-3 py-2 text-sm" type="submit">Enregistrer la préparation</button>
          <button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-50" type="button" disabled={!ready || !currentCompanyId} onClick={() => void runAction("close")}>Clôturer le mois</button>
          <button className="rounded-md border border-line px-3 py-2 text-sm" type="button" onClick={() => void runAction("reopen")}>Rouvrir</button>
        </div>
      </form>
      <SimpleTable rows={rows} columns={[["year", "Année"], ["month", "Mois"], ["status", "Statut"], ["closedAt", "Clôturé le"], ["reopenedAt", "Rouvert le"], ["notes", "Notes"]]} />
    </section>
  );
}

export function RealInvoicesPage() {
  return <CrudPage title="Factures réelles" path="/invoices" initial={{ companyId: "", clientId: "", missionId: "", invoiceNumber: "", invoiceDate: "2026-06-30", dueDate: "2026-07-30", amountHT: 10000, vatRate: 0.2, amountTTC: 12000, status: "issued", paidAmount: 0, source: "manual" }} fields={[
    { name: "companyId", label: "Société", type: "select", optionsPath: "/companies", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une société" }, { name: "clientId", label: "Client", type: "select", optionsPath: "/clients", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner un client" }, { name: "missionId", label: "Mission", type: "select", optionsPath: "/missions", optionLabelKey: "title", optionValueKey: "id", placeholder: "Sélectionner une mission" }, { name: "invoiceNumber", label: "Numéro" }, { name: "invoiceDate", label: "Date facture", type: "date" }, { name: "dueDate", label: "Échéance", type: "date" }, { name: "amountHT", label: "HT", type: "number" }, { name: "amountTTC", label: "TTC", type: "number" }, { name: "status", label: "Statut", type: "select", options: ["draft", "issued", "partially_paid", "paid", "late", "cancelled"].map((value) => ({ label: value, value })) }, { name: "paidAmount", label: "Payé", type: "number" }, { name: "source", label: "Source", type: "select", options: ["manual", "csv", "accounting", "bank_reconciliation"].map((value) => ({ label: value, value })) }
  ]} columns={[{ key: "invoiceNumber", label: "Numéro" }, { key: "source", label: "Source", render: (row: any) => <DataOriginBadge kind={row.source ?? "manual"} details={[row.createdAt ? `Créée le ${row.createdAt}` : undefined, row.updatedAt ? `Mise à jour le ${row.updatedAt}` : undefined]} /> }, { key: "invoiceDate", label: "Date" }, { key: "clientId", label: "Client" }, { key: "missionId", label: "Mission" }, { key: "amountTTC", label: "TTC", render: (row: any) => money(row.amountTTC) }, { key: "paidAmount", label: "Payé", render: (row: any) => money(row.paidAmount) }, { key: "status", label: "Statut" }]} />;
}

export function PaymentsPage() {
  return <CrudPage title="Paiements" path="/payments" initial={{ invoiceId: "", clientId: "", paymentDate: "2026-07-30", amount: 10000, paymentMethod: "wire", status: "received" }} fields={[
    { name: "invoiceId", label: "Facture", type: "select", optionsPath: "/invoices", optionLabelKey: "invoiceNumber", optionValueKey: "id", placeholder: "Sélectionner une facture" }, { name: "clientId", label: "Client", type: "select", optionsPath: "/clients", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner un client" }, { name: "paymentDate", label: "Date paiement", type: "date" }, { name: "amount", label: "Montant", type: "number" }, { name: "paymentMethod", label: "Méthode", type: "select", options: ["wire", "card", "check", "cash", "direct_debit", "other"].map((value) => ({ label: value, value })) }, { name: "status", label: "Statut", type: "select", options: ["pending", "received", "reconciled", "cancelled"].map((value) => ({ label: value, value })) }
  ]} columns={[{ key: "paymentDate", label: "Date" }, { key: "invoiceId", label: "Facture" }, { key: "clientId", label: "Client" }, { key: "amount", label: "Montant", render: (row: any) => money(row.amount) }, { key: "status", label: "Statut" }]} />;
}

export function ReconciliationPage() {
  const { data, reload } = useObject("/reconciliation/billing/queue");
  const [selectedId, setSelectedId] = useState("");
  const [queueFilter, setQueueFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [notes, setNotes] = useState("");
  const [candidates, setCandidates] = useState<any[]>([]);
  const items = useMemo(() => data?.items ?? [], [data]);
  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((row: any) => {
      const matchesFilter = queueFilter === "all" || row.queueStatus === queueFilter || row.priority === queueFilter || row.paymentStatus === queueFilter;
      const matchesSearch = !needle || [row.forecastLabel, row.clientLabel, row.missionLabel, row.invoiceLabel, row.invoiceNumber].filter(Boolean).join(" ").toLowerCase().includes(needle);
      return matchesFilter && matchesSearch;
    });
  }, [items, queueFilter, search]);
  const selected = useMemo(() => filteredRows.find((row: any) => row.id === selectedId) ?? filteredRows[0], [filteredRows, selectedId]);
  const selectedCandidate = useMemo(() => candidates.find((candidate) => candidate.invoiceId === invoiceId), [candidates, invoiceId]);
  const displayedPayments = selectedCandidate?.payments ?? selected?.payments ?? [];

  useEffect(() => {
    if (!selected) return;
    setInvoiceId(selected.invoiceId ?? selected.bestSuggestion?.invoiceId ?? "");
    setPaymentId(selected.payments?.[0]?.id ?? "");
    setCandidateQuery("");
    setNotes(selected.notes ?? "");
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) return;
    void api<any[]>("/reconciliation/billing/candidates?forecastId=" + encodeURIComponent(selected.invoiceForecastId) + "&q=" + encodeURIComponent(candidateQuery)).then((rows) => {
      setCandidates(rows);
      setInvoiceId((current) => current || rows[0]?.invoiceId || "");
    }).catch(() => setCandidates([]));
  }, [selected?.invoiceForecastId, candidateQuery]);

  useEffect(() => {
    setPaymentId((current) => displayedPayments.some((payment: any) => payment.id === current) ? current : displayedPayments[0]?.id || "");
  }, [displayedPayments]);

  const refreshSuggestions = async () => {
    await api("/reconciliation/billing/suggestions/refresh", { method: "POST", body: JSON.stringify({}) });
    setSelectedId("");
    await reload();
  };
  const matchForecast = async (targetInvoiceId = invoiceId, targetPaymentId = paymentId) => {
    if (!selected || !targetInvoiceId) return;
    await api("/reconciliation/billing/forecasts/" + selected.invoiceForecastId + "/match", { method: "POST", body: JSON.stringify({ invoiceId: targetInvoiceId, paymentId: targetPaymentId || undefined, notes }) });
    setSelectedId("");
    await reload();
  };
  const acceptBestSuggestion = async () => {
    if (!selected?.bestSuggestion?.invoiceId) return;
    await matchForecast(selected.bestSuggestion.invoiceId, selected.payments?.[0]?.id ?? "");
  };
  const ignoreForecast = async () => {
    if (!selected) return;
    await api("/reconciliation/billing/forecasts/" + selected.invoiceForecastId + "/ignore", { method: "POST", body: JSON.stringify({ notes }) });
    setSelectedId("");
    await reload();
  };
  const cancelReconciliation = async () => {
    if (!selected?.reconciliationId) return;
    await api("/reconciliation/billing/" + selected.reconciliationId + "/cancel", { method: "POST", body: JSON.stringify({ notes }) });
    setSelectedId("");
    await reload();
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle title="Rapprochement facturation" subtitle="File de traitement des factures prévues à rapprocher avec les factures réelles et paiements." />
        <div className="flex flex-wrap gap-2">
          <button className="rounded-md border border-line bg-white px-3 py-2 text-sm" onClick={() => void reload()}>Rafraîchir</button>
          <button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={() => void refreshSuggestions()}>Recalculer les suggestions</button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="À traiter" value={String(data?.summary?.total ?? 0)} />
        <KpiCard label="Avec suggestion" value={String(data?.summary?.suggested ?? 0)} tone={(data?.summary?.suggested ?? 0) > 0 ? "good" : "default"} />
        <KpiCard label="Revue manuelle" value={String(data?.summary?.manualReview ?? 0)} tone={(data?.summary?.manualReview ?? 0) > 0 ? "risk" : "good"} />
        <KpiCard label="Rapprochées" value={String(data?.summary?.matched ?? 0)} tone="good" />
        <KpiCard label="Paiement à suivre" value={String(data?.summary?.paymentPending ?? 0)} tone={(data?.summary?.paymentPending ?? 0) > 0 ? "risk" : "good"} />
        <KpiCard label="Montant prévu restant" value={money(data?.summary?.amountToInvoice ?? 0)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(430px,0.75fr)]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 rounded-lg border border-line bg-white p-3">
            <input className="min-w-64 flex-1 rounded-md border border-line px-3 py-2 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher client, mission, facture..." />
            <select className="rounded-md border border-line bg-white px-3 py-2 text-sm" value={queueFilter} onChange={(event) => setQueueFilter(event.target.value)}>
              <option value="all">Toutes</option>
              <option value="suggested">Avec suggestion</option>
              <option value="manual_review">Revue manuelle</option>
              <option value="matched">Rapprochées</option>
              <option value="pending">Paiement absent</option>
              <option value="partial">Paiement partiel</option>
              <option value="high">Priorité haute</option>
            </select>
          </div>
          <SimpleTable rows={filteredRows} columns={[
            ["forecastLabel", "Facture prévue", (value: string, row: any) => <button className="text-left font-medium text-brand" onClick={() => setSelectedId(row.id)}>{value}</button>],
            ["origin", "Origine", (_value: string, row: any) => <DataOriginBadge kind="calculated" label="Suggestion" details={[row.bestSuggestion?.reason]} />],
            ["clientLabel", "Client"],
            ["missionLabel", "Mission"],
            ["forecastAmountTTC", "Prévu TTC", money],
            ["invoiceLabel", "Facture réelle", (value: string) => value ?? "À rapprocher"],
            ["amountVariance", "Écart", money],
            ["paymentStatus", "Paiement", (value: string) => billingPaymentBadge(value)],
            ["queueStatus", "Statut", (value: string) => billingQueueBadge(value)]
          ]} />
        </div>
        <aside className="rounded-lg border border-line bg-white p-4 shadow-sm">
          {selected ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Traitement facturation</h2>
                  <p className="text-sm text-muted">{selected.forecastLabel}</p>
                </div>
                <Badge tone={selected.priority === "high" ? "risk" : selected.priority === "medium" ? "warn" : "neutral"}>{priorityLabel(selected.priority)}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <KpiCard label="Prévu TTC" value={money(selected.forecastAmountTTC ?? 0)} />
                <KpiCard label="Restant à encaisser" value={money(selected.remainingAmount ?? 0)} tone={(selected.remainingAmount ?? 0) > 0 ? "risk" : "good"} />
              </div>
              <div className="rounded-md border border-line bg-surface p-3 text-sm">
                <div className="font-medium">Meilleure suggestion</div>
                {selected.bestSuggestion ? (
                  <div className="mt-2 space-y-1">
                    <div>{selected.bestSuggestion.invoiceLabel}</div>
                    <div className="text-muted">{selected.bestSuggestion.reason}</div>
                    <div>Score : {percent(selected.bestSuggestion.score ?? 0)}</div>
                    <button className="mt-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={() => void acceptBestSuggestion()}>Accepter cette suggestion</button>
                  </div>
                ) : <div className="mt-2 text-muted">Aucune facture réelle suffisamment proche. Choisissez une cible manuellement.</div>}
              </div>
              {displayedPayments.length ? (
                <div>
                  <div className="mb-2 text-sm font-medium">Paiements associés</div>
                  <div className="space-y-2">
                    {displayedPayments.map((payment: any) => (
                      <label key={payment.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-sm">
                        <span>{payment.label}</span>
                        <input type="radio" name="billing-payment" checked={paymentId === payment.id} onChange={() => setPaymentId(payment.id)} />
                      </label>
                    ))}
                  </div>
                </div>
              ) : <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Aucun paiement associé à la facture réelle sélectionnée.</div>}
              <div className="border-t border-line pt-4">
                <h3 className="text-base font-semibold">Rapprochement manuel</h3>
                <div className="mt-3 grid gap-3">
                  <label className="text-sm">Recherche facture réelle<input className="mt-1 w-full rounded-md border border-line px-3 py-2" value={candidateQuery} onChange={(event) => { setCandidateQuery(event.target.value); setInvoiceId(""); }} placeholder="Numéro, client, mission..." /></label>
                  <label className="text-sm">Facture réelle<select className="mt-1 w-full rounded-md border border-line px-3 py-2" value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)}>
                    <option value="">Sélectionner une facture</option>
                    {candidates.map((candidate) => <option key={candidate.invoiceId} value={candidate.invoiceId}>{candidate.label} - score {Math.round((candidate.score ?? 0) * 100)} %</option>)}
                  </select></label>
                  <label className="text-sm">Commentaire<textarea className="mt-1 min-h-20 w-full rounded-md border border-line px-3 py-2" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={!invoiceId} onClick={() => void matchForecast()}>Rapprocher</button>
                  <button className="rounded-md border border-line px-4 py-2 text-sm" onClick={() => void ignoreForecast()}>Ignorer la prévision</button>
                  {selected.reconciliationId ? <button className="rounded-md border border-line px-4 py-2 text-sm text-red-700" onClick={() => void cancelReconciliation()}>Annuler le rapprochement</button> : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted">Aucune facture prévue à traiter.</div>
          )}
        </aside>
      </div>
    </section>
  );
}

export function CapacityPage({ scenarioId, horizon }: DeliveryContext) {
  const { rows } = useRows(`/capacity?scenarioId=${scenarioId}&horizon=${horizon}`);
  return <TablePage title="Capacity planning" subtitle="Capacité disponible, besoins par compétence et gaps mensuels." rows={rows} columns={[
    ["month", "Mois"], ["skillLabel", "Compétence"], ["availableFTE", "Dispo FTE"], ["requiredFTE", "Besoin FTE"], ["gapFTE", "Gap"], ["status", "Statut", (value: string) => <Badge tone={value === "shortage" ? "risk" : value === "surplus" ? "warn" : "good"}>{value}</Badge>]
  ]} />;
}

export function StaffingForecastPage({ scenarioId, horizon }: DeliveryContext) {
  const { data } = useObject(`/staffing/forecast?scenarioId=${scenarioId}&horizon=${horizon}`);
  const rows = data?.rows ?? [];
  const summary = data?.summary ?? {};
  return (
    <section className="space-y-5">
      <PageTitle title="Staffing prévisionnel" subtitle="Vue par mission des besoins, affectations prévues et trous de staffing à traiter." />
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Besoins" value={String(summary.totalNeeds ?? 0)} />
        <KpiCard label="Couverts" value={String(summary.staffedNeeds ?? 0)} tone="good" />
        <KpiCard label="Partiels" value={String(summary.partialNeeds ?? 0)} tone={(summary.partialNeeds ?? 0) > 0 ? "risk" : "good"} />
        <KpiCard label="Non couverts" value={String(summary.uncoveredNeeds ?? 0)} tone={(summary.uncoveredNeeds ?? 0) > 0 ? "risk" : "good"} />
        <KpiCard label="ETP requis" value={String(summary.totalRequiredFTE ?? 0)} />
        <KpiCard label="Gap ETP" value={String(summary.totalGapFTE ?? 0)} tone={(summary.totalGapFTE ?? 0) < 0 ? "risk" : "good"} />
      </div>
      <SimpleTable rows={rows} columns={[
        ["month", "Mois"],
        ["missionTitle", "Mission"],
        ["clientName", "Client"],
        ["skillLabel", "Compétence"],
        ["requiredLevel", "Niveau"],
        ["requiredFTE", "ETP requis"],
        ["assignedFTE", "ETP affecté"],
        ["gapFTE", "Gap"],
        ["status", "Statut", (value: string) => <Badge tone={value === "uncovered" ? "risk" : value === "partial" || value === "surplus" ? "warn" : "good"}>{staffingStatusLabel(value)}</Badge>],
        ["assignedResources", "Ressources", (value: any[]) => value?.length ? value.map((resource) => `${resource.resourceName} (${resource.occupancyRate} ETP)`).join(", ") : "Aucune"],
        ["recommendedAction", "Action recommandée"]
      ]} />
    </section>
  );
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

export function MonteCarloPage({ scenarioId, horizon }: DeliveryContext) {
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

export function StrategicRisksPage({ scenarioId, horizon }: DeliveryContext) {
  const { data } = useObject(`/risks/strategic?scenarioId=${scenarioId}&horizon=${horizon}`);
  return <TablePage title="Risques stratégiques" subtitle="Concentration client et dépendances majeures." rows={data?.clientConcentration ?? []} columns={[
    ["clientName", "Client"], ["revenue", "CA", money], ["revenueShare", "Part CA", percent], ["severity", "Sévérité", (value: string) => <Badge tone={value === "critical" ? "risk" : value === "warning" ? "warn" : "neutral"}>{value}</Badge>]
  ]} />;
}

export function AiAnalysisPage({ scenarioId, horizon }: DeliveryContext) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { if (scenarioId) void api("/ai/analyze/scenario", { method: "POST", body: JSON.stringify({ scenarioId, horizon }) }).then(setData); }, [scenarioId, horizon]);
  return (
    <section className="space-y-5">
      <PageTitle title="Analyse IA encadrée" subtitle="Synthèse basée uniquement sur les données calculées par ESN Forecast." />
      <InfoPanel title="Périmètre de l'IA">L'assistant ne calcule pas seul les chiffres et ne modifie aucune donnée. Il résume les faits fournis par les services internes et liste les sources utilisées.</InfoPanel>
      <div className="rounded-lg border border-line bg-white p-4">
        <h2 className="text-base font-semibold">Résumé exécutif</h2>
        <p className="mt-2 text-sm text-slate-700">{data?.executiveSummary ?? "Analyse non disponible."}</p>
      </div>
      <SimpleTable rows={(data?.sourceFacts ?? []).map((fact: string, index: number) => ({ id: index, fact }))} columns={[["fact", "Chiffre source"]]} />
      <SimpleTable rows={(data?.recommendations ?? []).map((recommendation: string, index: number) => ({ id: index, recommendation }))} columns={[["recommendation", "Recommandation"]]} />
    </section>
  );
}

export function DeliveryCrudPage({ kind, scenarioId = "" }: { kind: "plannedHires" | "rules" | "notifications" | "documents" | "offers" | "connectors" | "workflows" | "webhooks" | "apiKeys" | "crmOpportunities" | "hrAbsences"; scenarioId?: string }) {
  if (kind === "plannedHires") return <CrudPage title="Recrutements prévisionnels" path={scenarioId ? `/planned-hires?scenarioId=${encodeURIComponent(scenarioId)}` : "/planned-hires"} initial={{ scenarioId, title: "", targetRole: "", expectedStartDate: "2026-09-01", expectedMonthlyCost: 5000, expectedEmployerCharges: 2200, expectedFullCost: 7600, expectedTJM: 850, expectedUtilizationRate: 0.8, probability: 0.7, status: "planned" }} fields={[
    { name: "scenarioId", label: "Scénario", type: "select", optionsPath: "/scenarios", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner un scenario" }, { name: "title", label: "Titre" }, { name: "targetRole", label: "Rôle" }, { name: "expectedStartDate", label: "Début", type: "date" }, { name: "expectedFullCost", label: "Coût complet", type: "number" }, { name: "expectedTJM", label: "TJM attendu", type: "number" }, { name: "expectedUtilizationRate", label: "Occupation", type: "number" }, { name: "status", label: "Statut", type: "select", options: ["planned", "approved", "cancelled", "hired", "delayed"].map((value) => ({ label: value, value })) }
  ]} columns={[{ key: "title", label: "Recrutement" }, { key: "expectedStartDate", label: "Début" }, { key: "expectedFullCost", label: "Coût", render: (row: any) => money(row.expectedFullCost) }, { key: "expectedTJM", label: "TJM", render: (row: any) => money(row.expectedTJM) }, { key: "status", label: "Statut" }]} />;
  if (kind === "rules") return <CrudPage title="Règles métier" path="/business-rules" initial={{ name: "", triggerType: "monthly_projection", condition: { metric: "closingCash", operator: "lt", value: 50000 }, action: { type: "alert", message: "Alerte" }, severity: "warning", isActive: true }} fields={[
    { name: "name", label: "Nom" }, { name: "triggerType", label: "Déclencheur", type: "select", options: ["monthly_projection", "cash_threshold", "margin_threshold", "connector_error", "manual"].map((value) => ({ label: value, value })) }, { name: "severity", label: "Sévérité", type: "select", options: ["info", "warning", "critical"].map((value) => ({ label: value, value })) }, { name: "isActive", label: "Active", type: "checkbox" }
  ]} columns={[{ key: "name", label: "Règle" }, { key: "triggerType", label: "Déclencheur" }, { key: "severity", label: "Sévérité" }, { key: "isActive", label: "Active", render: (row: any) => row.isActive ? "Oui" : "Non" }]} />;
  if (kind === "notifications") return <CrudPage title="Notifications" path="/notifications" initial={{ type: "manual", severity: "info", title: "", message: "", status: "unread" }} fields={[{ name: "type", label: "Type", type: "select", options: ["manual", "alert", "workflow", "system"].map((value) => ({ label: value, value })) }, { name: "severity", label: "Sévérité", type: "select", options: ["info", "warning", "critical"].map((value) => ({ label: value, value })) }, { name: "title", label: "Titre" }, { name: "message", label: "Message", type: "textarea" }, { name: "status", label: "Statut", type: "select", options: ["unread", "read", "archived"].map((value) => ({ label: value, value })) }]} columns={[{ key: "createdAt", label: "Date" }, { key: "severity", label: "Sévérité" }, { key: "title", label: "Titre" }, { key: "status", label: "Statut" }]} />;
  if (kind === "workflows") return <CrudPage title="Workflows d'approbation" path="/workflows" initial={{ entityType: "invoice", entityId: "", requestedBy: "", status: "pending", comment: "" }} fields={[
    { name: "entityType", label: "Entit\u00e9", type: "select", options: ["invoice", "payment", "budget", "pricing", "other"].map((value) => ({ label: value, value })) },
    { name: "entityId", label: "Objet lié", type: "select", optionDependsOn: "entityType", optionSourcesByValue: { invoice: { path: "/invoices", optionLabelKey: "invoiceNumber" }, payment: { path: "/payments", optionLabelFields: ["paymentDate", "amount"] }, budget: { path: "/budgets", optionLabelKey: "name" }, pricing: { path: "/pricing/simulations", optionLabelKey: "name" } }, placeholder: "Sélectionner l'objet concerné" },
    { name: "requestedBy", label: "Demand\u00e9 par" },
    { name: "status", label: "Statut", type: "select", options: ["pending", "approved", "rejected", "cancelled"].map((value) => ({ label: value, value })) },
    { name: "comment", label: "Commentaire", type: "textarea" }
  ]} columns={[{ key: "entityType", label: "Entit\u00e9" }, { key: "entityId", label: "Objet" }, { key: "requestedBy", label: "Demandeur" }, { key: "status", label: "Statut" }, { key: "createdAt", label: "Cr\u00e9\u00e9 le" }]} />;
  if (kind === "webhooks") return <CrudPage title="Abonnements webhooks" path="/webhooks" initial={{ name: "", targetUrl: "", eventTypes: [], isActive: true, secretMasked: "" }} fields={[
    { name: "name", label: "Nom" },
    { name: "targetUrl", label: "URL cible" },
    { name: "secretMasked", label: "Secret masqu\u00e9" },
    { name: "isActive", label: "Actif", type: "checkbox" }
  ]} columns={[{ key: "name", label: "Nom" }, { key: "targetUrl", label: "URL" }, { key: "isActive", label: "Actif", render: (row: any) => row.isActive ? "Oui" : "Non" }, { key: "lastTriggeredAt", label: "Dernier appel" }]} />;
  if (kind === "apiKeys") return <ApiKeysPage />;
  if (kind === "crmOpportunities") return <CrmOpportunitiesPage />;
  if (kind === "hrAbsences") return <HrAbsencesPage />;
  if (kind === "documents") return <CrudPage title="Documents" path="/documents" initial={{ companyId: "", entityType: "mission", entityId: "", fileName: "", mimeType: "application/pdf", size: 0, storagePath: "", category: "contract" }} fields={[{ name: "companyId", label: "Société", type: "select", optionsPath: "/companies", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une société" }, { name: "entityType", label: "Entité", type: "select", options: [{ label: "Mission", value: "mission" }, { label: "Facture", value: "invoice" }, { label: "Client", value: "client" }, { label: "Paiement", value: "payment" }, { label: "Autre", value: "other" }] }, { name: "entityId", label: "Entité liée", type: "select", optionDependsOn: "entityType", optionSourcesByValue: { mission: { path: "/missions", optionLabelKey: "title" }, invoice: { path: "/invoices", optionLabelKey: "invoiceNumber" }, client: { path: "/clients", optionLabelKey: "name" }, payment: { path: "/payments", optionLabelFields: ["paymentDate", "amount"] } }, placeholder: "Sélectionner une entité" }, { name: "fileName", label: "Fichier" }, { name: "mimeType", label: "MIME" }, { name: "size", label: "Taille", type: "number" }, { name: "storagePath", label: "Chemin" }, { name: "category", label: "Catégorie", type: "select", options: ["contract", "invoice", "report", "support", "other"].map((value) => ({ label: value, value })) }]} columns={[{ key: "fileName", label: "Fichier" }, { key: "entityType", label: "Entité" }, { key: "entityId", label: "Entité liée" }, { key: "category", label: "Catégorie" }, { key: "uploadedAt", label: "Ajouté le" }]} />;
  if (kind === "offers") return <CrudPage title="Offres et devis" path="/offers" initial={{ clientId: "", title: "", status: "draft", pricingMode: "daily_rate", totalAmount: 100000, expectedMargin: 30000, probability: 0.5 }} fields={[{ name: "clientId", label: "Client", type: "select", optionsPath: "/clients", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner un client" }, { name: "title", label: "Titre" }, { name: "status", label: "Statut", type: "select", options: ["draft", "sent", "won", "lost", "cancelled"].map((value) => ({ label: value, value })) }, { name: "pricingMode", label: "Prix", type: "select", options: ["daily_rate", "fixed_price", "mixed"].map((value) => ({ label: value, value })) }, { name: "totalAmount", label: "Montant", type: "number" }, { name: "expectedMargin", label: "Marge", type: "number" }, { name: "probability", label: "Probabilité", type: "number" }]} columns={[{ key: "title", label: "Offre" }, { key: "status", label: "Statut" }, { key: "totalAmount", label: "Montant", render: (row: any) => money(row.totalAmount) }, { key: "expectedMargin", label: "Marge", render: (row: any) => money(row.expectedMargin) }]} />;
  return <ConnectorsPage />;
}

function ApiKeysPage() {
  const { rows, reload } = useRows("/api-keys");
  const [draft, setDraft] = useState({ name: "", scopes: "read:forecast", expiresAt: "" });
  const [createdKey, setCreatedKey] = useState("");

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const scopes = draft.scopes.split(",").map((scope) => scope.trim()).filter(Boolean);
    const result = await api<any>("/api-keys", { method: "POST", body: JSON.stringify({ name: draft.name, scopes, expiresAt: draft.expiresAt || null }) });
    setCreatedKey(result.rawKey ?? "");
    setDraft({ name: "", scopes: "read:forecast", expiresAt: "" });
    await reload();
  };

  const revoke = async (id: string) => {
    await api("/api-keys/" + id, { method: "DELETE" });
    await reload();
  };

  return (
    <section className="space-y-5">
      <PageTitle title="Cl\u00e9s API" subtitle="Cr\u00e9ation et r\u00e9vocation des cl\u00e9s destin\u00e9es aux int\u00e9grations techniques." />
      <form className="rounded-lg border border-line bg-white p-4" onSubmit={create}>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">Nom<input className="mt-1 w-full rounded-md border border-line px-3 py-2" required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label className="text-sm">Scopes<input className="mt-1 w-full rounded-md border border-line px-3 py-2" value={draft.scopes} onChange={(event) => setDraft({ ...draft, scopes: event.target.value })} /></label>
          <label className="text-sm">Expiration<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="date" value={draft.expiresAt} onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })} /></label>
        </div>
        <button className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white">Cr\u00e9er la cl\u00e9</button>
      </form>
      {createdKey ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Copiez cette cl\u00e9 maintenant, elle ne sera plus affich\u00e9e : <code>{createdKey}</code></div> : null}
      <SimpleTable rows={rows} columns={[
        ["name", "Nom"],
        ["scopes", "Scopes", (value: string[]) => Array.isArray(value) ? value.join(", ") : ""],
        ["createdAt", "Cr\u00e9\u00e9e le"],
        ["revokedAt", "R\u00e9voqu\u00e9e le", (value: string) => value || "Active"],
        ["id", "Actions", (_value: string, row: any) => row.revokedAt ? "" : <button className="rounded border border-line px-2 py-1 text-xs text-red-700" onClick={() => void revoke(row.id)}>R\u00e9voquer</button>]
      ]} />
    </section>
  );
}

function CrmOpportunitiesPage() {
  const { rows, reload } = useRows("/crm/opportunities");
  const convert = async (id: string) => {
    await api("/crm/opportunities/" + id + "/convert-to-mission", { method: "POST" });
    await reload();
  };
  return (
    <section className="space-y-5">
      <PageTitle title="Opportunit\u00e9s CRM" subtitle="Lecture des opportunit\u00e9s import\u00e9es et conversion en mission lorsque l'affaire est qualifi\u00e9e." />
      <SimpleTable rows={rows} columns={[
        ["opportunityName", "Opportunit\u00e9"],
        ["clientName", "Client"],
        ["amount", "Montant", (value: number) => money(value)],
        ["probability", "Probabilit\u00e9", (value: number) => percent(value)],
        ["expectedCloseDate", "Cl\u00f4ture pr\u00e9vue"],
        ["status", "Statut"],
        ["id", "Actions", (_value: string, row: any) => <button className="rounded border border-line px-2 py-1 text-xs" onClick={() => void convert(row.id)}>Convertir en mission</button>]
      ]} />
    </section>
  );
}

function HrAbsencesPage() {
  const { rows, reload } = useRows("/hr/absences");
  const [employees, setEmployees] = useState<any[]>([]);
  const [draft, setDraft] = useState({ employeeId: "", type: "paid_leave", startDate: "", endDate: "", status: "planned", comment: "" });

  useEffect(() => {
    void api<any[]>("/employees").then((data) => {
      setEmployees(data);
      setDraft((current) => ({ ...current, employeeId: current.employeeId || data[0]?.id || "" }));
    }).catch(() => setEmployees([]));
  }, []);

  const employeeLabels = useMemo(() => new Map(employees.map((employee) => [employee.id, ((employee.firstName ?? "") + " " + (employee.lastName ?? "")).trim() || employee.email || employee.id])), [employees]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    await api("/hr/absences", { method: "POST", body: JSON.stringify(draft) });
    setDraft((current) => ({ ...current, startDate: "", endDate: "", comment: "" }));
    await reload();
  };

  return (
    <section className="space-y-5">
      <PageTitle title="Absences RH" subtitle="Absences utilis\u00e9es pour fiabiliser la capacit\u00e9 disponible et le staffing." />
      <form className="rounded-lg border border-line bg-white p-4" onSubmit={create}>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">Collaborateur<select className="mt-1 w-full rounded-md border border-line px-3 py-2" value={draft.employeeId} onChange={(event) => setDraft({ ...draft, employeeId: event.target.value })}>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employeeLabels.get(employee.id)}</option>)}</select></label>
          <label className="text-sm">Type<select className="mt-1 w-full rounded-md border border-line px-3 py-2" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>{["paid_leave", "sick_leave", "training", "other"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="text-sm">Statut<select className="mt-1 w-full rounded-md border border-line px-3 py-2" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>{["planned", "approved", "cancelled"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="text-sm">D\u00e9but<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="date" required value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></label>
          <label className="text-sm">Fin<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="date" required value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} /></label>
          <label className="text-sm">Commentaire<input className="mt-1 w-full rounded-md border border-line px-3 py-2" value={draft.comment} onChange={(event) => setDraft({ ...draft, comment: event.target.value })} /></label>
        </div>
        <button className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white">Cr\u00e9er l'absence</button>
      </form>
      <SimpleTable rows={rows} columns={[
        ["employeeId", "Collaborateur", (value: string) => employeeLabels.get(value) ?? value],
        ["type", "Type"],
        ["startDate", "D\u00e9but"],
        ["endDate", "Fin"],
        ["status", "Statut"]
      ]} />
    </section>
  );
}

export function DocumentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState({ companyId: "", entityType: "mission", entityId: "", category: "contract", notes: "" });
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = async () => setRows(await api<any[]>("/documents"));
  useEffect(() => {
    void load();
    void api<any[]>("/companies").then((data) => { setCompanies(data); setDraft((current) => ({ ...current, companyId: current.companyId || data[0]?.id || "" })); });
    void api<any[]>("/missions").then(setMissions);
    void api<any[]>("/clients").then(setClients);
    void api<any[]>("/invoices").then(setInvoices).catch(() => setInvoices([]));
    void api<any[]>("/payments").then(setPayments).catch(() => setPayments([]));
  }, []);

  const entityOptions = useMemo(() => {
    if (draft.entityType === "mission") return missions.map((item) => ({ value: item.id, label: item.title }));
    if (draft.entityType === "client") return clients.map((item) => ({ value: item.id, label: item.name }));
    if (draft.entityType === "invoice") return invoices.map((item) => ({ value: item.id, label: item.invoiceNumber ?? item.id }));
    if (draft.entityType === "payment") return payments.map((item) => ({ value: item.id, label: `${item.paymentDate ?? ""} - ${money(item.amount)}` }));
    return [];
  }, [clients, draft.entityType, invoices, missions, payments]);

  useEffect(() => {
    setDraft((current) => ({ ...current, entityId: entityOptions[0]?.value ?? "" }));
  }, [draft.entityType, entityOptions]);

  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!file) {
      setError("Sélectionnez un fichier à téléverser.");
      return;
    }
    if (!draft.companyId || !draft.entityId) {
      setError("Sélectionnez une société et une entité liée.");
      return;
    }
    setUploading(true);
    try {
      await api("/documents/upload", {
        method: "POST",
        body: JSON.stringify({
          ...draft,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          contentBase64: await fileToBase64(file)
        })
      });
      setFile(null);
      setDraft((current) => ({ ...current, notes: "" }));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Le document n'a pas pu être téléversé.");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    await api(`/documents/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <section className="space-y-5">
      <PageTitle title="Documents" subtitle="Téléversement, classement et téléchargement des pièces liées aux missions, clients, factures et paiements." />
      <form className="rounded-lg border border-line bg-white p-4" onSubmit={upload}>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">Société<select className="mt-1 w-full rounded-md border border-line px-3 py-2" value={draft.companyId} onChange={(event) => setDraft({ ...draft, companyId: event.target.value })}>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
          <label className="text-sm">Entité<select className="mt-1 w-full rounded-md border border-line px-3 py-2" value={draft.entityType} onChange={(event) => setDraft({ ...draft, entityType: event.target.value })}>{["mission", "client", "invoice", "payment"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="text-sm">Élément lié<select className="mt-1 w-full rounded-md border border-line px-3 py-2" value={draft.entityId} onChange={(event) => setDraft({ ...draft, entityId: event.target.value })}>{entityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="text-sm">Catégorie<select className="mt-1 w-full rounded-md border border-line px-3 py-2" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{["contract", "invoice", "report", "support", "other"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="text-sm md:col-span-2">Fichier<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
          <label className="text-sm md:col-span-3">Notes<textarea className="mt-1 w-full rounded-md border border-line px-3 py-2" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
        </div>
        {error ? <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <button className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={uploading}>{uploading ? "Téléversement..." : "Téléverser"}</button>
      </form>
      <SimpleTable rows={rows} columns={[
        ["fileName", "Fichier"],
        ["entityType", "Entité"],
        ["category", "Catégorie"],
        ["size", "Taille", (value: number) => `${Math.round((value ?? 0) / 1024)} Ko`],
        ["uploadedAt", "Ajouté le"],
        ["id", "Actions", (_value: string, row: any) => <div className="flex gap-2"><a className="rounded border border-line px-2 py-1 text-xs" href={`${API_URL}/documents/${row.id}/download`}>Télécharger</a><button className="rounded border border-line px-2 py-1 text-xs text-red-700" onClick={() => void remove(row.id)}>Supprimer</button></div>]
      ]} />
    </section>
  );
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function ConnectorsPage() {
  const { data } = useObject("/delivery/connectors");
  const rows = [...(data?.accounting ?? []), ...(data?.hr ?? []), ...(data?.crm ?? [])];
  return <TablePage title="Connecteurs" subtitle="Architecture de synchronisation CSV/CRM/compta/RH optionnelle." rows={rows} columns={[["provider", "Provider", (value: string, row: any) => <DataOriginBadge kind={row.externalSource?.includes("mock") ? "mock" : "provider"} provider={value} details={[row.lastSyncAt ? `Derni\u00e8re sync ${row.lastSyncAt}` : undefined]} />], ["externalSource", "Source", (value: string) => <DataOriginBadge kind={value} label={value} />], ["status", "Statut"], ["lastSyncAt", "Dernière synchro"], ["opportunityName", "Opportunité"]]} />;
}

const actualsColumns = [
  { key: "year", label: "Année" }, { key: "month", label: "Mois" }, { key: "source", label: "Source", render: (row: any) => <DataOriginBadge kind={row.source ?? "manual"} details={[row.updatedAt ? `Mis \u00e0 jour le ${row.updatedAt}` : undefined]} /> }, { key: "actualRevenueGenerated", label: "CA", render: (row: any) => money(row.actualRevenueGenerated) }, { key: "actualCashIn", label: "Cash-in", render: (row: any) => money(row.actualCashIn) }, { key: "actualCashOut", label: "Cash-out", render: (row: any) => money(row.actualCashOut) }, { key: "actualClosingCash", label: "Cash final", render: (row: any) => money(row.actualClosingCash) }
];

function TablePage({ title, subtitle, rows, columns }: { title: string; subtitle: string; rows: any[]; columns: any[] }) {
  return <section className="space-y-5"><PageTitle title={title} subtitle={subtitle} /><SimpleTable rows={rows} columns={columns} /></section>;
}

function useRows(path: string) {
  const [rows, setRows] = useState<any[]>([]);
  const reload = useCallback(async () => {
    try {
      const payload = await api<unknown>(path);
      setRows(normalizeRows(payload));
    } catch {
      setRows([]);
    }
  }, [path]);
  useEffect(() => { void reload(); }, [reload]);
  return { rows, reload };
}

function normalizeRows(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["rows", "data", "items", "resources"]) {
      if (Array.isArray(record[key])) return record[key] as any[];
    }
  }
  return [];
}

function useObject(path: string) {
  const [data, setData] = useState<any>(null);
  const reload = useCallback(async () => {
    try {
      setData(await api<any>(path));
    } catch {
      setData(null);
    }
  }, [path]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, reload };
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h1 className="text-2xl font-semibold tracking-normal">{title}</h1><p className="text-sm text-muted">{subtitle}</p></div>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<{ label: string; value: string }>; onChange: (value: string) => void }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <select className="w-full rounded-md border border-line px-3 py-2" value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">Sélectionner</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input className="w-full rounded-md border border-line px-3 py-2" type="number" value={value ?? 0} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return <div className="rounded-lg border border-line bg-white p-4"><h2 className="mb-4 text-base font-semibold">{title}</h2><div className="h-80"><ResponsiveContainer>{children}</ResponsiveContainer></div></div>;
}

function staffingStatusLabel(value: string) {
  const labels: Record<string, string> = {
    staffed: "Couvert",
    partial: "Partiel",
    uncovered: "Non couvert",
    surplus: "Sur-staffé"
  };
  return labels[value] ?? value;
}

function billingQueueBadge(value: string) {
  const labels: Record<string, string> = {
    suggested: "Suggestion",
    manual_review: "Revue manuelle",
    matched: "Rapprochée",
    ignored: "Ignorée"
  };
  return <Badge tone={value === "manual_review" ? "risk" : value === "matched" ? "good" : value === "ignored" ? "neutral" : "warn"}>{labels[value] ?? value}</Badge>;
}

function billingPaymentBadge(value: string) {
  const labels: Record<string, string> = {
    paid: "Payée",
    partial: "Partielle",
    pending: "À encaisser",
    not_invoiced: "Non facturée"
  };
  return <Badge tone={value === "paid" ? "good" : value === "partial" ? "warn" : "risk"}>{labels[value] ?? value}</Badge>;
}

function priorityLabel(value: string) {
  const labels: Record<string, string> = { high: "Priorité haute", medium: "Priorité moyenne", normal: "Priorité normale" };
  return labels[value] ?? value;
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
