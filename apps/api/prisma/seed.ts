import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();
const d = (value: string) => new Date(`${value}T00:00:00.000Z`);
const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};

async function main() {
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

  const organization = await prisma.organization.create({ data: { name: "ESN Forecast Demo Group", slug: "demo-group" } });

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
    prisma.user.create({ data: { organizationId: organization.id, email: "admin@esnforecast.local", name: "Admin ESN", role: "admin", passwordHash: hashPassword("demo") } }),
    prisma.user.create({ data: { organizationId: organization.id, email: "direction@esnforecast.local", name: "Direction ESN", role: "direction", passwordHash: hashPassword("demo") } }),
    prisma.user.create({ data: { organizationId: organization.id, email: "finance@esnforecast.local", name: "Finance ESN", role: "finance", passwordHash: hashPassword("demo") } })
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
    prisma.auditLog.create({ data: { entityType: "seed", entityId: "v1", action: "create_demo_data", after: { scenarios: 3, users: 3 } } })
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
    prisma.monthlyClose.create({ data: { companyId: company.id, month: 5, year: 2026, status: "closed", closedAt: d("2026-06-07"), closedBy: "finance@esnforecast.local", initialForecastSnapshot: { revenue: 78000 }, revisedForecastSnapshot: { revenue: 82000 }, actualSnapshot: { revenue: 79500, cash: 69000 }, notes: "Mois cloture demo" } }),
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
    prisma.probabilisticAssumption.create({ data: { scenarioId: referenceScenario.id, entityType: "mission", entityId: missions[4].id, field: "revenueGenerated", distributionType: "triangular", minValue: 45000, mostLikelyValue: 72000, maxValue: 95000, probability: 0.65, notes: "Opportunite IA conformite incertaine" } }),
    prisma.businessRule.create({ data: { companyId: company.id, name: "Tresorerie critique", description: "Alerte si la tresorerie de cloture passe sous 50k", triggerType: "monthly_projection", condition: { metric: "closingCash", operator: "lt", value: 50000 }, action: { type: "alert", message: "Tresorerie sous seuil de vigilance" }, severity: "critical", isActive: true } }),
    prisma.businessRule.create({ data: { companyId: company.id, name: "Marge faible", description: "Alerte marge inferieure a 22%", triggerType: "monthly_projection", condition: { metric: "marginRate", operator: "lt", value: 0.22 }, action: { type: "alert", message: "Marge previsionnelle inferieure au seuil" }, severity: "warning", isActive: true } }),
    prisma.notification.create({ data: { type: "invoice_overdue", severity: "warning", title: "Relance paiement Banque Horizon", message: "La facture F-2026-0001 reste partiellement payee.", relatedEntityType: "invoice", relatedEntityId: realInvoice.id, status: "unread" } }),
    prisma.approvalWorkflow.create({ data: { entityType: "timesheet", entityId: "demo-cra", status: "pending_approval", requestedBy: "consultant@esnforecast.local", requestedAt: d("2026-07-02"), comment: "CRA juin a valider" } }),
    prisma.crmOpportunity.create({ data: { externalSource: "csv-demo", externalId: "opp-001", clientName: "Banque Horizon", opportunityName: "Modernisation paiement instantane", stage: "proposal", probability: 0.55, expectedAmount: 180000, expectedStartDate: d("2026-11-01"), expectedEndDate: d("2027-04-30"), expectedTJM: 920, expectedStaffingNeeds: { java: 2, cloud: 1 }, owner: "Julien Moreau", lastSyncedAt: d("2026-06-15"), rawPayload: { source: "seed" } } }),
    prisma.accountingSync.create({ data: { provider: "csv-accounting", status: "completed", lastSyncAt: d("2026-07-05"), importedInvoicesCount: 1, importedPaymentsCount: 1, importedExpensesCount: 2, errors: [] } }),
    prisma.hrSync.create({ data: { provider: "csv-hr", status: "completed", lastSyncAt: d("2026-07-04"), importedEmployeesCount: 8, importedAbsencesCount: 1, errors: [] } }),
    prisma.document.create({ data: { companyId: company.id, entityType: "invoice", entityId: realInvoice.id, fileName: "F-2026-0001.pdf", mimeType: "application/pdf", size: 128000, storagePath: "local/demo/F-2026-0001.pdf", category: "invoice", uploadedBy: "finance@esnforecast.local", notes: "Document fictif seed" } }),
    prisma.apiKey.create({ data: { companyId: company.id, name: "Demo API", keyHash: hashPassword("demo-api-key"), scopes: ["read:projection", "read:invoices"] } }),
    prisma.webhookSubscription.create({ data: { companyId: company.id, url: "https://example.invalid/webhooks/esn-forecast", events: ["invoice.paid", "monthly_close.completed"], secret: "demo-secret", isActive: true, lastDeliveryStatus: "never_sent" } })
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

  await prisma.auditLog.create({ data: { entityType: "seed", entityId: "v2", action: "create_demo_data", after: { timesheets: 3, invoices: 1, skills: 3, rules: 2 } } });

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
    prisma.financialAnomaly.create({ data: { organizationId: organization.id, type: "uncategorized_large_transaction", severity: "warning", entityType: "bank_transaction", entityId: tx5.id, amount: 6200, explanation: "Transaction significative a valider dans les couts fixes.", suggestedAction: "Confirmer la categorie et rapprocher avec le loyer prevu.", status: "new" } }),
    prisma.dataQualityIssue.create({ data: { organizationId: organization.id, type: "uncategorized_transactions", severity: "warning", entityType: "bank_transaction", entityId: "multiple", message: "1 transaction bancaire reste non categorisee.", suggestedFix: "Creer une regle ou categoriser manuellement.", status: "open" } }),
    prisma.dataQualityIssue.create({ data: { organizationId: organization.id, type: "connector_health", severity: "critical", entityType: "connector", entityId: expiredConnector.id, message: "Un consentement bancaire est expire.", suggestedFix: "Renouveler ou revoquer le consentement.", status: "open" } }),
    prisma.codirReport.create({ data: { organizationId: organization.id, companyId: company.id, scenarioId: referenceScenario.id, month: "2026-06", format: "json", payload: { cash: 77000, runway: "fragile", anomalies: 2, recommendations: ["Rapprocher les transactions URSSAF", "Relancer HealthLink"] }, generatedBy: "direction@esnforecast.local" } }),
    prisma.financialExportLog.create({ data: { organizationId: organization.id, companyId: company.id, userId: "direction@esnforecast.local", exportType: "codir_report", filters: { month: "2026-06" }, sensitivityLevel: "financial" } })
  ]);

  await prisma.auditLog.create({ data: { entityType: "financial_v3", entityId: "seed", action: "create_connected_finance_demo", after: { connectors: 3, bankTransactions: 6, reconciliations: 1, anomalies: 2 } } });
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
