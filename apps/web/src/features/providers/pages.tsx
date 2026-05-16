import { useEffect, useMemo, useState } from "react";
import { API_URL, api } from "../../api";
import { CrudPage } from "../../components/CrudPage";
import { Badge } from "../../components/Format";
import { KpiCard } from "../../components/KpiCard";

export function RealConnectorsPage() {
  const { rows } = useRows("/providers");
  return <TablePage title="Connecteurs réels V4" subtitle="Bridge, Powens, Tink, Plaid, Pennylane, Sage et extensions." rows={rows} columns={[
    ["provider", "Provider"],
    ["configStatus", "Configuration", (_value: any, row: any) => <Badge tone={row.configStatus?.ok ? "good" : "warn"}>{row.configStatus?.ok ? "configuré" : "mock/sandbox"}</Badge>],
    ["capabilities", "Données", (_value: any, row: any) => capabilityText(row.capabilities)],
    ["configStatus", "Environnement", (value: any) => value?.environment]
  ]} />;
}

export function ProviderConnectionPage() {
  const [provider, setProvider] = useState("bridge");
  const [result, setResult] = useState<any>(null);
  const [callbackResult, setCallbackResult] = useState<Record<string, string> | null>(() => readProviderCallbackResult());
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setLoading(true);
    try {
      const response = await api<any>(`/connectors/${provider}/oauth/start`, {
        method: "POST",
        body: JSON.stringify({
          connectorType: ["pennylane", "sage"].includes(provider) ? "accounting" : "banking",
          redirectUri: `${API_URL}/connectors/${provider}/oauth/callback`,
          returnUrl: `${window.location.origin}/#/provider-connection`
        })
      });
      setResult(response);
      window.location.assign(response.authorizationUrl);
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Erreur de démarrage de connexion" });
      setLoading(false);
    }
  };

  const clearCallback = () => {
    setCallbackResult(null);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  };

  return (
    <section className="space-y-5">
      <PageTitle title="Assistant de connexion provider" subtitle="Démarre le flux OAuth provider, puis affiché le résultat au retour." />
      {callbackResult ? (
        <div className={`rounded-lg border p-4 text-sm ${callbackResult.connectionStatus === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>
          <div className="font-semibold">{callbackResult.connectionStatus === "success" ? "Connexion provider terminée" : "Connexion provider en erreur"}</div>
          <div className="mt-1">
            {callbackResult.connectionStatus === "success"
              ? `Provider ${callbackResult.provider ?? ""} connecté. Connecteur créé : ${callbackResult.connectorId ?? "non renseigné"}.`
              : callbackResult.message ?? "Le provider a retourné une erreur."}
          </div>
          <pre className="mt-3 overflow-auto rounded bg-white/70 p-3 text-xs">{JSON.stringify(callbackResult, null, 2)}</pre>
          <button className="mt-3 rounded-md border border-line bg-white px-3 py-2 text-xs font-medium text-slate-700" onClick={clearCallback}>Effacer le retour</button>
        </div>
      ) : null}
      <div className="rounded-lg border border-line bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[240px_auto]">
          <select className="rounded-md border border-line px-3 py-2" value={provider} onChange={(event) => setProvider(event.target.value)}>
            {["bridge", "powens", "tink", "plaid", "pennylane", "sage"].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={loading} onClick={start}>{loading ? "Redirection..." : "Démarrer connexion"}</button>
        </div>
      </div>
      {result ? (
        <div className="rounded-lg border border-line bg-white p-4 text-sm">
          <div className="font-medium">Authorization URL</div>
          {result.authorizationUrl ? <a className="break-all text-brand" href={result.authorizationUrl}>{result.authorizationUrl}</a> : null}
          <pre className="mt-3 overflow-auto rounded bg-surface p-3">{JSON.stringify(result, null, 2)}</pre>
        </div>
      ) : null}
    </section>
  );
}

function ProviderConnectionPageLegacy() {
  const [provider, setProvider] = useState("bridge");
  const [result, setResult] = useState<any>(null);
  const start = async () => setResult(await api(`/connectors/${provider}/oauth/start`, {
    method: "POST",
    body: JSON.stringify({
      connectorType: ["pennylane", "sage"].includes(provider) ? "accounting" : "banking",
      redirectUri: `${API_URL}/connectors/${provider}/oauth/callback`
    })
  }));
  return (
    <section className="space-y-5">
      <PageTitle title="Assistant de connexion provider" subtitle="Démarre un flux OAuth sécurisé ou un flux sandbox/mock si les credentials sont absents." />
      <div className="rounded-lg border border-line bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[240px_auto]">
          <select className="rounded-md border border-line px-3 py-2" value={provider} onChange={(event) => setProvider(event.target.value)}>
            {["bridge", "powens", "tink", "plaid", "pennylane", "sage"].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white" onClick={start}>Démarrer connexion</button>
        </div>
      </div>
      {result ? <div className="rounded-lg border border-line bg-white p-4 text-sm"><div className="font-medium">Authorization URL</div><a className="break-all text-brand" href={result.authorizationUrl}>{result.authorizationUrl}</a><pre className="mt-3 overflow-auto rounded bg-surface p-3">{JSON.stringify(result, null, 2)}</pre></div> : null}
    </section>
  );
}

export function ProviderHealthPage() {
  const { data } = useObject("/connector-health");
  return (
    <section className="space-y-5">
      <PageTitle title="Santé connecteurs V4" subtitle="Vue opérationnelle provider, syncs, webhooks, erreurs et rate limits." />
      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Connectes" value={String(data?.summary?.connected ?? 0)} tone="good" />
        <KpiCard label="En erreur" value={String(data?.summary?.errors ?? 0)} tone={(data?.summary?.errors ?? 0) > 0 ? "risk" : "good"} />
        <KpiCard label="Expirés" value={String(data?.summary?.expired ?? 0)} tone={(data?.summary?.expired ?? 0) > 0 ? "risk" : "good"} />
        <KpiCard label="Deconnectés" value={String(data?.summary?.disconnected ?? 0)} />
      </div>
      <SimpleTable rows={data?.connectors ?? []} columns={[["provider", "Provider"], ["type", "Type"], ["name", "Nom"], ["status", "Statut", statusBadge], ["lastSyncAt", "Dernier sync"], ["errorMessage", "Erreur"]]} />
    </section>
  );
}

export function ProviderErrorsPage() {
  const { rows } = useRows("/provider-errors");
  return <TablePage title="Erreurs provider" subtitle="Erreurs normalisées avec action utilisateur, retry et diagnostic technique." rows={rows} columns={[
    ["provider", "Provider"],
    ["errorCategory", "Catégorie"],
    ["userMessage", "Message"],
    ["retryable", "Retry"],
    ["requiresUserAction", "Action utilisateur"],
    ["createdAt", "Date"]
  ]} />;
}

export function ProviderWebhooksPage() {
  const { rows } = useRows("/connector-health/webhooks");
  return <TablePage title="Webhooks provider" subtitle="événements entrants deduplicables et validables par signature." rows={rows} columns={[
    ["provider", "Provider"], ["eventType", "Type"], ["externalEventId", "Event ID"], ["signatureValid", "Signature"], ["status", "Statut"], ["receivedAt", "Reçu"]
  ]} />;
}

export function ProviderRateLimitsPage() {
  const { rows } = useRows("/connector-health/rate-limits");
  return <TablePage title="Rate limits" subtitle="état des quotas provider et throttling." rows={rows} columns={[
    ["provider", "Provider"], ["connectorId", "Connecteur"], ["remaining", "Restant"], ["resetAt", "Reset"], ["isThrottled", "Throttle"]
  ]} />;
}

export function DuplicatesPage() {
  const { rows } = useRows("/duplicates");
  return <TablePage title="Doublons multi-source" subtitle="Doublons potentiels entre CSV, banque, compta et saisie manuelle." rows={rows} columns={[
    ["entityType", "Entité"], ["sourceAType", "Source A"], ["sourceBType", "Source B"], ["confidenceScore", "Score"], ["reason", "Raison"], ["status", "Statut"]
  ]} />;
}

export function DataSourcePoliciesPage() {
  return <CrudPage title="Sources de verite" path="/data-source-policies" initial={{ organizationId: "", domain: "bank_transactions", primarySource: "bank_provider", conflictResolution: "manual" }} fields={[
    { name: "organizationId", label: "Organisation", type: "select", optionsPath: "/organizations", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner une organisation" },
    { name: "domain", label: "Domaine", type: "select", options: ["bank_transactions", "invoices", "payments", "customers", "suppliérs", "missions", "expenses"].map((value) => ({ label: value, value })) },
    { name: "primarySource", label: "Source primaire", type: "select", options: ["bank_provider", "accounting_provider", "csv", "esn_forecast", "manual"].map((value) => ({ label: value, value })) },
    { name: "conflictResolution", label: "Resolution conflit", type: "select", options: ["manual", "provider_wins", "esn_forecast_wins", "latest_update_wins"].map((value) => ({ label: value, value })) }
  ]} columns={[{ key: "domain", label: "Domaine" }, { key: "primarySource", label: "Source" }, { key: "conflictResolution", label: "Conflit" }]} />;
}

export function ConnectorCompliancePage() {
  const { data } = useObject("/compliance/connectors");
  return (
    <section className="space-y-5">
      <PageTitle title="Conformité connecteurs" subtitle="Tokens masqués, scopes, environnements, consentements et responsabilités." />
      <SimpleTable rows={data?.connectors ?? []} columns={[["provider", "Provider"], ["type", "Type"], ["status", "Statut", statusBadge], ["configuration", "Configuration", (value: any) => value?.environment ?? "n/a"], ["lastSyncAt", "Dernier sync"]]} />
      <SimpleTable rows={data?.tokens ?? []} columns={[["provider", "Provider"], ["connectorId", "Connecteur"], ["tokenType", "Type"], ["expiresAt", "Expiration"], ["accessTokenEncrypted", "Token d'accès"], ["refreshTokenEncrypted", "Refresh token"]]} />
    </section>
  );
}

export function ConsentCompliancePage() {
  const { rows } = useRows("/compliance/consents");
  return <TablePage title="Consentements réels" subtitle="Suivi des consentements bancaires et révocation." rows={rows} columns={[
    ["provider", "Provider"], ["status", "Statut", statusBadge], ["grantedBy", "Accordé par"], ["grantedAt", "Accordé le"], ["expiresAt", "Expiré le"], ["revokedAt", "Révoqué le"]
  ]} />;
}

function capabilityText(value: any) {
  const enabled = Object.entries(value ?? {}).filter(([, v]) => v).map(([key]) => key.replace("supports", ""));
  return enabled.slice(0, 4).join(", ");
}

function statusBadge(value: string) {
  return <Badge tone={["connected", "success", "processed", true].includes(value as any) ? "good" : ["error", "expired", "failed"].includes(value) ? "risk" : "warn"}>{String(value)}</Badge>;
}

function TablePage({ title, subtitle, rows, columns }: { title: string; subtitle: string; rows: any[]; columns: any[] }) {
  return <section className="space-y-5"><PageTitle title={title} subtitle={subtitle} /><SimpleTable rows={rows} columns={columns} /></section>;
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h1 className="text-2xl font-semibold tracking-normal">{title}</h1><p className="text-sm text-muted">{subtitle}</p></div>;
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

function readProviderCallbackResult() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [route, search = ""] = hash.split("?");
  if (route !== "provider-connection" || !search) return null;
  return Object.fromEntries(new URLSearchParams(search).entries());
}

function SimpleTable({ rows, columns }: { rows: any[]; columns: any[] }) {
  const normalized = useMemo(() => rows ?? [], [rows]);
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-surface text-left text-xs uppercase text-muted"><tr>{columns.map((column: any) => <th key={column[0]} className="px-3 py-3">{column[1]}</th>)}</tr></thead>
        <tbody>
          {normalized.map((row, index) => <tr key={row.id ?? row.provider ?? index} className="border-t border-line">{columns.map((column: any) => <td key={column[0]} className="px-3 py-3">{column[2] ? column[2](row[column[0]], row) : String(row[column[0]] ?? "")}</td>)}</tr>)}
          {!normalized.length ? <tr><td className="px-3 py-8 text-center text-muted" colSpan={columns.length}>Aucune donnée</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
