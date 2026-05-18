import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { SecretManager } from "../src/connectors/secretManager";

const prisma = new PrismaClient();
const secrets = new SecretManager(process.env.SECRET_ENCRYPTION_KEY ?? "seed-démo-key");
const d = (value: string) => new Date(`${value}T00:00:00.000Z`);
const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};

async function main() {
  await prisma.marginException.deleteMany();
  await prisma.pricingDecision.deleteMany();
  await prisma.renegotiationCandidate.deleteMany();
  await prisma.pricingSimulationVariant.deleteMany();
  await prisma.pricingSimulation.deleteMany();
  await prisma.missionPricingProfile.deleteMany();
  await prisma.pricingSettings.deleteMany();
  await prisma.whatMustBeTrueCondition.deleteMany();
  await prisma.budgetStaffingSnapshot.deleteMany();
  await prisma.requiredPipelineSnapshot.deleteMany();
  await prisma.annualLandingSnapshot.deleteMany();
  await prisma.actionSuggestion.deleteMany();
  await prisma.actionItem.deleteMany();
  await prisma.actionPlan.deleteMany();
  await prisma.varianceComment.deleteMany();
  await prisma.varianceCause.deleteMany();
  await prisma.varianceAnalysis.deleteMany();
  await prisma.rollingForecastLine.deleteMany();
  await prisma.rollingForecast.deleteMany();
  await prisma.objective.deleteMany();
  await prisma.budgetLine.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.helpArticle.deleteMany();
  await prisma.dataQualityScore.deleteMany();
  await prisma.performanceSnapshot.deleteMany();
  await prisma.supportAction.deleteMany();
  await prisma.onboardingState.deleteMany();
  await prisma.featureFlag.deleteMany();
  await prisma.sensitiveDataAccessLog.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.securityEvent.deleteMany();
  await prisma.purgeRun.deleteMany();
  await prisma.retentionPolicy.deleteMany();
  await prisma.exportRun.deleteMany();
  await prisma.restoreRun.deleteMany();
  await prisma.backupRun.deleteMany();
  await prisma.errorReport.deleteMany();
  await prisma.applicationLog.deleteMany();
  await prisma.systemEvent.deleteMany();
  await prisma.jobRun.deleteMany();
  await prisma.dataSourcePolicy.deleteMany();
  await prisma.duplicateCandidate.deleteMany();
  await prisma.providerRateLimitState.deleteMany();
  await prisma.providerError.deleteMany();
  await prisma.providerWebhookEvent.deleteMany();
  await prisma.syncCursor.deleteMany();
  await prisma.oAuthConnectionSession.deleteMany();
  await prisma.secretAccessLog.deleteMany();
  await prisma.providerToken.deleteMany();
  await prisma.providerCredential.deleteMany();
  await prisma.providerCapability.deleteMany();
  await prisma.financialExportLog.deleteMany();
  await prisma.codirReport.deleteMany();
  await prisma.dataQualityIssue.deleteMany();
  await prisma.financialAnomaly.deleteMany();
  await prisma.forecastReliabilityScore.deleteMany();
  await prisma.reforecastSuggestion.deleteMany();
  await prisma.clientPaymentProfile.deleteMany();
  await prisma.accountingPaymentImport.deleteMany();
  await prisma.accountingInvoiceImport.deleteMany();
  await prisma.financialReconciliation.deleteMany();
  await prisma.reconciliationSuggestion.deleteMany();
  await prisma.ruleEvaluationLog.deleteMany();
  await prisma.bankCategorizationRule.deleteMany();
  await prisma.financialCategory.deleteMany();
  await prisma.bankTransaction.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.bankConsent.deleteMany();
  await prisma.bankConnection.deleteMany();
  await prisma.connectorSyncRun.deleteMany();
  await prisma.connector.deleteMany();
  await prisma.offerLine.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.businessRule.deleteMany();
  await prisma.document.deleteMany();
  await prisma.webhookSubscription.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.approvalWorkflow.deleteMany();
  await prisma.monteCarloResult.deleteMany();
  await prisma.probabilisticAssumption.deleteMany();
  await prisma.plannedHire.deleteMany();
  await prisma.missionSkillNeed.deleteMany();
  await prisma.resourceSkill.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.businessCalendar.deleteMany();
  await prisma.absence.deleteMany();
  await prisma.hrSync.deleteMany();
  await prisma.accountingSync.deleteMany();
  await prisma.crmOpportunity.deleteMany();
  await prisma.billingReconciliation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.monthlyClose.deleteMany();
  await prisma.monthlyActual.deleteMany();
  await prisma.timesheet.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.monthlyProjectionCache.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.reportExport.deleteMany();
  await prisma.cashOutForecast.deleteMany();
  await prisma.cashInForecast.deleteMany();
  await prisma.invoiceForecast.deleteMany();
  await prisma.simulationEvent.deleteMany();
  await prisma.scenarioOverride.deleteMany();
  await prisma.scenario.deleteMany();
  await prisma.variableCost.deleteMany();
  await prisma.fixedCost.deleteMany();
  await prisma.missionAssignment.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.client.deleteMany();
  await prisma.freelancer.deleteMany();
  await prisma.partnerResource.deleteMany();
  await prisma.partner.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.projectionSettings.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();

  const organization = await prisma.organization.create({ data: { name: "ESN Forecast Demo Group", slug: "démo-group" } });

  const company = await prisma.company.create({
    data: {
      organizationId: organization.id,
      name: "ESN Forecast Demo",
      currency: "EUR",
      defaultEmployeeSocialRate: 0.22,
      defaultEmployerRate: 0.45,
      defaultOverheadRate: 0.08,
      projectionStartMonth: "2026-06",
      defaultProjectionHorizonMonths: 12
    }
  });

  await prisma.projectionSettings.create({
    data: {
      horizonMonths: 12,
      averageBusinessDaysPerMonth: 20,
      defaultEmployeeChargeRate: 0.45,
      overheadRate: 0.08,
      simplifiedTaxRate: 0.1,
      defaultPaymentDelayDays: 30,
      defaultSupplierPaymentDelayDays: 30,
      applyProbabilityToPlannedMissions: true,
      minimumMarginRate: 0.22,
      initialCash: 120000,
      criticalCashThreshold: 30000,
      minimumUtilizationRate: 0.75,
      employeeCostMode: "full_monthly"
    }
  });

  await Promise.all([
    prisma.user.create({ data: { organizationId: organization.id, email: "admin@esnforecast.local", name: "Admin ESN", role: "admin", passwordHash: hashPassword("démo") } }),
    prisma.user.create({ data: { organizationId: organization.id, email: "direction@esnforecast.local", name: "Direction ESN", role: "direction", passwordHash: hashPassword("démo") } }),
    prisma.user.create({ data: { organizationId: organization.id, email: "finance@esnforecast.local", name: "Finance ESN", role: "finance", passwordHash: hashPassword("démo") } })
  ]);

  const [referenceScenario, pessimisticScenario, optimisticScenario] = await Promise.all([
    prisma.scenario.create({ data: { name: "Reference", type: "reference", isActive: true, riskLevel: "medium", author: "Direction", notes: "Scenario de pilotage courant" } }),
    prisma.scenario.create({ data: { name: "Pessimiste", type: "pessimistic", riskLevel: "high", author: "Direction", notes: "Perte mission et retard encaissement" } }),
    prisma.scenario.create({ data: { name: "Optimiste", type: "optimistic", riskLevel: "low", author: "Direction", notes: "Hausse TJM et prolongation mission" } })
  ]);

  const employees = await Promise.all([
    prisma.employee.create({ data: { firstName: "Alice", lastName: "Martin", position: "Lead Java", status: "consultant", assignable: true, startDate: d("2024-01-08"), monthlyGrossSalary: 4700, employerChargeRate: 0.45, benefitsMonthly: 480 } }),
    prisma.employee.create({ data: { firstName: "Mehdi", lastName: "Benali", position: "Data Engineer", status: "consultant", assignable: true, startDate: d("2024-04-15"), monthlyGrossSalary: 4300, employerChargeRate: 0.45, benefitsMonthly: 420 } }),
    prisma.employee.create({ data: { firstName: "Chloé", lastName: "Bernard", position: "Product Owner", status: "consultant", assignable: true, startDate: d("2023-09-01"), monthlyGrossSalary: 4100, employerChargeRate: 0.43, benefitsMonthly: 390 } }),
    prisma.employee.create({ data: { firstName: "Thomas", lastName: "Petit", position: "DevOps", status: "consultant", assignable: true, startDate: d("2025-02-03"), monthlyGrossSalary: 4500, employerChargeRate: 0.45, benefitsMonthly: 450 } }),
    prisma.employee.create({ data: { firstName: "Sarah", lastName: "Leroy", position: "Consultante QA", status: "consultant", assignable: true, startDate: d("2025-10-01"), monthlyGrossSalary: 3600, employerChargeRate: 0.42, benefitsMonthly: 350, notes: "Plaçable, volontairement non affectée dans la démo" } }),
    prisma.employee.create({ data: { firstName: "Julien", lastName: "Moreau", position: "Commercial", status: "sales", assignable: false, startDate: d("2023-06-01"), monthlyGrossSalary: 5200, employerChargeRate: 0.45, benefitsMonthly: 550 } }),
    prisma.employee.create({ data: { firstName: "Nora", lastName: "Diallo", position: "Office manager", status: "administrative", assignable: false, startDate: d("2022-03-01"), monthlyGrossSalary: 3200, employerChargeRate: 0.42, benefitsMonthly: 360 } }),
    prisma.employee.create({ data: { firstName: "Marc", lastName: "Vidal", position: "Dirigeant", status: "management", assignable: false, startDate: d("2021-01-01"), monthlyGrossSalary: 7000, employerChargeRate: 0.45, benefitsMonthly: 800 } })
  ]);

  const [partnerA, partnerB] = await Promise.all([
    prisma.partner.create({ data: { name: "Cloud Partners", notes: "Renfort DevOps et cloud" } }),
    prisma.partner.create({ data: { name: "DataCraft", notes: "Partenaire data et BI" } })
  ]);

  const partnerResources = await Promise.all([
    prisma.partnerResource.create({ data: { partnerId: partnerA.id, firstName: "Lina", lastName: "CP", role: "Architecte Cloud", dailyCost: 560, monthlyFees: 0, availableFrom: d("2026-01-01") } }),
    prisma.partnerResource.create({ data: { partnerId: partnerA.id, firstName: "Owen", lastName: "CP", role: "SRE", dailyCost: 500, monthlyFees: 0, availableFrom: d("2026-01-01") } }),
    prisma.partnerResource.create({ data: { partnerId: partnerB.id, firstName: "Maya", lastName: "DC", role: "Data Analyst", dailyCost: 420, monthlyFees: 150, availableFrom: d("2026-01-01") } }),
    prisma.partnerResource.create({ data: { partnerId: partnerB.id, firstName: "Rayan", lastName: "DC", role: "BI Engineer", dailyCost: 450, monthlyFees: 0, availableFrom: d("2026-01-01") } })
  ]);

  const freelancers = await Promise.all([
    prisma.freelancer.create({ data: { firstName: "Eva", lastName: "Klein", specialty: "UX Research", dailyCost: 620, monthlyFees: 0, paymentTerms: "30 jours", availableFrom: d("2026-01-01") } }),
    prisma.freelancer.create({ data: { firstName: "Karim", lastName: "Saadi", specialty: "Cyber sécurité", dailyCost: 720, monthlyFees: 250, paymentTerms: "45 jours", availableFrom: d("2026-01-01") } }),
    prisma.freelancer.create({ data: { firstName: "Lucie", lastName: "Roux", specialty: "Scrum master", dailyCost: 580, monthlyFees: 0, paymentTerms: "30 jours", availableFrom: d("2026-01-01") } })
  ]);

  const clients = await Promise.all([
    prisma.client.create({ data: { name: "Banque Horizon", sector: "Banque", primaryContact: "Claire Fontaine", contactEmail: "claire@horizon.example", paymentDelayDays: 45 } }),
    prisma.client.create({ data: { name: "AssurOne", sector: "Assurance", primaryContact: "Paul Renard", contactEmail: "paul@assurone.example", paymentDelayDays: 30 } }),
    prisma.client.create({ data: { name: "RetailNow", sector: "Retail", primaryContact: "Sophie Caron", contactEmail: "sophie@retailnow.example", paymentDelayDays: 30 } }),
    prisma.client.create({ data: { name: "HealthLink", sector: "Santé", primaryContact: "Nicolas Durand", contactEmail: "nicolas@healthlink.example", paymentDelayDays: 60 } }),
    prisma.client.create({ data: { name: "GreenGrid", sector: "Energie", primaryContact: "Amina Roche", contactEmail: "amina@greengrid.example", paymentDelayDays: 30 } })
  ]);

  const missions = await Promise.all([
    prisma.mission.create({ data: { title: "Refonte portail bancaire", clientId: clients[0].id, status: "active", type: "time_material", startDate: d("2026-02-01"), estimatedEndDate: d("2026-12-31"), defaultDailyRate: 1080, signatureProbability: 1, notes: "Mission très rentable" } }),
    prisma.mission.create({ data: { title: "Run data assurance", clientId: clients[1].id, status: "active", type: "service_center", startDate: d("2026-04-01"), estimatedEndDate: d("2026-09-30"), defaultDailyRate: 860, signatureProbability: 1 } }),
    prisma.mission.create({ data: { title: "Migration cloud retail", clientId: clients[2].id, status: "active", type: "technical_assistance", startDate: d("2026-05-01"), estimatedEndDate: d("2026-08-31"), defaultDailyRate: 930, signatureProbability: 1 } }),
    prisma.mission.create({ data: { title: "Audit sécurité santé", clientId: clients[3].id, status: "active", type: "fixed_price", startDate: d("2026-06-01"), estimatedEndDate: d("2026-07-31"), defaultDailyRate: 800, fixedPriceAmount: 36000, signatureProbability: 1, notes: "Peu rentable à cause d'un coût externe élevé" } }),
    prisma.mission.create({ data: { title: "Plateforme IA conformité", clientId: clients[0].id, status: "planned", type: "time_material", startDate: d("2026-09-01"), estimatedEndDate: d("2027-03-31"), defaultDailyRate: 850, signatureProbability: 0.65 } }),
    prisma.mission.create({ data: { title: "Centre de service énergie", clientId: clients[4].id, status: "planned", type: "service_center", startDate: d("2026-10-01"), estimatedEndDate: d("2027-05-31"), defaultDailyRate: 760, signatureProbability: 0.35 } }),
    prisma.mission.create({ data: { title: "Cadrage CRM retail", clientId: clients[2].id, status: "completed", type: "fixed_price", startDate: d("2026-01-01"), estimatedEndDate: d("2026-03-31"), actualEndDate: d("2026-03-20"), defaultDailyRate: 700, fixedPriceAmount: 24000, signatureProbability: 1 } }),
    prisma.mission.create({ data: { title: "Programme mobile assurance", clientId: clients[1].id, status: "suspended", type: "time_material", startDate: d("2026-03-01"), estimatedEndDate: d("2026-11-30"), defaultDailyRate: 720, signatureProbability: 1 } })
  ]);

  const assignmentData = [
    { missionId: missions[0].id, resourceType: "employee", resourceId: employees[0].id, employeeId: employees[0].id, startDate: d("2026-02-01"), estimatedEndDate: d("2026-12-31"), specificDailyRate: 1120, occupancyRate: 1, calculationMode: "business_days" },
    { missionId: missions[0].id, resourceType: "employee", resourceId: employees[1].id, employeeId: employees[1].id, startDate: d("2026-06-01"), estimatedEndDate: d("2026-11-30"), specificDailyRate: 980, occupancyRate: 0.8, calculationMode: "business_days" },
    { missionId: missions[1].id, resourceType: "employee", resourceId: employees[2].id, employeeId: employees[2].id, startDate: d("2026-04-01"), estimatedEndDate: d("2026-09-30"), specificDailyRate: 880, occupancyRate: 0.8, calculationMode: "business_days" },
    { missionId: missions[1].id, resourceType: "partner", resourceId: partnerResources[2].id, partnerResourceId: partnerResources[2].id, startDate: d("2026-05-01"), estimatedEndDate: d("2026-09-30"), specificDailyRate: 830, specificDailyCost: 420, occupancyRate: 1, calculationMode: "business_days" },
    { missionId: missions[2].id, resourceType: "employee", resourceId: employees[3].id, employeeId: employees[3].id, startDate: d("2026-05-01"), estimatedEndDate: d("2026-08-31"), specificDailyRate: 940, occupancyRate: 1, calculationMode: "business_days" },
    { missionId: missions[2].id, resourceType: "partner", resourceId: partnerResources[0].id, partnerResourceId: partnerResources[0].id, startDate: d("2026-06-15"), estimatedEndDate: d("2026-08-31"), specificDailyRate: 890, specificDailyCost: 560, occupancyRate: 0.6, calculationMode: "business_days" },
    { missionId: missions[3].id, resourceType: "freelancer", resourceId: freelancers[1].id, freelancerId: freelancers[1].id, startDate: d("2026-06-01"), estimatedEndDate: d("2026-07-31"), specificDailyRate: 800, specificDailyCost: 760, occupancyRate: 1, calculationMode: "business_days" },
    { missionId: missions[4].id, resourceType: "employee", resourceId: employees[1].id, employeeId: employees[1].id, startDate: d("2026-09-01"), estimatedEndDate: d("2027-03-31"), specificDailyRate: 860, occupancyRate: 1, calculationMode: "business_days" },
    { missionId: missions[4].id, resourceType: "freelancer", resourceId: freelancers[0].id, freelancerId: freelancers[0].id, startDate: d("2026-09-01"), estimatedEndDate: d("2026-12-31"), specificDailyRate: 780, specificDailyCost: 620, occupancyRate: 0.5, calculationMode: "business_days" },
    { missionId: missions[5].id, resourceType: "partner", resourceId: partnerResources[1].id, partnerResourceId: partnerResources[1].id, startDate: d("2026-10-01"), estimatedEndDate: d("2027-05-31"), specificDailyRate: 760, specificDailyCost: 500, occupancyRate: 1, calculationMode: "business_days" }
  ] as const;

  for (const data of assignmentData) {
    await prisma.missionAssignment.create({ data: data as any });
  }

  for (const data of [
    ["Loyer bureaux", "locaux", 6200],
    ["Assurance RC Pro", "assurance", 850],
    ["Outils SaaS", "logiciels", 2900],
    ["Comptabilité", "comptabilite", 1200],
    ["Téléphonie", "telecom", 420],
    ["Marketing récurrent", "marketing", 1800],
    ["Frais bancaires", "banque", 250],
    ["Leasing matériel", "materiel", 1600],
    ["Licences cloud internes", "cloud", 1100],
    ["Juridique", "juridique", 700]
  ] as const) {
    await prisma.fixedCost.create({ data: { label: data[0], category: data[1], monthlyAmount: data[2], startDate: d("2026-01-01"), recurrence: "monthly" } });
  }

  for (const data of [
    ["Prime cooptation", "recrutement", 2500, "2026-06-20"],
    ["Matériel consultant", "materiel", 4200, "2026-07-12"],
    ["Formation cloud", "formation", 3600, "2026-08-10"],
    ["Commission commerciale", "commission", 7000, "2026-09-30"],
    ["Provision impôts", "impots", 9500, "2026-10-15"],
    ["Déplacement client", "deplacement", 1800, "2026-06-25"],
    ["Campagne recrutement", "recrutement", 5200, "2026-11-10"],
    ["Achat licences projet", "logiciels", 3200, "2026-12-05"]
  ] as const) {
    await prisma.variableCost.create({ data: { label: data[0], category: data[1], amount: data[2], date: d(data[3]) } });
  }

  const scenarios = [referenceScenario, pessimisticScenario, optimisticScenario];
  for (const scenario of scenarios) {
    for (const mission of missions.filter((item) => ["active", "planned"].includes(item.status)).slice(0, 8)) {
      const invoiceDate = mission.startDate > d("2026-06-01") ? mission.startDate : d("2026-06-30");
      const expectedPaymentDate = new Date(invoiceDate);
      expectedPaymentDate.setUTCDate(expectedPaymentDate.getUTCDate() + 45);
      const baseAmount = mission.fixedPriceAmount ?? mission.defaultDailyRate * 20;
      const amountHT = scenario.type === "optimistic" ? baseAmount * 1.1 : scenario.type === "pessimistic" ? baseAmount * 0.85 : baseAmount;
      const probability = mission.status === "planned" ? mission.signatureProbability : 1;
      const invoice = await prisma.invoiceForecast.create({
        data: {
          missionId: mission.id,
          scenarioId: scenario.id,
          invoiceDate,
          dueDate: expectedPaymentDate,
          expectedPaymentDate,
          amountHT,
          vatRate: 0.2,
          amountTTC: amountHT * 1.2,
          probability,
          status: scenario.type === "pessimistic" && mission.status === "planned" ? "late" : "planned"
        }
      });
      await prisma.cashInForecast.create({
        data: {
          scenarioId: scenario.id,
          sourceType: "invoice",
          sourceId: invoice.id,
          expectedDate: expectedPaymentDate,
          amount: amountHT * 1.2,
          probability,
          weightedAmount: amountHT * 1.2 * probability,
          status: invoice.status === "late" ? "late" : "planned"
        }
      });
    }
  }

  await Promise.all([
    prisma.cashOutForecast.create({ data: { scenarioId: referenceScenario.id, sourceType: "tax", expectedDate: d("2026-09-15"), amount: 18000, status: "planned", notes: "Provision IS simplifiee" } }),
    prisma.cashOutForecast.create({ data: { scenarioId: pessimisticScenario.id, sourceType: "manual", expectedDate: d("2026-08-15"), amount: 45000, status: "planned", notes: "Retard client et besoin de tresorerie" } }),
    prisma.cashOutForecast.create({ data: { scenarioId: optimisticScenario.id, sourceType: "manual", expectedDate: d("2026-10-15"), amount: 12000, status: "planned", notes: "Recrutement anticipe" } }),
    prisma.simulationEvent.create({ data: { scenarioId: pessimisticScenario.id, type: "mission_loss", label: "Perte migration cloud", startDate: d("2026-08-01"), relatedMissionId: missions[2].id, parameters: {}, isActive: true } }),
    prisma.simulationEvent.create({ data: { scenarioId: pessimisticScenario.id, type: "exceptional_cost", label: "Impayé partiel client", startDate: d("2026-09-01"), amount: 30000, parameters: {}, isActive: true } }),
    prisma.simulationEvent.create({ data: { scenarioId: optimisticScenario.id, type: "sale_rate_change", label: "Hausse TJM banque", startDate: d("2026-06-01"), percentage: 0.08, relatedMissionId: missions[0].id, parameters: {}, isActive: true } }),
    prisma.simulationEvent.create({ data: { scenarioId: optimisticScenario.id, type: "mission_extension", label: "Extension portail bancaire", startDate: d("2026-12-01"), relatedMissionId: missions[0].id, parameters: { days: 90 }, isActive: true } }),
    prisma.alert.create({ data: { scenarioId: pessimisticScenario.id, type: "treasury_below_threshold", severity: "critical", message: "Tresorerie sous seuil dans le scenario pessimiste", month: "2026-09", recommendedAction: "Securiser encaissement ou reduire sous-traitance", status: "new" } }),
    prisma.alert.create({ data: { scenarioId: referenceScenario.id, type: "client_concentration", severity: "warning", message: "Banque Horizon concentre une part importante du CA", recommendedAction: "Diversifier le pipe commercial", status: "new" } }),
    prisma.auditLog.create({ data: { entityType: "seed", entityId: "v1", action: "create_démo_data", after: { scenarios: 3, users: 3 } } })
  ]);

  const realInvoice = await prisma.invoice.create({
    data: {
      companyId: company.id,
      clientId: clients[0].id,
      missionId: missions[0].id,
      invoiceNumber: "F-2026-0001",
      invoiceDate: d("2026-06-30"),
      dueDate: d("2026-08-14"),
      amountHT: 39200,
      vatRate: 0.2,
      amountTTC: 47040,
      status: "partially_paid",
      paidAmount: 28000,
      paymentDate: d("2026-08-05"),
      source: "generated_from_timesheet",
      notes: "Facture generee depuis CRA valide"
    }
  });

  await Promise.all([
    prisma.timesheet.create({ data: { companyId: company.id, resourceType: "employee", resourceId: employees[0].id, missionId: missions[0].id, month: 6, year: 2026, workedDays: 20, billableDays: 19, nonBillableDays: 1, absenceDays: 0, vacationDays: 0, sickLeaveDays: 0, trainingDays: 0, internalDays: 1, status: "approved", approvedAt: d("2026-07-03"), notes: "CRA valide pour facturation" } }),
    prisma.timesheet.create({ data: { companyId: company.id, resourceType: "employee", resourceId: employees[2].id, missionId: missions[1].id, month: 6, year: 2026, workedDays: 18, billableDays: 14, nonBillableDays: 4, absenceDays: 2, vacationDays: 2, sickLeaveDays: 0, trainingDays: 0, internalDays: 2, status: "submitted", submittedAt: d("2026-07-02"), notes: "A valider par finance" } }),
    prisma.timesheet.create({ data: { companyId: company.id, resourceType: "freelancer", resourceId: freelancers[1].id, missionId: missions[3].id, month: 6, year: 2026, workedDays: 20, billableDays: 20, nonBillableDays: 0, absenceDays: 0, vacationDays: 0, sickLeaveDays: 0, trainingDays: 0, internalDays: 0, status: "locked", lockedAt: d("2026-07-05"), notes: "CRA verrouille apres validation client" } }),
    prisma.monthlyActual.create({ data: { companyId: company.id, month: 6, year: 2026, actualRevenueGenerated: 92500, actualRevenueInvoiced: 81200, actualCashIn: 28000, actualEmployeeCosts: 43800, actualExternalCosts: 21800, actualFixedCosts: 17020, actualVariableCosts: 4300, actualCashOut: 86920, actualGrossMargin: 26900, actualNetMargin: 5580, actualClosingCash: 61080, notes: "Mois reel avec encaissement partiel" } }),
    prisma.monthlyClose.create({ data: { companyId: company.id, month: 5, year: 2026, status: "closed", closedAt: d("2026-06-07"), closedBy: "finance@esnforecast.local", initialForecastSnapshot: { revenue: 78000 }, revisedForecastSnapshot: { revenue: 82000 }, actualSnapshot: { revenue: 79500, cash: 69000 }, notes: "Mois cloture démo" } }),
    prisma.payment.create({ data: { invoiceId: realInvoice.id, clientId: clients[0].id, paymentDate: d("2026-08-05"), amount: 28000, paymentMethod: "wire", status: "received", notes: "Paiement partiel" } }),
    prisma.billingReconciliation.create({ data: { invoiceId: realInvoice.id, status: "partially_matched", amountVariance: -8040, dateVarianceDays: 7, notes: "Paiement partiel rapproche" } })
  ]);

  const [javaSkill, dataSkill, cloudSkill] = await Promise.all([
    prisma.skill.create({ data: { name: "Java", normalizedName: "java", category: "Backend", aliases: ["spring", "jvm"] } }),
    prisma.skill.create({ data: { name: "Data Engineering", normalizedName: "data-engineering", category: "Data", aliases: ["etl", "dbt"] } }),
    prisma.skill.create({ data: { name: "Cloud AWS", normalizedName: "cloud-aws", category: "Cloud", aliases: ["aws", "terraform"] } })
  ]);

  await Promise.all([
    prisma.resourceSkill.create({ data: { resourceType: "employee", resourceId: employees[0].id, skillId: javaSkill.id, level: "expert", yearsExperience: 9 } }),
    prisma.resourceSkill.create({ data: { resourceType: "employee", resourceId: employees[1].id, skillId: dataSkill.id, level: "senior", yearsExperience: 6 } }),
    prisma.resourceSkill.create({ data: { resourceType: "employee", resourceId: employees[3].id, skillId: cloudSkill.id, level: "senior", yearsExperience: 7 } }),
    prisma.missionSkillNeed.create({ data: { missionId: missions[4].id, skillId: javaSkill.id, requiredLevel: "senior", requiredFTE: 2, startDate: d("2026-09-01"), endDate: d("2027-03-31"), priority: "critical" } }),
    prisma.missionSkillNeed.create({ data: { missionId: missions[5].id, skillId: cloudSkill.id, requiredLevel: "confirmed", requiredFTE: 2, startDate: d("2026-10-01"), endDate: d("2027-05-31"), priority: "high" } }),
    prisma.absence.create({ data: { employeeId: employees[2].id, startDate: d("2026-06-10"), endDate: d("2026-06-11"), type: "vacation", impactOnBillableDays: 2, source: "manual", notes: "Absence impactant CRA" } }),
    prisma.businessCalendar.create({ data: { companyId: company.id, country: "FR", region: "IDF", year: 2026, holidays: ["2026-01-01", "2026-05-01", "2026-05-08", "2026-07-14", "2026-11-11", "2026-12-25"], workingDaysByMonth: { "2026-06": 22, "2026-07": 23, "2026-08": 21, "2026-09": 22 } } })
  ]);

  await Promise.all([
    prisma.plannedHire.create({ data: { scenarioId: referenceScenario.id, title: "Recrutement Java senior", targetRole: "Consultant Java senior", targetSkills: ["java", "spring"], expectedStartDate: d("2026-09-01"), expectedMonthlyCost: 5200, expectedEmployerCharges: 2340, expectedFullCost: 8040, expectedTJM: 900, expectedUtilizationRate: 0.8, onboardingMonths: 1, probability: 0.75, status: "approved", notes: "Couvre le gap Java du pipe banque" } }),
    prisma.probabilisticAssumption.create({ data: { scenarioId: referenceScenario.id, entityType: "mission", entityId: missions[4].id, field: "revenueGenerated", distributionType: "triangular", minValue: 45000, mostLikelyValue: 72000, maxValue: 95000, probability: 0.65, notes: "Opportunite IA conformité incertaine" } }),
    prisma.businessRule.create({ data: { companyId: company.id, name: "Tresorerie critique", description: "Alerte si la tresorerie de cloture passe sous 50k", triggerType: "monthly_projection", condition: { metric: "closingCash", operator: "lt", value: 50000 }, action: { type: "alert", message: "Tresorerie sous seuil de vigilance" }, severity: "critical", isActive: true } }),
    prisma.businessRule.create({ data: { companyId: company.id, name: "Marge faible", description: "Alerte marge inférieure à 22%", triggerType: "monthly_projection", condition: { metric: "marginRate", operator: "lt", value: 0.22 }, action: { type: "alert", message: "Marge previsionnelle inferieure au seuil" }, severity: "warning", isActive: true } }),
    prisma.notification.create({ data: { type: "invoice_overdue", severity: "warning", title: "Relance paiement Banque Horizon", message: "La facture F-2026-0001 reste partiellement payee.", relatedEntityType: "invoice", relatedEntityId: realInvoice.id, status: "unread" } }),
    prisma.approvalWorkflow.create({ data: { entityType: "timesheet", entityId: "démo-cra", status: "pending_approval", requestedBy: "consultant@esnforecast.local", requestedAt: d("2026-07-02"), comment: "CRA juin à valider" } }),
    prisma.crmOpportunity.create({ data: { externalSource: "csv-démo", externalId: "opp-001", clientName: "Banque Horizon", opportunityName: "Modernisation paiement instantane", stage: "proposal", probability: 0.55, expectedAmount: 180000, expectedStartDate: d("2026-11-01"), expectedEndDate: d("2027-04-30"), expectedTJM: 920, expectedStaffingNeeds: { java: 2, cloud: 1 }, owner: "Julien Moreau", lastSyncedAt: d("2026-06-15"), rawPayload: { source: "seed" } } }),
    prisma.accountingSync.create({ data: { provider: "csv-accounting", status: "completed", lastSyncAt: d("2026-07-05"), importedInvoicesCount: 1, importedPaymentsCount: 1, importedExpensesCount: 2, errors: [] } }),
    prisma.hrSync.create({ data: { provider: "csv-hr", status: "completed", lastSyncAt: d("2026-07-04"), importedEmployeesCount: 8, importedAbsencesCount: 1, errors: [] } }),
    prisma.document.create({ data: { companyId: company.id, entityType: "invoice", entityId: realInvoice.id, fileName: "F-2026-0001.pdf", mimeType: "application/pdf", size: 128000, storagePath: "local/démo/F-2026-0001.pdf", category: "invoice", uploadedBy: "finance@esnforecast.local", notes: "Document fictif seed" } }),
    prisma.apiKey.create({ data: { companyId: company.id, name: "Demo API", keyHash: hashPassword("démo-api-key"), scopes: ["read:projection", "read:invoices"] } }),
    prisma.webhookSubscription.create({ data: { companyId: company.id, url: "https://example.invalid/webhooks/esn-forecast", events: ["invoice.paid", "monthly_close.complèted"], secret: "démo-secret", isActive: true, lastDeliveryStatus: "never_sent" } })
  ]);

  const offer = await prisma.offer.create({
    data: {
      clientId: clients[4].id,
      title: "Offre centre de service GreenGrid",
      status: "internal_review",
      expectedStartDate: d("2026-10-01"),
      expectedEndDate: d("2027-03-31"),
      pricingMode: "daily_rate",
      totalAmount: 198000,
      expectedMargin: 64000,
      probability: 0.45,
      notes: "Offre en validation direction"
    }
  });
  await prisma.offerLine.create({ data: { offerId: offer.id, label: "Equipe cloud et run", role: "Cloud engineer", skillNeeds: { cloud: 2 }, quantity: 2, durationDays: 120, tjmSale: 825, estimatedCost: 134000, expectedMargin: 64000 } });

  await prisma.auditLog.create({ data: { entityType: "seed", entityId: "v2", action: "create_démo_data", after: { timesheets: 3, invoices: 1, skills: 3, rules: 2 } } });

  const [bankConnector, accountingConnector, expiredConnector] = await Promise.all([
    prisma.connector.create({ data: { organizationId: organization.id, companyId: company.id, type: "banking", provider: "mock_bank_provider", name: "Banque mock principale", status: "connected", configuration: { mode: "mock" }, lastSyncAt: d("2026-07-01"), nextSyncAt: d("2026-07-02"), createdBy: "admin@esnforecast.local" } }),
    prisma.connector.create({ data: { organizationId: organization.id, companyId: company.id, type: "accounting", provider: "mock_accounting_provider", name: "Compta mock", status: "connected", configuration: { mode: "mock" }, lastSyncAt: d("2026-07-01"), nextSyncAt: d("2026-07-02"), createdBy: "finance@esnforecast.local" } }),
    prisma.connector.create({ data: { organizationId: organization.id, companyId: company.id, type: "banking", provider: "csv_bank_import", name: "Import bancaire secondaire", status: "expired", errorMessage: "Consentement expire", lastSyncAt: d("2026-06-15"), createdBy: "finance@esnforecast.local" } })
  ]);

  await Promise.all([
    prisma.connectorSyncRun.create({ data: { connectorId: bankConnector.id, startedAt: d("2026-07-01"), finishedAt: d("2026-07-01"), status: "success", importedCount: 6, updatedCount: 1, skippedCount: 0, errorCount: 0, logs: { provider: "mock_bank_provider" } } }),
    prisma.connectorSyncRun.create({ data: { connectorId: accountingConnector.id, startedAt: d("2026-07-01"), finishedAt: d("2026-07-01"), status: "partial_success", importedCount: 3, updatedCount: 1, skippedCount: 1, errorCount: 1, errors: [{ line: 4, message: "Client non mappe" }] } }),
    prisma.connectorSyncRun.create({ data: { connectorId: expiredConnector.id, startedAt: d("2026-06-15"), finishedAt: d("2026-06-15"), status: "failed", errorCount: 1, errors: [{ message: "Consentement expire" }] } })
  ]);

  const bankConnection = await prisma.bankConnection.create({
    data: {
      organizationId: organization.id,
      companyId: company.id,
      connectorId: bankConnector.id,
      provider: "mock_bank_provider",
      externalConnectionId: "mock-connection-001",
      status: "active",
      consentExpiresAt: d("2026-08-20"),
      lastSyncAt: d("2026-07-01"),
      createdBy: "admin@esnforecast.local"
    }
  });
  await prisma.bankConsent.create({ data: { organizationId: organization.id, bankConnectionId: bankConnection.id, provider: "mock_bank_provider", status: "active", grantedBy: "admin@esnforecast.local", grantedAt: d("2026-06-01"), expiresAt: d("2026-08-20"), scopes: ["accounts", "balances", "transactions"], metadata: { mock: true } } });

  const bankAccount = await prisma.bankAccount.create({
    data: {
      organizationId: organization.id,
      companyId: company.id,
      bankConnectionId: bankConnection.id,
      externalAccountId: "mock-account-main",
      name: "Compte courant principal",
      ibanMasked: "FR76************1234",
      currency: "EUR",
      type: "checking",
      currentBalance: 77000,
      availableBalance: 76000,
      balanceDate: d("2026-06-30"),
      isActive: true,
      rawPayload: { provider: "mock" }
    }
  });

  const [revenueCategory, urssafCategory, softwareCategory, rentCategory, unknownCategory] = await Promise.all([
    prisma.financialCategory.create({ data: { organizationId: organization.id, name: "Encaissements clients", type: "revenue", isSystem: true, isActive: true } }),
    prisma.financialCategory.create({ data: { organizationId: organization.id, name: "Charges sociales", type: "employer_charges", isSystem: true, isActive: true } }),
    prisma.financialCategory.create({ data: { organizationId: organization.id, name: "Logiciels et infrastructure", type: "software", isSystem: true, isActive: true } }),
    prisma.financialCategory.create({ data: { organizationId: organization.id, name: "Loyer et locaux", type: "rent", isSystem: true, isActive: true } }),
    prisma.financialCategory.create({ data: { organizationId: organization.id, name: "A qualifier", type: "other_expense", isSystem: false, isActive: true } })
  ]);

  await Promise.all([
    prisma.bankCategorizationRule.create({ data: { organizationId: organization.id, name: "URSSAF", priority: 1, isActive: true, condition: { labelContains: "URSSAF", direction: "debit" }, targetCategoryId: urssafCategory.id, autoApply: "always" } }),
    prisma.bankCategorizationRule.create({ data: { organizationId: organization.id, name: "OVH", priority: 5, isActive: true, condition: { labelContains: "OVH", direction: "debit" }, targetCategoryId: softwareCategory.id, autoApply: "always" } }),
    prisma.bankCategorizationRule.create({ data: { organizationId: organization.id, name: "LOYER", priority: 10, isActive: true, condition: { labelContains: "LOYER", direction: "debit" }, targetCategoryId: rentCategory.id, autoApply: "if_high_confidence" } }),
    prisma.bankCategorizationRule.create({ data: { organizationId: organization.id, name: "Client Banque Horizon", priority: 20, isActive: true, condition: { counterpartyContains: "Banque Horizon", direction: "credit" }, targetCategoryId: revenueCategory.id, autoApply: "if_high_confidence" } })
  ]);

  const tx1 = await prisma.bankTransaction.create({ data: { organizationId: organization.id, companyId: company.id, bankAccountId: bankAccount.id, externalTransactionId: "bank-tx-001", transactionDate: d("2026-06-28"), bookingDate: d("2026-06-28"), label: "VIR Banque Horizon F-2026-0001", counterpartyName: "Banque Horizon", amount: 28000, currency: "EUR", direction: "credit", status: "booked", categoryId: revenueCategory.id, categorizationStatus: "auto_categorized", reconciliationStatus: "reconciled", confidenceScore: 0.96, rawPayload: { mock: true } } });
  const tx2 = await prisma.bankTransaction.create({ data: { organizationId: organization.id, companyId: company.id, bankAccountId: bankAccount.id, externalTransactionId: "bank-tx-002", transactionDate: d("2026-06-12"), bookingDate: d("2026-06-12"), label: "PRLV URSSAF JUIN", counterpartyName: "URSSAF", amount: -9000, currency: "EUR", direction: "debit", status: "booked", categoryId: urssafCategory.id, categorizationStatus: "rule_categorized", reconciliationStatus: "unreconciled", confidenceScore: 0.95 } });
  const tx3 = await prisma.bankTransaction.create({ data: { organizationId: organization.id, companyId: company.id, bankAccountId: bankAccount.id, externalTransactionId: "bank-tx-003", transactionDate: d("2026-06-13"), bookingDate: d("2026-06-13"), label: "PRLV URSSAF REGUL", counterpartyName: "URSSAF", amount: -9000, currency: "EUR", direction: "debit", status: "booked", categoryId: urssafCategory.id, categorizationStatus: "rule_categorized", reconciliationStatus: "unreconciled", confidenceScore: 0.94 } });
  const tx4 = await prisma.bankTransaction.create({ data: { organizationId: organization.id, companyId: company.id, bankAccountId: bankAccount.id, externalTransactionId: "bank-tx-004", transactionDate: d("2026-06-05"), bookingDate: d("2026-06-05"), label: "OVH CLOUD", counterpartyName: "OVH", amount: -1260, currency: "EUR", direction: "debit", status: "booked", categoryId: softwareCategory.id, categorizationStatus: "rule_categorized", reconciliationStatus: "unreconciled", confidenceScore: 0.93 } });
  const tx5 = await prisma.bankTransaction.create({ data: { organizationId: organization.id, companyId: company.id, bankAccountId: bankAccount.id, externalTransactionId: "bank-tx-005", transactionDate: d("2026-06-02"), bookingDate: d("2026-06-02"), label: "LOYER BUREAUX", counterpartyName: "SCI Bureau", amount: -6200, currency: "EUR", direction: "debit", status: "booked", categoryId: rentCategory.id, categorizationStatus: "rule_categorized", reconciliationStatus: "unreconciled", confidenceScore: 0.9 } });
  await prisma.bankTransaction.create({ data: { organizationId: organization.id, companyId: company.id, bankAccountId: bankAccount.id, externalTransactionId: "bank-tx-006", transactionDate: d("2026-06-24"), bookingDate: d("2026-06-24"), label: "CB ACHAT INCONNU", counterpartyName: "Unknown", amount: -4800, currency: "EUR", direction: "debit", status: "booked", categoryId: unknownCategory.id, categorizationStatus: "uncategorized", reconciliationStatus: "unreconciled", confidenceScore: 0.1 } });

  await Promise.all([
    prisma.financialReconciliation.create({ data: { organizationId: organization.id, transactionId: tx1.id, targetType: "invoice", targetId: realInvoice.id, amountMatched: 28000, dateVarianceDays: -47, amountVariance: -19040, confidenceScore: 0.96, matchedBy: "auto", status: "partially_reconciled", notes: "Paiement partiel bancaire rapproche automatiquement" } }),
    prisma.reconciliationSuggestion.create({ data: { organizationId: organization.id, transactionId: tx2.id, targetType: "tax", confidenceScore: 0.82, reason: "Libelle URSSAF et montant recurrent", status: "pending" } }),
    prisma.reconciliationSuggestion.create({ data: { organizationId: organization.id, transactionId: tx4.id, targetType: "fixed_cost", confidenceScore: 0.78, reason: "Libelle OVH proche des couts logiciels", status: "pending" } }),
    prisma.ruleEvaluationLog.create({ data: { ruleId: (await prisma.bankCategorizationRule.findFirstOrThrow({ where: { name: "URSSAF" } })).id, transactionId: tx2.id, matched: true, applied: true, confidenceScore: 0.95, explanation: "Libelle contient URSSAF" } })
  ]);

  await Promise.all([
    prisma.accountingInvoiceImport.create({ data: { connectorId: accountingConnector.id, externalId: "acc-inv-001", invoiceNumber: "F-2026-0001", type: "customer_invoice", clientOrSupplierName: "Banque Horizon", clientId: clients[0].id, missionId: missions[0].id, invoiceDate: d("2026-06-30"), dueDate: d("2026-08-14"), amountHT: 39200, vatAmount: 7840, amountTTC: 47040, paidAmount: 28000, status: "partially_paid", rawPayload: { mock: true } } }),
    prisma.accountingInvoiceImport.create({ data: { connectorId: accountingConnector.id, externalId: "acc-inv-002", invoiceNumber: "F-2026-0002", type: "customer_invoice", clientOrSupplierName: "HealthLink", clientId: clients[3].id, missionId: missions[3].id, invoiceDate: d("2026-06-30"), dueDate: d("2026-08-29"), amountHT: 36000, vatAmount: 7200, amountTTC: 43200, paidAmount: 0, status: "late", rawPayload: { mock: true } } }),
    prisma.accountingPaymentImport.create({ data: { connectorId: accountingConnector.id, externalId: "acc-pay-001", invoiceExternalId: "acc-inv-001", paymentDate: d("2026-06-28"), amount: 28000, payerOrPayeeName: "Banque Horizon", paymentMethod: "wire", rawPayload: { mock: true } } })
  ]);

  await Promise.all([
    prisma.clientPaymentProfile.create({ data: { clientId: clients[0].id, averagePaymentDelayDays: 28, medianPaymentDelayDays: 28, averageLateDays: 0, latePaymentRate: 0, totalLateAmount: 0, reliabilityScore: 94, recommendedForecastDelayDays: 30 } }),
    prisma.clientPaymentProfile.create({ data: { clientId: clients[3].id, averagePaymentDelayDays: 72, medianPaymentDelayDays: 70, averageLateDays: 18, latePaymentRate: 0.66, totalLateAmount: 43200, reliabilityScore: 42, recommendedForecastDelayDays: 75 } }),
    prisma.reforecastSuggestion.create({ data: { organizationId: organization.id, scenarioId: referenceScenario.id, type: "adjust_payment_delay", targetType: "client", targetId: clients[3].id, currentValue: { delay: 60 }, suggestedValue: { delay: 75 }, impactAmount: -43200, impactMonth: "2026-08", explanation: "HealthLink paie historiquement plus tard que le delai contractuel.", confidenceScore: 0.82, status: "pending" } }),
    prisma.forecastReliabilityScore.create({ data: { scenarioId: referenceScenario.id, month: "2026-06", score: 71, confidenceLevel: "medium", factors: { cashVarianceRate: 0.08, unreconciledTransactions: 5, connectorIssues: 1 }, explanation: "Fiabilite penalisee par des transactions non rapprochees et un connecteur expire." } }),
    prisma.financialAnomaly.create({ data: { organizationId: organization.id, type: "duplicate_payment", severity: "warning", entityType: "bank_transaction", entityId: tx3.id, amount: 9000, explanation: "Deux prelevements URSSAF tres proches ont le meme montant.", suggestedAction: "Verifier s'il s'agit d'une regularisation ou d'un double paiement.", status: "new" } }),
    prisma.financialAnomaly.create({ data: { organizationId: organization.id, type: "uncategorized_large_transaction", severity: "warning", entityType: "bank_transaction", entityId: tx5.id, amount: 6200, explanation: "Transaction significative à valider dans les couts fixes.", suggestedAction: "Confirmer la categorie et rapprocher avec le loyer prevu.", status: "new" } }),
    prisma.dataQualityIssue.create({ data: { organizationId: organization.id, type: "uncategorized_transactions", severity: "warning", entityType: "bank_transaction", entityId: "multiple", message: "1 transaction bancaire reste non categorisee.", suggestedFix: "Creer une règle ou categoriser manuellement.", status: "open" } }),
    prisma.dataQualityIssue.create({ data: { organizationId: organization.id, type: "connector_health", severity: "critical", entityType: "connector", entityId: expiredConnector.id, message: "Un consentement bancaire est expire.", suggestedFix: "Renouveler ou revoquer le consentement.", status: "open" } }),
    prisma.codirReport.create({ data: { organizationId: organization.id, companyId: company.id, scenarioId: referenceScenario.id, month: "2026-06", format: "json", payload: { cash: 77000, runway: "fragile", anomalies: 2, recommendations: ["Rapprocher les transactions URSSAF", "Relancer HealthLink"] }, generatedBy: "direction@esnforecast.local" } }),
    prisma.financialExportLog.create({ data: { organizationId: organization.id, companyId: company.id, userId: "direction@esnforecast.local", exportType: "codir_report", filters: { month: "2026-06" }, sensitivityLevel: "financial" } })
  ]);

  await prisma.auditLog.create({ data: { entityType: "financial_v3", entityId: "seed", action: "create_connected_finance_démo", after: { connectors: 3, bankTransactions: 6, reconciliations: 1, anomalies: 2 } } });

  await Promise.all([
    prisma.providerCapability.create({ data: { provider: "bridge", connectorType: "banking", environment: "sandbox", capabilities: { supportsOAuth: true, supportsAccounts: true, supportsTransactions: true, supportsWebhooks: true }, isConfigured: false } }),
    prisma.providerCapability.create({ data: { provider: "powens", connectorType: "banking", environment: "sandbox", capabilities: { supportsOAuth: true, supportsAccounts: true, supportsTransactions: true, supportsWebhooks: true }, isConfigured: false } }),
    prisma.providerCapability.create({ data: { provider: "tink", connectorType: "banking", environment: "sandbox", capabilities: { supportsOAuth: true, supportsAccounts: true, supportsTransactions: true, supportsWebhooks: true }, isConfigured: false } }),
    prisma.providerCapability.create({ data: { provider: "plaid", connectorType: "banking", environment: "sandbox", capabilities: { supportsOAuth: true, supportsAccounts: true, supportsTransactions: true, supportsWebhooks: true, supportsPlaidLink: true }, isConfigured: false } }),
    prisma.providerCapability.create({ data: { provider: "pennylane", connectorType: "accounting", environment: "sandbox", capabilities: { supportsOAuth: true, supportsInvoices: true, supportsPayments: true, supportsWebhooks: true }, isConfigured: false } }),
    prisma.providerCapability.create({ data: { provider: "sage", connectorType: "accounting", environment: "sandbox", capabilities: { supportsOAuth: true, supportsInvoices: true, supportsPayments: true }, isConfigured: false } })
  ]);

  await Promise.all([
    prisma.providerCredential.create({ data: { organizationId: organization.id, provider: "bridge", environment: "sandbox", clientIdMasked: "brid********démo", clientSecretEncrypted: secrets.encryptSecret("bridge-démo-secret"), apiBaseUrl: "https://api.bridgeapi.io", redirectUri: "http://localhost:4000/api/connectors/bridge/oauth/callback", webhookSecretEncrypted: secrets.encryptSecret("bridge-webhook-démo"), status: "configured", createdBy: "admin@esnforecast.local" } }),
    prisma.providerCredential.create({ data: { organizationId: organization.id, provider: "plaid", environment: "sandbox", clientIdMasked: "plai********démo", clientSecretEncrypted: secrets.encryptSecret("plaid-démo-secret"), apiBaseUrl: "https://sandbox.plaid.com", redirectUri: "http://localhost:5173", webhookSecretEncrypted: secrets.encryptSecret("plaid-webhook-démo"), status: "configured", createdBy: "admin@esnforecast.local" } }),
    prisma.providerCredential.create({ data: { organizationId: organization.id, provider: "pennylane", environment: "sandbox", clientIdMasked: "penn********démo", clientSecretEncrypted: secrets.encryptSecret("pennylane-démo-secret"), apiBaseUrl: "https://app.pennylane.com/api/external/v1", redirectUri: "http://localhost:4000/api/connectors/pennylane/oauth/callback", webhookSecretEncrypted: secrets.encryptSecret("pennylane-webhook-démo"), status: "configured", createdBy: "finance@esnforecast.local" } })
  ]);

  await Promise.all([
    prisma.providerToken.create({ data: { organizationId: organization.id, companyId: company.id, connectorId: bankConnector.id, provider: "bridge", accessTokenEncrypted: secrets.encryptSecret("bridge-access-démo"), refreshTokenEncrypted: secrets.encryptSecret("bridge-refresh-démo"), expiresAt: d("2026-07-01"), scopes: ["accounts", "transactions"], tokenType: "Bearer", providerAccountId: "bridge-item-démo" } }),
    prisma.providerToken.create({ data: { organizationId: organization.id, companyId: company.id, connectorId: accountingConnector.id, provider: "pennylane", accessTokenEncrypted: secrets.encryptSecret("pennylane-access-démo"), refreshTokenEncrypted: secrets.encryptSecret("pennylane-refresh-démo"), expiresAt: d("2026-07-01"), scopes: ["customer_invoices", "supplier_invoices", "payments"], tokenType: "Bearer", providerAccountId: "pennylane-company-démo" } }),
    prisma.secretAccessLog.create({ data: { organizationId: organization.id, provider: "bridge", connectorId: bankConnector.id, action: "store_token", sensitivityLevel: "secret" } })
  ]);

  await Promise.all([
    prisma.oAuthConnectionSession.create({ data: { organizationId: organization.id, companyId: company.id, provider: "plaid", connectorType: "banking", state: "démo-oauth-state-plaid", redirectUri: "http://localhost:5173", status: "token_exchanged", expiresAt: d("2026-07-01") } }),
    prisma.syncCursor.create({ data: { connectorId: bankConnector.id, resourceType: "transactions", cursor: "cursor-bank-2026-06-30", lastSuccessfulSyncAt: d("2026-07-01"), metadata: { mode: "incremental" } } }),
    prisma.syncCursor.create({ data: { connectorId: accountingConnector.id, resourceType: "invoices", cursor: "cursor-invoices-2026-06-30", lastSuccessfulSyncAt: d("2026-07-01"), metadata: { mode: "incremental" } } }),
    prisma.providerWebhookEvent.create({ data: { provider: "bridge", connectorId: bankConnector.id, eventType: "transactions.updated", externalEventId: "bridge-event-001", payload: { account_id: "mock-account-main" }, signatureValid: true, status: "processed", processedAt: d("2026-07-01") } }),
    prisma.providerWebhookEvent.create({ data: { provider: "tink", connectorId: expiredConnector.id, eventType: "credentials.expired", externalEventId: "tink-event-001", payload: { status: "expired" }, signatureValid: true, status: "received" } }),
    prisma.providerError.create({ data: { connectorId: expiredConnector.id, provider: "tink", errorCategory: "CONSENT_EXPIRED", providerErrorCode: "CONSENT_EXPIRED", providerErrorMessage: "User consent expired", userMessage: "Le consentement bancaire doit etre renouvele.", technicalDetails: { providerStatus: "expired" }, retryable: false, requiresUserAction: true } }),
    prisma.providerRateLimitState.create({ data: { provider: "plaid", connectorId: bankConnector.id, remaining: 12, resetAt: d("2026-07-02"), lastRateLimitAt: d("2026-07-01"), isThrottled: false } })
  ]);

  await Promise.all([
    prisma.duplicateCandidate.create({ data: { organizationId: organization.id, entityType: "payment", sourceAType: "bank_transaction", sourceAId: tx1.id, sourceBType: "payment", sourceBId: realInvoice.id, confidenceScore: 0.91, reason: "Montant et reference facture proches entre banque et compta", status: "pending" } }),
    prisma.dataSourcePolicy.create({ data: { organizationId: organization.id, domain: "bank_transactions", primarySource: "bank_provider", conflictResolution: "provider_wins" } }),
    prisma.dataSourcePolicy.create({ data: { organizationId: organization.id, domain: "invoices", primarySource: "pennylane", conflictResolution: "manual" } }),
    prisma.dataSourcePolicy.create({ data: { organizationId: organization.id, domain: "missions", primarySource: "esn_forecast", conflictResolution: "esn_forecast_wins" } }),
    prisma.auditLog.create({ data: { entityType: "financial_connector", entityId: bankConnector.id, action: "sync_complèted", after: { provider: "bridge", imported: 6 }, } }),
    prisma.auditLog.create({ data: { entityType: "financial_connector", entityId: expiredConnector.id, action: "consent_expired", after: { provider: "tink", requiresUserAction: true } } })
  ]);

  await Promise.all([
    prisma.jobRun.create({ data: { organizationId: organization.id, companyId: company.id, type: "connector_sync", status: "success", startedAt: d("2026-07-01"), finishedAt: d("2026-07-01"), durationMs: 1840, progressPercent: 100, inputSummary: { provider: "bridge" }, resultSummary: { imported: 6, updated: 1 }, triggeredBy: "schedule", correlationId: "seed-sync-success" } }),
    prisma.jobRun.create({ data: { organizationId: organization.id, companyId: company.id, type: "report_pdf", status: "failed", startedAt: d("2026-07-01"), finishedAt: d("2026-07-01"), durationMs: 4200, progressPercent: 65, inputSummary: { report: "codir" }, errorMessage: "Template PDF indisponible", errorDetails: { renderer: "pdf" }, triggeredBy: "user", triggeredByUserId: "direction@esnforecast.local", correlationId: "seed-report-failed" } }),
    prisma.jobRun.create({ data: { organizationId: organization.id, companyId: company.id, type: "reforecast", status: "retrying", startedAt: d("2026-07-01"), durationMs: 900, progressPercent: 40, inputSummary: { scenarioId: referenceScenario.id }, errorMessage: "Rate limit provider temporaire", triggeredBy: "webhook", correlationId: "seed-reforecast-retry" } }),
    prisma.systemEvent.create({ data: { organizationId: organization.id, companyId: company.id, level: "warning", module: "connectors", message: "Consentement bancaire proche expiration", metadata: { connectorId: expiredConnector.id }, correlationId: "seed-system-event" } }),
    prisma.applicationLog.create({ data: { level: "info", service: "api", route: "/api/connectors", organizationId: organization.id, companyId: company.id, correlationId: "seed-log-1", durationMs: 74, message: "Liste connecteurs chargee", metadata: { count: 3 } } }),
    prisma.applicationLog.create({ data: { level: "error", service: "api", route: "/api/reports/codir.pdf", organizationId: organization.id, companyId: company.id, correlationId: "seed-report-failed", durationMs: 4200, errorCode: "REPORT_ERROR", message: "Generation rapport CODIR échouée" } }),
    prisma.errorReport.create({ data: { organizationId: organization.id, companyId: company.id, code: "REPORT_ERROR", message: "Le rapport CODIR n'a pas pu etre genere.", userAction: "Relancer le job ou verifier le template.", status: "open", severity: "warning", correlationId: "seed-report-failed" } }),
    prisma.backupRun.create({ data: { organizationId: organization.id, companyId: company.id, type: "full_organization", status: "success", filePath: "backups/démo-full-organization.json", sizeBytes: 42800, createdBy: "admin@esnforecast.local", completedAt: d("2026-07-01") } }),
    prisma.restoreRun.create({ data: { organizationId: organization.id, mode: "dry_run", status: "success", resultSummary: { valid: true, conflicts: 0, excludedSecrets: true }, createdBy: "admin@esnforecast.local", completedAt: d("2026-07-01") } }),
    prisma.exportRun.create({ data: { organizationId: organization.id, companyId: company.id, type: "full", format: "zip_csv", status: "success", filePath: "exports/démo-full.zip", sizeBytes: 64000, createdBy: "direction@esnforecast.local", completedAt: d("2026-07-01") } }),
    prisma.retentionPolicy.create({ data: { organizationId: organization.id, domain: "application_logs", retentionDays: 90, action: "delete", isActive: true } }),
    prisma.retentionPolicy.create({ data: { organizationId: organization.id, domain: "webhook_payloads", retentionDays: 180, action: "archive", isActive: true } }),
    prisma.purgeRun.create({ data: { organizationId: organization.id, domain: "application_logs", status: "success", deletedCount: 120, startedAt: d("2026-07-01"), completedAt: d("2026-07-01") } }),
    prisma.securityEvent.create({ data: { organizationId: organization.id, userId: "admin@esnforecast.local", type: "sensitive_export", severity: "warning", message: "Export financier complet genere", ipAddress: "127.0.0.1", userAgent: "seed", metadata: { export: "full" }, correlationId: "seed-export" } }),
    prisma.loginAttempt.create({ data: { organizationId: organization.id, email: "admin@esnforecast.local", success: true, ipAddress: "127.0.0.1", userAgent: "seed" } }),
    prisma.loginAttempt.create({ data: { organizationId: organization.id, email: "unknown@esnforecast.local", success: false, failureReason: "invalid_password", ipAddress: "127.0.0.1", userAgent: "seed" } }),
    prisma.sensitiveDataAccessLog.create({ data: { organizationId: organization.id, companyId: company.id, userId: "finance@esnforecast.local", entityType: "employee_salary", entityId: employees[0].id, action: "view", sensitivityLevel: "salary", ipAddress: "127.0.0.1", userAgent: "seed", correlationId: "seed-sensitive-access" } }),
    prisma.featureFlag.create({ data: { key: "new_sidebar_v5", name: "Menu lateral V5", description: "Navigation groupee, scrollable, compacte et recherchable.", enabledGlobally: true, enabledForRoles: ["admin", "direction"], rolloutPercent: 100, status: "stable" } }),
    prisma.featureFlag.create({ data: { key: "command_palette", name: "Palette de commande", description: "Recherche rapide des pages et actions.", enabledGlobally: true, enabledForRoles: ["admin", "direction", "finance"], rolloutPercent: 100, status: "beta" } }),
    prisma.featureFlag.create({ data: { key: "ai_assistant", name: "Assistant IA", description: "Analyse assistee basee sur les donnees calculees.", enabledGlobally: false, enabledForOrganizations: [organization.id], rolloutPercent: 25, status: "experimental" } }),
    prisma.onboardingState.create({ data: { organizationId: organization.id, userId: "admin@esnforecast.local", steps: { company: true, clients: true, employees: true, missions: true, bank: false, accounting: false, dataQuality: false, firstProjection: true, codirReport: false } } }),
    prisma.supportAction.create({ data: { organizationId: organization.id, companyId: company.id, action: "recalculate_data_quality", status: "success", requestedBy: "admin@esnforecast.local", result: { scoresUpdated: 6 }, reason: "Controle support démo", correlationId: "seed-support-action", completedAt: d("2026-07-01") } }),
    prisma.performanceSnapshot.create({ data: { organizationId: organization.id, metric: "api_latency_ms", value: 380, unit: "ms", route: "/api/projections/scenario", metadata: { percentile: "p95" }, capturedAt: d("2026-07-01") } }),
    prisma.performanceSnapshot.create({ data: { organizationId: organization.id, metric: "projection_duration_ms", value: 1280, unit: "ms", route: "/api/projections/scenario", metadata: { horizon: 24 }, capturedAt: d("2026-07-01") } }),
    prisma.dataQualityScore.create({ data: { organizationId: organization.id, domain: "transactions", score: 72, issuesCount: 4, criticalCount: 1, recommendations: ["Categoriser les transactions importantes", "Renouveler le consentement expire"] } }),
    prisma.dataQualityScore.create({ data: { organizationId: organization.id, domain: "connectors", score: 68, issuesCount: 2, criticalCount: 1, recommendations: ["Reconnecter le connecteur Tink", "Relancer la sync comptable"] } }),
    prisma.dataQualityScore.create({ data: { organizationId: organization.id, domain: "missions", score: 86, issuesCount: 1, criticalCount: 0, recommendations: ["Verifier les dates de fin estimees"] } }),
    prisma.helpArticle.create({ data: { pageKey: "dashboard", title: "Lire le dashboard direction", category: "pilotage", body: "Le dashboard combine reel, previsionnel et alertes. Commencez par la tresorerie, les Ecarts et les alertes critiques.", links: [{ label: "Documentation exploitation", href: "/docs/v5-operations.md" }] } }),
    prisma.helpArticle.create({ data: { pageKey: "bankReconciliation", title: "Rapprochement partiel", category: "finance", body: "Un rapprochement partiel relie une transaction à une facture sans couvrir tout le montant. Il doit rester visible jusqu'au solde complet." } }),
    prisma.helpArticle.create({ data: { pageKey: "forecastReliability", title: "Score de fiabilite", category: "previsions", body: "Le score baisse si les donnees bancaires sont obsoletes, si les transactions ne sont pas rapprochees ou si une forte part du CA reste non signee." } })
  ]);

  await prisma.auditLog.create({ data: { entityType: "product_hardening_v5", entityId: "seed", action: "create_operations_démo", after: { jobs: 3, featureFlags: 3, backups: 1, dataQualityScores: 3 } } });

  const [initialBudget, revisedBudget] = await Promise.all([
    prisma.budget.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: 2026, name: "Budget initial 2026", description: "Trajectoire annuelle validee CODIR", status: "locked", versionNumber: 1, budgetType: "initial", isReference: true, createdBy: "direction@esnforecast.local", approvedBy: "direction@esnforecast.local", lockedBy: "direction@esnforecast.local", approvedAt: d("2026-01-15"), lockedAt: d("2026-01-20"), notes: "Budget ambitieux avec croissance du pipe bancaire et energie" } }),
    prisma.budget.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: 2026, name: "Budget revise 2026", description: "Revision post T2", status: "approved", versionNumber: 2, budgetType: "revised", createdBy: "finance@esnforecast.local", approvedBy: "direction@esnforecast.local", approvedAt: d("2026-07-10"), notes: "Ajuste apres retard HealthLink et sous-occupation QA" } })
  ]);

  const budgetLines = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const seasonalRevenue = 178000 + month * 5500 + (month >= 9 ? 22000 : 0);
    const employeeCosts = 72000 + (month >= 9 ? 8500 : 0);
    const externalCosts = 30500 + (month >= 10 ? 7000 : 0);
    const fixedCosts = 17020;
    const variableCosts = 4200 + month * 180;
    const grossMargin = seasonalRevenue - employeeCosts - externalCosts;
    const netMargin = grossMargin - fixedCosts - variableCosts;
    return [
      { budgetId: initialBudget.id, year: 2026, month, category: "revenue", amount: seasonalRevenue, comment: "CA budgete mensuel" },
      { budgetId: initialBudget.id, year: 2026, month, category: "employee_costs", amount: employeeCosts },
      { budgetId: initialBudget.id, year: 2026, month, category: "partner_costs", amount: externalCosts * 0.6 },
      { budgetId: initialBudget.id, year: 2026, month, category: "freelancer_costs", amount: externalCosts * 0.4 },
      { budgetId: initialBudget.id, year: 2026, month, category: "fixed_costs", amount: fixedCosts },
      { budgetId: initialBudget.id, year: 2026, month, category: "variable_costs", amount: variableCosts },
      { budgetId: initialBudget.id, year: 2026, month, category: "cash_in", amount: seasonalRevenue * 1.17 },
      { budgetId: initialBudget.id, year: 2026, month, category: "cash_out", amount: employeeCosts + externalCosts + fixedCosts + variableCosts },
      { budgetId: initialBudget.id, year: 2026, month, category: "gross_margin", amount: grossMargin },
      { budgetId: initialBudget.id, year: 2026, month, category: "net_margin", amount: netMargin },
      { budgetId: initialBudget.id, year: 2026, month, category: "closing_cash", amount: 125000 + month * 6200 },
      { budgetId: initialBudget.id, year: 2026, month, category: "utilization_rate", amount: 0.87, percentage: 0.87 },
      { budgetId: initialBudget.id, year: 2026, month, category: "bench_cost", amount: month >= 8 ? 12000 : 6500 },
      { budgetId: initialBudget.id, year: 2026, month, category: "commercial_pipeline", amount: month >= 9 ? 290000 : 180000 }
    ];
  }).flat();
  await prisma.budgetLine.createMany({ data: budgetLines });
  await prisma.budgetLine.createMany({ data: budgetLines.map((line) => ({ ...line, budgetId: revisedBudget.id, amount: line.category === "revenue" ? line.amount * 0.96 : line.category === "closing_cash" ? line.amount * 0.92 : line.amount })) });

  const rollingForecast = await prisma.rollingForecast.create({ data: { organizationId: organization.id, companyId: company.id, name: "Rolling forecast juillet 2026", baseMonth: "2026-07", horizonMonths: 12, sourceScenarioId: referenceScenario.id, sourceBudgetId: initialBudget.id, versionNumber: 1, status: "active", generatedBy: "finance@esnforecast.local", notes: "Reel T1/T2 + reforecast S2" } });
  await prisma.rollingForecastLine.createMany({
    data: budgetLines
      .filter((line) => ["revenue", "gross_margin", "net_margin", "cash_in", "cash_out", "closing_cash", "utilization_rate", "bench_cost"].includes(line.category))
      .map((line) => ({ rollingForecastId: rollingForecast.id, year: line.year, month: line.month, category: line.category, amount: line.month <= 6 ? line.amount * 0.92 : line.amount * (line.category === "revenue" ? 0.95 : line.category === "closing_cash" ? 0.9 : 0.97), source: line.month <= 6 ? "actual" : "reforecast", confidenceScore: line.month <= 6 ? 0.95 : 0.74, comment: line.month <= 6 ? "Reel consolide" : "Reforecast apres retard mission" }))
  });

  const [revenueObjective, marginObjective, cashObjective, utilizationObjective, pipelineObjective] = await Promise.all([
    prisma.objective.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: 2026, name: "CA annuel 2,4 M EUR", description: "Objectif CODIR de croissance", type: "revenue", targetValue: 2400000, unit: "amount", period: "annual", ownerUserId: "direction@esnforecast.local", status: "active" } }),
    prisma.objective.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: 2026, name: "Marge brute 28 %", type: "gross_margin", targetValue: 670000, unit: "amount", period: "annual", ownerUserId: "finance@esnforecast.local", status: "active" } }),
    prisma.objective.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: 2026, name: "Tresorerie minimale 150 k EUR", type: "cash", targetValue: 150000, unit: "amount", period: "annual", ownerUserId: "direction@esnforecast.local", status: "at_risk" } }),
    prisma.objective.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: 2026, name: "Occupation interne 87 %", type: "utilization", targetValue: 0.87, unit: "percentage", period: "monthly", ownerUserId: "staffing@esnforecast.local", status: "at_risk" } }),
    prisma.objective.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: 2026, name: "Pipeline supplementaire T3", type: "pipeline", targetValue: 500000, unit: "amount", period: "quarterly", startMonth: 7, endMonth: 9, ownerUserId: "commercial@esnforecast.local", status: "at_risk" } })
  ]);

  const revenueVariance = await prisma.varianceAnalysis.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: 2026, month: 6, quarter: 2, category: "revenue", budgetValue: 211000, actualValue: 92500, forecastValue: 194120, varianceAmount: -118500, variancePercent: -0.56, severity: "critical", status: "action_required", ownerUserId: "commercial@esnforecast.local" } });
  const marginVariance = await prisma.varianceAnalysis.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: 2026, month: 6, quarter: 2, category: "gross_margin", budgetValue: 108800, actualValue: 26900, forecastValue: 101536, varianceAmount: -81900, variancePercent: -0.75, severity: "critical", status: "explained", ownerUserId: "finance@esnforecast.local" } });
  const cashVariance = await prisma.varianceAnalysis.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: 2026, month: 6, quarter: 2, category: "closing_cash", budgetValue: 162200, actualValue: 61080, forecastValue: 145980, varianceAmount: -101120, variancePercent: -0.62, severity: "critical", status: "action_required", ownerUserId: "direction@esnforecast.local" } });

  await Promise.all([
    prisma.varianceCause.create({ data: { varianceAnalysisId: revenueVariance.id, causeType: "delayed_mission", description: "Demarrage de Plateforme IA conformité decale de septembre à octobre", amountImpact: -42000, relatedMissionId: missions[4].id, relatedClientId: clients[0].id, confidenceScore: 0.83 } }),
    prisma.varianceCause.create({ data: { varianceAnalysisId: revenueVariance.id, causeType: "late_payment", description: "Encaissement HealthLink en retard et facture non payee", amountImpact: -43200, relatedClientId: clients[3].id, confidenceScore: 0.88 } }),
    prisma.varianceCause.create({ data: { varianceAnalysisId: marginVariance.id, causeType: "external_cost_increase", description: "Cout freelance cyber plus eleve que prevu sur audit sante", amountImpact: -18500, relatedMissionId: missions[3].id, confidenceScore: 0.8 } }),
    prisma.varianceCause.create({ data: { varianceAnalysisId: cashVariance.id, causeType: "late_payment", description: "Paiement partiel Banque Horizon et retard HealthLink", amountImpact: -62240, relatedInvoiceId: realInvoice.id, confidenceScore: 0.9 } }),
    prisma.varianceComment.create({ data: { varianceAnalysisId: revenueVariance.id, userId: "commercial@esnforecast.local", visibility: "direction", comment: "Le gap CA vient surtout du retard de demarrage IA et d'un pipe Q3 insuffisant. Deux offres sont prioritaires." } }),
    prisma.varianceComment.create({ data: { varianceAnalysisId: marginVariance.id, userId: "finance@esnforecast.local", visibility: "finance", comment: "La marge de l'audit sante est dégradée par un cout externe non anticipe. Action de renegociation fournisseur ouverte." } }),
    prisma.varianceComment.create({ data: { varianceAnalysisId: cashVariance.id, userId: "direction@esnforecast.local", visibility: "direction", comment: "Point CODIR requis sur encaissements et gel temporaire des depenses non essentielles." } })
  ]);

  const actionPlan = await prisma.actionPlan.create({ data: { organizationId: organization.id, companyId: company.id, title: "Plan de redressement trajectoire S2", description: "Actions pour reduire le gap CA, cash et marge", relatedObjectiveId: revenueObjective.id, relatedVarianceId: revenueVariance.id, fiscalYear: 2026, status: "active", ownerUserId: "direction@esnforecast.local", createdBy: "direction@esnforecast.local" } });
  await Promise.all([
    prisma.actionItem.create({ data: { actionPlanId: actionPlan.id, title: "Relancer HealthLink et obtenir date paiement", description: "Escalade finance + commercial", actionType: "invoice_follow_up", ownerUserId: "finance@esnforecast.local", dueDate: d("2026-07-20"), status: "in_progress", expectedImpactAmount: 43200, expectedImpactMonth: "2026-08", priority: "critical", relatedClientId: clients[3].id } }),
    prisma.actionItem.create({ data: { actionPlanId: actionPlan.id, title: "Securiser prolongation Banque Horizon", actionType: "mission_extension", ownerUserId: "commercial@esnforecast.local", dueDate: d("2026-08-15"), status: "todo", expectedImpactAmount: 120000, expectedImpactMonth: "2026-10", priority: "high", relatedClientId: clients[0].id, relatedMissionId: missions[0].id } }),
    prisma.actionItem.create({ data: { actionPlanId: actionPlan.id, title: "Reduire cout freelance audit sante", actionType: "reduce_external_cost", ownerUserId: "finance@esnforecast.local", dueDate: d("2026-07-30"), status: "blocked", expectedImpactAmount: 12000, expectedImpactMonth: "2026-08", priority: "high", relatedMissionId: missions[3].id } }),
    prisma.actionItem.create({ data: { actionPlanId: actionPlan.id, title: "Placer Sarah Leroy sur mission QA retail", actionType: "improve_utilization", ownerUserId: "staffing@esnforecast.local", dueDate: d("2026-07-25"), status: "done", expectedImpactAmount: 18000, expectedImpactMonth: "2026-08", actualImpactAmount: 16000, priority: "medium", relatedResourceId: employees[4].id } }),
    prisma.actionSuggestion.create({ data: { organizationId: organization.id, sourceType: "variance", sourceId: cashVariance.id, title: "Accelerer relance encaissements critiques", description: "Regrouper Banque Horizon et HealthLink dans une relance direction", expectedImpactAmount: 62000, expectedImpactMonth: "2026-08", confidenceScore: 0.86, priority: "critical", status: "suggested" } }),
    prisma.actionSuggestion.create({ data: { organizationId: organization.id, sourceType: "objective", sourceId: pipelineObjective.id, title: "Creer 330 k EUR de pipeline qualifie", description: "Cibler Energie et Banque pour combler le gap Q4", expectedImpactAmount: 115000, expectedImpactMonth: "2026-11", confidenceScore: 0.72, priority: "high", status: "suggested" } })
  ]);

  const annualLanding = await prisma.annualLandingSnapshot.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: 2026, budgetId: initialBudget.id, budgetRevenue: 2493000, actualRevenueToDate: 92500, forecastRevenueRemaining: 1972600, projectedAnnualRevenue: 2065100, revenueGap: -427900, budgetGrossMargin: 1285500, projectedGrossMargin: 1071300, marginGap: -214200, budgetClosingCash: 199400, projectedClosingCash: 179460, cashGap: -19940, achievementProbability: 0.78, lowCase: { revenue: 1900000, cash: 145000 }, medianCase: { revenue: 2065100, cash: 179460 }, highCase: { revenue: 2190000, cash: 205000 }, mainDrivers: [{ label: "Retard mission IA", impact: -42000 }, { label: "Pipeline insuffisant", impact: -115000 }, { label: "Encaissements tardifs", impact: -62240 }] } });
  await Promise.all([
    prisma.requiredPipelineSnapshot.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: 2026, targetRevenue: 2493000, actualRevenue: 92500, signedRemainingRevenue: 840000, weightedPipelineRevenue: 210000, revenueGap: 1350500, historicalConversionRate: 0.35, requiredGrossPipeline: 3858571, opportunitiesNeeded: 46, latestSignatureMonth: "2026-09", recommendations: ["Securiser prolongations", "Convertir GreenGrid", "Lancer campagne nouveaux comptes"] } }),
    prisma.whatMustBeTrueCondition.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: 2026, conditionType: "revenue_condition", description: "Signer au moins 420 k EUR de nouvelles missions avant fin septembre", targetValue: 420000, currentValue: 210000, gap: -210000, riskLevel: "high", relatedActions: ["Securiser prolongation Banque Horizon", "Convertir offre GreenGrid"], status: "at_risk" } }),
    prisma.whatMustBeTrueCondition.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: 2026, conditionType: "staffing_condition", description: "Maintenir un taux d'occupation interne supérieur à 86 %", targetValue: 0.86, currentValue: 0.81, gap: -0.05, riskLevel: "medium", relatedActions: ["Placer Sarah Leroy sur mission QA retail"], status: "at_risk" } }),
    prisma.whatMustBeTrueCondition.create({ data: { organizationId: organization.id, companyId: company.id, fiscalYear: 2026, conditionType: "payment_condition", description: "Encaisser 80 % des factures à moins de 45 jours", targetValue: 0.8, currentValue: 0.64, gap: -0.16, riskLevel: "high", relatedActions: ["Relancer HealthLink"], status: "not_satisfied" } })
  ]);

  for (const month of Array.from({ length: 12 }, (_, index) => index + 1)) {
    const requiredBillableDays = 245 + month * 2;
    const internalCapacityDays = month >= 9 ? 168 : 150;
    const externalCapacityDays = month >= 10 ? 58 : 46;
    await prisma.budgetStaffingSnapshot.create({
      data: {
        organizationId: organization.id,
        companyId: company.id,
        fiscalYear: 2026,
        month,
        requiredBillableDays,
        internalCapacityDays,
        externalCapacityDays,
        gapDays: internalCapacityDays + externalCapacityDays - requiredBillableDays,
        requiredFTE: requiredBillableDays / 20,
        availableFTE: (internalCapacityDays + externalCapacityDays) / 20,
        staffingGapFTE: (internalCapacityDays + externalCapacityDays - requiredBillableDays) / 20,
        missingSkills: month >= 9 ? ["Java senior", "Cloud AWS"] : ["QA automation"],
        recommendedActions: month >= 9 ? ["Recruter Java senior", "Securiser partenaire cloud"] : ["Placer consultant disponible"]
      }
    });
  }

  await Promise.all([
    prisma.alert.create({ data: { scenarioId: referenceScenario.id, type: "budget_revenue_gap", severity: "critical", message: "Atterrissage annuel sous budget CA", month: "2026-07", recommendedAction: "Activer plan de redressement S2 et pipeline necessaire", status: "new" } }),
    prisma.alert.create({ data: { scenarioId: referenceScenario.id, type: "objective_at_risk", severity: "warning", message: "Objectif occupation interne à risque", month: "2026-07", recommendedAction: "Placer les consultants en intercontrat avant fin juillet", status: "new" } }),
    prisma.auditLog.create({ data: { entityType: "budget_v6", entityId: initialBudget.id, action: "create_budget_trajectory_démo", after: { fiscalYear: 2026, objectives: 5, landing: annualLanding.projectedAnnualRevenue, actionPlan: actionPlan.title } } }),
    prisma.helpArticle.create({ data: { pageKey: "trajectory", title: "Budget, forecast et reel", category: "budget", body: "Le budget est la trajectoire cible verrouillee. Le rolling forecast est la trajectoire actualisee. Le reel explique les Ecarts." } }),
    prisma.helpArticle.create({ data: { pageKey: "annualLanding", title: "Atterrissage annuel", category: "budget", body: "L'atterrissage combine le reel à date et le forecast restant pour estimer la fin d'annee probable." } }),
    prisma.helpArticle.create({ data: { pageKey: "actionPlans", title: "Plans d'action", category: "pilotage", body: "Chaque action doit etre rattachee à un objectif ou un Ecart, avec responsable, Echeance et impact attendu." } })
  ]);

  const pricingSettings = await prisma.pricingSettings.create({
    data: {
      organizationId: organization.id,
      companyId: company.id,
      defaultTargetMarginRate: 0.3,
      minimumMarginRate: 0.22,
      defaultOverheadAllocationMode: "percentage_of_direct_cost",
      defaultOverheadRate: 0.08,
      roundingMode: "nearest_10",
      defaultCommercialDiscountWarningRate: 0.05,
      renegotiationMarginThreshold: 0.25,
      renegotiationReviewPeriodMonths: 3
    }
  });

  const pricingProfiles = [
    { mission: missions[0], status: "healthy", current: 720, floor: 580, recommended: 690, margin: 0.34, impact: 0, note: "Mission rentable, TJM coherent avec la cible." },
    { mission: missions[1], status: "renegotiation_recommended", current: 610, floor: 590, recommended: 710, margin: 0.24, impact: 2800, note: "TJM proche du plancher, marge inférieure à la cible." },
    { mission: missions[2], status: "underpriced", current: 560, floor: 620, recommended: 740, margin: 0.16, impact: 3600, note: "Remise commerciale durable non compensee." },
    { mission: missions[3], status: "critical", current: 540, floor: 650, recommended: 780, margin: -0.08, impact: 5200, note: "Hausse cout freelance cyber non répercutée." },
    { mission: missions[4], status: "watch", current: 760, floor: 640, recommended: 820, margin: 0.28, impact: 1200, note: "Mission longue à revoir avant prolongation." }
  ];

  for (const profile of pricingProfiles) {
    await prisma.missionPricingProfile.create({
      data: {
        organizationId: organization.id,
        companyId: company.id,
        missionId: profile.mission.id,
        targetMarginRate: 0.3,
        minimumMarginRate: pricingSettings.minimumMarginRate,
        overheadAllocationMode: pricingSettings.defaultOverheadAllocationMode,
        overheadRate: pricingSettings.defaultOverheadRate,
        pricingStatus: profile.status,
        currentAverageSaleDailyRate: profile.current,
        calculatedFloorDailyRate: profile.floor,
        recommendedDailyRate: profile.recommended,
        currentMarginRate: profile.margin,
        targetMarginGap: profile.recommended - profile.current,
        monthlyImpactAmount: profile.impact,
        annualizedImpactAmount: profile.impact * 12,
        lastCalculatedAt: d("2026-07-01"),
        notes: profile.note
      }
    });
  }

  const candidateA = await prisma.renegotiationCandidate.create({
    data: {
      organizationId: organization.id,
      companyId: company.id,
      missionId: missions[3].id,
      reason: "Marge negative apres hausse du cout freelance cyber",
      severity: "critical",
      currentDailyRate: 540,
      floorDailyRate: 650,
      recommendedDailyRate: 780,
      targetDailyRate: 780,
      marginGap: -0.38,
      monthlyImpactAmount: 5200,
      annualizedImpactAmount: 62400,
      priorityScore: 88,
      priorityFactors: [{ label: "Marge negative", value: 35 }, { label: "Impact mensuel", value: 10.4 }, { label: "Ecart TJM", value: 30 }, { label: "Mission critique", value: 12.6 }],
      status: "negotiation_in_progress",
      ownerUserId: "commercial@esnforecast.local",
      nextReviewDate: d("2026-07-25")
    }
  });
  const candidateB = await prisma.renegotiationCandidate.create({
    data: {
      organizationId: organization.id,
      companyId: company.id,
      missionId: missions[2].id,
      reason: "TJM sous plancher apres remise commerciale prolongee",
      severity: "high",
      currentDailyRate: 560,
      floorDailyRate: 620,
      recommendedDailyRate: 740,
      targetDailyRate: 720,
      marginGap: -0.14,
      monthlyImpactAmount: 3600,
      annualizedImpactAmount: 43200,
      priorityScore: 74,
      priorityFactors: [{ label: "Ecart marge", value: 14 }, { label: "Impact mensuel", value: 7.2 }, { label: "Ecart TJM recommande", value: 24 }, { label: "Duree restante", value: 28.8 }],
      status: "action_planned",
      ownerUserId: "direction@esnforecast.local",
      nextReviewDate: d("2026-08-05")
    }
  });

  const pricingPlan = await prisma.actionPlan.create({
    data: {
      organizationId: organization.id,
      companyId: company.id,
      title: "Plan de renegociation marge mission",
      description: "Actions V7 pour securiser les TJM et la marge des missions sous-margees",
      fiscalYear: 2026,
      status: "active",
      ownerUserId: "direction@esnforecast.local",
      createdBy: "direction@esnforecast.local"
    }
  });
  const renegotiationAction = await prisma.actionItem.create({
    data: {
      actionPlanId: pricingPlan.id,
      title: "Renegocier audit securite sante à 780 EUR",
      description: "Argumentaire base sur hausse cout freelance et TJM recommande V7.",
      actionType: "client_renegotiation",
      ownerUserId: "commercial@esnforecast.local",
      dueDate: d("2026-07-25"),
      status: "in_progress",
      expectedImpactAmount: 5200,
      expectedImpactMonth: "2026-08",
      priority: "critical",
      relatedMissionId: missions[3].id
    }
  });

  const simulation = await prisma.pricingSimulation.create({
    data: {
      organizationId: organization.id,
      companyId: company.id,
      missionId: missions[3].id,
      scenarioId: referenceScenario.id,
      name: "Audit sante - scenarios TJM",
      input: { currentDailyRate: 540, targetMarginRate: 0.3, freelanceCostIncrease: 0.12 },
      output: { recommendedDailyRate: 780, monthlyGain: 5200, status: "critical" },
      createdBy: "finance@esnforecast.local",
      variants: {
        create: [
          { name: "Maintien TJM", dailyRate: 540, discountRate: 0, result: { marginRate: -0.08, monthlyImpact: -5200 }, isSelected: false },
          { name: "Hausse cible", dailyRate: 780, discountRate: 0, result: { marginRate: 0.3, monthlyImpact: 5200 }, isSelected: true },
          { name: "Compromis commercial", dailyRate: 720, discountRate: 0, result: { marginRate: 0.24, monthlyImpact: 3600 }, isSelected: false }
        ]
      }
    }
  });

  await Promise.all([
    prisma.pricingDecision.create({ data: { organizationId: organization.id, companyId: company.id, missionId: missions[0].id, decisionType: "initial_pricing", previousDailyRate: 680, newDailyRate: 720, floorDailyRateAtDecision: 580, recommendedDailyRateAtDecision: 690, marginBefore: 0.29, marginAfter: 0.34, reason: "Prix initial valide au-dessus du TJM recommande", decidedBy: "direction@esnforecast.local", decidedAt: d("2026-06-01") } }),
    prisma.pricingDecision.create({ data: { organizationId: organization.id, companyId: company.id, missionId: missions[2].id, decisionType: "discount_accepted", previousDailyRate: 610, newDailyRate: 560, floorDailyRateAtDecision: 620, recommendedDailyRateAtDecision: 740, marginBefore: 0.22, marginAfter: 0.16, reason: "Remise acceptee pour prolongation courte, à revoir au prochain avenant", decidedBy: "commercial@esnforecast.local", decidedAt: d("2026-06-15"), relatedSimulationId: simulation.id } }),
    prisma.pricingDecision.create({ data: { organizationId: organization.id, companyId: company.id, missionId: missions[3].id, decisionType: "renegotiation", previousDailyRate: 540, newDailyRate: 780, floorDailyRateAtDecision: 650, recommendedDailyRateAtDecision: 780, marginBefore: -0.08, marginAfter: 0.3, reason: "Renegociation lancee apres hausse du cout freelance", decidedBy: "finance@esnforecast.local", decidedAt: d("2026-07-01"), relatedActionItemId: renegotiationAction.id } }),
    prisma.marginException.create({ data: { organizationId: organization.id, companyId: company.id, missionId: missions[1].id, reason: "Entree strategique chez client energie avec potentiel de phase 2", approvedBy: "direction@esnforecast.local", approvedAt: d("2026-06-20"), expirationDate: d("2026-09-30"), targetReviewDate: d("2026-09-15"), comment: "Exception visible en rapport pricing, pas de masquage de la marge.", status: "active" } }),
    prisma.alert.create({ data: { scenarioId: referenceScenario.id, type: "pricing_floor_rate", severity: "critical", message: "Audit securite sante est sous le TJM plancher", month: "2026-07", recommendedAction: "Renegocier à 780 EUR ou reduire le cout freelance", status: "new" } }),
    prisma.alert.create({ data: { scenarioId: referenceScenario.id, type: "pricing_discount", severity: "warning", message: "Migration cloud retail subit une remise durable superieure au seuil", month: "2026-07", recommendedAction: "Preparer avenant ou limiter la remise à la prochaine reconduction", status: "new" } }),
    prisma.actionSuggestion.create({ data: { organizationId: organization.id, sourceType: "pricing", sourceId: candidateA.id, title: "Preparer argumentaire TJM audit sante", description: "Utiliser cout complet et marge cible pour justifier le TJM 780 EUR", expectedImpactAmount: 5200, expectedImpactMonth: "2026-08", confidenceScore: 0.84, priority: "critical", status: "suggested" } }),
    prisma.actionSuggestion.create({ data: { organizationId: organization.id, sourceType: "pricing", sourceId: candidateB.id, title: "Revoir remise migration retail", description: "Limiter la remise ou compenser par extension de volume", expectedImpactAmount: 3600, expectedImpactMonth: "2026-08", confidenceScore: 0.78, priority: "high", status: "suggested" } }),
    prisma.helpArticle.create({ data: { pageKey: "pricingDashboard", title: "TJM plancher et TJM recommande", category: "pricing", body: "Le TJM plancher couvre le cout complet et la marge minimum. Le TJM recommande vise la marge cible de l'entreprise ou de la mission." } }),
    prisma.helpArticle.create({ data: { pageKey: "pricingSimulator", title: "Simuler une remise", category: "pricing", body: "Une remise doit etre analysee en impact CA, marge mensuelle, marge annuelle et Ecart au TJM recommande." } }),
    prisma.auditLog.create({ data: { entityType: "pricing_v7", entityId: pricingSettings.id, action: "create_pricing_démo", after: { profiles: pricingProfiles.length, candidates: 2, simulation: simulation.id } } })
  ]);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed ESN Forecast terminé.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
