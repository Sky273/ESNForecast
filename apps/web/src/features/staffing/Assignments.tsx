import { FormEvent, useEffect, useState } from "react";
import { api } from "../../api";
import { Badge, money, percent } from "../../components/Format";

export function Assignments() {
  const [missions, setMissions] = useState<any[]>([]);
  const [resources, setResources] = useState<{ employees: any[]; partners: any[]; freelancers: any[] }>({ employees: [], partners: [], freelancers: [] });
  const [missionId, setMissionId] = useState("");
  const [assignments, setAssignments] = useState<any[]>([]);
  const [draft, setDraft] = useState({ resourceType: "employee", resourceId: "", startDate: "2026-06-01", estimatedEndDate: "2026-12-31", occupancyRate: 1, calculationMode: "business_days", specificDailyRate: 750, specificDailyCost: 0 });
  const [editingId, setEditingId] = useState("");

  useEffect(() => {
    Promise.all([api<any[]>("/missions"), api<any[]>("/employees"), api<any[]>("/partner-resources"), api<any[]>("/freelancers")]).then(([missionRows, employees, partners, freelancers]) => {
      setMissions(missionRows);
      setMissionId(missionRows[0]?.id ?? "");
      setResources({ employees, partners, freelancers });
    });
  }, []);

  useEffect(() => {
    if (missionId) void api<any[]>(`/missions/${missionId}/assignments`).then(setAssignments);
  }, [missionId]);

  const currentResources = draft.resourceType === "employee" ? resources.employees : draft.resourceType === "partner" ? resources.partners : resources.freelancers;
  const resourceLabel = (assignment: any) => {
    const pool = assignment.resourceType === "employee" ? resources.employees : assignment.resourceType === "partner" ? resources.partners : resources.freelancers;
    const resource = pool.find((item) => item.id === assignment.resourceId);
    return resource ? `${resource.firstName ?? ""} ${resource.lastName ?? ""}`.trim() || resource.name || assignment.resourceId : assignment.resourceId;
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api(editingId ? `/assignments/${editingId}` : `/missions/${missionId}/assignments`, { method: editingId ? "PUT" : "POST", body: JSON.stringify(draft) });
    setEditingId("");
    setDraft({ resourceType: "employee", resourceId: "", startDate: "2026-06-01", estimatedEndDate: "2026-12-31", occupancyRate: 1, calculationMode: "business_days", specificDailyRate: 750, specificDailyCost: 0 });
    setAssignments(await api(`/missions/${missionId}/assignments`));
  };
  const editAssignment = (assignment: any) => {
    setEditingId(assignment.id);
    setDraft({
      resourceType: assignment.resourceType,
      resourceId: assignment.resourceId,
      startDate: String(assignment.startDate ?? "").slice(0, 10),
      estimatedEndDate: String(assignment.estimatedEndDate ?? "").slice(0, 10),
      occupancyRate: assignment.occupancyRate,
      calculationMode: assignment.calculationMode,
      specificDailyRate: assignment.specificDailyRate ?? 0,
      specificDailyCost: assignment.specificDailyCost ?? 0
    });
  };
  const deleteAssignment = async (id: string) => {
    await api(`/assignments/${id}`, { method: "DELETE" });
    if (editingId === id) setEditingId("");
    setAssignments(await api(`/missions/${missionId}/assignments`));
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Affectations</h1>
        <p className="text-sm text-muted">Affectez salariés, partenaires et indépendants aux missions.</p>
      </div>
      <div className="rounded-lg border border-line bg-white p-4">
        <label>
          <span className="mb-1 block text-xs font-medium text-muted">Mission</span>
          <select className="w-full rounded-md border border-line px-3 py-2" value={missionId} onChange={(event) => setMissionId(event.target.value)}>
            {missions.map((mission) => <option key={mission.id} value={mission.id}>{mission.title}</option>)}
          </select>
        </label>
      </div>
      <form className="rounded-lg border border-line bg-white p-4" onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-4">
          <label>
            <span className="mb-1 block text-xs font-medium text-muted">Type ressource</span>
            <select className="w-full rounded-md border border-line px-3 py-2" value={draft.resourceType} onChange={(event) => setDraft({ ...draft, resourceType: event.target.value, resourceId: "" })}>
              <option value="employee">Salarié</option>
              <option value="partner">Partenaire</option>
              <option value="freelancer">Indépendant</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-muted">Ressource</span>
            <select className="w-full rounded-md border border-line px-3 py-2" value={draft.resourceId} onChange={(event) => setDraft({ ...draft, resourceId: event.target.value })}>
              <option value="">Sélectionner</option>
              {currentResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.firstName} {resource.lastName}</option>)}
            </select>
          </label>
          <label><span className="mb-1 block text-xs font-medium text-muted">Début</span><input className="w-full rounded-md border border-line px-3 py-2" type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></label>
          <label><span className="mb-1 block text-xs font-medium text-muted">Fin estimée</span><input className="w-full rounded-md border border-line px-3 py-2" type="date" value={draft.estimatedEndDate} onChange={(event) => setDraft({ ...draft, estimatedEndDate: event.target.value })} /></label>
          <label><span className="mb-1 block text-xs font-medium text-muted">Occupation</span><input className="w-full rounded-md border border-line px-3 py-2" type="number" step="0.1" value={draft.occupancyRate} onChange={(event) => setDraft({ ...draft, occupancyRate: Number(event.target.value) })} /></label>
          <label><span className="mb-1 block text-xs font-medium text-muted">TJM vente</span><input className="w-full rounded-md border border-line px-3 py-2" type="number" value={draft.specificDailyRate} onChange={(event) => setDraft({ ...draft, specificDailyRate: Number(event.target.value) })} /></label>
          <label><span className="mb-1 block text-xs font-medium text-muted">TJM achat</span><input className="w-full rounded-md border border-line px-3 py-2" type="number" value={draft.specificDailyCost} onChange={(event) => setDraft({ ...draft, specificDailyCost: Number(event.target.value) })} /></label>
          <label><span className="mb-1 block text-xs font-medium text-muted">Mode</span><select className="w-full rounded-md border border-line px-3 py-2" value={draft.calculationMode} onChange={(event) => setDraft({ ...draft, calculationMode: event.target.value })}><option value="business_days">Jours ouvrés</option><option value="fixed_days_monthly">Jours fixes</option><option value="fixed_monthly_amount">Montant fixe</option></select></label>
        </div>
        <button className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white">{editingId ? "Enregistrer l'affectation" : "Ajouter l'affectation"}</button>
      </form>
      <div className="rounded-lg border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase text-muted"><tr><th className="px-3 py-3">Type</th><th>Ressource</th><th>Période</th><th>Occupation</th><th>TJM vente</th><th>Actions</th></tr></thead>
          <tbody>
            {assignments.map((assignment) => (
              <tr key={assignment.id} className="border-t border-line">
                <td className="px-3 py-3"><Badge>{assignment.resourceType}</Badge></td>
                <td>{resourceLabel(assignment)}</td>
                <td>{assignment.startDate} - {assignment.estimatedEndDate}</td>
                <td>{percent(assignment.occupancyRate)}</td>
                <td>{money(assignment.specificDailyRate ?? 0)}</td>
                <td className="flex gap-2 py-2"><button className="rounded-md border border-line px-2 py-1" onClick={() => editAssignment(assignment)}>Éditer</button><button className="rounded-md border border-line px-2 py-1 text-risk" onClick={() => deleteAssignment(assignment.id)}>Supprimer</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
