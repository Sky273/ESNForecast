# ESN Forecast

MVP web pour piloter les revenus, coûts, marges et risques de trésorerie d'une ESN.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Recharts
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL, Prisma
- Shared: moteur de projection financier isolé et testé

## Démarrage

```powershell
npm install
Copy-Item apps/api/.env.example apps/api/.env
docker compose up -d postgres
npm run prisma:generate
npm run db:push
npm run seed
npm run dev
```

L'API écoute par défaut sur `http://localhost:4000`, le frontend sur `http://localhost:5173`, et PostgreSQL Docker sur `localhost:55432`.

## V1 - Modules livrés

La V1 ajoute les modules opérationnels suivants :

- scénarios financiers : référence, pessimiste, optimiste, duplication, activation et comparaison ;
- moteur V1 `calculateScenarioProjection` distinguant CA généré, CA facturé, cash-in, coûts engagés, cash-out et trésorerie ;
- facturation prévisionnelle, encaissements et décaissements ;
- trésorerie prévisionnelle mois par mois avec seuil critique ;
- rentabilité par mission et par ressource ;
- calcul d'intercontrat et taux d'occupation interne ;
- simulations : perte de mission, prolongation, hausse de TJM, coût exceptionnel ;
- alertes avancées dynamiques et persistées ;
- utilisateurs/roles simples, audit logs et endpoints d'authentification de démonstration ;
- rapport direction JSON et PDF simple ;
- seed V1 avec 3 scénarios, utilisateurs, factures, cash-in/out, simulations et alertes.

## Indicateurs métier

- `revenueGenerated` : production économique du mois, selon missions et affectations.
- `revenueInvoiced` : factures prévues émises sur le mois.
- `cashInExpected` : encaissements bruts attendus selon les dates de paiement.
- `cashInWeighted` : encaissements pondérés par probabilité.
- `costsAccrued` : coûts engagés économiquement sur le mois.
- `cashOutExpected` : décaissements prévisionnels, incluant coûts et sorties manuelles.
- `monthlyBalanceAccrual` : résultat mensuel en logique économique.
- `monthlyCashBalance` : variation de trésorerie.
- `benchCost` : coût d'intercontrat des salariés plaçables non affectés.

## API V1 principale

- `GET /api/scenarios`
- `POST /api/scenarios`
- `POST /api/scenarios/:id/duplicate`
- `POST /api/scenarios/:id/set-active`
- `GET /api/scenarios/compare?scenarioA=...&scenarioB=...`
- `GET /api/projections/scenario/:scenarioId?horizon=12`
- `GET /api/profitability/missions?scenarioId=...`
- `GET /api/profitability/resources?scenarioId=...`
- `GET /api/bench?scenarioId=...`
- `GET /api/alerts?scenarioId=...`
- `GET /api/reports/executive.json`
- `GET /api/reports/executive.pdf`

## Limites V1

Le produit reste un outil de pilotage prévisionnel. Il ne remplace pas un logiciel comptable, ne calcule pas une paie légale, ne gère pas une TVA exhaustive et ne fait pas de rapprochement bancaire.
## V2 - Cockpit augmente

La V2 ajoute une premiere tranche fonctionnelle reliant le previsionnel au reel :

- CRA / timesheets avec statuts `draft`, `submitted`, `approved`, `rejected`, `locked` ;
- factures reelles, paiements partiels et rapprochement facture prevue / facture reelle ;
- saisie des actuals mensuels et calcul des ecarts previsionnel / reel ;
- cloture mensuelle simplifiee avec snapshots JSON ;
- capacity planning par competence, besoins mission et gaps FTE ;
- recrutements previsionnels, offres/devis, documents, workflows et notifications ;
- regles metier configurables declenchant des alertes dynamiques ;
- analyse Monte Carlo simplifiee P10/P50/P90 ;
- risques strategiques par concentration client ;
- analyse IA encadree, basee uniquement sur les chiffres calcules ;
- preparation SaaS avec `organizations`, `memberships`, API keys et webhooks ;
- architecture de connecteurs CSV/CRM/compta/RH avec tables de synchro.

## API V2 principale

- `GET /api/executive/situation?scenarioId=...&horizon=12`
- `GET|POST /api/timesheets`
- `POST /api/timesheets/:id/submit`
- `POST /api/timesheets/:id/approve`
- `POST /api/timesheets/:id/lock`
- `POST /api/timesheets/:id/generate-invoice`
- `GET|POST /api/actuals/monthly`
- `GET /api/variances/monthly?scenarioId=...`
- `GET /api/monthly-closes`
- `POST /api/monthly-closes/:month/prepare`
- `POST /api/monthly-closes/:month/close`
- `POST /api/monthly-closes/:month/reopen`
- `GET|POST /api/invoices`
- `POST /api/invoices/:id/mark-paid`
- `GET|POST /api/payments`
- `GET /api/reconciliation/billing`
- `GET /api/capacity`
- `GET /api/staffing/forecast`
- `POST /api/monte-carlo/run`
- `GET /api/risks/strategic`
- `POST /api/ai/analyze/scenario`
- `POST /api/ai/chat`
- `GET|POST /api/business-rules`
- `POST /api/business-rules/evaluate`
- `GET|POST /api/offers`
- `POST /api/offers/:id/convert-to-mission`
- `GET|POST /api/documents`
- `GET|POST /api/webhooks`
- `GET|POST /api/api-keys`

## Moteur V2

Le package partage expose `calculateExecutiveSituation(input)` et des modules testables :

- `calculateMonthlyVariance` pour les ecarts CA, couts, marge et cash ;
- `generateInvoiceFromTimesheet` pour la facturation depuis CRA valide ;
- `calculateCapacityPlan` pour les gaps de staffing par competence ;
- `runMonteCarloSimulation` pour les fourchettes probabilistes ;
- `runRuleEngine` pour alertes et notifications ;
- `analyzeStrategicDependencies` pour concentration client ;
- `buildAiExecutiveAnalysis` pour une synthese IA sans invention de chiffres.

Les tests couvrent V1 et V2 via `npm run test`.

## Limites V2

La V2 reste volontairement un cockpit de pilotage. Les connecteurs externes sont prepares et simules via tables/imports CSV, mais les integrations completes HubSpot, Pennylane, Lucca ou Salesforce ne sont pas implementees. L'analyse IA ne modifie aucune donnee et ne doit pas etre traitee comme une expertise comptable.
