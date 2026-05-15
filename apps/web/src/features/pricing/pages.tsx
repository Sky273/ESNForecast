import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FormEvent, ReactNode, useState } from "react";
import { api } from "../../api";
import { KpiCard } from "../../components/KpiCard";
import { PageHeader, StatusBadge } from "../../components/PageHeader";
import { useApi } from "../../hooks/useApi";

const money = (value: number | null | undefined) => `${Math.round(value ?? 0).toLocaleString("fr-FR")} EUR`;
const percent = (value: number | null | undefined) => `${Math.round((value ?? 0) * 100)} %`;
const tone = (status: string) => {
  if (["healthy", "active", "renegotiated", "accepted"].includes(status)) return "good" as const;
  if (["critical", "underpriced", "blocked"].includes(status)) return "risk" as const;
  if (["watch", "renegotiation_recommended", "high", "medium", "action_planned", "negotiation_in_progress"].includes(status)) return "warn" as const;
  return "neutral" as const;
};
const kpiTone = (status: string): "default" | "good" | "risk" => {
  if (["healthy", "active", "renegotiated", "accepted"].includes(status)) return "good";
  if (["critical", "underpriced", "blocked"].includes(status)) return "risk";
  return "default";
};

function Table({ rows, columns }: { rows: any[]; columns: { key: string; label: string; render?: (row: any) => any }[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="min-w-full divide-y divide-line text-sm">
        <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
          <tr>{columns.map((column) => <th key={column.key} className="px-3 py-2 font-medium">{column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, index) => (
            <tr key={row.id ?? row.missionId ?? index} className="hover:bg-surface/60">
              {columns.map((column) => <td key={column.key} className="px-3 py-2 align-top">{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
          {!rows.length ? <tr><td className="px-3 py-8 text-center text-muted" colSpan={columns.length}>Aucune donnee.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function ActionButton({ children, tone = "neutral", onClick }: { children: ReactNode; tone?: "neutral" | "risk"; onClick: () => void }) {
  return (
    <button type="button" className={`rounded-md border border-line px-2 py-1 text-xs ${tone === "risk" ? "text-risk" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

const missionLabel = (row: any) => row.missionLabel ?? row.missionTitle ?? row.mission?.title ?? row.missionId ?? "-";

export function PricingDashboardPage() {
  const { data, refetch } = useApi<any>("/pricing/dashboard");
  const recalculate = async () => { await api("/pricing/renegotiation-candidates/recalculate", { method: "POST" }); refetch(); };
  const chart = [
    { label: "Missions", value: data?.missionsAnalyzed ?? 0 },
    { label: "Saines", value: data?.healthyMissions ?? 0 },
    { label: "Sous-margées", value: data?.underpricedMissions ?? 0 },
    { label: "à renégocier", value: data?.renegotiationCandidates ?? 0 }
  ];
  return (
    <>
      <PageHeader title="Dashboard pricing" description="Pilotage des TJM, marges mission, gains potentiels et priorités de renégociation." actions={<button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={recalculate}>Recalculer</button>} />
      <div className="mb-5 grid gap-3 md:grid-cols-6">
        <KpiCard label="Missions analysées" value={data?.missionsAnalyzed ?? 0} />
        <KpiCard label="Missions saines" value={data?.healthyMissions ?? 0} tone="good" />
        <KpiCard label="Sous-margées" value={data?.underpricedMissions ?? 0} tone={(data?.underpricedMissions ?? 0) ? "risk" : "good"} />
        <KpiCard label="à renégocier" value={data?.renegotiationCandidates ?? 0} tone={(data?.renegotiationCandidates ?? 0) ? "default" : "good"} />
        <KpiCard label="Gain mensuel" value={money(data?.potentialMonthlyGain)} />
        <KpiCard label="Gain annuel" value={money(data?.potentialAnnualGain)} />
      </div>
      <div className="mb-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-line bg-white p-4">
          <h2 className="mb-4 font-semibold">Repartition pricing</h2>
          <div className="h-64">
            <ResponsiveContainer><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#0f766e" /></BarChart></ResponsiveContainer>
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Top priorites</h2>
          <Table rows={data?.topCandidates ?? []} columns={[
            { key: "missionLabel", label: "Mission", render: missionLabel },
            { key: "priorityScore", label: "Score" },
            { key: "severity", label: "Sévérité", render: (row) => <StatusBadge label={row.severity} tone={tone(row.severity)} /> },
            { key: "currentDailyRate", label: "TJM actuel", render: (row) => money(row.currentDailyRate) },
            { key: "recommendedDailyRate", label: "TJM cible", render: (row) => money(row.recommendedDailyRate) },
            { key: "monthlyImpactAmount", label: "Gain mensuel", render: (row) => money(row.monthlyImpactAmount) }
          ]} />
        </div>
      </div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Missions a surveiller</h2>
      <Table rows={data?.underpriced ?? []} columns={pricingColumns()} />
    </>
  );
}

export function PricingSimulatorPage() {
  const { data: missions } = useApi<any[]>("/missions");
  const { data: simulations, refetch } = useApi<any[]>("/pricing/simulations");
  const firstMission = missions?.[0]?.id ?? "";
  const [missionId, setMissionId] = useState("");
  const [simulationName, setSimulationName] = useState("Simulation interactive");
  const [editingSimulationId, setEditingSimulationId] = useState("");
  const [dailyRate, setDailyRate] = useState(720);
  const [discountRate, setDiscountRate] = useState(0.05);
  const [result, setResult] = useState<any | null>(null);
  const run = async () => {
    const targetMissionId = missionId || firstMission;
    if (!targetMissionId) return;
    setResult(await api("/pricing/simulate", { method: "POST", body: JSON.stringify({ missionId: targetMissionId, simulatedDailyRate: dailyRate, discountRate, name: simulationName }) }));
    refetch();
  };
  const updateSimulation = async () => {
    if (!editingSimulationId) return;
    await api("/pricing/simulations/" + editingSimulationId, { method: "PUT", body: JSON.stringify({ name: simulationName }) });
    setEditingSimulationId("");
    refetch();
  };
  const removeSimulation = async (id: string) => {
    await api("/pricing/simulations/" + id, { method: "DELETE" });
    if (editingSimulationId === id) setEditingSimulationId("");
    refetch();
  };
  return (
    <>
      <PageHeader title="Simulateur pricing" description="Simuler un TJM, une remise et mesurer l'impact sur marge, TJM plancher et TJM recommande." actions={<div className="flex gap-2"><button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={run}>Simuler</button>{editingSimulationId ? <button className="rounded-md border border-line px-3 py-2 text-sm" onClick={updateSimulation}>Renommer</button> : null}</div>} />
      <div className="mb-5 grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-4">
        <label className="text-sm">Nom simulation<input className="mt-1 w-full rounded-md border border-line px-3 py-2" value={simulationName} onChange={(event) => setSimulationName(event.target.value)} /></label>
        <label className="text-sm">Mission<select className="mt-1 w-full rounded-md border border-line px-3 py-2" value={missionId || firstMission} onChange={(event) => setMissionId(event.target.value)}>{(missions ?? []).map((mission) => <option key={mission.id} value={mission.id}>{mission.title}</option>)}</select></label>
        <label className="text-sm">TJM simule<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="number" value={dailyRate} onChange={(event) => setDailyRate(Number(event.target.value))} /></label>
        <label className="text-sm">Remise<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="number" step="0.01" value={discountRate} onChange={(event) => setDiscountRate(Number(event.target.value))} /></label>
      </div>
      {result ? <div className="grid gap-3 md:grid-cols-5">
        <KpiCard label="TJM apres remise" value={money(result.output?.simulatedDailyRate)} />
        <KpiCard label="CA simule" value={money(result.output?.revenue)} />
        <KpiCard label="Marge" value={percent(result.output?.currentMarginRate)} tone={kpiTone(result.output?.status)} />
        <KpiCard label="TJM plancher" value={money(result.output?.floorDailyRate)} />
        <KpiCard label="TJM recommande" value={money(result.output?.recommendedDailyRate)} />
      </div> : null}
      <h2 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-muted">Simulations enregistrees</h2>
      <Table rows={simulations ?? []} columns={[
        { key: "name", label: "Nom" },
        { key: "missionLabel", label: "Mission", render: missionLabel },
        { key: "createdAt", label: "Creee le", render: (row) => String(row.createdAt ?? "").slice(0, 10) },
        { key: "actions", label: "Actions", render: (row) => <div className="flex gap-2"><ActionButton onClick={() => { setEditingSimulationId(row.id); setSimulationName(row.name); }}>Editer</ActionButton><ActionButton tone="risk" onClick={() => removeSimulation(row.id)}>Supprimer</ActionButton></div> }
      ]} />
    </>
  );
}

export function MissionPricingProfilePage() {
  const { data: missions } = useApi<any[]>("/missions");
  const [selectedMissionId, setSelectedMissionId] = useState("");
  const missionId = selectedMissionId || missions?.[0]?.id || "";
  const { data } = useApi<any>(missionId ? `/pricing/missions/${missionId}` : "");
  const [recalculated, setRecalculated] = useState<any | null>(null);
  const profile = recalculated?.missionId === missionId ? recalculated : data;
  const recalculate = async () => {
    if (!missionId) return;
    setRecalculated(await api(`/pricing/missions/${missionId}/recalculate`, { method: "POST" }));
  };
  return (
    <>
      <PageHeader title="Profil pricing mission" description="Lecture détaillée du coût complet, TJM plancher, TJM recommandé et écart de marge." />
      <div className="mb-5 rounded-lg border border-line bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[320px] flex-1 text-sm">
            <span className="mb-1 block text-xs font-medium text-muted">Mission analysee</span>
            <select className="w-full rounded-md border border-line px-3 py-2" value={missionId} onChange={(event) => { setSelectedMissionId(event.target.value); setRecalculated(null); }}>
              {(missions ?? []).map((mission) => <option key={mission.id} value={mission.id}>{mission.client?.name ? `${mission.title} - ${mission.client.name}` : mission.title}</option>)}
            </select>
          </label>
          <button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={recalculate} disabled={!missionId}>Recalculer</button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Mission" value={profile?.missionTitle ?? "-"} />
        <KpiCard label="TJM actuel" value={money(profile?.currentDailyRate)} />
        <KpiCard label="TJM plancher" value={money(profile?.calculatedFloorDailyRate)} tone={(profile?.currentDailyRate ?? 0) < (profile?.calculatedFloorDailyRate ?? 0) ? "risk" : "default"} />
        <KpiCard label="TJM recommandé" value={money(profile?.recommendedDailyRate)} />
        <KpiCard label="Coût complet / jour" value={money(profile?.fullDailyCost)} />
        <KpiCard label="Marge actuelle" value={percent(profile?.currentMarginRate)} tone={kpiTone(profile?.pricingStatus ?? "")} />
        <KpiCard label="Impact mensuel" value={money(profile?.monthlyImpactAmount)} />
        <KpiCard label="Statut" value={profile?.pricingStatus ?? "-"} tone={kpiTone(profile?.pricingStatus ?? "")} />
      </div>
      {profile?.pricingStatus === "insufficient_data" ? (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Données insuffisantes pour calculer le pricing.</div>
          <p className="mt-1">Complète les affectations de cette mission avec des jours facturables, un TJM vente et des coûts ressource.</p>
          {profile?.missingData?.length ? <p className="mt-2">Champs manquants : {profile.missingData.join(", ")}</p> : null}
        </div>
      ) : null}
    </>
  );
}

export function UnderpricedMissionsPage() {
  const { data } = useApi<any[]>("/pricing/underpriced-missions");
  return <><PageHeader title="Missions sous-margées" description="Missions dont le TJM ou la marge ne couvre pas les seuils pricing." /><Table rows={data ?? []} columns={pricingColumns()} /></>;
}

export function RenegotiationCandidatesPage() {
  const { data, refetch } = useApi<any[]>("/pricing/renegotiation-candidates");
  const recalculate = async () => { await api("/pricing/renegotiation-candidates/recalculate", { method: "POST" }); refetch(); };
  const updateCandidate = async (id: string, payload: Record<string, unknown>) => { await api("/pricing/renegotiation-candidates/" + id, { method: "PUT", body: JSON.stringify(payload) }); refetch(); };
  const createAction = async (id: string) => { await api("/pricing/renegotiation-candidates/" + id + "/create-action", { method: "POST", body: JSON.stringify({}) }); refetch(); };
  const removeCandidate = async (id: string) => { await api("/pricing/renegotiation-candidates/" + id, { method: "DELETE" }); refetch(); };
  return (
    <>
      <PageHeader title="Missions a renegocier" description="Priorisation des missions a renegocier avec score explicable et gains attendus." actions={<button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={recalculate}>Recalculer</button>} />
      <Table rows={data ?? []} columns={[
        { key: "missionLabel", label: "Mission", render: missionLabel },
        { key: "reason", label: "Raison" },
        { key: "priorityScore", label: "Score" },
        { key: "severity", label: "Severite", render: (row) => <StatusBadge label={row.severity} tone={tone(row.severity)} /> },
        { key: "currentDailyRate", label: "TJM actuel", render: (row) => money(row.currentDailyRate) },
        { key: "targetDailyRate", label: "TJM cible", render: (row) => money(row.targetDailyRate) },
        { key: "annualizedImpactAmount", label: "Gain annuel", render: (row) => money(row.annualizedImpactAmount) },
        { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> },
        { key: "actions", label: "Actions", render: (row) => <div className="flex flex-wrap gap-2"><ActionButton onClick={() => createAction(row.id)}>Creer action</ActionButton><ActionButton onClick={() => updateCandidate(row.id, { status: "ignored" })}>Ignorer</ActionButton><ActionButton onClick={() => updateCandidate(row.id, { status: "renegotiated" })}>Renegociee</ActionButton><ActionButton tone="risk" onClick={() => removeCandidate(row.id)}>Supprimer</ActionButton></div> }
      ]} />
    </>
  );
}

export function PricingSettingsPage() {
  const { data, refetch } = useApi<any>("/pricing/settings");
  const [draft, setDraft] = useState<any | null>(null);
  const current = draft ?? data ?? {};
  const update = (key: string, value: any) => setDraft({ ...current, [key]: value });
  const save = async () => {
    await api("/pricing/settings", { method: "PUT", body: JSON.stringify(current) });
    setDraft(null);
    refetch();
  };
  return (
    <>
      <PageHeader title="Paramètres pricing" description="Marge cible, marge minimum, overhead, arrondis et seuils de renégociation." actions={<button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={save}>Enregistrer</button>} />
      <div className="mb-5 grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-3">
        <label className="text-sm">Marge cible<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="number" step="0.01" value={current.defaultTargetMarginRate ?? 0} onChange={(event) => update("defaultTargetMarginRate", Number(event.target.value))} /></label>
        <label className="text-sm">Marge minimum<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="number" step="0.01" value={current.minimumMarginRate ?? 0} onChange={(event) => update("minimumMarginRate", Number(event.target.value))} /></label>
        <label className="text-sm">Mode overhead<select className="mt-1 w-full rounded-md border border-line px-3 py-2" value={current.defaultOverheadAllocationMode ?? "none"} onChange={(event) => update("defaultOverheadAllocationMode", event.target.value)}>{["none", "flat_daily_amount", "percentage_of_direct_cost", "percentage_of_revenue", "monthly_fixed_pool"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-sm">Overhead journalier<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="number" value={current.defaultOverheadDailyAmount ?? 0} onChange={(event) => update("defaultOverheadDailyAmount", Number(event.target.value))} /></label>
        <label className="text-sm">Taux overhead<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="number" step="0.01" value={current.defaultOverheadRate ?? 0} onChange={(event) => update("defaultOverheadRate", Number(event.target.value))} /></label>
        <label className="text-sm">Arrondi<select className="mt-1 w-full rounded-md border border-line px-3 py-2" value={current.roundingMode ?? "nearest_10"} onChange={(event) => update("roundingMode", event.target.value)}>{["none", "nearest_5", "nearest_10", "nearest_50"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-sm">Seuil remise<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="number" step="0.01" value={current.defaultCommercialDiscountWarningRate ?? 0} onChange={(event) => update("defaultCommercialDiscountWarningRate", Number(event.target.value))} /></label>
        <label className="text-sm">Seuil renegociation<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="number" step="0.01" value={current.renegotiationMarginThreshold ?? 0} onChange={(event) => update("renegotiationMarginThreshold", Number(event.target.value))} /></label>
        <label className="text-sm">Période revue (mois)<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="number" value={current.renegotiationReviewPeriodMonths ?? 0} onChange={(event) => update("renegotiationReviewPeriodMonths", Number(event.target.value))} /></label>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard label="Marge cible" value={percent(current.defaultTargetMarginRate)} />
        <KpiCard label="Marge minimum" value={percent(current.minimumMarginRate)} />
        <KpiCard label="Mode overhead" value={current.defaultOverheadAllocationMode ?? "-"} />
        <KpiCard label="Taux overhead" value={percent(current.defaultOverheadRate)} />
        <KpiCard label="Arrondi TJM" value={current.roundingMode ?? "-"} />
        <KpiCard label="Seuil remise" value={percent(current.defaultCommercialDiscountWarningRate)} />
      </div>
    </>
  );
}

export function PricingHistoryPage() {
  const { data: missions } = useApi<any[]>("/missions");
  const { data: decisions, refetch: refetchDecisions } = useApi<any[]>("/pricing/decisions");
  const { data: exceptions, refetch: refetchExceptions } = useApi<any[]>("/pricing/margin-exceptions");
  const firstMissionId = missions?.[0]?.id ?? "";
  const [decisionId, setDecisionId] = useState("");
  const [decision, setDecision] = useState({ missionId: "", decisionType: "initial_pricing", previousDailyRate: 0, newDailyRate: 0, marginAfter: 0, reason: "" });
  const [exceptionId, setExceptionId] = useState("");
  const [exception, setException] = useState({ missionId: "", reason: "", approvedBy: "direction", targetReviewDate: new Date().toISOString().slice(0, 10), comment: "", status: "active" });
  const saveDecision = async (event: FormEvent) => {
    event.preventDefault();
    await api(decisionId ? "/pricing/decisions/" + decisionId : "/pricing/decisions", { method: decisionId ? "PUT" : "POST", body: JSON.stringify({ ...decision, missionId: decision.missionId || firstMissionId }) });
    setDecisionId("");
    setDecision({ missionId: "", decisionType: "initial_pricing", previousDailyRate: 0, newDailyRate: 0, marginAfter: 0, reason: "" });
    refetchDecisions();
  };
  const saveException = async (event: FormEvent) => {
    event.preventDefault();
    await api(exceptionId ? "/pricing/margin-exceptions/" + exceptionId : "/pricing/margin-exceptions", { method: exceptionId ? "PUT" : "POST", body: JSON.stringify({ ...exception, missionId: exception.missionId || firstMissionId }) });
    setExceptionId("");
    setException({ missionId: "", reason: "", approvedBy: "direction", targetReviewDate: new Date().toISOString().slice(0, 10), comment: "", status: "active" });
    refetchExceptions();
  };
  const removeDecision = async (id: string) => { await api("/pricing/decisions/" + id, { method: "DELETE" }); refetchDecisions(); };
  const removeException = async (id: string) => { await api("/pricing/margin-exceptions/" + id, { method: "DELETE" }); refetchExceptions(); };
  return (
    <>
      <PageHeader title="Historique pricing" description="Decisions de prix, remises, renegociations et exceptions de marge." />
      <form className="mb-5 rounded-lg border border-line bg-white p-4" onSubmit={saveDecision}>
        <h2 className="mb-3 font-semibold">{decisionId ? "Modifier une decision" : "Nouvelle decision"}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">Mission<select className="mt-1 w-full rounded-md border border-line px-3 py-2" value={decision.missionId || firstMissionId} onChange={(event) => setDecision({ ...decision, missionId: event.target.value })}>{(missions ?? []).map((mission) => <option key={mission.id} value={mission.id}>{mission.title}</option>)}</select></label>
          <label className="text-sm">Type<input className="mt-1 w-full rounded-md border border-line px-3 py-2" value={decision.decisionType} onChange={(event) => setDecision({ ...decision, decisionType: event.target.value })} /></label>
          <label className="text-sm">Ancien TJM<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="number" value={decision.previousDailyRate} onChange={(event) => setDecision({ ...decision, previousDailyRate: Number(event.target.value) })} /></label>
          <label className="text-sm">Nouveau TJM<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="number" value={decision.newDailyRate} onChange={(event) => setDecision({ ...decision, newDailyRate: Number(event.target.value) })} /></label>
          <label className="text-sm">Marge apres<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="number" step="0.01" value={decision.marginAfter} onChange={(event) => setDecision({ ...decision, marginAfter: Number(event.target.value) })} /></label>
          <label className="text-sm">Raison<input className="mt-1 w-full rounded-md border border-line px-3 py-2" value={decision.reason} onChange={(event) => setDecision({ ...decision, reason: event.target.value })} /></label>
        </div>
        <button className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white">{decisionId ? "Enregistrer" : "Creer"}</button>
      </form>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Decisions</h2>
      <Table rows={decisions ?? []} columns={[
        { key: "missionLabel", label: "Mission", render: missionLabel },
        { key: "decisionType", label: "Decision" },
        { key: "previousDailyRate", label: "Ancien TJM", render: (row) => money(row.previousDailyRate) },
        { key: "newDailyRate", label: "Nouveau TJM", render: (row) => money(row.newDailyRate) },
        { key: "marginAfter", label: "Marge apres", render: (row) => percent(row.marginAfter) },
        { key: "reason", label: "Raison" },
        { key: "actions", label: "Actions", render: (row) => <div className="flex gap-2"><ActionButton onClick={() => { setDecisionId(row.id); setDecision({ missionId: row.missionId, decisionType: row.decisionType, previousDailyRate: row.previousDailyRate ?? 0, newDailyRate: row.newDailyRate ?? 0, marginAfter: row.marginAfter ?? 0, reason: row.reason ?? "" }); }}>Editer</ActionButton><ActionButton tone="risk" onClick={() => removeDecision(row.id)}>Supprimer</ActionButton></div> }
      ]} />
      <form className="mb-5 mt-5 rounded-lg border border-line bg-white p-4" onSubmit={saveException}>
        <h2 className="mb-3 font-semibold">{exceptionId ? "Modifier une exception" : "Nouvelle exception"}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">Mission<select className="mt-1 w-full rounded-md border border-line px-3 py-2" value={exception.missionId || firstMissionId} onChange={(event) => setException({ ...exception, missionId: event.target.value })}>{(missions ?? []).map((mission) => <option key={mission.id} value={mission.id}>{mission.title}</option>)}</select></label>
          <label className="text-sm">Raison<input className="mt-1 w-full rounded-md border border-line px-3 py-2" value={exception.reason} onChange={(event) => setException({ ...exception, reason: event.target.value })} /></label>
          <label className="text-sm">Revue<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="date" value={exception.targetReviewDate} onChange={(event) => setException({ ...exception, targetReviewDate: event.target.value })} /></label>
          <label className="text-sm">Statut<select className="mt-1 w-full rounded-md border border-line px-3 py-2" value={exception.status} onChange={(event) => setException({ ...exception, status: event.target.value })}>{["active", "expired", "revoked"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="text-sm md:col-span-2">Commentaire<input className="mt-1 w-full rounded-md border border-line px-3 py-2" value={exception.comment} onChange={(event) => setException({ ...exception, comment: event.target.value })} /></label>
        </div>
        <button className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white">{exceptionId ? "Enregistrer" : "Creer"}</button>
      </form>
      <h2 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-muted">Exceptions de marge</h2>
      <Table rows={exceptions ?? []} columns={[
        { key: "missionLabel", label: "Mission", render: missionLabel },
        { key: "reason", label: "Raison" },
        { key: "targetReviewDate", label: "Revue", render: (row) => String(row.targetReviewDate ?? "").slice(0, 10) },
        { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> },
        { key: "actions", label: "Actions", render: (row) => <div className="flex gap-2"><ActionButton onClick={() => { setExceptionId(row.id); setException({ missionId: row.missionId, reason: row.reason ?? "", approvedBy: row.approvedBy ?? "direction", targetReviewDate: String(row.targetReviewDate ?? "").slice(0, 10), comment: row.comment ?? "", status: row.status }); }}>Editer</ActionButton><ActionButton tone="risk" onClick={() => removeException(row.id)}>Supprimer</ActionButton></div> }
      ]} />
    </>
  );
}

export function PricingReportPage() {
  const { data } = useApi<any>("/reports/pricing-margin.json");
  return (
    <>
      <PageHeader title="Rapport pricing" description="Synthese pricing, missions ? risque, exceptions, actions et gains attendus." />
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <KpiCard label="Missions analysées" value={data?.dashboard?.missionsAnalyzed ?? 0} />
        <KpiCard label="à renégocier" value={data?.dashboard?.renegotiationCandidates ?? 0} />
        <KpiCard label="Gain mensuel" value={money(data?.dashboard?.potentialMonthlyGain)} />
        <KpiCard label="Gain annuel" value={money(data?.dashboard?.potentialAnnualGain)} />
      </div>
      <Table rows={data?.candidates ?? []} columns={[
        { key: "missionLabel", label: "Mission", render: missionLabel },
        { key: "priorityScore", label: "Score" },
        { key: "reason", label: "Raison" },
        { key: "annualizedImpactAmount", label: "Impact annuel", render: (row) => money(row.annualizedImpactAmount) }
      ]} />
    </>
  );
}

function pricingColumns() {
  return [
    { key: "missionTitle", label: "Mission" },
    { key: "clientName", label: "Client" },
    { key: "pricingStatus", label: "Statut", render: (row: any) => <StatusBadge label={row.pricingStatus} tone={tone(row.pricingStatus)} /> },
    { key: "currentDailyRate", label: "TJM actuel", render: (row: any) => money(row.currentDailyRate) },
    { key: "calculatedFloorDailyRate", label: "TJM plancher", render: (row: any) => money(row.calculatedFloorDailyRate) },
    { key: "recommendedDailyRate", label: "TJM recommandé", render: (row: any) => money(row.recommendedDailyRate) },
    { key: "currentMarginRate", label: "Marge", render: (row: any) => percent(row.currentMarginRate) },
    { key: "annualizedImpactAmount", label: "Impact annuel", render: (row: any) => money(row.annualizedImpactAmount) }
  ];
}
