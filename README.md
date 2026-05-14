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
