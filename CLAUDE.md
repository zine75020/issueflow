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

## Prochaine priorité : Assistant Backlog IA (agent + RAG)

Objectif : un vrai agent conversationnel avec tool use (pas un simple appel LLM), pour
démontrer une architecture IA sérieuse.

Architecture cible :
- Un panneau de chat dédié ("Assistant Backlog"), affichant les étapes de raisonnement de
  l'agent de façon visible (ex: "Recherche dans le backlog...", "Proposition : ...").
- L'agent dispose de plusieurs outils (tool use API Anthropic) qu'il choisit d'appeler en
  autonomie selon la demande : search_backlog (recherche sémantique RAG), create_story,
  reorder_backlog, get_item_details. Il peut enchaîner plusieurs appels d'outils avant de
  répondre.
- RAG réel pour search_backlog : embeddings via Voyage AI (voyage-4-lite), stockés en base
  (nouveau modèle Embedding), recherche par similarité cosinus.
- Human-in-the-loop strict : toute action d'écriture (création, réorganisation) est
  présentée comme une proposition, jamais exécutée sans validation explicite de
  l'utilisateur dans l'UI.
- Clés nécessaires dans .env : VOYAGE_API_KEY (déjà présente), ANTHROPIC_API_KEY (à ajouter
  par l'utilisateur, pas encore présente), et le SDK @anthropic-ai/sdk à installer (pas
  encore dans package.json).

Étape en cours : génération et stockage des embeddings (schéma + backfill), avant de
construire la recherche sémantique puis l'agent lui-même.

Passe de polish visuel (couleurs, hiérarchie des boutons, mise en valeur) une fois
l'assistant IA en place.

## Dette technique connue (non bloquante)
- Le champ "Remaining Effort" est actuellement contraint à l'échelle Fibonacci comme les
  Story Points, alors que ça n'a pas besoin d'être aussi strict — à assouplir plus tard si
  souhaité.
