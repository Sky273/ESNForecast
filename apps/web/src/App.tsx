import { AlertTriangle, BarChart3, Building2, Calculator, ChartNoAxesCombined, Contact, Euro, FileText, Handshake, History, LayoutDashboard, Receipt, Settings as SettingsIcon, Shield, TrendingUp, Users, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "./api";
import { CrudPage } from "./components/CrudPage";
import { Assignments } from "./pages/Assignments";
import { Dashboard } from "./pages/Dashboard";
import { Projections } from "./pages/Projections";
import { Settings } from "./pages/Settings";
import { AdminPage, AlertsPage, AuditPage, BenchPage, BillingPage, CashInPage, CashOutPage, ProfitabilityMissionsPage, ProfitabilityResourcesPage, ReportsPage, ScenariosPage, SimulationsPage, TreasuryPage } from "./pages/V1Pages";
import { configs } from "./pages/crudConfigs";

const nav = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "projections", label: "Projections", icon: ChartNoAxesCombined },
  { id: "treasury", label: "Trésorerie", icon: TrendingUp },
  { id: "scenarios", label: "Scénarios", icon: BarChart3 },
  { id: "simulations", label: "Simulations", icon: Calculator },
  { id: "missions", label: "Missions", icon: Calculator },
  { id: "profitabilityMissions", label: "Rentabilité missions", icon: BarChart3 },
  { id: "assignments", label: "Affectations", icon: Contact },
  { id: "employees", label: "Ressources internes", icon: Users },
  { id: "profitabilityResources", label: "Rentabilité ressources", icon: Users },
  { id: "bench", label: "Intercontrat", icon: AlertTriangle },
  { id: "partners", label: "Partenaires", icon: Handshake },
  { id: "partnerResources", label: "Ressources partenaires", icon: Building2 },
  { id: "freelancers", label: "Indépendants", icon: Contact },
  { id: "clients", label: "Clients", icon: Building2 },
  { id: "fixedCosts", label: "Frais fixes", icon: WalletCards },
  { id: "variableCosts", label: "Frais variables", icon: Euro },
  { id: "billing", label: "Facturation", icon: Receipt },
  { id: "cashIn", label: "Encaissements", icon: TrendingUp },
  { id: "cashOut", label: "Décaissements", icon: Euro },
  { id: "alerts", label: "Alertes", icon: AlertTriangle },
  { id: "reports", label: "Rapports", icon: FileText },
  { id: "settings", label: "Paramètres", icon: SettingsIcon },
  { id: "audit", label: "Historique", icon: History },
  { id: "admin", label: "Administration", icon: Shield }
];

export function App() {
  const [page, setPage] = useState("dashboard");
  const [horizon, setHorizon] = useState(12);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [scenarioId, setScenarioId] = useState("");
  const cfg = configs[page];

  useEffect(() => {
    api<any[]>("/scenarios").then((rows) => {
      setScenarios(rows);
      setScenarioId(rows.find((row) => row.isActive)?.id ?? rows[0]?.id ?? "");
    }).catch(() => undefined);
  }, []);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-r border-line bg-white p-4">
        <div className="mb-6">
          <div className="text-lg font-semibold tracking-normal">ESN Forecast</div>
          <div className="text-xs text-muted">Pilotage financier ESN</div>
        </div>
        <nav className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setPage(item.id)} className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${page === item.id ? "bg-emerald-50 font-medium text-brand" : "text-slate-700 hover:bg-surface"}`}>
                <Icon size={17} /> {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="p-4 md:p-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white p-3">
          <div className="text-sm text-muted">Scénario actif et horizon visibles sur toutes les vues V1.</div>
          <div className="flex flex-wrap gap-2">
            <select className="rounded-md border border-line px-3 py-2 text-sm" value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>
              {scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}
            </select>
            <select className="rounded-md border border-line px-3 py-2 text-sm" value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>
              {[3, 6, 12, 24].map((value) => <option key={value} value={value}>{value} mois</option>)}
            </select>
          </div>
        </header>
        {page === "dashboard" ? <Dashboard horizon={horizon} setHorizon={setHorizon} /> : null}
        {page === "projections" ? <Projections horizon={horizon} /> : null}
        {page === "treasury" ? <TreasuryPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "scenarios" ? <ScenariosPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "simulations" ? <SimulationsPage /> : null}
        {page === "profitabilityMissions" ? <ProfitabilityMissionsPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "profitabilityResources" ? <ProfitabilityResourcesPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "bench" ? <BenchPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "billing" ? <BillingPage /> : null}
        {page === "cashIn" ? <CashInPage /> : null}
        {page === "cashOut" ? <CashOutPage /> : null}
        {page === "alerts" ? <AlertsPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "reports" ? <ReportsPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "assignments" ? <Assignments /> : null}
        {page === "settings" ? <Settings /> : null}
        {page === "audit" ? <AuditPage /> : null}
        {page === "admin" ? <AdminPage /> : null}
        {cfg ? <CrudPage title={cfg.title} path={cfg.path} fields={cfg.fields} columns={cfg.columns} initial={cfg.initial} /> : null}
      </main>
    </div>
  );
}
