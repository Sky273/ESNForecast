import { FormEvent, useEffect, useState } from "react";
import { api } from "../../api";

type SettingField = {
  name: string;
  label: string;
  description: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
};

const settingSections: Array<{ title: string; description: string; fields: SettingField[] }> = [
  {
    title: "Horizon et calendrier",
    description: "Ces paramètres définissent la période de projection et la base de calcul mensuelle.",
    fields: [
      {
        name: "horizonMonths",
        label: "Horizon par défaut",
        description: "Nombre de mois affichés par défaut dans les projections si aucun horizon n'est sélectionné dans la barre supérieure.",
        unit: "mois",
        min: 1,
        max: 36,
        step: 1
      },
      {
        name: "averageBusinessDaysPerMonth",
        label: "Jours ouvrés moyens",
        description: "Base mensuelle utilisée pour convertir les affectations, TJM et jours facturables en chiffre d'affaires prévisionnel.",
        unit: "jours",
        min: 1,
        max: 31,
        step: 0.5
      },
      {
        name: "defaultPaymentDelayDays",
        label: "Délai de paiement par défaut",
        description: "Délai appliqué lorsqu'une mission, facture ou prévision ne précise pas son propre délai d'encaissement.",
        unit: "jours",
        min: 0,
        max: 180,
        step: 1
      }
    ]
  },
  {
    title: "Coûts et marge",
    description: "Ces hypothèses structurent le coût complet et les alertes de rentabilité dans le moteur financier.",
    fields: [
      {
        name: "defaultEmployeeChargeRate",
        label: "Taux de charges salariés",
        description: "Taux de charges patronales appliqué par défaut au salaire brut lorsqu'aucun taux spécifique n'est renseigné sur la ressource.",
        unit: "ratio",
        min: 0,
        max: 2,
        step: 0.01
      },
      {
        name: "overheadRate",
        label: "Taux de frais généraux",
        description: "Quote-part de frais de structure ajoutée aux coûts pour approcher un coût complet simplifié.",
        unit: "ratio",
        min: 0,
        max: 2,
        step: 0.01
      },
      {
        name: "minimumMarginRate",
        label: "Seuil de marge minimum",
        description: "Seuil sous lequel une mission ou une projection peut être signalée comme à risque de marge.",
        unit: "ratio",
        min: -1,
        max: 1,
        step: 0.01
      }
    ]
  },
  {
    title: "Fiscalité simplifiée",
    description: "Ce taux sert uniquement aux projections de pilotage. Il ne remplace pas un calcul comptable ou fiscal légal.",
    fields: [
      {
        name: "simplifiedTaxRate",
        label: "Taux d'imposition simplifié",
        description: "Taux forfaitaire utilisé pour estimer une charge fiscale dans les projections financières.",
        unit: "ratio",
        min: 0,
        max: 1,
        step: 0.01
      }
    ]
  }
];

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

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Paramètres de projection</h1>
          <p className="text-sm text-muted">
            Hypothèses globales utilisées par le moteur de projection. Elles servent de valeurs par défaut lorsque les données métier ne précisent pas leurs propres règles.
          </p>
        </div>
        {saved ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">Paramètres enregistrés</span> : null}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Ces paramètres impactent les projections, la trésorerie prévisionnelle, les écarts, les alertes et certains rapports.
        Ils ne modifient pas les données réelles importées depuis la banque, la comptabilité ou les connecteurs.
      </div>

      <form onSubmit={submit} className="space-y-5">
        {settingSections.map((section) => (
          <div key={section.title} className="rounded-lg border border-line bg-white p-4">
            <div className="mb-4">
              <h2 className="text-base font-semibold">{section.title}</h2>
              <p className="text-sm text-muted">{section.description}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {section.fields.map((field) => (
                <NumberSetting key={field.name} field={field} settings={settings} setSettings={setSettings} />
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-lg border border-line bg-white p-4">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Reconnaissance du revenu</h2>
            <p className="text-sm text-muted">Détermine à quel moment le moteur considère qu'un revenu contribue à la projection.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Mode de revenu</span>
              <select className="w-full rounded-md border border-line px-3 py-2" value={settings.revenueRecognitionMode} onChange={(event) => setSettings({ ...settings, revenueRecognitionMode: event.target.value })}>
                <option value="billing">Facturation</option>
                <option value="estimated_collection">Encaissement estimé</option>
              </select>
              <span className="mt-1 block text-xs text-muted">
                En mode facturation, le chiffre d'affaires suit les dates de facture. En mode encaissement estimé, il suit les dates de paiement prévues.
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-md border border-line bg-surface p-3">
              <input className="mt-1" type="checkbox" checked={Boolean(settings.applyProbabilityToPlannedMissions)} onChange={(event) => setSettings({ ...settings, applyProbabilityToPlannedMissions: event.target.checked })} />
              <span>
                <span className="block text-sm font-medium">Pondérer les missions prévues</span>
                <span className="mt-1 block text-xs text-muted">
                  Si activé, les missions non signées sont pondérées par leur probabilité. Exemple : 10 000 EUR à 60 % comptent pour 6 000 EUR.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white">Enregistrer les paramètres</button>
          <span className="text-xs text-muted">Les nouveaux calculs utiliseront ces hypothèses dès le prochain chargement ou recalcul.</span>
        </div>
      </form>
    </section>
  );
}

function NumberSetting({
  field,
  settings,
  setSettings
}: {
  field: SettingField;
  settings: Record<string, any>;
  setSettings: (settings: Record<string, any>) => void;
}) {
  const value = settings[field.name] ?? "";
  return (
    <label className="block rounded-md border border-line bg-surface p-3">
      <span className="mb-1 block text-sm font-medium">{field.label}</span>
      <div className="flex rounded-md border border-line bg-white focus-within:border-brand">
        <input
          className="min-w-0 flex-1 rounded-l-md px-3 py-2 outline-none"
          type="number"
          min={field.min}
          max={field.max}
          step={field.step ?? 0.01}
          value={value}
          onChange={(event) => setSettings({ ...settings, [field.name]: Number(event.target.value) })}
        />
        {field.unit ? <span className="border-l border-line px-3 py-2 text-sm text-muted">{field.unit}</span> : null}
      </div>
      <span className="mt-2 block text-xs leading-5 text-muted">{field.description}</span>
      {field.unit === "ratio" ? <span className="mt-1 block text-xs text-muted">Format attendu : 0,45 = 45 %.</span> : null}
    </label>
  );
}
