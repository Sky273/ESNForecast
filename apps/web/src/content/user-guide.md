# Guide utilisateur ESN Forecast

ESN Forecast est une application de pilotage financier, opérationnel et prévisionnel pour ESN. Elle aide une direction à comprendre où l'entreprise voulait aller, où elle se trouve réellement, où elle risque d'atterrir, pourquoi elle s'écarte de sa trajectoire et quelles actions doivent être lancées.

Le produit ne remplace pas un logiciel comptable, un CRM ou un SIRH. Il consolide les données utiles au pilotage : missions, ressources, factures, paiements, transactions bancaires, budgets, forecasts, objectifs, pricing et plans d'action.

## 1. Principe général

L'application fonctionne autour de quatre familles de données.

- Les données de référence : organisation, société, clients, missions, ressources, partenaires, indépendants, compétences et paramètres.
- Les données opérationnelles : affectations, CRA, staffing, capacité, offres, absences et clôtures mensuelles.
- Les données financières : factures, paiements, encaissements, décaissements, frais, transactions bancaires, comptabilité importée et rapprochements.
- Les données calculées : projections, reforecast, atterrissage annuel, écarts, runway, pipeline nécessaire, staffing budgétaire, pricing mission et rapports.

Les écrans de saisie permettent de créer ou corriger les données sources. Les écrans de pilotage affichent des résultats calculés à partir de ces données sources, du scénario actif et de l'horizon sélectionné.

## 2. Navigation et contexte de travail

Le menu latéral regroupe les écrans par grandes fonctions : pilotage, budget, prévisions, missions, staffing, finance, pricing, connecteurs, risques, documents, exploitation et administration.

Certaines pages utilisent un scénario actif. Dans ce cas, le sélecteur de scénario apparaît dans le header. Le scénario impacte notamment les projections, les encaissements et décaissements prévisionnels, le reforecast, les rapports, la capacité, le staffing et les risques.

L'horizon en mois détermine la profondeur de calcul affichée sur les écrans prévisionnels. Par exemple, un horizon de 12 mois limite les projections et rapports aux 12 prochains mois.

## 3. Données de référence

Avant d'analyser une trajectoire, il faut renseigner les éléments structurants.

- Les clients portent les missions, factures, paiements et risques de concentration.
- Les missions décrivent les contrats, dates, TJM, statut, client, scénario et logique de production.
- Les ressources internes, partenaires et indépendants alimentent la capacité, les coûts et la marge.
- Les compétences servent au capacity planning et au staffing prévisionnel.
- Les paramètres définissent des hypothèses globales de projection et de pricing.

Ces données sont généralement gérées par CRUD dans les écrans correspondants. Quand une donnée vient d'un connecteur bancaire ou comptable, elle est plutôt synchronisée puis contrôlée via les écrans de supervision.

## 4. Prévisions, scénarios et simulations

Un scénario représente une hypothèse de travail. Il peut être de référence, pessimiste, optimiste ou personnalisé. Les projections financières, le staffing et plusieurs rapports sont calculés dans ce contexte.

Les simulations permettent d'ajouter des événements : hausse ou baisse de revenus, coûts exceptionnels, économies, retards ou hypothèses spécifiques. Elles ne remplacent pas les données sources mais permettent de mesurer un impact prévisionnel.

Le reforecast recalibre la trajectoire à partir du réel observé. Il permet de comparer ce qui était prévu avec ce qui est réellement constaté, puis de produire des suggestions de correction.

## 5. Budget, objectifs et trajectoire

Le module budget sert à définir une cible annuelle. Le budget peut contenir des lignes mensuelles par catégorie : chiffre d'affaires, coûts salariés, coûts externes, cash-in, cash-out, marge, trésorerie, occupation ou pipeline.

Les objectifs complètent le budget avec des seuils explicites : chiffre d'affaires annuel, marge cible, trésorerie minimale, pipeline, staffing ou taux d'occupation.

La trajectoire combine budget, réel, forecast et reforecast pour répondre à trois questions :

- Sommes-nous dans la trajectoire prévue ?
- Où allons-nous probablement finir l'année ?
- Quelles actions doivent être lancées pour revenir vers l'objectif ?

## 6. Écarts, causes et plans d'action

Les écarts comparent budget, forecast, reforecast et réel. Ils peuvent porter sur le chiffre d'affaires, la marge, le cash, les coûts, le staffing ou le pipeline.

Chaque écart peut être qualifié, commenté et relié à une cause : mission retardée, coût supérieur au prévu, paiement en retard, intercontrat, staffing insuffisant ou dépense imprévue.

Les plans d'action transforment l'analyse en exécution. Une action possède un responsable, une échéance, une priorité, un statut et un impact attendu. L'objectif est de ne pas laisser les alertes sans suite.

## 7. Finance, banque et rapprochements

Les données financières peuvent être saisies manuellement, importées ou synchronisées depuis un provider bancaire ou comptable.

Les transactions bancaires synchronisées ne doivent pas être modifiées directement. Elles sont rapprochées avec des factures, paiements ou centres de coûts depuis l'écran de rapprochement bancaire.

Le rapprochement facturation permet de comparer les factures prévues avec les factures réelles et les paiements associés. Il aide à identifier les retards de facturation, les paiements partiels et les montants restant à encaisser.

La trésorerie réelle et le runway utilisent les données bancaires quand elles sont disponibles. La qualité de ces résultats dépend donc de la synchronisation et du rapprochement.

## 8. Connecteurs et données importées

Les connecteurs servent à récupérer des données externes. Bridge est utilisé pour la banque. D'autres providers peuvent être configurés ou préparés selon le contexte.

Le flux de connexion provider démarre un OAuth, revient dans l'application via une URL de callback, puis crée ou met à jour un connecteur. Les synchronisations importent ensuite comptes, transactions et événements.

La supervision connecteurs permet de vérifier l'état des connecteurs, les dernières synchronisations, les erreurs, les webhooks et les volumes importés ou mis à jour.

En cas de problème, il faut regarder : le statut du connecteur, le dernier job de synchronisation, les erreurs provider, les webhooks et le correlationId quand il est disponible.

## 9. Staffing et capacité

Le staffing prévisionnel présente les besoins par mission et les ressources affectées ou manquantes.

Le capacity planning compare les besoins en compétences avec la capacité disponible. Il sert à détecter les manques de compétences, les surcapacités et les risques de staffing.

Le staffing budgétaire est différent : il part du budget de chiffre d'affaires pour estimer le nombre de jours facturables et d'ETP nécessaires à l'atteinte de la trajectoire.

## 10. Pricing et marge mission

Le module pricing aide à sécuriser la marge des missions.

Il calcule un coût complet journalier, un TJM plancher et un TJM recommandé. Le TJM plancher couvre le coût complet et la marge minimale. Le TJM recommandé vise la marge cible définie dans les paramètres pricing ou sur la mission.

Le simulateur pricing permet de tester un TJM, une remise, une hausse de coût ou une variation de jours facturables. Le bouton Simuler calcule un résultat sans enregistrer. Le bouton Créer la simulation conserve la simulation dans l'historique.

Les missions sous-margées et les candidats à la renégociation identifient les missions dont la marge, le TJM ou le coût nécessitent une action.

## 11. Rapports et pilotage direction

Les rapports consolident les données calculées dans un format exploitable par la direction.

- Le rapport de direction synthétise projection, cash, risques et recommandations.
- Le rapport CODIR connecté utilise le réel bancaire, les écarts, les anomalies et la prévision recalibrée.
- Le rapport Budget / Forecast / Actual compare budget, forecast, reforecast et réel.
- Le rapport pricing met en évidence les missions sous-margées et les gains potentiels.

Les rapports utilisent le scénario actif, l'horizon sélectionné et les données disponibles au moment de l'ouverture.

## 12. Observabilité, jobs et exploitation

Les écrans d'exploitation servent à diagnostiquer l'application.

L'observabilité affiche logs, erreurs, latences et routes lentes. Les jobs permettent de suivre les traitements : reforecast, rapport PDF, synchronisation connecteur, imports et calculs.

Quand une action échoue, il faut chercher le job correspondant, son statut, son message d'erreur, son correlationId et les logs associés.

Les sauvegardes, exports et restaurations dry-run permettent de sécuriser les données et de vérifier qu'un incident peut être traité.

## 13. Sécurité et accès

L'application contient des données sensibles : marges, TJM, coûts, trésorerie, clients et ressources.

L'authentification protège l'accès. Les rôles contrôlent l'accès aux écrans sensibles. Les actions de sécurité, tentatives de connexion et accès aux données sensibles sont consultables dans les écrans d'administration et de sécurité.

En production, l'application doit être servie en HTTPS, notamment pour protéger les identifiants et recevoir correctement les callbacks ou webhooks des providers.

## 14. Assistant IA

L'assistant IA est encadré. Il ne doit pas inventer de chiffres et ne modifie pas les données sans validation.

Il s'appuie sur les données calculées par l'application pour produire des synthèses, expliquer des écarts, identifier des risques ou préparer des recommandations. Les chiffres doivent rester vérifiables dans les écrans métiers correspondants.

Si aucun fournisseur LLM réel n'est configuré, l'assistant fonctionne comme une couche d'analyse déterministe ou mockée selon les services disponibles.

## 15. Parcours recommandé pour démarrer

Pour rendre l'application exploitable, le parcours recommandé est le suivant.

1. Renseigner les sociétés, clients, ressources, partenaires, indépendants et compétences.
2. Créer les missions et les affectations.
3. Configurer les paramètres de projection et de pricing.
4. Créer un scénario de référence.
5. Renseigner ou importer factures, paiements, encaissements et décaissements.
6. Connecter la banque si disponible, puis synchroniser comptes et transactions.
7. Rapprocher les transactions bancaires et la facturation.
8. Créer un budget annuel et des objectifs.
9. Lancer les projections, reforecast et rapports.
10. Suivre les écarts, causes, plans d'action et missions à renégocier.

## 16. Bonnes pratiques

- Distinguer les données saisies des données calculées.
- Ne pas corriger une donnée provider directement : corriger la source ou relancer la synchronisation.
- Toujours vérifier le scénario actif avant d'interpréter une projection.
- Utiliser les plans d'action pour suivre les décisions, pas uniquement les commentaires.
- Contrôler la qualité des données avant de présenter un rapport de direction.
- Clôturer les mois validés pour stabiliser le réel.
- Relire les hypothèses de pricing avant de renégocier une mission.

## 17. Limites connues

ESN Forecast est un outil de pilotage. Il ne remplace pas la comptabilité légale, la paie, un CRM complet ou un ERP.

Certaines données peuvent être de démonstration si aucun connecteur réel ou import réel n'est configuré. Les écrans de supervision, de santé des données et d'observabilité permettent de vérifier l'origine et la fraîcheur des données.
