import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";
import { api } from "../api";
import { KpiCard } from "../components/KpiCard";
import { PageHeader, StatusBadge } from "../components/PageHeader";
import { useApi } from "../hooks/useApi";

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

export function PricingDashboardPage() {
  const { data, refetch } = useApi<any>("/pricing/dashboard");
  const recalculate = async () => { await api("/pricing/renegotiation-candidates/recalculate", { method: "POST" }); refetch(); };
  const chart = [
    { label: "Missions", value: data?.missionsAnalyzed ?? 0 },
    { label: "Saines", value: data?.healthyMissions ?? 0 },
    { label: "Sous-margees", value: data?.underpricedMissions ?? 0 },
    { label: "A renegocier", value: data?.renegotiationCandidates ?? 0 }
  ];
  return (
    <>
      <PageHeader title="Dashboard pricing" description="Pilotage des TJM, marges mission, gains potentiels et priorites de renegociation." actions={<button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={recalculate}>Recalculer</button>} />
      <div className="mb-5 grid gap-3 md:grid-cols-6">
        <KpiCard label="Missions analysees" value={data?.missionsAnalyzed ?? 0} />
        <KpiCard label="Missions saines" value={data?.healthyMissions ?? 0} tone="good" />
        <KpiCard label="Sous-margees" value={data?.underpricedMissions ?? 0} tone={(data?.underpricedMissions ?? 0) ? "risk" : "good"} />
        <KpiCard label="A renegocier" value={data?.renegotiationCandidates ?? 0} tone={(data?.renegotiationCandidates ?? 0) ? "default" : "good"} />
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
            { key: "missionId", label: "Mission" },
            { key: "priorityScore", label: "Score" },
            { key: "severity", label: "Severite", render: (row) => <StatusBadge label={row.severity} tone={tone(row.severity)} /> },
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
  const firstMission = missions?.[0]?.id ?? "";
  const [missionId, setMissionId] = useState("");
  const [dailyRate, setDailyRate] = useState(720);
  const [discountRate, setDiscountRate] = useState(0.05);
  const [result, setResult] = useState<any | null>(null);
  const run = async () => {
    const targetMissionId = missionId || firstMission;
    if (!targetMissionId) return;
    setResult(await api("/pricing/simulate", { method: "POST", body: JSON.stringify({ missionId: targetMissionId, simulatedDailyRate: dailyRate, discountRate, name: "Simulation interactive" }) }));
  };
  return (
    <>
      <PageHeader title="Simulateur pricing" description="Simuler un TJM, une remise et mesurer l'impact sur marge, TJM plancher et TJM recommande." actions={<button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={run}>Simuler</button>} />
      <div className="mb-5 grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-3">
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
    </>
  );
}

export function MissionPricingProfilePage() {
  const { data: missions } = useApi<any[]>("/missions");
  const missionId = missions?.[0]?.id;
  const { data } = useApi<any>(missionId ? `/pricing/missions/${missionId}` : "");
  return (
    <>
      <PageHeader title="Profil pricing mission" description="Lecture detaillee du cout complet, TJM plancher, TJM recommande et ecart de marge." />
      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Mission" value={data?.missionTitle ?? "-"} />
        <KpiCard label="TJM actuel" value={money(data?.currentDailyRate)} />
        <KpiCard label="TJM plancher" value={money(data?.calculatedFloorDailyRate)} tone={(data?.currentDailyRate ?? 0) < (data?.calculatedFloorDailyRate ?? 0) ? "risk" : "default"} />
        <KpiCard label="TJM recommande" value={money(data?.recommendedDailyRate)} />
        <KpiCard label="Cout complet / jour" value={money(data?.fullDailyCost)} />
        <KpiCard label="Marge actuelle" value={percent(data?.currentMarginRate)} tone={kpiTone(data?.pricingStatus ?? "")} />
        <KpiCard label="Impact mensuel" value={money(data?.monthlyImpactAmount)} />
        <KpiCard label="Statut" value={data?.pricingStatus ?? "-"} tone={kpiTone(data?.pricingStatus ?? "")} />
      </div>
    </>
  );
}

export function UnderpricedMissionsPage() {
  const { data } = useApi<any[]>("/pricing/underpriced-missions");
  return <><PageHeader title="Missions sous-margees" description="Missions dont le TJM ou la marge ne couvre pas les seuils pricing." /><Table rows={data ?? []} columns={pricingColumns()} /></>;
}

export function RenegotiationCandidatesPage() {
  const { data, refetch } = useApi<any[]>("/pricing/renegotiation-candidates");
  const recalculate = async () => { await api("/pricing/renegotiation-candidates/recalculate", { method: "POST" }); refetch(); };
  return (
    <>
      <PageHeader title="Missions a renegocier" description="Priorisation des missions a renegocier avec score explicable et gains attendus." actions={<button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white" onClick={recalculate}>Recalculer</button>} />
      <Table rows={data ?? []} columns={[
        { key: "missionId", label: "Mission" },
        { key: "reason", label: "Raison" },
        { key: "priorityScore", label: "Score" },
        { key: "severity", label: "Severite", render: (row) => <StatusBadge label={row.severity} tone={tone(row.severity)} /> },
        { key: "currentDailyRate", label: "TJM actuel", render: (row) => money(row.currentDailyRate) },
        { key: "targetDailyRate", label: "TJM cible", render: (row) => money(row.targetDailyRate) },
        { key: "annualizedImpactAmount", label: "Gain annuel", render: (row) => money(row.annualizedImpactAmount) },
        { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }
      ]} />
    </>
  );
}

export function PricingSettingsPage() {
  const { data } = useApi<any>("/pricing/settings");
  return (
    <>
      <PageHeader title="Parametres pricing" description="Marge cible, marge minimum, overhead, arrondis et seuils de renegociation." />
      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard label="Marge cible" value={percent(data?.defaultTargetMarginRate)} />
        <KpiCard label="Marge minimum" value={percent(data?.minimumMarginRate)} />
        <KpiCard label="Mode overhead" value={data?.defaultOverheadAllocationMode ?? "-"} />
        <KpiCard label="Taux overhead" value={percent(data?.defaultOverheadRate)} />
        <KpiCard label="Arrondi TJM" value={data?.roundingMode ?? "-"} />
        <KpiCard label="Seuil remise" value={percent(data?.defaultCommercialDiscountWarningRate)} />
      </div>
    </>
  );
}

export function PricingHistoryPage() {
  const { data: decisions } = useApi<any[]>("/pricing/decisions");
  const { data: exceptions } = useApi<any[]>("/pricing/margin-exceptions");
  return (
    <>
      <PageHeader title="Historique pricing" description="Decisions de prix, remises, renegociations et exceptions de marge." />
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Decisions</h2>
      <Table rows={decisions ?? []} columns={[
        { key: "missionId", label: "Mission" },
        { key: "decisionType", label: "Decision" },
        { key: "previousDailyRate", label: "Ancien TJM", render: (row) => money(row.previousDailyRate) },
        { key: "newDailyRate", label: "Nouveau TJM", render: (row) => money(row.newDailyRate) },
        { key: "marginAfter", label: "Marge apres", render: (row) => percent(row.marginAfter) },
        { key: "reason", label: "Raison" }
      ]} />
      <h2 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-muted">Exceptions de marge</h2>
      <Table rows={exceptions ?? []} columns={[
        { key: "missionId", label: "Mission" },
        { key: "reason", label: "Raison" },
        { key: "targetReviewDate", label: "Revue" },
        { key: "status", label: "Statut", render: (row) => <StatusBadge label={row.status} tone={tone(row.status)} /> }
      ]} />
    </>
  );
}

export function PricingReportPage() {
  const { data } = useApi<any>("/reports/pricing-margin.json");
  return (
    <>
      <PageHeader title="Rapport pricing" description="Synthese pricing, missions a risque, exceptions, actions et gains attendus." />
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <KpiCard label="Missions analysees" value={data?.dashboard?.missionsAnalyzed ?? 0} />
        <KpiCard label="A renegocier" value={data?.dashboard?.renegotiationCandidates ?? 0} />
        <KpiCard label="Gain mensuel" value={money(data?.dashboard?.potentialMonthlyGain)} />
        <KpiCard label="Gain annuel" value={money(data?.dashboard?.potentialAnnualGain)} />
      </div>
      <Table rows={data?.candidates ?? []} columns={[
        { key: "missionId", label: "Mission" },
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
    { key: "recommendedDailyRate", label: "TJM recommande", render: (row: any) => money(row.recommendedDailyRate) },
    { key: "currentMarginRate", label: "Marge", render: (row: any) => percent(row.currentMarginRate) },
    { key: "annualizedImpactAmount", label: "Impact annuel", render: (row: any) => money(row.annualizedImpactAmount) }
  ];
}
