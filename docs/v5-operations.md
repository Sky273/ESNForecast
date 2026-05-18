# ESN Forecast V5 - Exploitation

La V5 durcit le produit autour de l'ergonomie, de l'observabilité, du support, des sauvegardes et de la sécurité.

## Navigation

Le menu lateral est organise par domaines fonctionnels. Il est scrollable indépendamment du contenu principal, les groupes sont repliables et l'état est memorise dans `localStorage`.

Fonctions utiles :

- mode compact avec icones ;
- recherche dans le menu ;
- raccourci `Ctrl+K` ou `Cmd+K` pour placer le focus dans la recherche ;
- badges sur les zones qui demandent une action.

## Diagnostic

Chaque requête API reçoit un `x-correlation-id`. Ce même identifiant est renvoyé au frontend et doit être fourni au support pour diagnostiquer une erreur.

Endpoints principaux :

- `GET /api/health` : disponibilité minimale ;
- `GET /api/ready` : API et base de données ;
- `GET /api/system/status` : statut opérationnel agrégé ;
- `GET /api/observability/summary` : logs, erreurs, jobs et lenteurs ;
- `GET /api/jobs` : supervision des jobs.

## Sauvegarde et restauration

La V5 ajoute les objets `BackupRun`, `RestoreRun` et `ExportRun`.

Bonnes pratiques :

- générer une sauvegarde avant une opération de maintenance ;
- lancer une restauration en `dry_run` avant toute restauration effective ;
- exclure les tokens provider des restaurations par defaut ;
- auditer les exports financiers.

## Support

Le backoffice support permet de consulter une organisation, ses connectéurs, ses jobs, ses erreurs et ses scores de qualité de données.

Actions support disponibles :

- relancer les synchronisations ;
- recalculer les projections ;
- recalculer la qualité des données ;
- générer un diagnostic ;
- suivre les erreurs via correlation id.

## Sécurité

La V5 trace :

- tentatives de connexion ;
- événements sensibles ;
- accès aux données sensibles ;
- exports ;
- actions support.

Les secrets et tokens provider ne doivent jamais être exposés dans les exports, logs ou Écrans support.

## Feature flags

Les feature flags permettent d'activer progressivement les modules par organisation, role ou pourcentage de rollout.

Flags de démonstration :

- `new_sidebar_v5` ;
- `command_palette` ;
- `ai_assistant`.
