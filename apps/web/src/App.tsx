import {
  AlertTriangle, BarChart3, Bell, BookOpenCheck, BriefcaseBusiness, Building2, Calculator, ChevronDown, ChevronsLeft, ChevronsRight, Contact,
  DatabaseBackup, Euro, FileText, Gauge, Handshake, HeartPulse, HelpCircle, History, Landmark, LayoutDashboard, LockKeyhole, Receipt, Search,
  Settings as SettingsIcon, Shield, Sparkles, TrendingUp, Users, WalletCards, Workflow
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { api } from "./api";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { CrudPage } from "./components/CrudPage";
import { Assignments } from "./pages/Assignments";
import { Dashboard } from "./pages/Dashboard";
import { Projections } from "./pages/Projections";
import { Settings } from "./pages/Settings";
import {
  AdminPage, AlertsPage, AuditPage, BenchPage, BillingPage, CashInPage, CashOutPage, ProfitabilityMissionsPage, ProfitabilityResourcesPage,
  ReportsPage, ScenariosPage, SimulationsPage, TreasuryPage
} from "./pages/V1Pages";
import {
  ActualsVariancesPage, AiAnalysisPage, CapacityPage, ExecutiveCockpitPage, MonthlyClosePage, MonteCarloPage, PaymentsPage, RealInvoicesPage,
  ReconciliationPage, StrategicRisksPage, TimesheetsPage, V2CrudPage
} from "./pages/V2Pages";
import {
  BankAccountsPage, BankConsentsPage, BankReconciliationPage, BankTransactionsPage, ClientPaymentProfilesPage, CodirReportPage,
  ConnectedFinanceDashboard, ConnectorSupervisionPage, DataQualityPage, FinancialAnomaliesPage, FinancialAuditPage, FinancialRulesPage,
  ForecastReliabilityPage, ImportedAccountingPage, RealTreasuryPage, RunwayPage
} from "./pages/V3Pages";
import {
  ConnectorCompliancePage, ConsentCompliancePage, DataSourcePoliciesPage, DuplicatesPage, ProviderConnectionPage, ProviderErrorsPage,
  ProviderHealthPage, ProviderRateLimitsPage, ProviderWebhooksPage, RealConnectorsPage
} from "./pages/V4Pages";
import {
  BackofficeSupportPage, BackupsPage, FeatureFlagsPage, HelpPage, JobsPage, ObservabilityPage, OnboardingPage, PerformancePage,
  SecurityPage, SystemStatusPage
} from "./pages/V5Pages";
import { configs } from "./pages/crudConfigs";

type NavItem = { id: string; label: string; icon: ComponentType<{ size?: number; className?: string }>; badge?: string; keywords?: string };
type NavGroup = { id: string; label: string; icon: ComponentType<{ size?: number; className?: string }>; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    id: "pilotage",
    label: "Pilotage",
    icon: LayoutDashboard,
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "executiveV2", label: "Vue direction", icon: Sparkles },
      { id: "treasury", label: "Tresorerie", icon: TrendingUp },
      { id: "actuals", label: "Previsionnel vs reel", icon: BarChart3 },
      { id: "codirReport", label: "Rapport CODIR", icon: FileText }
    ]
  },
  {
    id: "forecasts",
    label: "Previsions & scenarios",
    icon: Calculator,
    items: [
      { id: "projections", label: "Projections", icon: Calculator },
      { id: "scenarios", label: "Scenarios", icon: BarChart3 },
      { id: "simulations", label: "Simulations", icon: Workflow },
      { id: "monteCarlo", label: "Monte Carlo", icon: Gauge },
      { id: "reforecast", label: "Reforecast", icon: TrendingUp },
      { id: "forecastReliability", label: "Fiabilite previsionnelle", icon: Shield }
    ]
  },
  {
    id: "activity",
    label: "Missions & activite",
    icon: BriefcaseBusiness,
    items: [
      { id: "missions", label: "Missions", icon: BriefcaseBusiness },
      { id: "offers", label: "Offres / devis", icon: Receipt },
      { id: "clients", label: "Clients", icon: Building2 },
      { id: "profitabilityMissions", label: "Rentabilite missions", icon: BarChart3 },
      { id: "timesheets", label: "CRA", icon: BookOpenCheck, badge: "2" },
      { id: "monthlyClose", label: "Cloture mensuelle", icon: LockKeyhole }
    ]
  },
  {
    id: "staffing",
    label: "Ressources & staffing",
    icon: Users,
    items: [
      { id: "employees", label: "Ressources internes", icon: Users },
      { id: "partners", label: "Partenaires", icon: Handshake },
      { id: "freelancers", label: "Independants", icon: Contact },
      { id: "bench", label: "Intercontrat", icon: AlertTriangle },
      { id: "staffingForecast", label: "Staffing previsionnel", icon: Users },
      { id: "capacity", label: "Capacity planning", icon: Gauge },
      { id: "plannedHires", label: "Recrutements previsionnels", icon: Users },
      { id: "skills", label: "Competences", icon: Sparkles }
    ]
  },
  {
    id: "finance",
    label: "Finance",
    icon: Euro,
    items: [
      { id: "realInvoices", label: "Factures", icon: Receipt },
      { id: "payments", label: "Paiements", icon: Euro },
      { id: "cashIn", label: "Encaissements", icon: TrendingUp },
      { id: "cashOut", label: "Decaissements", icon: Euro },
      { id: "fixedCosts", label: "Frais fixes", icon: WalletCards },
      { id: "variableCosts", label: "Frais variables", icon: Euro },
      { id: "bankTransactions", label: "Transactions bancaires", icon: Receipt },
      { id: "bankReconciliation", label: "Rapprochement bancaire", icon: Calculator },
      { id: "importedAccounting", label: "Comptabilite importee", icon: FileText },
      { id: "runway", label: "Runway", icon: HeartPulse }
    ]
  },
  {
    id: "data",
    label: "Connecteurs & donnees",
    icon: Handshake,
    items: [
      { id: "realConnectors", label: "Connecteurs", icon: Handshake, badge: "!" },
      { id: "providerConnection", label: "Connexion provider", icon: Sparkles },
      { id: "connectorSupervision", label: "Supervision connecteurs", icon: Gauge },
      { id: "bankAccounts", label: "Comptes bancaires", icon: Landmark },
      { id: "bankConsents", label: "Consentements bancaires", icon: Shield },
      { id: "dataQuality", label: "Sante des donnees", icon: Shield, badge: "3" },
      { id: "sourcePolicies", label: "Sources de verite", icon: SettingsIcon },
      { id: "duplicates", label: "Doublons", icon: DatabaseBackup },
      { id: "connectorCompliance", label: "Conformite connecteurs", icon: Shield },
      { id: "consentCompliance", label: "Consentements V4", icon: Shield }
    ]
  },
  {
    id: "risks",
    label: "Risques & alertes",
    icon: AlertTriangle,
    items: [
      { id: "alerts", label: "Alertes", icon: AlertTriangle, badge: "2" },
      { id: "financialAnomalies", label: "Anomalies financieres", icon: AlertTriangle },
      { id: "strategicRisks", label: "Risques strategiques", icon: Shield },
      { id: "financialRules", label: "Regles metier", icon: SettingsIcon },
      { id: "notifications", label: "Notifications", icon: Bell, badge: "4" },
      { id: "aiAnalysis", label: "Analyse IA", icon: Sparkles }
    ]
  },
  {
    id: "documents",
    label: "Documents & rapports",
    icon: FileText,
    items: [
      { id: "documents", label: "Documents", icon: FileText },
      { id: "reports", label: "Rapports", icon: FileText },
      { id: "backups", label: "Exports & sauvegardes", icon: DatabaseBackup }
    ]
  },
  {
    id: "operations",
    label: "Exploitation",
    icon: Gauge,
    items: [
      { id: "observability", label: "Observabilite", icon: Gauge },
      { id: "jobs", label: "Jobs", icon: Workflow },
      { id: "systemStatus", label: "Statut systeme", icon: HeartPulse },
      { id: "providerHealth", label: "Health providers", icon: Shield },
      { id: "providerErrors", label: "Erreurs providers", icon: AlertTriangle },
      { id: "providerWebhooks", label: "Webhooks", icon: Bell },
      { id: "providerRateLimits", label: "Rate limits", icon: BarChart3 },
      { id: "performance", label: "Performance", icon: Gauge }
    ]
  },
  {
    id: "admin",
    label: "Administration",
    icon: SettingsIcon,
    items: [
      { id: "admin", label: "Utilisateurs", icon: Users },
      { id: "rules", label: "Roles & permissions", icon: Shield },
      { id: "settings", label: "Parametres", icon: SettingsIcon },
      { id: "audit", label: "Audit", icon: History },
      { id: "financialAudit", label: "Audit financier", icon: History },
      { id: "security", label: "Securite", icon: LockKeyhole },
      { id: "featureFlags", label: "Feature flags", icon: Workflow },
      { id: "backofficeSupport", label: "Backoffice support", icon: Shield },
      { id: "onboarding", label: "Onboarding", icon: BookOpenCheck },
      { id: "help", label: "Aide contextuelle", icon: HelpCircle }
    ]
  }
];

const allItems = navGroups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label, groupId: group.id })));

function getStoredGroups() {
  try {
    const stored = localStorage.getItem("esn-forecast-open-nav-groups");
    return stored ? JSON.parse(stored) as Record<string, boolean> : {};
  } catch {
    return {};
  }
}

export function App() {
  const [page, setPage] = useState("dashboard");
  const [horizon, setHorizon] = useState(12);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [scenarioId, setScenarioId] = useState("");
  const [compact, setCompact] = useState(() => localStorage.getItem("esn-forecast-compact-nav") === "true");
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({ pilotage: true, forecasts: true, ...getStoredGroups() }));
  const searchRef = useRef<HTMLInputElement>(null);
  const cfg = configs[page];
  const activeItem = allItems.find((item) => item.id === page) ?? allItems[0];

  useEffect(() => {
    api<any[]>("/scenarios").then((rows) => {
      setScenarios(rows);
      setScenarioId(rows.find((row) => row.isActive)?.id ?? rows[0]?.id ?? "");
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    localStorage.setItem("esn-forecast-open-nav-groups", JSON.stringify(openGroups));
  }, [openGroups]);

  useEffect(() => {
    localStorage.setItem("esn-forecast-compact-nav", String(compact));
  }, [compact]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCompact(false);
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filteredGroups = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return navGroups;
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => `${item.label} ${item.keywords ?? ""} ${group.label}`.toLowerCase().includes(value))
      }))
      .filter((group) => group.items.length);
  }, [query]);

  const toggleGroup = (id: string) => setOpenGroups((current) => ({ ...current, [id]: !(current[id] ?? true) }));
  const openPage = (id: string) => {
    setPage(id);
    setQuery("");
  };

  const content = renderPage(page, scenarioId, horizon, setHorizon, cfg);

  return (
    <div className={`h-screen overflow-hidden bg-slate-50 lg:grid ${compact ? "lg:grid-cols-[76px_1fr]" : "lg:grid-cols-[300px_1fr]"}`}>
      <aside className="hidden h-screen min-h-0 border-r border-line bg-white lg:flex lg:flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <div className={compact ? "sr-only" : ""}>
            <div className="text-lg font-semibold tracking-normal">ESN Forecast</div>
            <div className="text-xs text-muted">Pilotage financier ESN</div>
          </div>
          <button className="rounded-md border border-line p-2 text-muted hover:bg-surface" aria-label={compact ? "Etendre le menu" : "Compacter le menu"} onClick={() => setCompact((value) => !value)}>
            {compact ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
          </button>
        </div>

        {!compact ? (
          <div className="shrink-0 border-b border-line p-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-2.5 text-muted" size={16} />
              <input ref={searchRef} className="w-full rounded-md border border-line py-2 pl-9 pr-3 text-sm outline-none focus:border-brand" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une page (Ctrl+K)" />
            </label>
          </div>
        ) : null}

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {filteredGroups.map((group) => {
            const GroupIcon = group.icon;
            const isOpen = compact || query || (openGroups[group.id] ?? true);
            return (
              <div key={group.id} className="mb-2">
                <button className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs font-semibold uppercase text-muted hover:bg-surface ${compact ? "justify-center" : "justify-between"}`} onClick={() => toggleGroup(group.id)} title={compact ? group.label : undefined}>
                  <span className="flex items-center gap-2">
                    <GroupIcon size={16} />
                    {!compact ? group.label : null}
                  </span>
                  {!compact ? <ChevronDown size={15} className={`transition ${isOpen ? "" : "-rotate-90"}`} /> : null}
                </button>
                {isOpen ? (
                  <div className="mt-1 space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = page === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => openPage(item.id)}
                          title={compact ? item.label : undefined}
                          className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${compact ? "justify-center px-2" : ""} ${active ? "bg-emerald-50 font-medium text-brand" : "text-slate-700 hover:bg-surface"}`}
                        >
                          <Icon size={17} />
                          {!compact ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
                          {!compact && item.badge ? <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">{item.badge}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-line px-3 py-2 text-xs text-muted">
          {compact ? <HeartPulse size={17} className="mx-auto text-emerald-600" /> : <div className="flex items-center justify-between"><span>V5 exploitation</span><span className="text-emerald-700">operationnel</span></div>}
        </div>
      </aside>

      <div className="flex h-screen min-h-0 flex-col">
        <header className="shrink-0 border-b border-line bg-white px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs text-muted">{activeItem?.group ?? "ESN Forecast"} /</div>
              <div className="text-lg font-semibold tracking-normal">{activeItem?.label ?? "Dashboard"}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="rounded-md border border-line px-3 py-2 text-sm" value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>
                {scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}
              </select>
              <select className="rounded-md border border-line px-3 py-2 text-sm" value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>
                {[3, 6, 12, 24].map((value) => <option key={value} value={value}>{value} mois</option>)}
              </select>
              <button className="rounded-md border border-line p-2 text-muted hover:bg-surface" aria-label="Notifications"><Bell size={17} /></button>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <ErrorBoundary>{content}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function renderPage(page: string, scenarioId: string, horizon: number, setHorizon: (horizon: number) => void, cfg: any) {
  if (page === "dashboard") return <Dashboard horizon={horizon} setHorizon={setHorizon} />;
  if (page === "executiveV2") return <ExecutiveCockpitPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "connectedFinance") return <ConnectedFinanceDashboard scenarioId={scenarioId} horizon={horizon} />;
  if (page === "realConnectors") return <RealConnectorsPage />;
  if (page === "providerConnection") return <ProviderConnectionPage />;
  if (page === "projections") return <Projections horizon={horizon} />;
  if (page === "actuals") return <ActualsVariancesPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "timesheets") return <TimesheetsPage />;
  if (page === "monthlyClose") return <MonthlyClosePage />;
  if (page === "treasury") return <TreasuryPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "realTreasury" || page === "reforecast") return <RealTreasuryPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "runway") return <RunwayPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "scenarios") return <ScenariosPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "simulations") return <SimulationsPage />;
  if (page === "monteCarlo") return <MonteCarloPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "offers") return <V2CrudPage kind="offers" />;
  if (page === "profitabilityMissions") return <ProfitabilityMissionsPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "assignments") return <Assignments />;
  if (page === "profitabilityResources") return <ProfitabilityResourcesPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "capacity" || page === "staffingForecast") return <CapacityPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "bench") return <BenchPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "billing") return <BillingPage />;
  if (page === "realInvoices") return <RealInvoicesPage />;
  if (page === "bankAccounts") return <BankAccountsPage />;
  if (page === "bankTransactions") return <BankTransactionsPage />;
  if (page === "bankReconciliation") return <BankReconciliationPage />;
  if (page === "importedAccounting") return <ImportedAccountingPage />;
  if (page === "payments") return <PaymentsPage />;
  if (page === "reconciliation") return <ReconciliationPage />;
  if (page === "cashIn") return <CashInPage />;
  if (page === "cashOut") return <CashOutPage />;
  if (page === "plannedHires") return <V2CrudPage kind="plannedHires" />;
  if (page === "strategicRisks") return <StrategicRisksPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "forecastReliability") return <ForecastReliabilityPage />;
  if (page === "clientPaymentProfiles") return <ClientPaymentProfilesPage />;
  if (page === "financialAnomalies") return <FinancialAnomaliesPage />;
  if (page === "dataQuality") return <DataQualityPage />;
  if (page === "connectorSupervision") return <ConnectorSupervisionPage />;
  if (page === "providerHealth") return <ProviderHealthPage />;
  if (page === "providerErrors") return <ProviderErrorsPage />;
  if (page === "providerWebhooks") return <ProviderWebhooksPage />;
  if (page === "providerRateLimits") return <ProviderRateLimitsPage />;
  if (page === "duplicates") return <DuplicatesPage />;
  if (page === "sourcePolicies") return <DataSourcePoliciesPage />;
  if (page === "connectorCompliance") return <ConnectorCompliancePage />;
  if (page === "consentCompliance") return <ConsentCompliancePage />;
  if (page === "bankConsents") return <BankConsentsPage />;
  if (page === "financialRules") return <FinancialRulesPage />;
  if (page === "codirReport") return <CodirReportPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "financialAudit") return <FinancialAuditPage />;
  if (page === "aiAnalysis") return <AiAnalysisPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "rules") return <V2CrudPage kind="rules" />;
  if (page === "notifications") return <V2CrudPage kind="notifications" />;
  if (page === "documents") return <V2CrudPage kind="documents" />;
  if (page === "connectors") return <V2CrudPage kind="connectors" />;
  if (page === "alerts") return <AlertsPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "reports") return <ReportsPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "settings") return <Settings />;
  if (page === "audit") return <AuditPage />;
  if (page === "admin") return <AdminPage />;
  if (page === "observability") return <ObservabilityPage />;
  if (page === "jobs") return <JobsPage />;
  if (page === "systemStatus") return <SystemStatusPage />;
  if (page === "backofficeSupport") return <BackofficeSupportPage />;
  if (page === "backups") return <BackupsPage />;
  if (page === "security") return <SecurityPage />;
  if (page === "featureFlags") return <FeatureFlagsPage />;
  if (page === "onboarding") return <OnboardingPage />;
  if (page === "help") return <HelpPage pageKey="dashboard" />;
  if (page === "performance") return <PerformancePage />;
  if (page === "skills") return <CapacityPage scenarioId={scenarioId} horizon={horizon} />;
  return cfg ? <CrudPage title={cfg.title} path={cfg.path} fields={cfg.fields} columns={cfg.columns} initial={cfg.initial} /> : <Dashboard horizon={horizon} setHorizon={setHorizon} />;
}
