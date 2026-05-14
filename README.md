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

## V3 - Connexion au reel financier

La V3 ferme la boucle `prevision -> reel bancaire/comptable -> rapprochement -> ecarts -> recalibrage -> decision`.

Modules ajoutes :

- architecture generique de connecteurs avec `connectors` et `connector_sync_runs` ;
- provider bancaire mock et connecteur comptable mock pour demonstration et tests ;
- comptes bancaires, consentements, soldes et transactions bancaires ;
- imports CSV bancaire et comptable via endpoints robustes avec detection basique des lignes invalides ;
- categories financieres et regles de categorisation bancaire ;
- suggestions de rapprochement bancaire avec score de confiance ;
- rapprochements financiers validables et annulables ;
- chaine facture prevue / facture reelle / paiement / transaction ;
- profils de paiement clients et analyse des retards ;
- tresorerie reelle vs previsionnelle et projection recalibree ;
- cash runway base sur cash bancaire et burn importe ;
- suggestions de reforecast ;
- score de fiabilite previsionnelle ;
- detection d'anomalies financieres ;
- sante des donnees ;
- supervision connecteurs et gouvernance des consentements ;
- rapport CODIR JSON/PDF simple ;
- assistant IA V3 base sur donnees internes calculees.

## API V3 principale

- `GET /api/financial/situation`
- `GET|POST /api/connectors`
- `POST /api/connectors/:id/sync`
- `POST /api/connectors/:id/disconnect`
- `GET /api/connectors/:id/sync-runs`
- `GET|POST /api/bank/connections`
- `POST /api/bank/connections/:id/refresh-consent`
- `POST /api/bank/connections/:id/revoke`
- `GET /api/bank/accounts`
- `GET /api/bank/accounts/:id/transactions`
- `GET /api/bank/transactions`
- `PUT /api/bank/transactions/:id/category`
- `POST /api/bank/transactions/import-csv`
- `POST /api/accounting/import-csv`
- `GET /api/accounting/imports/invoices`
- `GET /api/accounting/imports/payments`
- `GET|POST /api/financial-categories`
- `GET|POST /api/bank/categorization-rules`
- `POST /api/bank/categorization-rules/evaluate`
- `GET /api/reconciliation/suggestions`
- `POST /api/reconciliation/suggestions/:id/accept`
- `POST /api/reconciliation/suggestions/:id/reject`
- `GET /api/reconciliation/financial`
- `POST /api/reconciliation/financial/:id/cancel`
- `GET /api/reconciliation/chains`
- `GET /api/client-payment-profiles`
- `POST /api/client-payment-profiles/recalculate`
- `GET /api/forecast-reliability`
- `POST /api/forecast-reliability/recalculate`
- `GET /api/treasury/actual-vs-forecast`
- `GET /api/treasury/runway`
- `GET /api/financial-anomalies`
- `POST /api/financial-anomalies/detect`
- `GET /api/data-quality`
- `POST /api/data-quality/recalculate`
- `GET /api/reports/codir.json`
- `GET /api/reports/codir.pdf`
- `POST /api/ai/analyze/cash-variance`
- `POST /api/ai/analyze/connector-health`
- `POST /api/ai/analyze/codir`

## Moteur V3

Le package partage expose :

- `categorizeTransactions` ;
- `generateReconciliationSuggestions` ;
- `calculateClientPaymentProfiles` ;
- `calculateForecastReliability` ;
- `calculateTreasuryActualVsForecast` ;
- `calculateRunway` ;
- `detectFinancialAnomalies` ;
- `calculateDataQualityIssues` ;
- `buildV3FinancialSituation`.

## Limites V3

La V3 ne stocke pas d'identifiants bancaires et n'initie aucun paiement. Les providers bancaire et comptable livres sont mock/CSV : ils preparent l'integration d'agregateurs type Bridge, Powens, Tink ou Plaid, mais aucune connexion bancaire reelle OAuth/API n'est active sans credentials et contrat fournisseur. ESN Forecast reste un cockpit de pilotage, pas un logiciel comptable certifie.

## V4 - Connecteurs production-grade

La V4 ajoute une couche provider commune pour passer du mock/CSV vers des connecteurs reels supervisables.

Capacites livrees :

- interface `FinancialConnectorProvider` commune ;
- providers Bridge, Powens, Tink, Plaid, Pennylane et Sage ;
- skeletons Cegid, Odoo et QuickBooks non actives par defaut ;
- `SecretManager` AES-GCM pour tokens et credentials ;
- sessions OAuth avec `state`, expiration et callback ;
- Plaid Link token et exchange public token cote backend ;
- tokens provider chiffres en base, jamais exposes au frontend ;
- sync full/incrementale avec cursors ;
- normalisation comptes, transactions, factures et paiements ;
- ingestion webhooks par provider avec stockage brut ;
- mapping d'erreurs provider ;
- rate limit state ;
- detection de doublons multi-source ;
- politiques de source de verite ;
- supervision provider, errors, syncs, webhooks, rate limits ;
- page conformite connecteurs avec tokens masques.

## API V4 principale

- `GET /api/providers`
- `GET /api/providers/:provider/capabilities`
- `GET /api/providers/:provider/config-status`
- `POST /api/connectors/:provider/oauth/start`
- `GET /api/connectors/:provider/oauth/callback`
- `POST /api/connectors/:id/reconnect`
- `POST /api/connectors/:id/revoke`
- `POST /api/providers/plaid/link-token`
- `POST /api/providers/plaid/exchange-public-token`
- `POST /api/connectors/:id/sync`
- `POST /api/connectors/:id/full-sync`
- `POST /api/connectors/:id/incremental-sync`
- `GET /api/connectors/:id/cursors`
- `POST /api/webhooks/bridge`
- `POST /api/webhooks/powens`
- `POST /api/webhooks/tink`
- `POST /api/webhooks/plaid`
- `POST /api/webhooks/pennylane`
- `POST /api/webhooks/sage`
- `GET /api/provider-errors`
- `POST /api/provider-errors/:id/resolve`
- `POST /api/provider-errors/:id/retry`
- `GET /api/duplicates`
- `POST /api/duplicates/:id/merge`
- `GET /api/data-source-policies`
- `PUT /api/data-source-policies/:domain`
- `GET /api/connector-health`
- `GET /api/connector-health/webhooks`
- `GET /api/connector-health/rate-limits`
- `GET /api/compliance/connectors`
- `GET /api/compliance/consents`
- `POST /api/compliance/consents/:id/revoke`

## Configuration V4

Les variables providers sont declarees dans `apps/api/.env.example` :

- Bridge : `BRIDGE_CLIENT_ID`, `BRIDGE_CLIENT_SECRET`, `BRIDGE_API_BASE_URL`, `BRIDGE_REDIRECT_URI`, `BRIDGE_WEBHOOK_SECRET`, `BRIDGE_ENV`
- Powens : `POWENS_CLIENT_ID`, `POWENS_CLIENT_SECRET`, `POWENS_DOMAIN`, `POWENS_REDIRECT_URI`, `POWENS_WEBHOOK_SECRET`, `POWENS_ENV`
- Tink : `TINK_CLIENT_ID`, `TINK_CLIENT_SECRET`, `TINK_API_BASE_URL`, `TINK_REDIRECT_URI`, `TINK_WEBHOOK_SECRET`, `TINK_ENV`
- Plaid : `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `PLAID_PRODUCTS`, `PLAID_COUNTRY_CODES`, `PLAID_REDIRECT_URI`, `PLAID_WEBHOOK_SECRET`
- Pennylane : `PENNYLANE_CLIENT_ID`, `PENNYLANE_CLIENT_SECRET`, `PENNYLANE_API_BASE_URL`, `PENNYLANE_REDIRECT_URI`, `PENNYLANE_WEBHOOK_SECRET`, `PENNYLANE_ENV`
- Sage : `SAGE_CLIENT_ID`, `SAGE_CLIENT_SECRET`, `SAGE_API_BASE_URL`, `SAGE_REDIRECT_URI`, `SAGE_WEBHOOK_SECRET`, `SAGE_ENV`

`SECRET_ENCRYPTION_KEY` doit etre defini avec une valeur forte en production. Sans credentials provider, ESN Forecast reste exploitable en mode mock/sandbox, ce qui permet tests, demo et developpement local.

## Limites V4

La V4 n'initie aucun paiement et ne stocke aucun identifiant bancaire utilisateur. Les appels providers reels dependent des contrats, credentials, scopes et URLs actives chez Bridge, Powens, Tink, Plaid, Pennylane ou Sage. En absence de credentials, les flux OAuth/sync utilisent un mode mock explicite et auditable.
