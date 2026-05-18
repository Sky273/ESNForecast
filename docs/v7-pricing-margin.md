# ESN Forecast V7 - Pricing mission et securisation de marge

## Objectif

La V7 ajoute une couche de pricing opérationnel par mission. Elle aide la direction à calculér un TJM plancher, un TJM recommandé, l'impact d'une remise ou d'une hausse de coût, puis à identifier les missions sous-margées à renégocier.

Le module reste volontairement cible sur la mission. Il ne remplace pas un CRM, ne fait pas de benchmark marche et ne produit pas de strategie commerciale globale.

## Concepts métier

- Coût direct : coût salarié prorate, partenaire, freelance et frais directement rattachés à la mission.
- Coût indirect imputé : overhead ajouté selon la règle de pricing.
- Coût complet journalier : coût complet divisé par les jours facturables.
- TJM plancher : `coût complet journalier / (1 - marge minimum)`.
- TJM recommandé : `coût complet journalier / (1 - marge cible)`.
- Mission sous-margee : mission dont le TJM ou la marge ne couvre pas les seuils.
- Mission à renégocier : mission sous plancher, sous cible, avec remise durable ou hausse de coût non répercutée.

## Paramètres

Les paramètres sont portes par `PricingSettings` :

- marge cible par defaut ;
- marge minimum ;
- mode d'imputation overhead : aucun, montant journalier, pourcentage du coût direct, pourcentage du revenu, pool mensuel ;
- arrondi des TJM ;
- seuil d'alerte remise ;
- seuil et periode de revue de renégociation.

## Moteur de calcul

Le moteur testable vit dans `packages/shared/src/v7PricingEngine.ts`.

Il expose :

- `calculateMissionPricing` ;
- `calculateFloorRate` ;
- `calculateRecommendedRate` ;
- `simulatePricing` ;
- `calculateRenegotiationPriority`.

Les statuts produits sont :

- `healthy` ;
- `watch` ;
- `underpriced` ;
- `critical` ;
- `renegotiation_recommended` ;
- `insufficient_data`.

## API

Principaux endpoints :

- `GET /api/pricing/settings`
- `PUT /api/pricing/settings`
- `GET /api/pricing/dashboard`
- `GET /api/pricing/missions/:missionId`
- `POST /api/pricing/missions/:missionId/recalculate`
- `POST /api/pricing/simulate`
- `GET /api/pricing/underpriced-missions`
- `GET /api/pricing/renegotiation-candidates`
- `POST /api/pricing/renegotiation-candidates/recalculate`
- `POST /api/pricing/renegotiation-candidates/:id/create-action`
- `GET /api/pricing/decisions`
- `GET /api/pricing/margin-exceptions`
- `GET /api/reports/pricing-margin.json`
- `GET /api/reports/pricing-margin.csv`

## UX

La navigation ajoute la section `Pricing & marge` :

- Dashboard pricing ;
- Simulateur pricing ;
- Profil pricing mission ;
- Missions sous-margées ;
- Missions à renégocier ;
- Paramètres pricing ;
- Rapport pricing ;
- Historique pricing.

## Données de démonstration

Le seed V7 créé :

- des paramètres pricing ;
- plusieurs profils mission ;
- une mission saine ;
- une mission sous plancher ;
- une mission dégradée par remise ;
- une mission dégradée par hausse de coût externe ;
- des candidats à la renégociation ;
- un plan d'action de renégociation ;
- des decisions pricing ;
- une exception de marge ;
- des alertes et suggestions.

## Limites

La V7 ne fait pas :

- benchmark marche ;
- CRM avance ;
- scoring stratégique client global ;
- strategie de croissance ;
- IA autonome modifiant les prix.

Toute action de renégociation ou modification de prix reste explicite et validable par un utilisateur.
