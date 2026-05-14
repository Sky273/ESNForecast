import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { CrudPage } from "../components/CrudPage";
import { Badge } from "../components/Format";
import { KpiCard } from "../components/KpiCard";

export function RealConnectorsPage() {
  const { rows } = useRows("/providers");
  return <TablePage title="Connecteurs reels V4" subtitle="Bridge, Powens, Tink, Plaid, Pennylane, Sage et extensions." rows={rows} columns={[
    ["provider", "Provider"],
    ["configStatus", "Configuration", (_value: any, row: any) => <Badge tone={row.configStatus?.ok ? "good" : "warn"}>{row.configStatus?.ok ? "configure" : "mock/sandbox"}</Badge>],
    ["capabilities", "Donnees", (_value: any, row: any) => capabilityText(row.capabilities)],
    ["configStatus", "Environnement", (value: any) => value?.environment]
  ]} />;
}

export function ProviderConnectionPage() {
  const [provider, setProvider] = useState("bridge");
  const [result, setResult] = useState<any>(null);
  const start = async () => setResult(await api(`/connectors/${provider}/oauth/start`, { method: "POST", body: JSON.stringify({ connectorType: ["pennylane", "sage"].includes(provider) ? "accounting" : "banking" }) }));
  return (
    <section className="space-y-5">
      <PageTitle title="Assistant de connexion provider" subtitle="Demarre un flux OAuth securise ou un flux sandbox/mock si les credentials sont absents." />
      <div className="rounded-lg border border-line bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[240px_auto]">
          <select className="rounded-md border border-line px-3 py-2" value={provider} onChange={(event) => setProvider(event.target.value)}>
            {["bridge", "powens", "tink", "plaid", "pennylane", "sage"].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white" onClick={start}>Demarrer connexion</button>
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
      <PageTitle title="Sante connecteurs V4" subtitle="Vue operationnelle provider, syncs, webhooks, erreurs et rate limits." />
      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Connectes" value={String(data?.summary?.connected ?? 0)} tone="good" />
        <KpiCard label="En erreur" value={String(data?.summary?.errors ?? 0)} tone={(data?.summary?.errors ?? 0) > 0 ? "risk" : "good"} />
        <KpiCard label="Expires" value={String(data?.summary?.expired ?? 0)} tone={(data?.summary?.expired ?? 0) > 0 ? "risk" : "good"} />
        <KpiCard label="Deconnectes" value={String(data?.summary?.disconnected ?? 0)} />
      </div>
      <SimpleTable rows={data?.connectors ?? []} columns={[["provider", "Provider"], ["type", "Type"], ["name", "Nom"], ["status", "Statut", statusBadge], ["lastSyncAt", "Dernier sync"], ["errorMessage", "Erreur"]]} />
    </section>
  );
}

export function ProviderErrorsPage() {
  const { rows } = useRows("/provider-errors");
  return <TablePage title="Erreurs provider" subtitle="Erreurs normalisees avec action utilisateur, retry et diagnostic technique." rows={rows} columns={[
    ["provider", "Provider"],
    ["errorCategory", "Categorie"],
    ["userMessage", "Message"],
    ["retryable", "Retry"],
    ["requiresUserAction", "Action utilisateur"],
    ["createdAt", "Date"]
  ]} />;
}

export function ProviderWebhooksPage() {
  const { rows } = useRows("/connector-health/webhooks");
  return <TablePage title="Webhooks provider" subtitle="Evenements entrants deduplicables et validables par signature." rows={rows} columns={[
    ["provider", "Provider"], ["eventType", "Type"], ["externalEventId", "Event ID"], ["signatureValid", "Signature"], ["status", "Statut"], ["receivedAt", "Recu"]
  ]} />;
}

export function ProviderRateLimitsPage() {
  const { rows } = useRows("/connector-health/rate-limits");
  return <TablePage title="Rate limits" subtitle="Etat des quotas provider et throttling." rows={rows} columns={[
    ["provider", "Provider"], ["connectorId", "Connecteur"], ["remaining", "Restant"], ["resetAt", "Reset"], ["isThrottled", "Throttle"]
  ]} />;
}

export function DuplicatesPage() {
  const { rows } = useRows("/duplicates");
  return <TablePage title="Doublons multi-source" subtitle="Doublons potentiels entre CSV, banque, compta et saisie manuelle." rows={rows} columns={[
    ["entityType", "Entite"], ["sourceAType", "Source A"], ["sourceBType", "Source B"], ["confidenceScore", "Score"], ["reason", "Raison"], ["status", "Statut"]
  ]} />;
}

export function DataSourcePoliciesPage() {
  return <CrudPage title="Sources de verite" path="/data-source-policies" initial={{ organizationId: "", domain: "bank_transactions", primarySource: "bank_provider", conflictResolution: "manual" }} fields={[
    { name: "organizationId", label: "Organisation ID" }, { name: "domain", label: "Domaine" }, { name: "primarySource", label: "Source primaire" }, { name: "conflictResolution", label: "Resolution conflit" }
  ]} columns={[{ key: "domain", label: "Domaine" }, { key: "primarySource", label: "Source" }, { key: "conflictResolution", label: "Conflit" }]} />;
}

export function ConnectorCompliancePage() {
  const { data } = useObject("/compliance/connectors");
  return (
    <section className="space-y-5">
      <PageTitle title="Conformite connecteurs" subtitle="Tokens masques, scopes, environnements, consentements et responsabilites." />
      <SimpleTable rows={data?.connectors ?? []} columns={[["provider", "Provider"], ["type", "Type"], ["status", "Statut", statusBadge], ["configuration", "Configuration", (value: any) => value?.environment ?? "n/a"], ["lastSyncAt", "Dernier sync"]]} />
      <SimpleTable rows={data?.tokens ?? []} columns={[["provider", "Provider"], ["connectorId", "Connecteur"], ["tokenType", "Type"], ["expiresAt", "Expiration"], ["accessTokenEncrypted", "Access token"], ["refreshTokenEncrypted", "Refresh token"]]} />
    </section>
  );
}

export function ConsentCompliancePage() {
  const { rows } = useRows("/compliance/consents");
  return <TablePage title="Consentements reels" subtitle="Suivi des consentements bancaires et revocation." rows={rows} columns={[
    ["provider", "Provider"], ["status", "Statut", statusBadge], ["grantedBy", "Accorde par"], ["grantedAt", "Accorde le"], ["expiresAt", "Expire le"], ["revokedAt", "Revoque le"]
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

function SimpleTable({ rows, columns }: { rows: any[]; columns: any[] }) {
  const normalized = useMemo(() => rows ?? [], [rows]);
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-surface text-left text-xs uppercase text-muted"><tr>{columns.map((column: any) => <th key={column[0]} className="px-3 py-3">{column[1]}</th>)}</tr></thead>
        <tbody>
          {normalized.map((row, index) => <tr key={row.id ?? row.provider ?? index} className="border-t border-line">{columns.map((column: any) => <td key={column[0]} className="px-3 py-3">{column[2] ? column[2](row[column[0]], row) : String(row[column[0]] ?? "")}</td>)}</tr>)}
          {!normalized.length ? <tr><td className="px-3 py-8 text-center text-muted" colSpan={columns.length}>Aucune donnee</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
