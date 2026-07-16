# ZineBoard

## Contexte
Outil de gestion de backlog agile (type Jira simplifié), avec deux fonctionnalités IA :
génération de user stories par prompt, et réorganisation du backlog par commande en
langage naturel. Voir issueflow-spec.md à la racine pour la spec fonctionnelle complète.

## Stack
- Next.js (App Router)
- Prisma + SQLite
- API Anthropic (Claude Sonnet) pour les features IA
- Déploiement cible : Vercel

## Règles de travail
- Un prompt = une feature ou un fix, jamais plusieurs choses mélangées dans un même cycle
- Ne jamais déclarer une fonctionnalité "terminée" ou "corrigée" sans confirmation explicite
  de l'utilisateur après test manuel
- Toute action IA qui modifie des données (génération de story, réorganisation du backlog)
  doit rester human-in-the-loop : validation ou possibilité d'annuler, jamais d'écriture
  directe sans confirmation
- Un seul sprint actif à la fois pour le MVP
- Pas de multi-projets pour le MVP

Lis aussi issueflow-spec.md pour le détail des user stories et critères d'acceptation.

## État actuel (mis à jour)
- Modèle de données : Epic, Story, Bug, Sprint, BoardColumn (colonnes de statut dynamiques,
  remplace l'ancien enum Status), avec remainingEffort et storyPoints sur échelle Fibonacci
  (0,1,2,3,5,8,13,21).
- Toutes les routes API CRUD sont en place et testées : epics, stories, bugs, sprints
  (+ activation/désactivation, clôture, assignation), columns.
- UI complète et fonctionnelle : Dashboard (KPI globaux), Backlog (vue Liste/Kanban avec
  drag & drop, gestion des colonnes), Sprints (liste triée Actif > Planifié > Terminé,
  avec stats de vélocité), Sprint en cours (Kanban du sprint actif), panneaux de détail
  cliquables et éditables sur tous les items, thème clair/sombre.
- Base de données peuplée avec un jeu de données de démo réaliste (thème e-commerce) via
  prisma/seed-demo.mjs, en plus des données de test de l'utilisateur.

## Assistant Backlog IA (agent + RAG) — terminé et fonctionnel

Agent conversationnel avec tool use réel (API Anthropic, modèle claude-sonnet-5), pas un
simple appel LLM :
- RAG fonctionnel pour la recherche sémantique : embeddings Voyage AI (voyage-4-lite),
  stockés en base (modèle Embedding), recherche par similarité cosinus via
  GET /api/search. Backfill effectué.
- 4 outils (tool use) : search_backlog (RAG), get_item_details (lecture) exécutés
  automatiquement ; propose_create_story et propose_reorder_backlog qui n'écrivent jamais
  directement en base — ils retournent une proposition structurée.
- Boucle agentique côté backend (POST /api/agent/chat), plafonnée à 5 itérations.
- Human-in-the-loop strict : toute proposition de création ou de réorganisation est
  affichée dans l'UI sous forme de carte dédiée avec boutons Valider/Refuser ; aucune
  écriture en base sans validation explicite de l'utilisateur.
- UI : panneau latéral ("Assistant Backlog") accessible depuis un bouton dédié dans le
  header, historique de conversation, indicateur de chargement pendant le traitement puis
  résumé discret des étapes utilisées, cartes de proposition.
- Testé de bout en bout dans un navigateur réel : recherche sémantique, création de story
  validée (apparaît bien dans le Product Backlog), proposition refusée (n'écrit rien).

Limite connue (amélioration future si souhaité) : l'agent ne dispose d'aucun outil pour
modifier ou renommer un item existant — seulement propose_create_story (création) et
propose_reorder_backlog (réorganisation). Un outil propose_update_item serait à ajouter si
ce besoin se présente.

Backfill des embeddings en production (Turso) : effectué avec succès. Le script
scripts/backfill-embeddings.mjs accepte désormais une cible Turso via --turso ou
BACKFILL_TARGET=turso. 31 embeddings générés (19 stories, 7 bugs, 5 epics), 100% de
couverture confirmée. Fix commité (08889df) et poussé sur le dépôt distant. La recherche
sémantique (RAG) a été testée manuellement en production et fonctionne correctement.

## Bugs d'affichage de l'Assistant Backlog IA — résolus et confirmés

Deux bugs distincts dans les réponses de l'agent listant des stories/bugs, corrigés et
confirmés par test manuel utilisateur :
- L'ID brut de la colonne de statut (ex: "35b2...") s'affichait au lieu de son nom
  lisible ("Review", "À faire", etc.) — cause : `searchBacklog`/`getStoryById`/
  `getBugById` ne chargeaient pas la relation `statusColumn`, l'agent n'avait donc pas
  accès au nom. Fix : inclusion de la relation + consigne dans le prompt système pour
  utiliser `statusColumn.name` plutôt que l'ID.
- Les en-têtes de colonnes adjacentes du tableau Markdown généré s'affichaient collés
  (ex: "PointsStatut", "MINEUR En cours") — cause réelle : Tailwind (preflight) applique
  `border-collapse: collapse` sur les tables sans que le bloc `.markdown` ne redéfinisse
  de padding/bordure pour `th`/`td` ; le Markdown généré par le LLM et le parsing GFM
  (react-markdown + remark-gfm) étaient corrects depuis le départ. Fix : ajout de styles
  `.markdown table/th/td` (bordure, padding, fond d'en-tête) dans app/globals.css.

## Domaine et déploiement

Nom de domaine zineboard.com connecté et actif sur Vercel (avec redirection 308 de
l'apex zineboard.com vers www.zineboard.com — à garder en tête pour tout test manuel
avec curl : `curl -L` supprime le header Authorization en suivant une redirection vers
un autre host, donc toujours tester directement sur www.zineboard.com plutôt que sur
l'apex avec `-L`).

## Reset quotidien de la base de démo (production) — en place et testé avec succès

Le site étant public (zineboard.com) et testé par des recruteurs sans isolation par
session, les modifications des visiteurs s'accumulent et se marchent dessus. Décision
assumée : un reset simple et périodique de toute la base de démo, sans isolation par
utilisateur.

- Route `GET /api/cron/reset-demo` (app/api/cron/reset-demo/route.ts) : vide les tables
  de contenu (Embedding, Story, Bug, Sprint, Epic, BoardColumn, dans cet ordre pour
  respecter les contraintes de clé étrangère), relance la logique de
  prisma/seed-demo.mjs (fonctions `seedTurso`/`seedLocal` désormais exportées et
  réutilisables, cible Turso en production comme le script de backfill des embeddings),
  puis régénère un embedding par item créé (séquentiel, ~31 items, ~10s).
- Sécurisée par le header `Authorization: Bearer <CRON_SECRET>` : la route retourne 401
  si absent ou incorrect. CRON_SECRET n'est pas généré automatiquement par Vercel — il
  faut le créer soi-même (ex: `openssl rand -hex 32`) et le déclarer dans les
  Environment Variables du projet Vercel ; une fois défini là-bas, Vercel l'envoie
  automatiquement dans ce header sur chaque appel de cron.
- Déclenchée une fois par jour à 3h du matin UTC via Vercel Cron (vercel.json,
  schedule "0 3 * * *"), horaire creux pour minimiser l'impact sur des visiteurs en
  cours de démo.
- Testé manuellement de bout en bout contre la vraie base Turso de production : reset
  et repeuplement corrects (5 epics, 19 stories, 7 bugs), 31 embeddings régénérés,
  recherche sémantique (RAG) fonctionnelle sur les nouvelles données juste après reset,
  rejouable sans erreur (testé deux fois consécutives).
- Faux problème d'authentification rencontré puis résolu : le 401 systématique observé
  en test manuel venait de la redirection de domaine décrite ci-dessus (curl -L
  supprimait le header Authorization), pas d'un bug de comparaison du secret. Confirmé
  résolu par test manuel de l'utilisateur sur le bon domaine.

## Rate limiting (protection des coûts) — en place

Pour éviter qu'un abus (script, crawler agressif, visiteur malveillant) ne fasse exploser
la facture Anthropic ou ne remplisse le quota gratuit Vercel Blob — risque réel puisque
le site est public et sans authentification — deux routes sont protégées via un store
Redis (sliding window implémenté à la main avec les commandes natives ZADD/
ZREMRANGEBYSCORE/ZCARD dans une transaction MULTI, voir lib/rateLimit.ts ; identifiant =
IP du visiteur lue depuis x-forwarded-for) :

- **Assistant Backlog IA** (POST /api/agent/chat) : 5 messages/heure par IP — limite
  volontairement stricte, l'assistant est une démo de portfolio, pas un produit à fort
  usage légitime attendu par visiteur. Plus un plafond global de 50 messages/jour tous
  visiteurs confondus (protège le budget même si l'abus vient de plusieurs IPs
  différentes), qui désactive l'agent jusqu'au reset (fenêtre glissante de 24h, pas un
  minuit fixe) ; ce plafond global n'est décrémenté que pour les requêtes qui passent
  déjà la limite par IP, donc il reflète le nombre réel d'appels facturés à Anthropic,
  pas les tentatives déjà bloquées par ailleurs. Messages d'erreur dédiés (429) affichés
  directement comme réponse de l'assistant dans le chat.
- **Upload de pièces jointes** (POST /api/attachments/token) : 20 uploads/heure par IP,
  en plus de la limite déjà existante de 10 pièces jointes par item. Vérifiée dans
  onBeforeGenerateToken : c'est le seul vrai point d'entrée avant qu'un octet ne soit
  accepté par Vercel Blob, donc le seul endroit où cette limite peut réellement être
  imposée (contrairement à POST /api/attachments, qui n'intervient qu'après coup, une
  fois le fichier déjà uploadé). Limite connue et acceptée : le SDK @vercel/blob ne
  propage pas le message d'erreur exact renvoyé par onBeforeGenerateToken jusqu'au
  navigateur (il le remplace systématiquement par un message générique) — la limite est
  bien appliquée côté serveur, mais l'utilisateur voit un message de repli générique
  plutôt que le texte exact, dans ce cas précis seulement.

Nécessite un store Redis (gratuit, provisionné via l'intégration Vercel Marketplace) connecté
au projet, variable REDIS_URL (connexion TCP classique, protocole redis:// — ce store-ci
n'expose pas d'API REST, donc pas de client `@upstash/redis`/`@upstash/ratelimit` : client
`redis` standard avec un pattern de connexion singleton réutilisée entre invocations
serverless, voir lib/rateLimit.ts). Les deux routes concernées (POST /api/agent/chat et
POST /api/attachments/token) sont explicitement forcées en runtime Node.js (`export const
runtime = "nodejs"`), le client Redis TCP étant incompatible avec le runtime Edge.

## Prochaine priorité : polish visuel

Passe de polish visuel sur l'ensemble de l'application (couleurs, hiérarchie des boutons,
mise en valeur) — dernière étape avant la démo finale.

## Dette technique connue (non bloquante)
- Le champ "Remaining Effort" est actuellement contraint à l'échelle Fibonacci comme les
  Story Points, alors que ça n'a pas besoin d'être aussi strict — à assouplir plus tard si
  souhaité.
