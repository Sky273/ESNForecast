import {
  AlertTriangle, BarChart3, Bell, BookOpenCheck, BriefcaseBusiness, Building2, Calculator, ChevronDown, ChevronsLeft, ChevronsRight, Contact,
  DatabaseBackup, Euro, FileText, Gauge, Handshake, HeartPulse, HelpCircle, History, KeyRound, Landmark, LayoutDashboard, LockKeyhole, LogOut,
  Receipt, Search, Settings as SettingsIcon, Shield, Sparkles, TrendingUp, Users, WalletCards, Workflow
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { api } from "./api";
import { hasAllowedRole } from "./auth/components/RoleGuard";
import { AuthProvider, useAuth } from "./auth/hooks/useAuth";
import { AccessDeniedPage } from "./auth/pages/AccessDeniedPage";
import { ChangePasswordPage } from "./auth/pages/ChangePasswordPage";
import { FirstLoginPage } from "./auth/pages/FirstLoginPage";
import { ForgotPasswordPage } from "./auth/pages/ForgotPasswordPage";
import { LoginPage } from "./auth/pages/LoginPage";
import { ResetPasswordPage } from "./auth/pages/ResetPasswordPage";
import { SessionExpiredPage } from "./auth/pages/SessionExpiredPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { CrudPage } from "./components/CrudPage";
import { I18nProvider, useI18n } from "./i18n";
import { Settings } from "./features/administration";
import {
  ActionPlansPage, AnnualLandingPage, BudgetDetailPage, BudgetForecastActualPage, BudgetStaffingPage, BudgetsPage, ObjectivesPage,
  RequiredPipelinePage, RollingForecastPage, TrajectoryDashboardPage, VarianceAnalysesPage, WhatMustBeTruePage
} from "./features/budget";
import {
  BankAccountsPage, BankConsentsPage, BankReconciliationPage, BankTransactionsPage, ClientPaymentProfilesPage, CodirReportPage,
  ConnectedFinanceDashboard, ConnectorSupervisionPage, DataQualityPage, FinancialAnomaliesPage, FinancialAuditPage, FinancialRulesPage,
  ForecastReliabilityPage, ImportedAccountingPage, RealTreasuryPage, ReforecastPage, RunwayPage
} from "./features/connected-finance";
import {
  ActualsVariancesPage, AiAnalysisPage, CapacityPage, DocumentsPage, ExecutiveCockpitPage, MonthlyClosePage, MonteCarloPage, PaymentsPage, RealInvoicesPage,
  ReconciliationPage, SkillsPage, StaffingForecastPage, StrategicRisksPage, TimesheetsPage, V2CrudPage
} from "./features/delivery";
import {
  AdminPage, AlertsPage, AuditPage, BenchPage, BillingPage, CashInPage, CashOutPage, ProfitabilityMissionsPage, ProfitabilityResourcesPage,
  Projections, ReportsPage, ScenariosPage, SimulationsPage, TreasuryPage
} from "./features/forecasting";
import { Dashboard } from "./features/pilotage";
import {
  BackofficeSupportPage, BackupsPage, FeatureFlagsPage, HelpPage, JobsPage, ObservabilityPage, OnboardingPage, PerformancePage,
  SecurityPage, SystemStatusPage
} from "./features/platform";
import {
  MissionPricingProfilePage, PricingDashboardPage, PricingHistoryPage, PricingReportPage, PricingSettingsPage, PricingSimulatorPage,
  RenegotiationCandidatesPage, UnderpricedMissionsPage
} from "./features/pricing";
import {
  ConnectorCompliancePage, ConsentCompliancePage, DataSourcePoliciesPage, DuplicatesPage, ProviderConnectionPage, ProviderErrorsPage,
  ProviderHealthPage, ProviderRateLimitsPage, ProviderWebhooksPage, RealConnectorsPage
} from "./features/providers";
import { configs } from "./features/shared-crud";
import { Assignments } from "./features/staffing";

type NavItem = { id: string; label: string; icon: ComponentType<{ size?: number; className?: string }>; badge?: string; keywords?: string };
type NavGroup = { id: string; label: string; icon: ComponentType<{ size?: number; className?: string }>; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    id: "pilotage",
    label: "Pilotage",
    icon: LayoutDashboard,
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "trajectory", label: "Trajectoire", icon: TrendingUp },
      { id: "executiveV2", label: "Vue direction", icon: Sparkles },
      { id: "treasury", label: "Trésorerie", icon: TrendingUp },
      { id: "connectedFinance", label: "Finance connect\u00e9e", icon: Landmark },
      { id: "actuals", label: "Prévisionnel vs réel", icon: BarChart3 },
      { id: "codirReport", label: "Rapport CODIR", icon: FileText },
      { id: "budgetForecastActual", label: "Rapport Budget / Forecast / Actual", icon: FileText }
    ]
  },
  {
    id: "budget",
    label: "Budget & objectifs",
    icon: Gauge,
    items: [
      { id: "budgets", label: "Budgets", icon: Calculator },
      { id: "budgetDetail", label: "Détail budget", icon: FileText },
      { id: "objectives", label: "Objectifs", icon: Gauge },
      { id: "rollingForecast", label: "Rolling Forecast", icon: TrendingUp },
      { id: "annualLanding", label: "Atterrissage annuel", icon: HeartPulse },
      { id: "variances", label: "Écarts", icon: BarChart3, badge: "3" },
      { id: "actionPlans", label: "Plans d'action", icon: Workflow, badge: "4" },
      { id: "requiredPipeline", label: "Pipeline nécessaire", icon: BriefcaseBusiness },
      { id: "budgetStaffing", label: "Staffing budgétaire", icon: Users },
      { id: "whatMustBeTrue", label: "Conditions de réussite", icon: Shield }
    ]
  },
  {
    id: "forecasts",
    label: "Prévisions & scenarios",
    icon: Calculator,
    items: [
      { id: "projections", label: "Projections", icon: Calculator },
      { id: "scenarios", label: "Scénarios", icon: BarChart3 },
      { id: "simulations", label: "Simulations", icon: Workflow },
      { id: "monteCarlo", label: "Monte Carlo", icon: Gauge },
      { id: "reforecast", label: "Reforecast", icon: TrendingUp },
      { id: "forecastReliability", label: "Fiabilité prévisionnelle", icon: Shield }
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
      { id: "assignments", label: "Affectations", icon: Users },
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
      { id: "freelancers", label: "Indépendants", icon: Contact },
      { id: "bench", label: "Intercontrat", icon: AlertTriangle },
      { id: "staffingForecast", label: "Staffing prévisionnel", icon: Users },
      { id: "capacity", label: "Capacity planning", icon: Gauge },
      { id: "profitabilityResources", label: "Rentabilit\u00e9 ressources", icon: BarChart3 },
      { id: "plannedHires", label: "Recrutements prévisionnels", icon: Users },
      { id: "skills", label: "Compétences", icon: Sparkles }
    ]
  },
  {
    id: "finance",
    label: "Finance",
    icon: Euro,
    items: [
      { id: "realInvoices", label: "Factures", icon: Receipt },
      { id: "billing", label: "Facturation pr\u00e9visionnelle", icon: Receipt },
      { id: "payments", label: "Paiements", icon: Euro },
      { id: "cashIn", label: "Encaissements", icon: TrendingUp },
      { id: "cashOut", label: "Décaissements", icon: Euro },
      { id: "fixedCosts", label: "Frais fixes", icon: WalletCards },
      { id: "variableCosts", label: "Frais variables", icon: Euro },
      { id: "bankTransactions", label: "Transactions bancaires", icon: Receipt },
      { id: "bankReconciliation", label: "Rapprochement bancaire", icon: Calculator },
      { id: "reconciliation", label: "Rapprochement facturation", icon: Calculator },
      { id: "importedAccounting", label: "Comptabilite importee", icon: FileText },
      { id: "realTreasury", label: "Tr\u00e9sorerie r\u00e9elle", icon: TrendingUp },
      { id: "clientPaymentProfiles", label: "Profils de paiement", icon: Euro },
      { id: "runway", label: "Runway", icon: HeartPulse }
    ]
  },
  {
    id: "pricing",
    label: "Pricing & marge",
    icon: Euro,
    items: [
      { id: "pricingDashboard", label: "Dashboard pricing", icon: Gauge },
      { id: "pricingSimulator", label: "Simulateur pricing", icon: Calculator },
      { id: "missionPricingProfile", label: "Profil pricing mission", icon: FileText },
      { id: "underpricedMissions", label: "Missions sous-margées", icon: AlertTriangle, badge: "3" },
      { id: "renegotiationCandidates", label: "Missions à renégocier", icon: Handshake, badge: "2" },
      { id: "pricingSettings", label: "Paramètres pricing", icon: SettingsIcon },
      { id: "pricingReport", label: "Rapport pricing", icon: FileText },
      { id: "pricingHistory", label: "Historique pricing", icon: History }
    ]
  },
  {
    id: "data",
    label: "Connecteurs & données",
    icon: Handshake,
    items: [
      { id: "realConnectors", label: "Connecteurs", icon: Handshake, badge: "!" },
      { id: "connectors", label: "Connecteurs delivery", icon: Workflow },
      { id: "providerConnection", label: "Connexion provider", icon: Sparkles },
      { id: "connectorSupervision", label: "Supervision connecteurs", icon: Gauge },
      { id: "bankAccounts", label: "Comptes bancaires", icon: Landmark },
      { id: "bankConsents", label: "Consentements bancaires", icon: Shield },
      { id: "dataQuality", label: "Santé des données", icon: Shield, badge: "3" },
      { id: "sourcePolicies", label: "Sources de verite", icon: SettingsIcon },
      { id: "duplicates", label: "Doublons", icon: DatabaseBackup },
      { id: "connectorCompliance", label: "Conformité connecteurs", icon: Shield },
      { id: "consentCompliance", label: "Consentements V4", icon: Shield }
    ]
  },
  {
    id: "risks",
    label: "Risques & alertes",
    icon: AlertTriangle,
    items: [
      { id: "alerts", label: "Alertes", icon: AlertTriangle, badge: "2" },
      { id: "financialAnomalies", label: "Anomalies financières", icon: AlertTriangle },
      { id: "strategicRisks", label: "Risques stratégiques", icon: Shield },
      { id: "financialRules", label: "Règles métier", icon: SettingsIcon },
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
      { id: "settings", label: "Paramètres", icon: SettingsIcon },
      { id: "audit", label: "Audit", icon: History },
      { id: "financialAudit", label: "Audit financier", icon: History },
      { id: "security", label: "Sécurité", icon: LockKeyhole },
      { id: "featureFlags", label: "Feature flags", icon: Workflow },
      { id: "backofficeSupport", label: "Backoffice support", icon: Shield },
      { id: "onboarding", label: "Onboarding", icon: BookOpenCheck },
      { id: "help", label: "Aide contextuelle", icon: HelpCircle }
    ]
  }
];

const allItems = navGroups.flatMap((group) => group.items.map((item) => ({ ...item, groupId: group.id })));
const AUTHENTICATION_DISABLED = false;
const AUTH_DISABLED_USER = {
  id: "auth-disabled-local-user",
  email: "local@esnforecast.local",
  name: "Accès local",
  role: "admin"
} as const;

export function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </I18nProvider>
  );
}

function AppContent() {
  const { language, setLanguage, t } = useI18n();
  const auth = useAuth();
  const currentUser = AUTHENTICATION_DISABLED ? AUTH_DISABLED_USER : auth.user;
  const [page, setPage] = useState("dashboard");
  const [horizon, setHorizon] = useState(12);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [scenarioId, setScenarioId] = useState("");
  const [compact, setCompact] = useState(() => localStorage.getItem("esn-forecast-compact-nav") === "true");
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [authRoute, setAuthRoute] = useState(() => readAuthRoute());
  const searchRef = useRef<HTMLInputElement>(null);
  const cfg = configs[page];
  const activeItem = allItems.find((item) => item.id === page) ?? allItems[0];

  useEffect(() => {
    if (!currentUser) return;
    api<any[]>("/scenarios").then((rows) => {
      setScenarios(rows);
      setScenarioId(rows.find((row) => row.isActive)?.id ?? rows[0]?.id ?? "");
    }).catch(() => undefined);
  }, [currentUser]);

  useEffect(() => {
    sessionStorage.setItem("esn-forecast-current-page", page);
  }, [page]);

  useEffect(() => {
    const onHashChange = () => setAuthRoute(readAuthRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!currentUser || authRoute.name !== "provider-connection") return;
    setPage("providerConnection");
  }, [authRoute.name, currentUser]);

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
        items: group.items.filter((item) => `${t(`nav.${item.id}`, item.label)} ${item.keywords ?? ""} ${t(`nav.group.${group.id}`, group.label)}`.toLowerCase().includes(value))
      }))
      .filter((group) => group.items.length);
  }, [query, t]);

  const toggleGroup = (id: string) => setOpenGroups((current) => ({ ...current, [id]: !Boolean(current[id]) }));
  const openPage = (id: string) => {
    setPage(id);
    setQuery("");
  };

  const content = renderPage(page, scenarioId, horizon, setHorizon, cfg);
  const requiredRoles = getRequiredRoles(page);

  const goLogin = () => {
    auth.clearSessionExpired();
    window.location.hash = "#/login";
    setAuthRoute(readAuthRoute());
  };

  const afterLogin = () => {
    const requested = sessionStorage.getItem("esn-forecast-requested-page");
    if (requested && allItems.some((item) => item.id === requested)) setPage(requested);
    sessionStorage.removeItem("esn-forecast-requested-page");
    window.location.hash = "";
    setAuthRoute(readAuthRoute());
  };

  if (!AUTHENTICATION_DISABLED && auth.loading) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-muted">{t("common.loading")}</div>;
  }

  if (!AUTHENTICATION_DISABLED && (authRoute.name === "session-expired" || auth.sessionExpired)) {
    return <SessionExpiredPage onLogin={goLogin} />;
  }

  if (!currentUser) {
    if (authRoute.name === "forgot-password") return <ForgotPasswordPage onBack={goLogin} />;
    if (authRoute.name === "reset-password") return <ResetPasswordPage token={authRoute.token} onBack={goLogin} />;
    if (authRoute.name === "first-login") return <FirstLoginPage token={authRoute.token} onDone={goLogin} />;
    return <LoginPage onAuthenticated={afterLogin} onForgotPassword={() => { window.location.hash = "#/forgot-password"; setAuthRoute(readAuthRoute()); }} />;
  }

  if (!AUTHENTICATION_DISABLED && authRoute.name === "change-password") {
    return <ChangePasswordPage onDone={() => { window.location.hash = ""; setAuthRoute(readAuthRoute()); }} />;
  }

  if (!AUTHENTICATION_DISABLED && (authRoute.name === "access-denied" || (requiredRoles.length && !hasAllowedRole(currentUser.role, requiredRoles)))) {
    return <AccessDeniedPage onDashboard={() => { setPage("dashboard"); window.location.hash = ""; setAuthRoute(readAuthRoute()); }} />;
  }

  return (
    <div className={`h-screen overflow-hidden bg-slate-50 lg:grid ${compact ? "lg:grid-cols-[76px_1fr]" : "lg:grid-cols-[300px_1fr]"}`}>
      <aside className="hidden h-screen min-h-0 border-r border-line bg-white lg:flex lg:flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <div className={compact ? "sr-only" : ""}>
            <div className="text-lg font-semibold tracking-normal">{t("app.name")}</div>
            <div className="text-xs text-muted">{t("app.subtitle")}</div>
          </div>
          <button className="rounded-md border border-line p-2 text-muted hover:bg-surface" aria-label={compact ? t("common.expandMenu", "Étendre le menu") : t("common.compactMenu", "Compacter le menu")} onClick={() => setCompact((value) => !value)}>
            {compact ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
          </button>
        </div>

        {!compact ? (
          <div className="shrink-0 border-b border-line p-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-2.5 text-muted" size={16} />
              <input ref={searchRef} className="w-full rounded-md border border-line py-2 pl-9 pr-3 text-sm outline-none focus:border-brand" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("common.searchPage")} />
            </label>
          </div>
        ) : null}

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {filteredGroups.map((group) => {
            const GroupIcon = group.icon;
            const isOpen = compact || Boolean(query) || Boolean(openGroups[group.id]);
            return (
              <div key={group.id} className="mb-2">
                <button className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs font-semibold uppercase text-muted hover:bg-surface ${compact ? "justify-center" : "justify-between"}`} onClick={() => toggleGroup(group.id)} title={compact ? t(`nav.group.${group.id}`, group.label) : undefined}>
                  <span className="flex items-center gap-2">
                    <GroupIcon size={16} />
                    {!compact ? t(`nav.group.${group.id}`, group.label) : null}
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
                          title={compact ? t(`nav.${item.id}`, item.label) : undefined}
                          className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${compact ? "justify-center px-2" : ""} ${active ? "bg-emerald-50 font-medium text-brand" : "text-slate-700 hover:bg-surface"}`}
                        >
                          <Icon size={17} />
                          {!compact ? <span className="min-w-0 flex-1 truncate">{t(`nav.${item.id}`, item.label)}</span> : null}
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
          {compact ? <HeartPulse size={17} className="mx-auto text-emerald-600" /> : <div className="flex items-center justify-between"><span>{t("app.version")}</span><span className="text-emerald-700">{t("app.status.operational")}</span></div>}
        </div>
      </aside>

      <div className="flex h-screen min-h-0 flex-col">
        <header className="shrink-0 border-b border-line bg-white px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs text-muted">{activeItem ? t(`nav.group.${activeItem.groupId}`, t("app.name")) : t("app.name")} /</div>
              <div className="text-lg font-semibold tracking-normal">{activeItem ? t(`nav.${activeItem.id}`, activeItem.label) : t("nav.dashboard")}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="rounded-md border border-line px-3 py-2 text-sm" value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>
                {scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}
              </select>
              <select className="rounded-md border border-line px-3 py-2 text-sm" value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>
                {[3, 6, 12, 24].map((value) => <option key={value} value={value}>{value} {t("common.months")}</option>)}
              </select>
              <select className="rounded-md border border-line px-3 py-2 text-sm" aria-label={t("common.language")} value={language} onChange={(event) => setLanguage(event.target.value as "fr" | "en")}>
                <option value="fr">FR</option>
                <option value="en">EN</option>
              </select>
              <button className="rounded-md border border-line p-2 text-muted hover:bg-surface" aria-label={t("common.notifications")}><Bell size={17} /></button>
              {AUTHENTICATION_DISABLED ? <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">{t("auth.disabled")}</span> : null}
              {!AUTHENTICATION_DISABLED ? <button className="rounded-md border border-line p-2 text-muted hover:bg-surface" aria-label={t("auth.changePassword")} title={t("auth.changePassword")} onClick={() => { window.location.hash = "#/change-password"; setAuthRoute(readAuthRoute()); }}><KeyRound size={17} /></button> : null}
              {!AUTHENTICATION_DISABLED ? <button className="rounded-md border border-line p-2 text-muted hover:bg-surface" aria-label={t("auth.logout")} title={`${t("auth.logout")} - ${currentUser.name}`} onClick={() => void auth.logout()}><LogOut size={17} /></button> : null}
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

type AuthRoute = { name: string; token?: string };

function readAuthRoute(): AuthRoute {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [name, search = ""] = hash.split("?");
  if (!name) return { name: "" };
  const params = new URLSearchParams(search);
  return { name, token: params.get("token") ?? undefined };
}

function getRequiredRoles(page: string) {
  const adminPages = new Set(["admin", "rules", "settings", "audit", "financialAudit", "security", "featureFlags", "backofficeSupport", "systemStatus"]);
  const financePages = new Set(["bankAccounts", "bankTransactions", "bankReconciliation", "importedAccounting", "realTreasury", "runway", "payments", "realInvoices"]);
  if (adminPages.has(page)) return ["admin"];
  if (financePages.has(page)) return ["admin", "direction", "finance", "manager"];
  return [];
}

function renderPage(page: string, scenarioId: string, horizon: number, setHorizon: (horizon: number) => void, cfg: any) {
  if (page === "dashboard") return <Dashboard horizon={horizon} setHorizon={setHorizon} />;
  if (page === "trajectory") return <TrajectoryDashboardPage />;
  if (page === "budgets") return <BudgetsPage />;
  if (page === "budgetDetail") return <BudgetDetailPage />;
  if (page === "objectives") return <ObjectivesPage />;
  if (page === "rollingForecast") return <RollingForecastPage />;
  if (page === "annualLanding") return <AnnualLandingPage />;
  if (page === "budgetForecastActual") return <BudgetForecastActualPage />;
  if (page === "variances") return <VarianceAnalysesPage />;
  if (page === "actionPlans") return <ActionPlansPage />;
  if (page === "requiredPipeline") return <RequiredPipelinePage />;
  if (page === "budgetStaffing") return <BudgetStaffingPage />;
  if (page === "whatMustBeTrue") return <WhatMustBeTruePage />;
  if (page === "pricingDashboard") return <PricingDashboardPage />;
  if (page === "pricingSimulator") return <PricingSimulatorPage />;
  if (page === "missionPricingProfile") return <MissionPricingProfilePage />;
  if (page === "underpricedMissions") return <UnderpricedMissionsPage />;
  if (page === "renegotiationCandidates") return <RenegotiationCandidatesPage />;
  if (page === "pricingSettings") return <PricingSettingsPage />;
  if (page === "pricingReport") return <PricingReportPage />;
  if (page === "pricingHistory") return <PricingHistoryPage />;
  if (page === "executiveV2") return <ExecutiveCockpitPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "connectedFinance") return <ConnectedFinanceDashboard scenarioId={scenarioId} horizon={horizon} />;
  if (page === "realConnectors") return <RealConnectorsPage />;
  if (page === "providerConnection") return <ProviderConnectionPage />;
  if (page === "projections") return <Projections horizon={horizon} />;
  if (page === "actuals") return <ActualsVariancesPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "timesheets") return <TimesheetsPage />;
  if (page === "monthlyClose") return <MonthlyClosePage />;
  if (page === "treasury") return <TreasuryPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "realTreasury") return <RealTreasuryPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "reforecast") return <ReforecastPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "runway") return <RunwayPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "scenarios") return <ScenariosPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "simulations") return <SimulationsPage />;
  if (page === "monteCarlo") return <MonteCarloPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "offers") return <V2CrudPage kind="offers" />;
  if (page === "profitabilityMissions") return <ProfitabilityMissionsPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "assignments") return <Assignments />;
  if (page === "profitabilityResources") return <ProfitabilityResourcesPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "capacity") return <CapacityPage scenarioId={scenarioId} horizon={horizon} />;
  if (page === "staffingForecast") return <StaffingForecastPage scenarioId={scenarioId} horizon={horizon} />;
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
  if (page === "documents") return <DocumentsPage />;
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
  if (page === "skills") return <SkillsPage />;
  return cfg ? <CrudPage title={cfg.title} path={cfg.path} fields={cfg.fields} columns={cfg.columns} initial={cfg.initial} /> : <Dashboard horizon={horizon} setHorizon={setHorizon} />;
}
