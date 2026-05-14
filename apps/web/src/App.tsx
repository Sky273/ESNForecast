import { AlertTriangle, BarChart3, Bell, BookOpenCheck, Building2, Calculator, ChartNoAxesCombined, Contact, Euro, FileText, Handshake, History, Landmark, LayoutDashboard, Receipt, Settings as SettingsIcon, Shield, Sparkles, TrendingUp, Users, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "./api";
import { CrudPage } from "./components/CrudPage";
import { Assignments } from "./pages/Assignments";
import { Dashboard } from "./pages/Dashboard";
import { Projections } from "./pages/Projections";
import { Settings } from "./pages/Settings";
import { AdminPage, AlertsPage, AuditPage, BenchPage, BillingPage, CashInPage, CashOutPage, ProfitabilityMissionsPage, ProfitabilityResourcesPage, ReportsPage, ScenariosPage, SimulationsPage, TreasuryPage } from "./pages/V1Pages";
import { ActualsVariancesPage, AiAnalysisPage, CapacityPage, ExecutiveCockpitPage, MonthlyClosePage, MonteCarloPage, PaymentsPage, RealInvoicesPage, ReconciliationPage, StrategicRisksPage, TimesheetsPage, V2CrudPage } from "./pages/V2Pages";
import { BankAccountsPage, BankConsentsPage, BankReconciliationPage, BankTransactionsPage, ClientPaymentProfilesPage, CodirReportPage, ConnectedFinanceDashboard, ConnectorSupervisionPage, DataQualityPage, FinancialAnomaliesPage, FinancialAuditPage, FinancialRulesPage, ForecastReliabilityPage, ImportedAccountingPage, RealTreasuryPage, RunwayPage } from "./pages/V3Pages";
import { configs } from "./pages/crudConfigs";

const nav = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "executiveV2", label: "Cockpit V2", icon: Sparkles },
  { id: "connectedFinance", label: "Dashboard V3", icon: Landmark },
  { id: "projections", label: "Projections", icon: ChartNoAxesCombined },
  { id: "actuals", label: "Reel / ecarts", icon: BarChart3 },
  { id: "treasury", label: "Tresorerie", icon: TrendingUp },
  { id: "realTreasury", label: "Tresorerie reelle", icon: TrendingUp },
  { id: "runway", label: "Runway", icon: AlertTriangle },
  { id: "timesheets", label: "CRA", icon: BookOpenCheck },
  { id: "monthlyClose", label: "Cloture", icon: Shield },
  { id: "scenarios", label: "Scenarios", icon: BarChart3 },
  { id: "simulations", label: "Simulations", icon: Calculator },
  { id: "monteCarlo", label: "Monte Carlo", icon: ChartNoAxesCombined },
  { id: "missions", label: "Missions", icon: Calculator },
  { id: "offers", label: "Offres", icon: Receipt },
  { id: "profitabilityMissions", label: "Rentabilite missions", icon: BarChart3 },
  { id: "assignments", label: "Affectations", icon: Contact },
  { id: "employees", label: "Ressources internes", icon: Users },
  { id: "profitabilityResources", label: "Rentabilite ressources", icon: Users },
  { id: "capacity", label: "Capacity planning", icon: Users },
  { id: "bench", label: "Intercontrat", icon: AlertTriangle },
  { id: "partners", label: "Partenaires", icon: Handshake },
  { id: "partnerResources", label: "Ressources partenaires", icon: Building2 },
  { id: "freelancers", label: "Independants", icon: Contact },
  { id: "clients", label: "Clients", icon: Building2 },
  { id: "fixedCosts", label: "Frais fixes", icon: WalletCards },
  { id: "variableCosts", label: "Frais variables", icon: Euro },
  { id: "billing", label: "Facturation prevue", icon: Receipt },
  { id: "realInvoices", label: "Factures reelles", icon: Receipt },
  { id: "bankAccounts", label: "Banque", icon: Landmark },
  { id: "bankTransactions", label: "Transactions", icon: Receipt },
  { id: "bankReconciliation", label: "Rapprochement bancaire", icon: Calculator },
  { id: "importedAccounting", label: "Compta importee", icon: FileText },
  { id: "payments", label: "Paiements", icon: Euro },
  { id: "reconciliation", label: "Rapprochement", icon: Calculator },
  { id: "cashIn", label: "Encaissements", icon: TrendingUp },
  { id: "cashOut", label: "Decaissements", icon: Euro },
  { id: "plannedHires", label: "Recrutements", icon: Users },
  { id: "strategicRisks", label: "Risques strategiques", icon: AlertTriangle },
  { id: "forecastReliability", label: "Fiabilite prevision", icon: BarChart3 },
  { id: "clientPaymentProfiles", label: "Paiements clients", icon: Users },
  { id: "financialAnomalies", label: "Anomalies financieres", icon: AlertTriangle },
  { id: "dataQuality", label: "Sante donnees", icon: Shield },
  { id: "connectorSupervision", label: "Supervision connecteurs", icon: Handshake },
  { id: "bankConsents", label: "Consentements", icon: Shield },
  { id: "financialRules", label: "Regles bancaires", icon: SettingsIcon },
  { id: "codirReport", label: "Rapport CODIR", icon: FileText },
  { id: "financialAudit", label: "Audit financier", icon: History },
  { id: "aiAnalysis", label: "Analyse IA", icon: Sparkles },
  { id: "rules", label: "Regles", icon: SettingsIcon },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "connectors", label: "Connecteurs", icon: Handshake },
  { id: "alerts", label: "Alertes", icon: AlertTriangle },
  { id: "reports", label: "Rapports", icon: FileText },
  { id: "settings", label: "Parametres", icon: SettingsIcon },
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
          <div className="text-sm text-muted">Scenario actif et horizon visibles sur toutes les vues.</div>
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
        {page === "executiveV2" ? <ExecutiveCockpitPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "connectedFinance" ? <ConnectedFinanceDashboard scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "projections" ? <Projections horizon={horizon} /> : null}
        {page === "actuals" ? <ActualsVariancesPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "timesheets" ? <TimesheetsPage /> : null}
        {page === "monthlyClose" ? <MonthlyClosePage /> : null}
        {page === "treasury" ? <TreasuryPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "realTreasury" ? <RealTreasuryPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "runway" ? <RunwayPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "scenarios" ? <ScenariosPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "simulations" ? <SimulationsPage /> : null}
        {page === "monteCarlo" ? <MonteCarloPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "offers" ? <V2CrudPage kind="offers" /> : null}
        {page === "profitabilityMissions" ? <ProfitabilityMissionsPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "assignments" ? <Assignments /> : null}
        {page === "profitabilityResources" ? <ProfitabilityResourcesPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "capacity" ? <CapacityPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "bench" ? <BenchPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "billing" ? <BillingPage /> : null}
        {page === "realInvoices" ? <RealInvoicesPage /> : null}
        {page === "bankAccounts" ? <BankAccountsPage /> : null}
        {page === "bankTransactions" ? <BankTransactionsPage /> : null}
        {page === "bankReconciliation" ? <BankReconciliationPage /> : null}
        {page === "importedAccounting" ? <ImportedAccountingPage /> : null}
        {page === "payments" ? <PaymentsPage /> : null}
        {page === "reconciliation" ? <ReconciliationPage /> : null}
        {page === "cashIn" ? <CashInPage /> : null}
        {page === "cashOut" ? <CashOutPage /> : null}
        {page === "plannedHires" ? <V2CrudPage kind="plannedHires" /> : null}
        {page === "strategicRisks" ? <StrategicRisksPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "forecastReliability" ? <ForecastReliabilityPage /> : null}
        {page === "clientPaymentProfiles" ? <ClientPaymentProfilesPage /> : null}
        {page === "financialAnomalies" ? <FinancialAnomaliesPage /> : null}
        {page === "dataQuality" ? <DataQualityPage /> : null}
        {page === "connectorSupervision" ? <ConnectorSupervisionPage /> : null}
        {page === "bankConsents" ? <BankConsentsPage /> : null}
        {page === "financialRules" ? <FinancialRulesPage /> : null}
        {page === "codirReport" ? <CodirReportPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "financialAudit" ? <FinancialAuditPage /> : null}
        {page === "aiAnalysis" ? <AiAnalysisPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "rules" ? <V2CrudPage kind="rules" /> : null}
        {page === "notifications" ? <V2CrudPage kind="notifications" /> : null}
        {page === "documents" ? <V2CrudPage kind="documents" /> : null}
        {page === "connectors" ? <V2CrudPage kind="connectors" /> : null}
        {page === "alerts" ? <AlertsPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "reports" ? <ReportsPage scenarioId={scenarioId} horizon={horizon} /> : null}
        {page === "settings" ? <Settings /> : null}
        {page === "audit" ? <AuditPage /> : null}
        {page === "admin" ? <AdminPage /> : null}
        {cfg ? <CrudPage title={cfg.title} path={cfg.path} fields={cfg.fields} columns={cfg.columns} initial={cfg.initial} /> : null}
      </main>
    </div>
  );
}
