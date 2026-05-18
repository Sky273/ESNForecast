import { useMemo, useState } from "react";
import { API_URL, api } from "../../api";
import { DataOriginBadge } from "../../components/DataOriginBadge";
import { InfoPanel } from "../../components/InfoPanel";
import { KpiCard } from "../../components/KpiCard";
import { PageHeader, StatusBadge } from "../../components/PageHeader";
import { useApi } from "../../hooks/useApi";
import userGuideMarkdown from "../../content/user-guide.md?raw";

function tone(status: string) {
  if (["success", "operational", "active", "stable", "completed"].includes(status)) return "good" as const;
  if (["failed", "critical", "error", "open"].includes(status)) return "risk" as const;
  if (["retrying", "partial_success", "warning", "beta", "degraded"].includes(status)) return "warn" as const;
  return "neutral" as const;
}

function Table({ rows, columns }: { rows: any[]; columns: { key: string; label: string; render?: (row: any) => any }[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="min-w-full divide-y divide-line text-sm">
        <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
          <tr>{columns.map((column) => <th key={column.key} className="px-3 py-2 font-medium">{column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, index) => (
            <tr key={row.id ?? index} className="hover:bg-surface/60">
              {columns.map((column) => <td key={column.key} className="px-3 py-2 align-top">{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
          {!rows.length ? <tr><td className="px-3 py-8 text-center text-muted" colSpan={columns.length}>Aucune donnée.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function reportPdfLink(row: any) {
  const endpoint = row?.resultSummary?.sourceEndpoint;
  if (row?.type !== "report_pdf" || row?.status !== "success" || typeof endpoint !== "string") return "-";
  return (
    <a className="rounded-md border border-line px-2 py-1 text-xs text-brand" href={`${API_URL}${endpoint.replace(/^\/api/, "")}`} target="_blank" rel="noreferrer">
      Ouvrir PDF
    </a>
  );
}

function jobOriginKind(row: any) {
  if (row.triggeredBy === "user") return "manual";
  if (row.triggeredBy === "webhook" || row.type === "connector_sync") return "provider";
  if (row.type === "reforecast") return "reforecast";
  return "calculated";
}

function jobOriginLabel(row: any) {
  if (row.triggeredBy === "user") return "Utilisateur";
  if (row.triggeredBy === "webhook") return "Webhook";
  if (row.type === "connector_sync") return "Connecteur";
  if (row.type === "reforecast") return "Reforecast";
  return "Job";
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

function formatBytes(value: number | null | undefined) {
  const bytes = Number(value ?? 0);
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("fr-FR") : "-";
}

export function ObservabilityPage() {
  const { data: summary } = useApi<any>("/observability/summary");
  const { data: logs } = useApi<any[]>("/observability/logs");
  const { data: errors } = useApi<any[]>("/observability/errors");
  const { data: slow } = useApi<any[]>("/observability/slow-requests");

  return (
    <>
      <PageHeader title="Observabilité" description="Vue opérationnelle des logs, erreurs, latences, jobs et connecteurs." />
      <InfoPanel title="Lecture opérationnelle">Cet écran aide à diagnostiquer rapidement un incident. Utilise le correlationId, la route et la durée pour relier une erreur utilisateur aux logs applicatifs.</InfoPanel>
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <KpiCard label="Logs collectés" value={String(summary?.logs ?? "-")} />
        <KpiCard label="Erreurs ouvertes" value={String(summary?.openErrors ?? "-")} tone={(summary?.openErrors ?? 0) ? "risk" : "good"} />
        <KpiCard label="Erreurs connecteurs" value={String(summary?.connectorErrors ?? "-")} />
        <KpiCard label="Snapshots lenteur" value={String(summary?.slowRequests?.length ?? "-")} />
      </div>
      <Panel title="Erreurs récentes">
        <Table rows={errors ?? []} columns={[
          { key: "code", label: "Code" },
          { key: "severity", label: "Sévérité", render: (row) => <StatusBadge label={row.severity} tone={tone(row.severity)} /> },
          { key: "message", label: "Message" },
          { key: "correlationId", label: "Correlation" }
        ]} />
      </Panel>
      <Panel title="Logs récents">
        <Table rows={logs ?? []} columns={[
          { key: "level", label: "Niveau", render: (row) => <StatusBadge label={row.level} tone={tone(row.level)} /> },
          { key: "service", label: "Service" },
          { key: "route", label: "Route" },
          { key: "durationMs", label: "Durée ms" },
          { key: "message", label: "Message" }
        ]} />
      </Panel>
      <Panel title="Requêtes lentes">
        <Table rows={slow ?? []} columns={[
          { key: "route", label: "Route" },
          { key: "metric", label: "Métrique" },
          { key: "value", label: "Valeur" },
          { key: "unit", label: "Unité" }
        ]} />
      </Panel>
    </>
  );
}

export function JobsPage({ scenarioId, horizon }: { scenarioId?: string; horizon?: number } = {}) {
  const { data: jobs, refetch } = useApi<any[]>("/jobs");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const launchReforecast = async () => {
    setActionError("");
    setActionMessage("");
    try {
      await api("/reforecast/recalculate", { method: "POST", body: JSON.stringify({}) });
      setActionMessage("Job reforecast lancé. La ligne sera mise à jour lorsque l'exécution sera terminée.");
      await refetch();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Le reforecast n'a pas pu être lancé.");
    }
  };
  const launchReportPdf = async () => {
    setActionError("");
    setActionMessage("");
    try {
      await api("/jobs/report-pdf", { method: "POST", body: JSON.stringify({ report: "codir", scenarioId, horizon }) });
      setActionMessage("Job rapport PDF lancé. Le lien PDF apparaîtra dans la colonne Sortie lorsque la génération sera terminée.");
      await refetch();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Le rapport PDF n'a pas pu être lancé.");
    }
  };
  const launchConnectorSync = async () => {
    setActionError("");
    setActionMessage("");
    try {
      await api("/jobs/connector-sync", { method: "POST", body: JSON.stringify({ mode: "incremental" }) });
      setActionMessage("Job de synchronisation connecteurs lancé. Les imports et mises à jour seront visibles dans les runs.");
      await refetch();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "La synchronisation connecteurs n'a pas pu être lancée.");
    }
  };
  const retry = async (row: any) => {
    setActionError("");
    setActionMessage("");
    try {
      await api(`/jobs/${row.id}/${["connector_sync", "reforecast", "report_pdf"].includes(row.type) ? "run" : "retry"}`, { method: "POST" });
      await refetch();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Le job n'a pas pu être relancé.");
    }
  };
  const cancel = async (id: string) => { await api(`/jobs/${id}/cancel`, { method: "POST" }); await refetch(); };

  return (
    <>
      <PageHeader title="Supervision jobs" description="Suivi des synchronisations, imports, projections, reforecast et rapports." actions={<><button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={launchReforecast}>Lancer un reforecast</button><button className="rounded-md border border-line bg-white px-3 py-2 text-sm font-medium" onClick={launchConnectorSync}>Lancer sync connecteurs</button><button className="rounded-md border border-line bg-white px-3 py-2 text-sm font-medium" onClick={launchReportPdf}>Générer rapport CODIR PDF</button></>} />
      {actionMessage ? <div className="mb-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">{actionMessage}</div> : null}
      {actionError ? <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div> : null}
      <Table rows={jobs ?? []} columns={[
        { key: "type", label: "Type" },
        { key: "origin", label: "Origine", render: (row) => <DataOriginBadge kind={jobOriginKind(row)} label={jobOriginLabel(row)} details={[row.triggeredBy ? `Déclenché par ${row.triggeredBy}` : undefined, row.correlationId ? `Correlation ${row.correlationId}` : undefined]} /> },
        { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> },
        { key: "progressPercent", label: "Progression", render: (row) => `${row.progressPercent ?? 0}%` },
        { key: "durationMs", label: "Duree ms" },
        { key: "errorMessage", label: "Erreur" },
        { key: "resultSummary", label: "Sortie", render: (row) => reportPdfLink(row) },
        { key: "actions", label: "Actions", render: (row) => (
          <div className="flex gap-2">
            <button className="rounded-md border border-line px-2 py-1 text-xs" onClick={() => retry(row)}>{["connector_sync", "reforecast", "report_pdf"].includes(row.type) ? "Exécuter" : "Mettre en retry"}</button>
            <button className="rounded-md border border-line px-2 py-1 text-xs" onClick={() => cancel(row.id)}>Annuler</button>
          </div>
        ) }
      ]} />
    </>
  );
}

export function SystemStatusPage() {
  const { data } = useApi<any>("/system/status");
  return (
    <>
      <PageHeader title="Statut système" description="État applicatif, base, workers, connecteurs et erreurs récentes." />
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <KpiCard label="État global" value={data?.status ?? "-"} tone={data?.status === "operational" ? "good" : "risk"} />
        <KpiCard label="API" value={data?.api ?? "-"} />
        <KpiCard label="Jobs en erreur" value={String(data?.failedJobs ?? "-")} tone={(data?.failedJobs ?? 0) ? "risk" : "good"} />
        <KpiCard label="Erreurs ouvertes" value={String(data?.recentErrors ?? "-")} tone={(data?.recentErrors ?? 0) ? "risk" : "good"} />
      </div>
      <Table rows={data?.connectors ?? []} columns={[{ key: "status", label: "Statut" }, { key: "_count", label: "Connecteurs", render: (row) => row._count }]} />
    </>
  );
}

export function BackofficeSupportPage() {
  const { data: organizations } = useApi<any[]>("/backoffice/organizations");
  const organization = organizations?.[0];
  const { data: detail } = useApi<any>(organization ? `/backoffice/organizations/${organization.id}` : "");
  const { data: diagnostics } = useApi<any>(organization ? `/backoffice/organizations/${organization.id}/diagnostics` : "");

  return (
    <>
      <PageHeader title="Backoffice support" description="Diagnostic organisation, connecteurs, jobs et erreurs sans exposer les secrets." />
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <KpiCard label="Organisations" value={String(organizations?.length ?? "-")} />
        <KpiCard label="Utilisateurs" value={String(detail?.users ?? "-")} />
        <KpiCard label="Jobs à traiter" value={String(diagnostics?.failedOrRetryingJobs ?? "-")} tone={(diagnostics?.failedOrRetryingJobs ?? 0) ? "risk" : "good"} />
        <KpiCard label="Erreurs ouvertes" value={String(diagnostics?.openErrors ?? "-")} tone={(diagnostics?.openErrors ?? 0) ? "risk" : "good"} />
      </div>
      <Panel title="Organisations">
        <Table rows={organizations ?? []} columns={[{ key: "name", label: "Nom" }, { key: "slug", label: "Slug" }, { key: "createdAt", label: "Création" }]} />
      </Panel>
      <Panel title="Scores qualité">
        <Table rows={diagnostics?.qualityScores ?? []} columns={[{ key: "domain", label: "Domaine" }, { key: "score", label: "Score" }, { key: "issuesCount", label: "Issues" }, { key: "criticalCount", label: "Critiques" }]} />
      </Panel>
    </>
  );
}

export function BackupsPage() {
  const { data: backups, refetch } = useApi<any[]>("/backups");
  const { data: exports, refetch: refetchExports } = useApi<any[]>("/exports");
  const { data: policies } = useApi<any[]>("/retention-policies");
  const createBackup = async () => { await api("/backups", { method: "POST", body: JSON.stringify({ type: "full_organization" }) }); refetch(); };
  const createExport = async () => { await api("/exports/full", { method: "POST", body: JSON.stringify({ format: "json" }) }); refetchExports(); };
  const dryRun = async () => { await api("/restores/dry-run", { method: "POST", body: JSON.stringify({}) }); refetch(); };

  return (
    <>
      <PageHeader title="Sauvegardes et exports" description="Sauvegarde JSON, restauration dry-run, exports complets et rétention." actions={
        <>
          <button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={createBackup}>Générer sauvegarde</button>
          <button className="rounded-md border border-line px-3 py-2 text-sm" onClick={createExport}>Créer export complet</button>
          <button className="rounded-md border border-line px-3 py-2 text-sm" onClick={dryRun}>Dry-run restauration</button>
        </>
      } />
      <Panel title="Sauvegardes">
        <Table rows={backups ?? []} columns={[{ key: "type", label: "Type" }, { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }, { key: "sizeBytes", label: "Taille", render: (row) => formatBytes(row.sizeBytes) }, { key: "createdAt", label: "Créée le", render: (row) => formatDate(row.createdAt) }, { key: "id", label: "Actions", render: (row) => <a className="rounded border border-line px-2 py-1 text-xs" href={`/api/backups/${row.id}/download`}>Télécharger</a> }]} />
      </Panel>
      <Panel title="Exports complets">
        <Table rows={exports ?? []} columns={[{ key: "type", label: "Type" }, { key: "format", label: "Format" }, { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }, { key: "sizeBytes", label: "Taille", render: (row) => formatBytes(row.sizeBytes) }, { key: "createdAt", label: "Créé le", render: (row) => formatDate(row.createdAt) }, { key: "id", label: "Actions", render: (row) => <a className="rounded border border-line px-2 py-1 text-xs" href={`/api/exports/${row.id}/download`}>Télécharger</a> }]} />
      </Panel>
      <Panel title="Politiques de retention">
        <Table rows={policies ?? []} columns={[{ key: "domain", label: "Domaine" }, { key: "retentionDays", label: "Jours" }, { key: "action", label: "Action" }, { key: "isActive", label: "Actif", render: (row) => row.isActive ? "Oui" : "Non" }]} />
      </Panel>
    </>
  );
}

export function SecurityPage() {
  const { data: events } = useApi<any[]>("/security/events");
  const { data: attempts } = useApi<any[]>("/security/login-attempts");
  const { data: access } = useApi<any[]>("/security/sensitive-access");
  return (
    <>
      <PageHeader title="Sécurité" description="Connexions, tentatives échouées, accès sensibles et événements critiques." />
      <Panel title="événements sécurité">
        <Table rows={events ?? []} columns={[{ key: "type", label: "Type" }, { key: "severity", label: "Sévérité", render: (row) => <StatusBadge label={row.severity} tone={tone(row.severity)} /> }, { key: "message", label: "Message" }, { key: "correlationId", label: "Correlation" }]} />
      </Panel>
      <Panel title="Tentatives de connexion">
        <Table rows={attempts ?? []} columns={[{ key: "email", label: "Email" }, { key: "success", label: "Succès", render: (row) => row.success ? "Oui" : "Non" }, { key: "failureReason", label: "Motif" }, { key: "createdAt", label: "Date" }]} />
      </Panel>
      <Panel title="Accès données sensibles">
        <Table rows={access ?? []} columns={[{ key: "entityType", label: "Entité" }, { key: "action", label: "Action" }, { key: "sensitivityLevel", label: "Sensibilité" }, { key: "userId", label: "Utilisateur" }]} />
      </Panel>
    </>
  );
}

export function FeatureFlagsPage() {
  const { data: flags, refetch } = useApi<any[]>("/feature-flags");
  const emptyFlag = { key: "", name: "", description: "", enabledGlobally: false, rolloutPercent: 0, status: "experimental" };
  const [draft, setDraft] = useState<any>(emptyFlag);
  const [editingId, setEditingId] = useState("");
  const update = (key: string, value: any) => setDraft({ ...draft, [key]: value });
  const save = async () => {
    await api(editingId ? `/feature-flags/${editingId}` : "/feature-flags", { method: editingId ? "PUT" : "POST", body: JSON.stringify(draft) });
    setDraft(emptyFlag);
    setEditingId("");
    refetch();
  };
  const edit = (flag: any) => {
    setDraft({ key: flag.key, name: flag.name, description: flag.description, enabledGlobally: flag.enabledGlobally, rolloutPercent: flag.rolloutPercent, status: flag.status });
    setEditingId(flag.id);
  };
  const remove = async (id: string) => {
    await api(`/feature-flags/${id}`, { method: "DELETE" });
    refetch();
  };
  return (
    <>
      <PageHeader title="Feature flags" description="Activation progressive des modules stables, beta et expérimentaux." actions={<button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={save}>{editingId ? "Enregistrer" : "Créer"}</button>} />
      <div className="mb-5 grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-3">
        <label className="text-sm">Clé<input className="mt-1 w-full rounded-md border border-line px-3 py-2" value={draft.key} onChange={(event) => update("key", event.target.value)} /></label>
        <label className="text-sm">Nom<input className="mt-1 w-full rounded-md border border-line px-3 py-2" value={draft.name} onChange={(event) => update("name", event.target.value)} /></label>
        <label className="text-sm">Statut<select className="mt-1 w-full rounded-md border border-line px-3 py-2" value={draft.status} onChange={(event) => update("status", event.target.value)}>{["experimental", "beta", "stable", "deprecated"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-sm">Rollout %<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="number" value={draft.rolloutPercent} onChange={(event) => update("rolloutPercent", Number(event.target.value))} /></label>
        <label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={draft.enabledGlobally} onChange={(event) => update("enabledGlobally", event.target.checked)} /> Active globalement</label>
        <label className="text-sm md:col-span-3">Description<textarea className="mt-1 w-full rounded-md border border-line px-3 py-2" value={draft.description} onChange={(event) => update("description", event.target.value)} /></label>
      </div>
      <Table rows={flags ?? []} columns={[
        { key: "key", label: "Clé" },
        { key: "name", label: "Nom" },
        { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> },
        { key: "enabledGlobally", label: "Global", render: (row) => row.enabledGlobally ? "Oui" : "Non" },
        { key: "rolloutPercent", label: "Rollout", render: (row) => `${row.rolloutPercent}%` },
        { key: "actions", label: "Actions", render: (row) => <div className="flex gap-2"><button className="rounded border border-line px-2 py-1 text-xs" onClick={() => edit(row)}>Éditer</button><button className="rounded border border-line px-2 py-1 text-xs text-red-700" onClick={() => remove(row.id)}>Supprimer</button></div> }
      ]} />
    </>
  );
}

export function OnboardingPage() {
  const { data } = useApi<any>("/onboarding");
  const steps = useMemo(() => Object.entries(data?.steps ?? {}).map(([key, value]) => ({ key, value })), [data]);
  const complèted = steps.filter((step) => step.value).length;
  return (
    <>
      <PageHeader title="Onboarding" description="Checklist de configuration initiale pour rendre le pilotage exploitable." />
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <KpiCard label="étapes terminées" value={`${complèted}/${steps.length || 0}`} />
        <KpiCard label="Banque connectée" value={data?.steps?.bank ? "Oui" : "Non"} tone={data?.steps?.bank ? "good" : "risk"} />
        <KpiCard label="Premier rapport CODIR" value={data?.steps?.codirReport ? "Oui" : "Non"} />
      </div>
      <Table rows={steps} columns={[{ key: "key", label: "étape" }, { key: "value", label: "Statut", render: (row) => <StatusBadge label={row.value ? "terminée" : "à faire"} tone={row.value ? "good" : "warn"} /> }]} />
    </>
  );
}

export function HelpPage({ pageKey = "dashboard" }: { pageKey?: string }) {
  const { data } = useApi<any[]>(`/help/contextual?page=${pageKey}`);
  return (
    <>
      <PageHeader title="Aide contextuelle" description="Définitions courtes et actions recommandées sur les Écrans complexes." />
      <div className="grid gap-3 md:grid-cols-2">
        {(data ?? []).map((article) => (
          <article key={article.id} className="rounded-lg border border-line bg-white p-4">
            <div className="mb-2 text-xs uppercase text-muted">{article.category}</div>
            <h2 className="text-base font-semibold">{article.title}</h2>
            <p className="mt-2 text-sm text-muted">{article.body}</p>
          </article>
        ))}
      </div>
    </>
  );
}

type GuideSection = {
  id: string;
  title: string;
  level: number;
  lines: string[];
};

export function UserGuidePage() {
  const sections = useMemo(() => parseGuide(userGuideMarkdown), []);
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const activeSection = sections.find((section) => section.id === activeId) ?? sections[0];

  return (
    <>
      <PageHeader title="Guide utilisateur" description="Mode d'emploi détaillé du fonctionnement d'ESN Forecast et des principaux parcours métier." />
      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-lg border border-line bg-white p-3 xl:sticky xl:top-4 xl:self-start">
          <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-muted">Sections</div>
          <nav className="max-h-[70vh] space-y-1 overflow-y-auto">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${activeSection?.id === section.id ? "bg-emerald-50 font-medium text-brand" : "text-slate-700 hover:bg-surface"}`}
                onClick={() => setActiveId(section.id)}
              >
                {section.title}
              </button>
            ))}
          </nav>
        </aside>
        <article className="rounded-lg border border-line bg-white p-5">
          {activeSection ? <GuideSectionView section={activeSection} /> : <p className="text-sm text-muted">Guide indisponible.</p>}
        </article>
      </div>
    </>
  );
}

export function PerformancePage() {
  const { data } = useApi<any[]>("/observability/slow-requests");
  return (
    <>
      <PageHeader title="Performance" description="Routes et calculs les plus lents pour prioriser les optimisations." />
      <Table rows={data ?? []} columns={[{ key: "route", label: "Route" }, { key: "metric", label: "Métrique" }, { key: "value", label: "Valeur" }, { key: "unit", label: "Unité" }, { key: "capturedAt", label: "Mesure" }]} />
    </>
  );
}

function parseGuide(markdown: string): GuideSection[] {
  const sections: GuideSection[] = [];
  let current: GuideSection | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^(#{1,2})\s+(.+)$/.exec(line);
    if (heading) {
      if (current) sections.push(current);
      const title = heading[2].trim();
      current = { id: slugify(title), title, level: heading[1].length, lines: [] };
      continue;
    }
    if (!current) continue;
    current.lines.push(line);
  }
  if (current) sections.push(current);
  return sections;
}

function GuideSectionView({ section }: { section: GuideSection }) {
  const blocks = toBlocks(section.lines);
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-normal text-slate-950">{section.title}</h1>
      <div className="mt-5 space-y-4 text-sm leading-6 text-slate-700">
        {blocks.map((block, index) => renderGuideBlock(block, index))}
      </div>
    </div>
  );
}

type GuideBlock = { type: "paragraph" | "list" | "ordered" | "heading"; content: string[] };

function toBlocks(lines: string[]): GuideBlock[] {
  const blocks: GuideBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let ordered: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", content: [paragraph.join(" ")] });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ type: "list", content: list });
    list = [];
  };
  const flushOrdered = () => {
    if (ordered.length) blocks.push({ type: "ordered", content: ordered });
    ordered = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      flushOrdered();
      continue;
    }
    const subHeading = /^###\s+(.+)$/.exec(line);
    if (subHeading) {
      flushParagraph();
      flushList();
      flushOrdered();
      blocks.push({ type: "heading", content: [subHeading[1]] });
      continue;
    }
    const bullet = /^-\s+(.+)$/.exec(line);
    if (bullet) {
      flushParagraph();
      flushOrdered();
      list.push(bullet[1]);
      continue;
    }
    const numbered = /^\d+\.\s+(.+)$/.exec(line);
    if (numbered) {
      flushParagraph();
      flushList();
      ordered.push(numbered[1]);
      continue;
    }
    flushList();
    flushOrdered();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  flushOrdered();
  return blocks;
}

function renderGuideBlock(block: GuideBlock, index: number) {
  if (block.type === "heading") return <h2 key={index} className="pt-2 text-lg font-semibold text-slate-950">{block.content[0]}</h2>;
  if (block.type === "list") return <ul key={index} className="list-disc space-y-1 pl-5">{block.content.map((item) => <li key={item}>{item}</li>)}</ul>;
  if (block.type === "ordered") return <ol key={index} className="list-decimal space-y-1 pl-5">{block.content.map((item) => <li key={item}>{item}</li>)}</ol>;
  return <p key={index}>{block.content[0]}</p>;
}

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
