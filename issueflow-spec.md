# ZineBoard — Spec fonctionnelle (MVP)

## 1. Contexte & scope produit

ZineBoard est un outil de gestion de backlog agile (type Jira simplifié), pensé pour démontrer
la capacité d'un Product Owner à cadrer un produit et à intégrer l'IA dans un vrai workflow métier.

**Éléments gérés :**
- **Product Backlog** : réservoir global de tous les items (epics, stories, bugs) non planifiés dans un sprint
- **Epics** : regroupent plusieurs user stories
- **User Stories** : format standard (En tant que... je veux... afin de...) + critères d'acceptation + story points
- **Bugs** : type d'item à part, avec un champ sévérité (Critique / Majeur / Mineur)
- **Sprints** : un seul sprint actif à la fois. Le PO crée un sprint et y assigne des items depuis le Product Backlog
- **Sprint Backlog** : sous-ensemble d'items engagés pour le sprint en cours (distinct du Product Backlog)

**Hors scope MVP (v2) :**
- Multi-projets / multi-produits
- Multi-sprints en parallèle
- Burndown chart / vélocité calculée
- Gestion fine des permissions/rôles

## 2. Objectifs & métrique de succès

**Objectif principal :** réduire le temps passé par le PO à rédiger et organiser le backlog.

**Métrique de succès :** temps de rédaction d'une user story complète (titre + description +
critères d'acceptation) avec l'assistance IA vs. sans.

## 3. Personas

- **Product Owner** : crée/édite epics, stories, bugs ; gère le Product Backlog et le Sprint
  Backlog ; utilise les fonctionnalités IA (génération de stories, réorganisation par commande) ;
  planifie les sprints.
- **Développeur** : vue en lecture sur le backlog et le sprint actif ; peut changer le statut des
  items qui lui sont assignés (To Do / In Progress / Done) ; pas d'accès aux fonctionnalités IA
  (cohérent avec un usage réel où le cadrage reste côté PO).

## 4. User Stories principales

### Gestion du backlog
- En tant que PO, je veux créer un epic, afin de regrouper des stories liées à une même
  fonctionnalité majeure.
  - *Critère d'acceptation* : un epic a un titre, une description, un statut, et affiche le
    nombre de stories rattachées.
- En tant que PO, je veux créer une user story manuellement, afin de documenter un besoin
  précis.
  - *Critère d'acceptation* : une story a titre, description, critères d'acceptation, story
    points, statut, epic parent (optionnel).
- En tant que PO, je veux créer un bug, afin de tracker une anomalie distincte d'une story.
  - *Critère d'acceptation* : un bug a un champ sévérité en plus des champs standards.

### Sprints
- En tant que PO, je veux créer un sprint et lui donner un nom/une durée, afin de démarrer un
  cycle de travail.
  - *Critère d'acceptation* : un seul sprint actif à la fois ; impossible d'en créer un second
    tant que l'actuel n'est pas clôturé.
- En tant que PO, je veux déplacer un item du Product Backlog vers le Sprint Backlog, afin de
  l'engager pour le sprint en cours.
- En tant que développeur, je veux voir le Sprint Backlog et changer le statut de mes items
  assignés, afin de refléter mon avancement.

### IA — Génération de user story par prompt
- En tant que PO, je veux décrire une idée en langage naturel, afin que l'IA me génère une
  user story complète (titre, description formatée, critères d'acceptation, story points
  suggérés).
  - *Critère d'acceptation* : si le prompt est trop vague, l'IA demande une précision plutôt
    que de générer une story creuse.
  - *Critère d'acceptation* : la story générée n'est jamais insérée directement dans le
    backlog — le PO doit valider/éditer avant sauvegarde (human-in-the-loop).

### IA — Réorganisation du backlog par commande naturelle
- En tant que PO, je veux taper une instruction libre (ex: "mets la story #256 en premier,
  puis toutes celles qui commencent par A"), afin de réorganiser le backlog sans le faire
  manuellement item par item.
  - *Critère d'acceptation* : l'IA retourne le nouvel ordre + un résumé texte de ce qu'elle a
    fait.
  - *Critère d'acceptation* : si l'instruction référence un item inexistant ou est ambiguë,
    l'IA renvoie une erreur claire plutôt que de réordonner au hasard.
  - *Critère d'acceptation* : un bouton "Annuler" permet de revenir à l'ordre précédent après
    une réorganisation IA.

## 5. Contraintes non-fonctionnelles

- API : Claude Sonnet (suffisant pour classification/génération de texte structuré, pas besoin
  d'un modèle plus lourd)
- Toute action IA modifiant des données reste **human-in-the-loop** (validation ou possibilité
  d'annuler)
- Stockage simple (SQLite + Prisma), pas de multi-tenant pour le MVP
- Déploiement prévu sur Vercel pour une démo accessible par lien (nom de domaine dédié
  envisageable une fois le MVP stable)

## 6. Stack technique proposée

- Next.js (frontend + API routes)
- SQLite + Prisma (ORM)
- API Anthropic (Claude Sonnet) pour les deux features IA
- Déploiement Vercel
