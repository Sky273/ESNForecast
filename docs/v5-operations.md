# ESN Forecast V5 - Exploitation

La V5 durcit le produit autour de l'ergonomie, de l'observabilite, du support, des sauvegardes et de la securite.

## Navigation

Le menu lateral est organise par domaines fonctionnels. Il est scrollable independamment du contenu principal, les groupes sont repliables et l'etat est memorise dans `localStorage`.

Fonctions utiles :

- mode compact avec icones ;
- recherche dans le menu ;
- raccourci `Ctrl+K` ou `Cmd+K` pour placer le focus dans la recherche ;
- badges sur les zones qui demandent une action.

## Diagnostic

Chaque requete API recoit un `x-correlation-id`. Ce meme identifiant est renvoye au frontend et doit etre fourni au support pour diagnostiquer une erreur.

Endpoints principaux :

- `GET /api/health` : disponibilite minimale ;
- `GET /api/ready` : API et base de donnees ;
- `GET /api/system/status` : statut operationnel agrege ;
- `GET /api/observability/summary` : logs, erreurs, jobs et lenteurs ;
- `GET /api/jobs` : supervision des jobs.

## Sauvegarde et restauration

La V5 ajoute les objets `BackupRun`, `RestoreRun` et `ExportRun`.

Bonnes pratiques :

- generer une sauvegarde avant une operation de maintenance ;
- lancer une restauration en `dry_run` avant toute restauration effective ;
- exclure les tokens provider des restaurations par defaut ;
- auditer les exports financiers.

## Support

Le backoffice support permet de consulter une organisation, ses connecteurs, ses jobs, ses erreurs et ses scores de qualite de donnees.

Actions support disponibles :

- relancer les synchronisations ;
- recalculer les projections ;
- recalculer la qualite des donnees ;
- generer un diagnostic ;
- suivre les erreurs via correlation id.

## Securite

La V5 trace :

- tentatives de connexion ;
- evenements sensibles ;
- acces aux donnees sensibles ;
- exports ;
- actions support.

Les secrets et tokens provider ne doivent jamais etre exposes dans les exports, logs ou ecrans support.

## Feature flags

Les feature flags permettent d'activer progressivement les modules par organisation, role ou pourcentage de rollout.

Flags de demonstration :

- `new_sidebar_v5` ;
- `command_palette` ;
- `ai_assistant`.

