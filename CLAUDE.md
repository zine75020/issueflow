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

## Prochaine priorité : polish visuel

Passe de polish visuel sur l'ensemble de l'application (couleurs, hiérarchie des boutons,
mise en valeur) — dernière étape avant la démo finale.

## Dette technique connue (non bloquante)
- Le champ "Remaining Effort" est actuellement contraint à l'échelle Fibonacci comme les
  Story Points, alors que ça n'a pas besoin d'être aussi strict — à assouplir plus tard si
  souhaité.
