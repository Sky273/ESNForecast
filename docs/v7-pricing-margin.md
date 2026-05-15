# ESN Forecast V7 - Pricing mission et securisation de marge

## Objectif

La V7 ajoute une couche de pricing operationnel par mission. Elle aide la direction a calculer un TJM plancher, un TJM recommande, l'impact d'une remise ou d'une hausse de cout, puis a identifier les missions sous-margees a renegocier.

Le module reste volontairement cible sur la mission. Il ne remplace pas un CRM, ne fait pas de benchmark marche et ne produit pas de strategie commerciale globale.

## Concepts metier

- Cout direct : cout salarie prorate, partenaire, freelance et frais directement rattaches a la mission.
- Cout indirect impute : overhead ajoute selon la regle de pricing.
- Cout complet journalier : cout complet divise par les jours facturables.
- TJM plancher : `cout complet journalier / (1 - marge minimum)`.
- TJM recommande : `cout complet journalier / (1 - marge cible)`.
- Mission sous-margee : mission dont le TJM ou la marge ne couvre pas les seuils.
- Mission a renegocier : mission sous plancher, sous cible, avec remise durable ou hausse de cout non repercutee.

## Parametres

Les parametres sont portes par `PricingSettings` :

- marge cible par defaut ;
- marge minimum ;
- mode d'imputation overhead : aucun, montant journalier, pourcentage du cout direct, pourcentage du revenu, pool mensuel ;
- arrondi des TJM ;
- seuil d'alerte remise ;
- seuil et periode de revue de renegociation.

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
- Missions sous-margees ;
- Missions a renegocier ;
- Parametres pricing ;
- Rapport pricing ;
- Historique pricing.

## Donnees de demonstration

Le seed V7 cree :

- des parametres pricing ;
- plusieurs profils mission ;
- une mission saine ;
- une mission sous plancher ;
- une mission degradee par remise ;
- une mission degradee par hausse de cout externe ;
- des candidats a la renegociation ;
- un plan d'action de renegociation ;
- des decisions pricing ;
- une exception de marge ;
- des alertes et suggestions.

## Limites

La V7 ne fait pas :

- benchmark marche ;
- CRM avance ;
- scoring strategique client global ;
- strategie de croissance ;
- IA autonome modifiant les prix.

Toute action de renegociation ou modification de prix reste explicite et validable par un utilisateur.
