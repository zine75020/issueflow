// Script de seed de DÉMONSTRATION (thème e-commerce), volontairement séparé
// de prisma/seed.mjs et non référencé dans prisma.config.ts (migrations.seed).
//
// Pourquoi séparé : prisma/seed.mjs est rejoué automatiquement à chaque
// `prisma migrate dev` / `prisma migrate reset` (hook configuré dans
// prisma.config.ts). Y injecter des données de démo e-commerce les aurait
// fait réapparaître (et se dupliquer) à chaque migration, y compris sur une
// base de travail réelle de l'utilisateur. Un script autonome, lancé à la
// main, évite ça : il ne s'exécute que si on le demande explicitement.
//
// Ce script est additif : il ne supprime ni ne modifie aucune donnée
// existante. Il pose une garde simple (présence de l'epic "Recherche
// produits") pour éviter de dupliquer le jeu de démo si on le relance par
// erreur. Il peut être lancé sur une base vierge (après `npx prisma db
// seed` pour créer les colonnes de board par défaut) ou sur une base de
// démo dédiée (pointer DATABASE_URL vers un autre fichier .db avant de
// lancer ce script si on veut l'isoler de sa base de travail).
//
// Cible : local (dev.db, comportement par défaut, inchangé) ou Turso
// distant, sélectionnée via la variable d'environnement SEED_TARGET ou le
// flag --turso. Les identifiants Turso sont lus dans .env.turso (jamais
// dans .env), comme pour scripts/push-schema-to-turso.mjs.
//
// Usage :
//   node prisma/seed-demo.mjs                 -> seed sur dev.db (local)
//   node prisma/seed-demo.mjs --turso         -> seed sur Turso
//   SEED_TARGET=turso node prisma/seed-demo.mjs -> idem, via variable d'env

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const target =
  process.argv.includes("--turso") || process.env.SEED_TARGET === "turso"
    ? "turso"
    : "local";

function isoDate(date) {
  return date.toISOString().replace("Z", "+00:00");
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const epicDefs = [
  {
    title: "Recherche produits",
    description:
      "Fonctionnalités permettant aux clients de trouver rapidement les produits qu'ils recherchent.",
  },
  {
    title: "Panier & Checkout",
    description: "Parcours d'achat, du panier jusqu'à la confirmation de commande.",
  },
  {
    title: "Compte client",
    description:
      "Gestion du compte, des commandes et des informations personnelles du client.",
  },
  {
    title: "Avis & Notation",
    description: "Système d'avis et de notation des produits par les clients.",
  },
  {
    title: "Recommandations personnalisées",
    description:
      "Suggestions de produits basées sur le comportement et l'historique du client.",
  },
];

const storyDefs = [
  // Recherche produits
  {
    epic: "Recherche produits",
    title:
      "En tant que client, je veux filtrer les résultats de recherche par prix, afin de trouver rapidement un produit dans mon budget.",
    description:
      "Ajouter un filtre par tranche de prix (min/max) sur la page de résultats de recherche, avec mise à jour des résultats sans rechargement complet de la page.",
    acceptanceCriteria:
      "Étant donné une recherche avec plusieurs résultats, quand le client définit une tranche de prix, alors seuls les produits dans cette tranche sont affichés.",
    storyPoints: 3,
    remainingEffort: 0,
    bucket: "done",
    status: "end",
  },
  {
    epic: "Recherche produits",
    title:
      "En tant que client, je veux trier les résultats de recherche par popularité ou par note, afin de repérer les produits les plus fiables.",
    description:
      "Ajouter un sélecteur de tri (pertinence, popularité, note, prix croissant/décroissant) au-dessus de la liste de résultats.",
    acceptanceCriteria:
      "Étant donné une liste de résultats, quand le client choisit un critère de tri, alors la liste est réordonnée selon ce critère.",
    storyPoints: 2,
    remainingEffort: 2,
    bucket: "active",
    status: "start",
  },
  {
    epic: "Recherche produits",
    title:
      "En tant que client, je veux voir des suggestions de recherche pendant que je tape, afin de gagner du temps.",
    description:
      "Afficher une liste déroulante de suggestions (produits, catégories, marques) sous la barre de recherche dès 2 caractères saisis.",
    acceptanceCriteria:
      "Étant donné que le client tape dans la barre de recherche, quand il saisit au moins 2 caractères, alors une liste de suggestions pertinentes s'affiche.",
    storyPoints: 5,
    remainingEffort: null,
    bucket: "backlog",
    status: "start",
  },
  {
    epic: "Recherche produits",
    title:
      "En tant que client, je veux filtrer les résultats par marque et par catégorie, afin d'affiner ma recherche.",
    description:
      "Ajouter des filtres à cases à cocher pour la marque et la catégorie sur la page de résultats de recherche.",
    acceptanceCriteria:
      "Étant donné une recherche avec plusieurs marques disponibles, quand le client coche une ou plusieurs marques, alors seuls les produits de ces marques sont affichés.",
    storyPoints: 3,
    remainingEffort: null,
    bucket: "backlog",
    status: "start",
  },

  // Panier & Checkout
  {
    epic: "Panier & Checkout",
    title:
      "En tant que client, je veux modifier la quantité d'un article directement depuis le panier, afin d'ajuster ma commande sans repasser par la fiche produit.",
    description:
      "Ajouter un sélecteur de quantité (+/-) sur chaque ligne du panier, avec recalcul immédiat du total.",
    acceptanceCriteria:
      "Étant donné un article dans le panier, quand le client modifie la quantité, alors le sous-total et le total de la commande sont recalculés immédiatement.",
    storyPoints: 2,
    remainingEffort: 1,
    bucket: "active",
    status: "inprogress",
  },
  {
    epic: "Panier & Checkout",
    title:
      "En tant que client, je veux voir les frais de livraison estimés avant de valider ma commande, afin d'éviter les mauvaises surprises.",
    description:
      "Afficher une estimation des frais de livraison dès la page panier, basée sur l'adresse par défaut du client.",
    acceptanceCriteria:
      "Étant donné un panier non vide, quand le client consulte la page panier, alors les frais de livraison estimés sont affichés avant le passage en caisse.",
    storyPoints: 3,
    remainingEffort: 0,
    bucket: "done",
    status: "end",
  },
  {
    epic: "Panier & Checkout",
    title:
      "En tant que client, je veux payer en plusieurs fois, afin d'étaler le coût d'un achat important.",
    description:
      "Proposer une option de paiement en 3 ou 4 fois sans frais au-delà d'un montant minimum de commande.",
    acceptanceCriteria:
      "Étant donné une commande supérieure au montant minimum, quand le client arrive à l'étape de paiement, alors l'option de paiement en plusieurs fois est proposée.",
    storyPoints: 8,
    remainingEffort: 5,
    bucket: "active",
    status: "review",
  },
  {
    epic: "Panier & Checkout",
    title:
      "En tant que client, je veux sauvegarder plusieurs adresses de livraison, afin de commander facilement pour moi ou pour un proche.",
    description:
      "Permettre l'ajout, la modification et la suppression de plusieurs adresses dans le profil client, avec sélection au moment du paiement.",
    acceptanceCriteria:
      "Étant donné un compte avec plusieurs adresses enregistrées, quand le client passe commande, alors il peut choisir l'adresse de livraison parmi celles enregistrées.",
    storyPoints: 5,
    remainingEffort: null,
    bucket: "backlog",
    status: "start",
  },
  {
    epic: "Panier & Checkout",
    title:
      "En tant que client, je veux appliquer un code promo au moment du paiement, afin de bénéficier d'une réduction.",
    description:
      "Ajouter un champ de saisie de code promo sur la page de paiement, avec validation et recalcul du total.",
    acceptanceCriteria:
      "Étant donné un code promo valide, quand le client le saisit à l'étape de paiement, alors la réduction correspondante est appliquée au total.",
    storyPoints: null,
    remainingEffort: null,
    bucket: "backlog",
    status: "start",
  },

  // Compte client
  {
    epic: "Compte client",
    title:
      "En tant que client, je veux consulter l'historique de mes commandes, afin de suivre mes achats passés.",
    description:
      'Ajouter une section "Mes commandes" listant les commandes passées avec statut, date et montant.',
    acceptanceCriteria:
      'Étant donné un client connecté ayant passé au moins une commande, quand il accède à "Mes commandes", alors la liste de ses commandes s\'affiche avec leur statut.',
    storyPoints: 2,
    remainingEffort: 0,
    bucket: "done",
    status: "end",
  },
  {
    epic: "Compte client",
    title:
      "En tant que client, je veux suivre la livraison de ma commande en temps réel, afin de savoir quand je serai livré.",
    description:
      "Intégrer le suivi du transporteur directement dans la page de détail de commande.",
    acceptanceCriteria:
      "Étant donné une commande expédiée, quand le client consulte le détail de la commande, alors le statut de livraison en temps réel est affiché.",
    storyPoints: 5,
    remainingEffort: 0,
    bucket: "active",
    status: "end",
  },
  {
    epic: "Compte client",
    title:
      "En tant que client, je veux activer l'authentification à deux facteurs, afin de sécuriser mon compte.",
    description:
      "Ajouter une option dans les paramètres de sécurité du compte pour activer la 2FA par SMS ou application d'authentification.",
    acceptanceCriteria:
      "Étant donné un compte client, quand le client active la 2FA, alors un code de vérification est requis à chaque nouvelle connexion.",
    storyPoints: 8,
    remainingEffort: 8,
    bucket: "planned",
    status: "start",
  },
  {
    epic: "Compte client",
    title:
      "En tant que client, je veux gérer mes moyens de paiement enregistrés, afin de payer plus rapidement lors des prochains achats.",
    description:
      "Ajouter une section permettant d'ajouter, modifier ou supprimer des cartes bancaires enregistrées.",
    acceptanceCriteria:
      "Étant donné un compte avec une carte enregistrée, quand le client la supprime, alors elle n'apparaît plus comme moyen de paiement disponible.",
    storyPoints: 3,
    remainingEffort: null,
    bucket: "backlog",
    status: "start",
  },

  // Avis & Notation
  {
    epic: "Avis & Notation",
    title:
      "En tant que client, je veux laisser un avis avec photos sur un produit acheté, afin d'aider les autres acheteurs.",
    description:
      "Permettre l'ajout de texte, une note et jusqu'à 5 photos lors de la rédaction d'un avis produit.",
    acceptanceCriteria:
      "Étant donné un produit acheté, quand le client rédige un avis, alors il peut y joindre jusqu'à 5 photos avant publication.",
    storyPoints: 3,
    remainingEffort: 3,
    bucket: "done",
    status: "start",
  },
  {
    epic: "Avis & Notation",
    title:
      "En tant que client, je veux signaler un avis inapproprié, afin de préserver la fiabilité des évaluations.",
    description:
      'Ajouter un bouton "Signaler" sur chaque avis, avec choix d\'un motif de signalement.',
    acceptanceCriteria:
      "Étant donné un avis publié, quand un client le signale, alors le signalement est transmis à la modération avec le motif choisi.",
    storyPoints: 1,
    remainingEffort: 1,
    bucket: "planned",
    status: "start",
  },
  {
    epic: "Avis & Notation",
    title:
      "En tant que client, je veux filtrer les avis par note, afin de lire rapidement les retours les plus critiques.",
    description:
      "Ajouter des filtres par nombre d'étoiles (1 à 5) au-dessus de la liste des avis d'un produit.",
    acceptanceCriteria:
      "Étant donné un produit avec plusieurs avis, quand le client filtre par note, alors seuls les avis correspondants sont affichés.",
    storyPoints: 0,
    remainingEffort: null,
    bucket: "backlog",
    status: "start",
  },

  // Recommandations personnalisées
  {
    epic: "Recommandations personnalisées",
    title:
      "En tant que client, je veux voir des suggestions de produits complémentaires sur la fiche produit, afin de compléter mon achat.",
    description:
      'Afficher un bandeau "Souvent achetés ensemble" sur la fiche produit, basé sur l\'historique d\'achats croisés.',
    acceptanceCriteria:
      "Étant donné une fiche produit, quand le client la consulte, alors un bandeau de produits complémentaires s'affiche s'il en existe.",
    storyPoints: 5,
    remainingEffort: 5,
    bucket: "active",
    status: "start",
  },
  {
    epic: "Recommandations personnalisées",
    title:
      "En tant que client, je veux recevoir des recommandations par email basées sur mon historique, afin de découvrir des produits pertinents.",
    description:
      "Mettre en place un email hebdomadaire de recommandations personnalisées basé sur les catégories consultées et achetées.",
    acceptanceCriteria:
      "Étant donné un client ayant un historique de navigation, quand la campagne hebdomadaire est déclenchée, alors il reçoit un email avec des recommandations pertinentes.",
    storyPoints: 8,
    remainingEffort: 8,
    bucket: "planned",
    status: "start",
  },
  {
    epic: "Recommandations personnalisées",
    title:
      "En tant qu'administrateur, je veux configurer les règles de recommandation par catégorie, afin d'ajuster la pertinence des suggestions.",
    description:
      "Ajouter une interface d'administration permettant de définir des règles de pondération par catégorie pour le moteur de recommandation.",
    acceptanceCriteria:
      "Étant donné une catégorie de produits, quand l'administrateur modifie sa pondération, alors les recommandations affichées aux clients reflètent ce changement.",
    storyPoints: 13,
    remainingEffort: null,
    bucket: "backlog",
    status: "start",
  },
];

const bugDefs = [
  {
    title: "Le prix affiché ne correspond pas au prix en caisse sur mobile",
    description:
      "Sur la version mobile du site, le prix affiché sur la fiche produit ne correspond pas toujours au prix réellement facturé au moment du paiement, probablement lié à un problème de cache côté client.",
    severity: "CRITICAL",
    remainingEffort: 0,
    bucket: "done",
    status: "end",
  },
  {
    title: 'Le bouton "Ajouter au panier" reste grisé après un ajout réussi',
    description:
      "Après l'ajout d'un article au panier, le bouton reste visuellement grisé alors que l'article a bien été ajouté, ce qui peut pousser le client à cliquer plusieurs fois.",
    severity: "MAJOR",
    remainingEffort: 1,
    bucket: "active",
    status: "inprogress",
  },
  {
    title:
      "Les filtres de recherche se réinitialisent après un retour arrière navigateur",
    description:
      "Quand le client utilise le bouton retour du navigateur depuis une fiche produit vers les résultats de recherche, les filtres précédemment appliqués sont perdus.",
    severity: "MINOR",
    remainingEffort: 2,
    bucket: "done",
    status: "inprogress",
  },
  {
    title:
      "L'email de confirmation de commande n'est pas envoyé pour les commandes en plusieurs fois",
    description:
      "Les commandes payées en plusieurs fois ne déclenchent pas l'envoi de l'email de confirmation, contrairement aux commandes payées en une fois.",
    severity: "CRITICAL",
    remainingEffort: 3,
    bucket: "active",
    status: "start",
  },
  {
    title: "Les avis avec photos ne s'affichent pas sur Safari",
    description:
      "Sur Safari (desktop et mobile), les photos jointes aux avis produits ne s'affichent pas, alors qu'elles s'affichent correctement sur Chrome et Firefox.",
    severity: "MAJOR",
    remainingEffort: 0,
    bucket: "active",
    status: "end",
  },
  {
    title: "Le compteur du panier n'est pas mis à jour après suppression d'un article",
    description:
      "Quand un client supprime un article du panier, le compteur affiché dans le header ne se met à jour qu'après un rechargement complet de la page.",
    severity: "MAJOR",
    remainingEffort: 2,
    bucket: "planned",
    status: "start",
  },
  {
    title: "Les recommandations personnalisées affichent des produits en rupture de stock",
    description:
      "Le moteur de recommandations suggère parfois des produits actuellement en rupture de stock, ce qui frustre les clients qui cliquent dessus.",
    severity: "MINOR",
    remainingEffort: null,
    bucket: "backlog",
    status: "start",
  },
];

// Construit toutes les lignes à insérer à partir de l'état déjà présent en base
// (colonnes de board, sprint actif éventuel, position de backlog courante).
// Pure : ne dépend d'aucune connexion DB, réutilisable pour local et Turso.
function buildSeedPlan({ columns, alreadyActiveSprintExists, maxStoryPos, maxBugPos }) {
  const locked = columns.filter((c) => c.isLocked).sort((a, b) => a.order - b.order);
  const startColumn = locked[0];
  const endColumn = locked[locked.length - 1] ?? startColumn;
  const middleColumns = columns
    .filter((c) => !c.isLocked)
    .sort((a, b) => a.order - b.order);
  const inProgressColumn = middleColumns[0] ?? startColumn;
  const reviewColumn = middleColumns[1] ?? inProgressColumn;

  const COLS = {
    start: startColumn.id,
    inprogress: inProgressColumn.id,
    review: reviewColumn.id,
    end: endColumn.id,
  };

  const canActivate = !alreadyActiveSprintExists;
  const now = new Date();

  const sprintDone = {
    id: randomUUID(),
    name: "Sprint 12 - Recherche & Paiement",
    startDate: isoDate(addDays(now, -28)),
    endDate: isoDate(addDays(now, -14)),
    isActive: 0,
    completedAt: isoDate(addDays(now, -14)),
    createdAt: isoDate(now),
  };

  const sprintActive = {
    id: randomUUID(),
    name: "Sprint 13 - Compte & Recommandations",
    startDate: isoDate(addDays(now, -3)),
    endDate: isoDate(addDays(now, 11)),
    isActive: canActivate ? 1 : 0,
    completedAt: null,
    createdAt: isoDate(now),
  };

  const sprintPlanned = {
    id: randomUUID(),
    name: "Sprint 14 - Sécurité & Avis",
    startDate: isoDate(addDays(now, 14)),
    endDate: isoDate(addDays(now, 28)),
    isActive: 0,
    completedAt: null,
    createdAt: isoDate(now),
  };

  const SPRINT = {
    done: sprintDone.id,
    active: sprintActive.id,
    planned: sprintPlanned.id,
    backlog: null,
  };

  const epicIds = {};
  const epics = epicDefs.map((e) => {
    const id = randomUUID();
    epicIds[e.title] = id;
    return {
      id,
      title: e.title,
      description: e.description,
      createdAt: isoDate(now),
      updatedAt: isoDate(now),
    };
  });

  let storyPos = maxStoryPos ?? 0;
  const stories = storyDefs.map((s) => {
    storyPos += 1;
    return {
      id: randomUUID(),
      title: s.title,
      description: s.description,
      acceptanceCriteria: s.acceptanceCriteria,
      storyPoints: s.storyPoints ?? null,
      remainingEffort: s.remainingEffort ?? null,
      statusColumnId: COLS[s.status],
      epicId: epicIds[s.epic],
      sprintId: SPRINT[s.bucket],
      backlogPosition: storyPos,
      createdAt: isoDate(now),
      updatedAt: isoDate(now),
    };
  });

  let bugPos = maxBugPos ?? 0;
  const bugs = bugDefs.map((b) => {
    bugPos += 1;
    return {
      id: randomUUID(),
      title: b.title,
      description: b.description,
      severity: b.severity,
      remainingEffort: b.remainingEffort ?? null,
      statusColumnId: COLS[b.status],
      sprintId: SPRINT[b.bucket],
      backlogPosition: bugPos,
      createdAt: isoDate(now),
      updatedAt: isoDate(now),
    };
  });

  return { canActivate, sprints: [sprintDone, sprintActive, sprintPlanned], epics, stories, bugs };
}

function printSummary({ canActivate, sprints, epics, stories, bugs }) {
  const [sprintDone, sprintActive, sprintPlanned] = sprints;
  console.log(
    `Démo e-commerce injectée : ${epics.length} epics, ${stories.length} stories, ${bugs.length} bugs, 3 sprints (${sprintDone.name} - terminé, ${sprintActive.name} - ${canActivate ? "actif" : "inactif car un autre sprint est déjà actif"}, ${sprintPlanned.name} - planifié).`
  );
}

export async function seedLocal() {
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(path.join(__dirname, "..", "dev.db"));

  const alreadySeeded = db
    .prepare("SELECT id FROM Epic WHERE title = ?")
    .get("Recherche produits");

  if (alreadySeeded) {
    console.log(
      'Les données de démo semblent déjà présentes en local (epic "Recherche produits" trouvé). Abandon pour éviter les doublons.'
    );
    db.close();
    return;
  }

  const columns = db
    .prepare('SELECT id, name, "order", isLocked FROM BoardColumn ORDER BY "order" ASC')
    .all();

  if (columns.length === 0) {
    console.error(
      "Aucune colonne de board trouvée. Lance d'abord `npx prisma db seed` pour créer les colonnes par défaut, puis relance ce script."
    );
    db.close();
    process.exitCode = 1;
    return;
  }

  const alreadyActiveSprintExists = !!db
    .prepare("SELECT id FROM Sprint WHERE isActive = 1")
    .get();
  if (alreadyActiveSprintExists) {
    console.log(
      'Un sprint est déjà actif dans cette base : le sprint de démo "actif" sera créé mais laissé inactif pour respecter la contrainte d\'un seul sprint actif à la fois.'
    );
  }

  const maxStoryPos = db.prepare("SELECT MAX(backlogPosition) as m FROM Story").get().m ?? 0;
  const maxBugPos = db.prepare("SELECT MAX(backlogPosition) as m FROM Bug").get().m ?? 0;

  const plan = buildSeedPlan({ columns, alreadyActiveSprintExists, maxStoryPos, maxBugPos });

  const seed = db.transaction(() => {
    const insertSprint = db.prepare(
      `INSERT INTO Sprint (id, name, startDate, endDate, isActive, completedAt, createdAt)
       VALUES (@id, @name, @startDate, @endDate, @isActive, @completedAt, @createdAt)`
    );
    for (const s of plan.sprints) insertSprint.run(s);

    const insertEpic = db.prepare(
      `INSERT INTO Epic (id, title, description, status, createdAt, updatedAt)
       VALUES (@id, @title, @description, 'TODO', @createdAt, @updatedAt)`
    );
    for (const e of plan.epics) insertEpic.run(e);

    const insertStory = db.prepare(
      `INSERT INTO Story (id, title, description, acceptanceCriteria, storyPoints, remainingEffort, statusColumnId, epicId, sprintId, backlogPosition, createdAt, updatedAt)
       VALUES (@id, @title, @description, @acceptanceCriteria, @storyPoints, @remainingEffort, @statusColumnId, @epicId, @sprintId, @backlogPosition, @createdAt, @updatedAt)`
    );
    for (const s of plan.stories) insertStory.run(s);

    const insertBug = db.prepare(
      `INSERT INTO Bug (id, title, description, severity, remainingEffort, statusColumnId, sprintId, backlogPosition, createdAt, updatedAt)
       VALUES (@id, @title, @description, @severity, @remainingEffort, @statusColumnId, @sprintId, @backlogPosition, @createdAt, @updatedAt)`
    );
    for (const b of plan.bugs) insertBug.run(b);
  });

  seed();
  printSummary(plan);
  db.close();
}

export async function seedTurso() {
  const { config } = await import("dotenv");
  config({ path: path.join(__dirname, "..", ".env.turso") });

  if (!process.env.DATABASE_URL || !process.env.TOKEN_DATABASE) {
    console.error(
      "DATABASE_URL et TOKEN_DATABASE doivent être définis dans .env.turso pour seeder Turso."
    );
    process.exitCode = 1;
    return;
  }

  const { createClient } = await import("@libsql/client");
  const client = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.TOKEN_DATABASE,
  });

  const existing = await client.execute({
    sql: "SELECT id FROM Epic WHERE title = ?",
    args: ["Recherche produits"],
  });
  if (existing.rows.length > 0) {
    console.log(
      'Les données de démo semblent déjà présentes sur Turso (epic "Recherche produits" trouvé). Abandon pour éviter les doublons.'
    );
    client.close();
    return;
  }

  let columnsRes = await client.execute(
    'SELECT id, name, "order", isLocked FROM BoardColumn ORDER BY "order" ASC;'
  );
  let columns = columnsRes.rows;

  if (columns.length === 0) {
    // Équivalent de `npx prisma db seed` (prisma/seed.mjs), qui ne peut pas cibler
    // Turso via la CLI (même limitation que pour les migrations). On crée donc ici
    // les 3 colonnes de board par défaut avant d'injecter les données de démo.
    console.log("Aucune colonne de board sur Turso : création des 3 colonnes par défaut.");
    await client.batch(
      [
        {
          sql: 'INSERT INTO BoardColumn (id, name, "order", isLocked) VALUES (@id, @name, @order, @isLocked)',
          args: { id: randomUUID(), name: "À faire", order: 0, isLocked: 1 },
        },
        {
          sql: 'INSERT INTO BoardColumn (id, name, "order", isLocked) VALUES (@id, @name, @order, @isLocked)',
          args: { id: randomUUID(), name: "En cours", order: 1, isLocked: 0 },
        },
        {
          sql: 'INSERT INTO BoardColumn (id, name, "order", isLocked) VALUES (@id, @name, @order, @isLocked)',
          args: { id: randomUUID(), name: "Terminé", order: 2, isLocked: 1 },
        },
      ],
      "write"
    );
    columnsRes = await client.execute(
      'SELECT id, name, "order", isLocked FROM BoardColumn ORDER BY "order" ASC;'
    );
    columns = columnsRes.rows;
  }

  const activeSprintRes = await client.execute(
    "SELECT id FROM Sprint WHERE isActive = 1;"
  );
  const alreadyActiveSprintExists = activeSprintRes.rows.length > 0;
  if (alreadyActiveSprintExists) {
    console.log(
      'Un sprint est déjà actif sur Turso : le sprint de démo "actif" sera créé mais laissé inactif pour respecter la contrainte d\'un seul sprint actif à la fois.'
    );
  }

  const maxStoryRes = await client.execute(
    "SELECT MAX(backlogPosition) as m FROM Story;"
  );
  const maxBugRes = await client.execute("SELECT MAX(backlogPosition) as m FROM Bug;");
  const maxStoryPos = maxStoryRes.rows[0]?.m ?? 0;
  const maxBugPos = maxBugRes.rows[0]?.m ?? 0;

  const plan = buildSeedPlan({ columns, alreadyActiveSprintExists, maxStoryPos, maxBugPos });

  const statements = [
    ...plan.sprints.map((s) => ({
      sql: `INSERT INTO Sprint (id, name, startDate, endDate, isActive, completedAt, createdAt)
            VALUES (@id, @name, @startDate, @endDate, @isActive, @completedAt, @createdAt)`,
      args: s,
    })),
    ...plan.epics.map((e) => ({
      sql: `INSERT INTO Epic (id, title, description, status, createdAt, updatedAt)
            VALUES (@id, @title, @description, 'TODO', @createdAt, @updatedAt)`,
      args: e,
    })),
    ...plan.stories.map((s) => ({
      sql: `INSERT INTO Story (id, title, description, acceptanceCriteria, storyPoints, remainingEffort, statusColumnId, epicId, sprintId, backlogPosition, createdAt, updatedAt)
            VALUES (@id, @title, @description, @acceptanceCriteria, @storyPoints, @remainingEffort, @statusColumnId, @epicId, @sprintId, @backlogPosition, @createdAt, @updatedAt)`,
      args: s,
    })),
    ...plan.bugs.map((b) => ({
      sql: `INSERT INTO Bug (id, title, description, severity, remainingEffort, statusColumnId, sprintId, backlogPosition, createdAt, updatedAt)
            VALUES (@id, @title, @description, @severity, @remainingEffort, @statusColumnId, @sprintId, @backlogPosition, @createdAt, @updatedAt)`,
      args: b,
    })),
  ];

  await client.batch(statements, "write");
  printSummary(plan);
  client.close();
}

// seedTurso/seedLocal sont exportées pour être réutilisées ailleurs (ex: la route de
// reset quotidien de la démo, app/api/cron/reset-demo/route.ts). Ce bloc ne s'exécute
// que lorsque le fichier est lancé directement en CLI (`node prisma/seed-demo.mjs`),
// jamais lors d'un import.
const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  if (target === "turso") {
    await seedTurso();
  } else {
    await seedLocal();
  }
}
