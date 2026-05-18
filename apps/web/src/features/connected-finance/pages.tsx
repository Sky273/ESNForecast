import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { API_URL, api } from "../../api";
import { CrudPage } from "../../components/CrudPage";
import { Badge, money, percent } from "../../components/Format";
import { InfoPanel } from "../../components/InfoPanel";
import { KpiCard } from "../../components/KpiCard";
import { DataOriginBadge, DataOriginLegend } from "../../components/DataOriginBadge";

type ConnectedFinanceContext = { scenarioId: string; horizon: number };

const reconciliationTargetTypes = [
  { value: "invoice", label: "Facture" },
  { value: "payment", label: "Paiement" },
  { value: "fixed_cost", label: "Frais fixe" },
  { value: "variable_cost", label: "Frais variable" }
];

export function ConnectedFinanceDashboard({ scenarioId, horizon }: ConnectedFinanceContext) {
  const { data } = useObject(`/financial/situation?scenarioId=${scenarioId}&horizon=${horizon}`);
  return (
    <section className="space-y-5">
      <PageTitle title="Dashboard finance connectée" subtitle="Trésorerie bancaire, Écarts, rapprochement, fiabilité, runway et qualité des données." />
      <DataOriginLegend items={[{ kind: "provider", provider: "Bridge", label: "Banque" }, { kind: "calculated", label: "Rapprochement" }, { kind: "reforecast", label: "Recalibrage" }]} />
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <KpiCard label="Cash bancaire" value={money(data?.bankSummary?.currentCash ?? 0)} origin={{ kind: "provider", label: "Banque", details: ["Comptes synchronisés"] }} />
                <KpiCard label="Comptes actifs" value={String(data?.bankSummary?.accounts ?? 0)} origin={{ kind: "provider", label: "Banque" }} />
                <KpiCard label="Connecteurs actifs" value={String(data?.connectorHealth?.active ?? 0)} tone={(data?.connectorHealth?.active ?? 0) > 0 ? "good" : "risk"} origin={{ kind: "provider", label: "Provider" }} />
                <KpiCard label="Connecteurs expirés" value={String(data?.connectorHealth?.expired ?? 0)} tone={(data?.connectorHealth?.expired ?? 0) > 0 ? "risk" : "good"} origin={{ kind: "provider", label: "Provider" }} />
                <KpiCard label="Suggestions" value={String(data?.reconciliationSuggestions?.length ?? 0)} origin={{ kind: "calculated", label: "Rapprochement" }} />
                <KpiCard label="Anomalies" value={String(data?.anomalies?.length ?? 0)} tone={(data?.anomalies?.length ?? 0) > 0 ? "risk" : "good"} origin={{ kind: "calculated", label: "Contrôle" }} />
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
  const { rows, reload } = useRows("/bank/accounts");
  const { rows: connections } = useRows("/bank/connections");
  const connectionLabels = useMemo(() => new Map(connections.map((connection: any) => [connection.id, `${connection.provider} - ${connection.status}`])), [connections]);
  const activeAccounts = rows.filter((row: any) => row.isActive !== false);
  const totalCash = activeAccounts.reduce((total: number, row: any) => total + Number(row.currentBalance ?? 0), 0);
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle title="Comptes bancaires" subtitle="Comptes synchronisés depuis les connecteurs bancaires. Ces données sont gérées par le provider et ne se modifient pas manuellement." />
        <button className="rounded-md border border-line bg-white px-3 py-2 text-sm" onClick={() => void reload()}>Rafraîchir</button>
      </div>
      <InfoPanel title="Données provider">Les comptes sont créés et mis à jour par les synchronisations bancaires. Pour corriger un compte, il faut relancer la synchronisation ou reconnecter le provider, pas modifier la ligne à la main.</InfoPanel>
      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard label="Comptes actifs" value={String(activeAccounts.length)} origin={{ kind: "provider", label: "Banque", details: ["Comptes synchronisés actifs"] }} />
        <KpiCard label="Solde courant" value={money(totalCash)} origin={{ kind: "calculated", label: "Solde consolidé", details: ["Somme des soldes des comptes actifs"] }} />
        <KpiCard label="Connexions bancaires" value={String(connections.length)} origin={{ kind: "provider", label: "Consentements bancaires" }} />
      </div>
      <SimpleTable rows={rows} columns={[
        ["name", "Compte"],
        ["provider", "Source", (value: string, row: any) => <DataOriginBadge kind={row.rawPayload?.mock ? "mock" : "provider"} provider={value ?? row.provider} details={[row.lastSyncAt ? `Dernière sync ${row.lastSyncAt}` : undefined, row.balanceDate ? `Solde au ${row.balanceDate}` : undefined]} />],
        ["bankConnectionId", "Connexion", (value: string) => connectionLabels.get(value) ?? "Connexion inconnue"],
        ["ibanMasked", "IBAN masqué"],
        ["currentBalance", "Solde", money],
        ["availableBalance", "Disponible", money],
        ["balanceDate", "Date solde"],
        ["isActive", "Actif", (value: boolean) => value === false ? "Non" : "Oui"]
      ]} />
    </section>
  );
}

export function BankTransactionsPage() {
  const { rows, reload } = useRows("/bank/transactions");
  const { rows: accounts } = useRows("/bank/accounts");
  const { rows: categories } = useRows("/financial-categories");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const accountLabels = useMemo(() => new Map(accounts.map((account: any) => [account.id, account.name])), [accounts]);
  const categoryLabels = useMemo(() => new Map(categories.map((category: any) => [category.id, category.name])), [categories]);
  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row: any) => {
      const matchesStatus = statusFilter === "all" || row.reconciliationStatus === statusFilter || row.categorizationStatus === statusFilter;
      const matchesQuery = !needle || [row.label, row.counterpartyName, accountLabels.get(row.bankAccountId), categoryLabels.get(row.categoryId)].filter(Boolean).join(" ").toLowerCase().includes(needle);
      return matchesStatus && matchesQuery;
    });
  }, [rows, statusFilter, query, accountLabels, categoryLabels]);
  const unreconciled = rows.filter((row: any) => !["reconciled", "ignored"].includes(row.reconciliationStatus));
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle title="Transactions bancaires" subtitle="Transactions synchronisées depuis la banque. La correction se fait via catégorisation et rapprochement, pas par édition brute." />
        <div className="flex flex-wrap gap-2">
          <button className="rounded-md border border-line bg-white px-3 py-2 text-sm" onClick={() => void reload()}>Rafraîchir</button>
          <button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={() => { window.location.hash = "/bankReconciliation"; }}>Traiter le rapprochement</button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Transactions" value={String(rows.length)} origin={{ kind: "provider", label: "Banque", details: ["Transactions synchronisées"] }} />
        <KpiCard label="À rapprocher" value={String(unreconciled.length)} tone={unreconciled.length ? "risk" : "good"} origin={{ kind: "calculated", label: "Rapprochement", details: ["Transactions non rapprochées et non ignorées"] }} />
        <KpiCard label="Crédits" value={money(rows.filter((row: any) => row.direction === "credit").reduce((total: number, row: any) => total + Number(row.amount ?? 0), 0))} origin={{ kind: "calculated", label: "Crédits", details: ["Somme des transactions crédit"] }} />
        <KpiCard label="Débits" value={money(rows.filter((row: any) => row.direction === "debit").reduce((total: number, row: any) => total + Number(row.amount ?? 0), 0))} origin={{ kind: "calculated", label: "Débits", details: ["Somme des transactions débit"] }} />
      </div>
      <div className="flex flex-wrap gap-2 rounded-lg border border-line bg-white p-3">
        <input className="min-w-64 flex-1 rounded-md border border-line px-3 py-2 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher libellé, contrepartie, compte, catégorie..." />
        <select className="rounded-md border border-line bg-white px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Toutes</option>
          <option value="uncategorized">Non catégorisées</option>
          <option value="unreconciled">Non rapprochées</option>
          <option value="suggested">Avec suggestion</option>
          <option value="reconciled">Rapprochées</option>
          <option value="ignored">Ignorées</option>
        </select>
      </div>
      <SimpleTable rows={filteredRows} columns={[
        ["transactionDate", "Date"],
        ["label", "Libellé"],
        ["counterpartyName", "Contrepartie"],
        ["provider", "Source", (value: string, row: any) => <DataOriginBadge kind={row.rawPayload?.mock ? "mock" : "provider"} provider={value ?? row.provider} details={[row.bookingDate ? `Comptabilisée le ${row.bookingDate}` : undefined]} />],
        ["bankAccountId", "Compte", (value: string) => accountLabels.get(value) ?? "Compte inconnu"],
        ["amount", "Montant", money],
        ["categoryId", "Catégorie", (value: string) => value ? categoryLabels.get(value) ?? value : "À catégoriser"],
        ["reconciliationStatus", "Rapprochement"]
      ]} />
    </section>
  );
}
export function BankReconciliationPage() {
  const { data, reload } = useObject("/reconciliation/queue");
  const [selectedId, setSelectedId] = useState("");
  const [queueFilter, setQueueFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [targetType, setTargetType] = useState("invoice");
  const [targetId, setTargetId] = useState("");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [notes, setNotes] = useState("");
  const [candidates, setCandidates] = useState<any[]>([]);
  const queueItems = useMemo(() => data?.items ?? [], [data]);
  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return queueItems.filter((row: any) => {
      const matchesFilter = queueFilter === "all" || row.queueStatus === queueFilter || row.priority === queueFilter;
      const matchesSearch = !needle || [row.transactionLabel, row.transactionCounterparty, row.transactionAccountName, row.bestSuggestion?.targetLabel].filter(Boolean).join(" ").toLowerCase().includes(needle);
      return matchesFilter && matchesSearch;
    });
  }, [queueItems, queueFilter, search]);
  const selected = useMemo(() => filteredRows.find((row: any) => row.id === selectedId) ?? filteredRows[0], [filteredRows, selectedId]);

  useEffect(() => {
    void api<any[]>("/reconciliation/candidates?targetType=" + encodeURIComponent(targetType) + "&q=" + encodeURIComponent(candidateQuery)).then((data) => {
      setCandidates(data);
      setTargetId((current) => current || data[0]?.targetId || "");
    }).catch(() => setCandidates([]));
  }, [targetType, candidateQuery]);

  useEffect(() => {
    if (!selected) return;
    setTargetType(selected.bestSuggestion?.targetType ?? "invoice");
    setTargetId(selected.bestSuggestion?.targetId ?? "");
    setCandidateQuery("");
    setNotes("");
  }, [selected?.id]);

  const acceptSuggestion = async (id: string) => { await api("/reconciliation/suggestions/" + id + "/accept", { method: "POST", body: JSON.stringify({}) }); await reload(); };
  const ignoreTransaction = async (id: string) => { await api("/reconciliation/transactions/" + id + "/ignore", { method: "POST", body: JSON.stringify({}) }); setSelectedId(""); await reload(); };
  const matchTransaction = async () => {
    if (!selected || !targetId) return;
    await api("/reconciliation/transactions/" + selected.transactionId + "/match", { method: "POST", body: JSON.stringify({ targetType, targetId, notes }) });
    setSelectedId("");
    await reload();
  };
  const acceptBestSuggestion = async () => {
    if (!selected?.bestSuggestion?.id) return;
    await acceptSuggestion(selected.bestSuggestion.id);
    setSelectedId("");
  };
  const refreshSuggestions = async () => {
    await api("/reconciliation/suggestions/refresh", { method: "POST", body: JSON.stringify({}) });
    setSelectedId("");
    await reload();
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle title="Rapprochement bancaire" subtitle="File de traitement des transactions à rapprocher, avec priorité, suggestion et action manuelle." />
        <div className="flex flex-wrap gap-2">
          <button className="rounded-md border border-line bg-white px-3 py-2 text-sm" onClick={() => void reload()}>Rafraîchir</button>
          <button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={() => void refreshSuggestions()}>Recalculer les suggestions</button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        <KpiCard label="À traiter" value={String(data?.summary?.total ?? 0)} origin={{ kind: "calculated", label: "File rapprochement", details: ["Transactions à rapprocher"] }} />
        <KpiCard label="Avec suggestion" value={String(data?.summary?.suggested ?? 0)} tone={(data?.summary?.suggested ?? 0) > 0 ? "good" : "default"} origin={{ kind: "calculated", label: "Suggestion", details: ["Matching montant, tiers et dates"] }} />
        <KpiCard label="Revue manuelle" value={String(data?.summary?.manualReview ?? 0)} tone={(data?.summary?.manualReview ?? 0) > 0 ? "risk" : "good"} origin={{ kind: "calculated", label: "Contrôle", details: ["Suggestions sous seuil de confiance"] }} />
        <KpiCard label="Priorité haute" value={String(data?.summary?.highPriority ?? 0)} tone={(data?.summary?.highPriority ?? 0) > 0 ? "risk" : "good"} origin={{ kind: "calculated", label: "Priorité", details: ["Montant ou risque élevé"] }} />
        <KpiCard label="Montant à traiter" value={money(data?.summary?.amountToProcess ?? 0)} origin={{ kind: "calculated", label: "Montant", details: ["Somme des transactions de la file"] }} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(420px,0.75fr)]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 rounded-lg border border-line bg-white p-3">
            <input className="min-w-64 flex-1 rounded-md border border-line px-3 py-2 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une transaction, un compte, une contrepartie..." />
            <select className="rounded-md border border-line bg-white px-3 py-2 text-sm" value={queueFilter} onChange={(event) => setQueueFilter(event.target.value)}>
              <option value="all">Toutes</option>
              <option value="suggested">Avec suggestion</option>
              <option value="manual_review">Revue manuelle</option>
              <option value="high">Priorité haute</option>
            </select>
          </div>
          <SimpleTable rows={filteredRows} columns={[
            ["transactionLabel", "Transaction", (value: string, row: any) => <button className="text-left font-medium text-brand" onClick={() => setSelectedId(row.id)}>{value}</button>],
            ["transactionAmount", "Montant", money],
            ["bestSuggestion", "Suggestion", (_value: any, row: any) => row.bestSuggestion?.targetLabel ?? "À qualifier"],
            ["queueStatus", "Statut", (value: string) => <Badge tone={value === "manual_review" ? "risk" : "good"}>{value === "manual_review" ? "Revue manuelle" : "Suggestion"}</Badge>],
            ["priority", "Priorité", (value: string) => <Badge tone={value === "high" ? "risk" : value === "medium" ? "warn" : "neutral"}>{value === "high" ? "Haute" : value === "medium" ? "Moyenne" : "Normale"}</Badge>],
            ["suggestionCount", "Choix"]
          ]} />
        </div>
        <aside className="rounded-lg border border-line bg-white p-4 shadow-sm">
          {selected ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Traitement de la transaction</h2>
                  <p className="text-sm text-muted">{selected.transactionLabel}</p>
                </div>
                <Badge tone={selected.priority === "high" ? "risk" : selected.priority === "medium" ? "warn" : "neutral"}>{selected.priority === "high" ? "Priorité haute" : selected.priority === "medium" ? "Priorité moyenne" : "Priorité normale"}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <KpiCard label="Montant" value={money(selected.transactionAmount ?? 0)} origin={{ kind: "provider", label: "Transaction bancaire" }} />
                <KpiCard label="Compte" value={selected.transactionAccountName ?? "-"} origin={{ kind: "provider", label: "Compte bancaire" }} />
              </div>
              <div className="rounded-md border border-line bg-surface p-3 text-sm">
                <div className="font-medium">Meilleure suggestion</div>
                {selected.bestSuggestion ? (
                  <div className="mt-2 space-y-1">
                    <div>{selected.bestSuggestion.targetLabel}</div>
                    <div className="text-muted">{selected.bestSuggestion.reason}</div>
                    <div>Score : {percent(selected.bestSuggestion.confidenceScore ?? 0)}</div>
                    <button className="mt-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={() => void acceptBestSuggestion()}>Accepter cette suggestion</button>
                  </div>
                ) : <div className="mt-2 text-muted">Aucune suggestion fiable. Choisissez une cible manuellement.</div>}
              </div>
              {selected.suggestions?.length > 1 ? (
                <div>
                  <div className="mb-2 text-sm font-medium">Autres suggestions</div>
                  <div className="space-y-2">
                    {selected.suggestions.slice(1).map((suggestion: any) => (
                      <button key={suggestion.id} className="w-full rounded-md border border-line px-3 py-2 text-left text-sm" onClick={() => void acceptSuggestion(suggestion.id)}>
                        <span className="font-medium">{suggestion.targetLabel}</span>
                        <span className="ml-2 text-muted">{percent(suggestion.confidenceScore ?? 0)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="border-t border-line pt-4">
                <h3 className="text-base font-semibold">Rapprochement manuel</h3>
                <div className="mt-3 grid gap-3">
                  <label className="text-sm">Type de cible<select className="mt-1 w-full rounded-md border border-line px-3 py-2" value={targetType} onChange={(event) => { setTargetType(event.target.value); setTargetId(""); }}>
                    {reconciliationTargetTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select></label>
                  <label className="text-sm">Recherche<input className="mt-1 w-full rounded-md border border-line px-3 py-2" value={candidateQuery} onChange={(event) => { setCandidateQuery(event.target.value); setTargetId(""); }} placeholder="Facture, paiement, client, libellé..." /></label>
                  <label className="text-sm">Cible<select className="mt-1 w-full rounded-md border border-line px-3 py-2" value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                    <option value="">Sélectionner une cible</option>
                    {candidates.map((candidate) => <option key={candidate.targetType + ":" + candidate.targetId} value={candidate.targetId}>{candidate.label}</option>)}
                  </select></label>
                  <label className="text-sm">Commentaire<textarea className="mt-1 min-h-20 w-full rounded-md border border-line px-3 py-2" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={!targetId} onClick={() => void matchTransaction()}>Rapprocher manuellement</button>
                  <button className="rounded-md border border-line px-4 py-2 text-sm text-red-700" onClick={() => void ignoreTransaction(selected.transactionId)}>Ignorer la transaction</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted">Aucune transaction à traiter.</div>
          )}
        </aside>
      </div>
    </section>
  );
}

export function ImportedAccountingPage() {
  const { rows } = useRows("/accounting/imports/invoices");
  return <TablePage title="Comptabilité importée" subtitle="Factures et paiements importés depuis un connecteur comptable ou un import CSV." rows={rows} columns={[
    ["invoiceNumber", "Facture"],
    ["source", "Source", (_value: string, row: any) => <DataOriginBadge kind={row.rawPayload?.mock ? "mock" : row.source ?? row.provider ?? "provider"} provider={row.provider} details={[row.importedAt ? `Importée le ${row.importedAt}` : undefined, row.updatedAt ? `Mise à jour le ${row.updatedAt}` : undefined]} />],
    ["type", "Type"],
    ["clientOrSupplierName", "Tiers"],
    ["invoiceDate", "Date"],
    ["amountTTC", "TTC", money],
    ["paidAmount", "Paye", money],
    ["status", "Statut"]
  ]} />;
}

export function RealTreasuryPage({ scenarioId, horizon }: ConnectedFinanceContext) {
  const { rows } = useRows(`/treasury/actual-vs-forecast?scenarioId=${scenarioId}&horizon=${horizon}`);
  return <TablePage title="Trésorerie réelle vs prévisionnelle" subtitle="Solde bancaire, solde prévu, Écart et projection recalibrée." rows={rows} columns={[
    ["month", "Mois"],
    ["origin", "Origine", (_value: string, row: any) => <DataOriginBadge kind="reforecast" label="Trésorerie" details={[`Prévu ${money(row.forecastClosingCash)}`, `Réel ${money(row.actualClosingCash)}`]} />],
    ["forecastClosingCash", "Prévu", money],
    ["actualClosingCash", "Réel bancaire", money],
    ["recalibratedClosingCash", "Recalibr\u00e9", money],
    ["variance", "Écart", money],
    ["reliabilityScore", "Fiabilité", (value: number) => `${value}/100`]
  ]} />;
}

export function ReforecastPage({ scenarioId, horizon }: ConnectedFinanceContext) {
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
        ["origin", "Origine", (_value: string, row: any) => <DataOriginBadge kind="reforecast" label="Reforecast" details={[`Écart ${money(row.variance)}`, `Fiabilité ${row.reliabilityScore ?? 0}/100`]} />],
        ["forecastClosingCash", "Prevu", money],
        ["actualClosingCash", "Reel bancaire", money],
        ["recalibratedClosingCash", "Recalibre", money],
        ["variance", "Ecart", money],
        ["reliabilityScore", "Fiabilité", (value: number) => `${value}/100`]
      ]} />
    </section>
  );
}

export function RunwayPage({ scenarioId, horizon }: ConnectedFinanceContext) {
  const { data } = useObject(`/treasury/runway?scenarioId=${scenarioId}&horizon=${horizon}`);
  return (
    <section className="space-y-5">
      <PageTitle title="Cash runway" subtitle="Runway basé sur cash bancaire réel, burn et cash-in pondéré." />
      <DataOriginLegend items={[{ kind: "provider", label: "Cash réel" }, { kind: "calculated", label: "Burn" }, { kind: "calculated", label: "Runway" }]} />
      <div className="grid gap-3 md:grid-cols-4">
                <KpiCard label="Cash actuel" value={money(data?.currentCash ?? 0)} origin={{ kind: "provider", label: "Banque" }} />
                <KpiCard label="Burn moyen" value={money(data?.averageMonthlyBurn ?? 0)} origin={{ kind: "calculated", label: "Burn" }} />
                <KpiCard label="Runway sans nouveau CA" value={`${data?.runwayWithoutNewRevenueMonths ?? 0} mois`} tone={(data?.runwayWithoutNewRevenueMonths ?? 0) < 3 ? "risk" : "good"} origin={{ kind: "calculated", label: "Runway" }} />
                <KpiCard label="Date critique" value={data?.criticalDate ?? "-"} origin={{ kind: "calculated", label: "Projection" }} />
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
            <KpiCard label={"Score qualité"} value={String(data?.score ?? 0) + "/100"} tone={(data?.score ?? 0) < 70 ? "risk" : "good"} origin={{ kind: "calculated", label: "Qualité" }} />
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
  const visibleConnectors = useMemo(
    () => (data?.connectors ?? []).filter((connector: any) => !["disconnected", "revoked"].includes(connector.status)),
    [data?.connectors]
  );
  const connectorLabels = useMemo(
    () => new Map((data?.connectors ?? []).map((connector: any) => [connector.id, connectorDisplayName(connector)])),
    [data?.connectors]
  );
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
  const removeConnector = async (id: string) => {
    setMessage("");
    await api("/connectors/" + id, { method: "DELETE" });
    await reload();
    setMessage("Connecteur supprim\u00e9 de la supervision.");
  };
  return (
    <section className="space-y-5">
      <PageTitle title="Supervision connecteurs" subtitle={"Pilotage op\u00e9rationnel des connecteurs, synchronisations et erreurs."} />
      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div> : null}
      <div className="grid gap-3 md:grid-cols-4">
                <KpiCard label={"Connectés"} value={String(data?.summary?.connected ?? 0)} tone="good" origin={{ kind: "provider", label: "Provider" }} />
                <KpiCard label="En erreur" value={String(data?.summary?.errors ?? 0)} tone={(data?.summary?.errors ?? 0) > 0 ? "risk" : "good"} origin={{ kind: "calculated", label: "Supervision" }} />
                <KpiCard label={"Expirés"} value={String(data?.summary?.expired ?? 0)} tone={(data?.summary?.expired ?? 0) > 0 ? "risk" : "good"} origin={{ kind: "calculated", label: "Supervision" }} />
                <KpiCard label={"Déconnectés"} value={String(data?.summary?.disconnected ?? 0)} origin={{ kind: "calculated", label: "Supervision" }} />
      </div>
      <SimpleTable rows={visibleConnectors} columns={[
        ["provider", "Provider"], ["type", "Type"], ["name", "Nom"], ["status", "Statut"], ["lastSyncAt", "Dernier sync"], ["errorMessage", "Erreur"],
        ["id", "Actions", (_value: string, row: any) => (
          <div className="flex flex-wrap gap-2">
            <button className="rounded border border-line px-2 py-1 text-xs" onClick={() => void run(row.id, "incremental-sync")}>Sync</button>
            <button className="rounded border border-line px-2 py-1 text-xs" onClick={() => void run(row.id, "full-sync")}>Full sync</button>
            <button className="rounded border border-line px-2 py-1 text-xs" onClick={() => void run(row.id, "reconnect")}>Reconnecter</button>
            <button className="rounded border border-line px-2 py-1 text-xs text-red-700" onClick={() => void run(row.id, "revoke")}>{"R\u00e9voquer"}</button>
            <button className="rounded border border-line px-2 py-1 text-xs text-red-700" onClick={() => void removeConnector(row.id)}>Supprimer</button>
          </div>
        )]
      ]} />
      <SimpleTable rows={data?.runs ?? []} columns={[
        ["connectorId", "Connecteur", (value: string) => connectorLabels.get(value) ?? value], ["status", "Statut"], ["startedAt", "D\u00e9but"], ["finishedAt", "Fin"], ["importedCount", "Import\u00e9s"], ["updatedCount", "Mis \u00e0 jour"], ["errorCount", "Erreurs"]
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

export function CodirReportPage({ scenarioId, horizon }: ConnectedFinanceContext) {
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
      <InfoPanel title="Sources du rapport">Le rapport CODIR utilise le scénario actif, l'horizon sélectionné, les données bancaires synchronisées et les écarts calculés sur le mois courant.</InfoPanel>
      <DataOriginLegend items={[{ kind: "provider", label: "Banque" }, { kind: "calculated", label: "Anomalies" }, { kind: "calculated", label: "Runway" }]} />
      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard label="Cash" value={money(data?.payload?.bankSummary?.currentCash ?? 0)} origin={{ kind: "provider", label: "Banque", details: ["Solde bancaire synchronisé"] }} />
        <KpiCard label="Anomalies" value={String(data?.payload?.anomalies?.length ?? 0)} origin={{ kind: "calculated", label: "Anomalies", details: ["Contrôles financiers du mois"] }} />
        <KpiCard label="Runway" value={`${data?.payload?.runway?.runwayWeightedMonths ?? 0} mois`} origin={{ kind: "calculated", label: "Runway", details: ["Cash réel, burn moyen et cash-in pondéré"] }} />
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

function connectorDisplayName(connector: any) {
  return connector?.name || [connector?.provider, connector?.type].filter(Boolean).join(" - ") || connector?.id || "";
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
