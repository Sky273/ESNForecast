import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();
const d = (value: string) => new Date(`${value}T00:00:00.000Z`);
const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};

async function main() {
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

  await prisma.company.create({
    data: {
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
    prisma.user.create({ data: { email: "admin@esnforecast.local", name: "Admin ESN", role: "admin", passwordHash: hashPassword("demo") } }),
    prisma.user.create({ data: { email: "direction@esnforecast.local", name: "Direction ESN", role: "direction", passwordHash: hashPassword("demo") } }),
    prisma.user.create({ data: { email: "finance@esnforecast.local", name: "Finance ESN", role: "finance", passwordHash: hashPassword("demo") } })
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
