import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";

export function Settings() {
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void api<Record<string, any>>("/settings/projection").then(setSettings);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    setSettings(await api("/settings/projection", { method: "PUT", body: JSON.stringify(settings) }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!settings) return <div className="text-muted">Chargement des paramètres...</div>;
  const fields = [
    ["horizonMonths", "Horizon par défaut", "number"],
    ["averageBusinessDaysPerMonth", "Jours ouvrés moyens", "number"],
    ["defaultEmployeeChargeRate", "Taux charges salariés", "number"],
    ["overheadRate", "Taux frais généraux", "number"],
    ["simplifiedTaxRate", "Taux imposition simplifié", "number"],
    ["defaultPaymentDelayDays", "Délai paiement défaut", "number"],
    ["minimumMarginRate", "Seuil marge minimum", "number"]
  ] as const;

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Paramètres de projection</h1>
        <p className="text-sm text-muted">Hypothèses globales utilisées par le moteur financier.</p>
      </div>
      <form onSubmit={submit} className="rounded-lg border border-line bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3">
          {fields.map(([name, label, type]) => (
            <label key={name}>
              <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
              <input className="w-full rounded-md border border-line px-3 py-2" type={type} step="0.01" value={settings[name] ?? ""} onChange={(event) => setSettings({ ...settings, [name]: Number(event.target.value) })} />
            </label>
          ))}
          <label>
            <span className="mb-1 block text-xs font-medium text-muted">Mode revenu</span>
            <select className="w-full rounded-md border border-line px-3 py-2" value={settings.revenueRecognitionMode} onChange={(event) => setSettings({ ...settings, revenueRecognitionMode: event.target.value })}>
              <option value="billing">Facturation</option>
              <option value="estimated_collection">Encaissement estimé</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pt-6">
            <input type="checkbox" checked={Boolean(settings.applyProbabilityToPlannedMissions)} onChange={(event) => setSettings({ ...settings, applyProbabilityToPlannedMissions: event.target.checked })} />
            Pondérer les missions prévues
          </label>
        </div>
        <button className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white">Enregistrer</button>
        {saved ? <span className="ml-3 text-sm text-brand">Paramètres enregistrés</span> : null}
      </form>
    </section>
  );
}
