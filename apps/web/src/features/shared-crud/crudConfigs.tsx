import { Badge, money, percent } from "../../components/Format";
import type { Field } from "../../types";

export const configs: Record<string, { title: string; path: string; fields: Field[]; columns: any[]; initial: Record<string, any>; description?: string }> = {
  employees: {
    title: "Ressources internes",
    description: "Collaborateurs internes utilisés pour le staffing, la capacité disponible et les coûts prévisionnels.",
    path: "/employees",
    initial: { firstName: "", lastName: "", position: "Consultant", status: "consultant", assignable: true, startDate: "2026-06-01", monthlyGrossSalary: 4000, employerChargeRate: 0.45, benefitsMonthly: 400 },
    fields: [
      { name: "firstName", label: "Prénom" }, { name: "lastName", label: "Nom" }, { name: "position", label: "Poste" },
      { name: "status", label: "Statut", type: "select", options: ["consultant", "sales", "administrative", "management", "support", "other"].map((value) => ({ label: value, value })) },
      { name: "assignable", label: "Plaçable", type: "checkbox" }, { name: "startDate", label: "Date d'entrée", type: "date" }, { name: "endDate", label: "Date sortie", type: "date" },
      { name: "monthlyGrossSalary", label: "Salaire brut mensuel", type: "number" }, { name: "employerChargeRate", label: "Taux charges", type: "number" }, { name: "benefitsMonthly", label: "Avantages mensuels", type: "number" }, { name: "notes", label: "Notes", type: "textarea" }
    ],
    columns: [
      { key: "lastName", label: "Nom", render: (r: any) => `${r.firstName} ${r.lastName}` },
      { key: "position", label: "Poste" },
      { key: "status", label: "Statut", render: (r: any) => <Badge>{r.status}</Badge> },
      { key: "assignable", label: "Plaçable", render: (r: any) => r.assignable ? "Oui" : "Non" },
      { key: "monthlyGrossSalary", label: "Coût estimé", render: (r: any) => money((r.monthlyGrossSalary ?? 0) * (1 + (r.employerChargeRate ?? 0.45)) + (r.benefitsMonthly ?? 0)) }
    ]
  },
  clients: {
    title: "Clients",
    description: "Référentiel clients utilisé par les missions, factures, paiements, rapports et analyses de dépendance.",
    path: "/clients",
    initial: { name: "", sector: "", primaryContact: "", contactEmail: "", paymentDelayDays: 30 },
    fields: [{ name: "name", label: "Nom" }, { name: "sector", label: "Secteur" }, { name: "primaryContact", label: "Contact" }, { name: "contactEmail", label: "Email" }, { name: "paymentDelayDays", label: "Délai paiement", type: "number" }, { name: "notes", label: "Notes", type: "textarea" }],
    columns: [{ key: "name", label: "Nom" }, { key: "sector", label: "Secteur" }, { key: "paymentDelayDays", label: "Délai paiement" }, { key: "missions", label: "Missions", render: (r: any) => r.missions?.length ?? 0 }]
  },
  missions: {
    title: "Missions",
    description: "Missions prévues ou actives utilisées pour les projections, affectations, factures et analyses pricing.",
    path: "/missions",
    initial: { title: "", clientId: "", status: "planned", type: "time_material", startDate: "2026-06-01", estimatedEndDate: "2026-12-31", defaultDailyRate: 750, signatureProbability: 1 },
    fields: [
      { name: "title", label: "Titre" }, { name: "clientId", label: "Client", type: "select", optionsPath: "/clients", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner un client" },
      { name: "status", label: "Statut", type: "select", options: ["draft", "planned", "active", "completed", "suspended", "cancelled"].map((value) => ({ label: value, value })) },
      { name: "type", label: "Type", type: "select", options: ["time_material", "fixed_price", "technical_assistance", "service_center", "other"].map((value) => ({ label: value, value })) },
      { name: "startDate", label: "Date début", type: "date" }, { name: "estimatedEndDate", label: "Date fin estimée", type: "date" }, { name: "defaultDailyRate", label: "TJM vente", type: "number" }, { name: "fixedPriceAmount", label: "Forfait", type: "number" }, { name: "signatureProbability", label: "Probabilité", type: "number" }, { name: "notes", label: "Notes", type: "textarea" }
    ],
    columns: [{ key: "title", label: "Titre" }, { key: "client", label: "Client", render: (r: any) => r.client?.name ?? r.clientId }, { key: "status", label: "Statut", render: (r: any) => <Badge tone={r.status === "active" ? "good" : r.status === "planned" ? "warn" : "neutral"}>{r.status}</Badge> }, { key: "defaultDailyRate", label: "TJM", render: (r: any) => money(r.defaultDailyRate) }, { key: "signatureProbability", label: "Probabilité", render: (r: any) => percent(r.signatureProbability) }]
  },
  partners: {
    title: "Partenaires",
    description: "Entreprises partenaires. Les personnes associées se gèrent dans Ressources partenaires.",
    path: "/partners",
    initial: { name: "", notes: "" },
    fields: [{ name: "name", label: "Société partenaire" }, { name: "notes", label: "Notes", type: "textarea" }],
    columns: [{ key: "name", label: "Partenaire" }, { key: "resources", label: "Ressources", render: (r: any) => r.resources?.length ?? 0 }]
  },
  partnerResources: {
    title: "Ressources partenaires",
    description: "Ressources rattachées aux partenaires et affectables aux missions.",
    path: "/partner-resources",
    initial: { partnerId: "", firstName: "", lastName: "", role: "", dailyCost: 500, monthlyFees: 0, availableFrom: "2026-06-01" },
    fields: [{ name: "partnerId", label: "Partenaire", type: "select", optionsPath: "/partners", optionLabelKey: "name", optionValueKey: "id", placeholder: "Sélectionner un partenaire" }, { name: "firstName", label: "Prénom" }, { name: "lastName", label: "Nom" }, { name: "role", label: "Rôle" }, { name: "dailyCost", label: "TJM achat", type: "number" }, { name: "monthlyFees", label: "Frais mensuels", type: "number" }, { name: "availableFrom", label: "Début dispo", type: "date" }, { name: "availableTo", label: "Fin dispo", type: "date" }],
    columns: [{ key: "lastName", label: "Ressource", render: (r: any) => `${r.firstName} ${r.lastName}` }, { key: "partner", label: "Partenaire", render: (r: any) => r.partner?.name ?? r.partnerId }, { key: "role", label: "Rôle" }, { key: "dailyCost", label: "TJM achat", render: (r: any) => money(r.dailyCost) }]
  },
  freelancers: {
    title: "Indépendants",
    description: "Ressources freelance affectables aux missions et prises en compte dans les coûts.",
    path: "/freelancers",
    initial: { firstName: "", lastName: "", specialty: "", dailyCost: 600, monthlyFees: 0, paymentTerms: "30 jours", availableFrom: "2026-06-01" },
    fields: [{ name: "firstName", label: "Prénom" }, { name: "lastName", label: "Nom" }, { name: "specialty", label: "Spécialité" }, { name: "dailyCost", label: "TJM achat", type: "number" }, { name: "monthlyFees", label: "Frais mensuels", type: "number" }, { name: "paymentTerms", label: "Conditions paiement" }, { name: "availableFrom", label: "Début dispo", type: "date" }, { name: "availableTo", label: "Fin dispo", type: "date" }],
    columns: [{ key: "lastName", label: "Nom", render: (r: any) => `${r.firstName} ${r.lastName}` }, { key: "specialty", label: "Spécialité" }, { key: "dailyCost", label: "TJM achat", render: (r: any) => money(r.dailyCost) }, { key: "availableFrom", label: "Disponibilité" }]
  },
  fixedCosts: {
    title: "Frais fixes",
    description: "Coûts récurrents intégrés aux projections et aux analyses de marge.",
    path: "/fixed-costs",
    initial: { label: "", category: "", monthlyAmount: 1000, startDate: "2026-06-01", recurrence: "monthly" },
    fields: [{ name: "label", label: "Libellé" }, { name: "category", label: "Catégorie" }, { name: "monthlyAmount", label: "Montant mensuel", type: "number" }, { name: "startDate", label: "Début", type: "date" }, { name: "endDate", label: "Fin", type: "date" }, { name: "recurrence", label: "Périodicité", type: "select", options: ["monthly", "quarterly", "annual", "one_time"].map((value) => ({ label: value, value })) }],
    columns: [{ key: "label", label: "Libellé" }, { key: "category", label: "Catégorie" }, { key: "monthlyAmount", label: "Montant", render: (r: any) => money(r.monthlyAmount) }, { key: "recurrence", label: "Périodicité" }, { key: "annual", label: "Annuel projeté", render: (r: any) => money(r.monthlyAmount * 12) }]
  },
  variableCosts: {
    title: "Frais variables",
    description: "Dépenses ponctuelles ou variables, rattachables à une mission ou une ressource.",
    path: "/variable-costs",
    initial: { label: "", category: "", amount: 1000, date: "2026-06-01" },
    fields: [{ name: "label", label: "Libellé" }, { name: "category", label: "Catégorie" }, { name: "amount", label: "Montant", type: "number" }, { name: "date", label: "Date", type: "date" }, { name: "missionId", label: "Mission", type: "select", optionsPath: "/missions", optionLabelKey: "title", optionValueKey: "id", placeholder: "Aucune mission liée" }, { name: "resourceId", label: "Ressource", type: "select", optionsPath: "/employees", optionLabelFields: ["firstName", "lastName"], optionValueKey: "id", placeholder: "Aucune ressource liée" }, { name: "notes", label: "Notes", type: "textarea" }],
    columns: [{ key: "label", label: "Libellé" }, { key: "category", label: "Catégorie" }, { key: "amount", label: "Montant", render: (r: any) => money(r.amount) }, { key: "date", label: "Date" }, { key: "missionId", label: "Mission liée" }]
  }
};
