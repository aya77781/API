# API — Plateforme de gestion de chantiers

Application web multi-rôles pour la gestion complète de projets de construction, de la phase commerciale jusqu'à la clôture GPA.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js 14 (App Router) |
| Langage | TypeScript |
| Style | Tailwind CSS + DM Sans |
| Backend / BDD | Supabase (PostgreSQL, Auth, Storage) |
| IA | Claude API (`claude-sonnet-4-20250514`) via `@anthropic-ai/sdk` |
| Auth SSR | `@supabase/ssr` |

---

## Prérequis

- Node.js 18+
- Un projet Supabase actif
- Une clé API Anthropic

---

## Installation

```bash
npm install
```

Copier le fichier d'environnement et renseigner les valeurs :

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://ton-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ta_cle_anon_publique
SUPABASE_SERVICE_ROLE_KEY=ta_cle_service_role_privee
ANTHROPIC_API_KEY=ta_cle_anthropic
N8N_WEBHOOK_URL=ton_url_n8n        # optionnel
N8N_API_KEY=ta_cle_n8n             # optionnel
```

```bash
npm run dev
```

---

## Rôles utilisateurs

L'application gère 11 rôles, chacun avec son propre espace. Le routage est géré par `middleware.ts` : tout utilisateur authentifié est automatiquement redirigé vers son dashboard selon le rôle stocké dans `app.utilisateurs`.

| Rôle | Préfixe de route | Description courte |
|---|---|---|
| `co` | `/co` | Chargé d'Opérations — pilotage opérationnel des chantiers |
| `commercial` | `/commercial` | Création et suivi commercial des dossiers |
| `economiste` | `/economiste` | Chiffrage, CCTP, avenants |
| `gerant` | `/gerant` | Vue dirigeant — synthèse globale |
| `dessin` | `/dessin` | Plans de conception et documents techniques |
| `at` | `/at` | Assistant Travaux — support terrain |
| `rh` | `/rh` | Ressources humaines |
| `cho` | `/cho` | Chargé de l'Hygiène et de l'Organisation |
| `compta` | `/compta` | Suivi financier et comptable |
| `st` | `/st` | Sous-traitant — accès à ses dossiers |
| `admin` | `/admin` | Administration complète de la plateforme |

---

## Description détaillée par rôle

### CO — Chargé d'Opérations (`/co`)

Le CO est le pilier opérationnel de la plateforme. Il suit chaque projet à travers toutes ses phases du début à la fin.

**Dashboard**
- Statistiques globales : nombre de projets actifs, projets par phase, alertes non lues.
- Accès rapide aux projets en cours.

**Gestion de projets**
- Liste de tous ses projets avec leur phase courante (passation → achats → installation → chantier → controle → cloture → gpa → terminé).
- Chaque projet dispose de 7 onglets correspondant aux phases de vie du chantier :
  - **Passation** : informations contractuelles, checklist de passation, dessinatrice assignée, statuts de lancement.
  - **Achats** : lots de travaux, sélection des sous-traitants, devis reçus avec scoring IA (60 % prix / 40 % délai), validation des attributions.
  - **Installation** : suivi de la mise en place du chantier.
  - **Chantier** : comptes rendus de réunion, interventions ST, planning PPE, prorata, dépenses DIC.
  - **Contrôle** : checklists de visite chantier, réserves.
  - **Clôture** : DOE, bilan de clôture.
  - **GPA** : réserves GPA, levée des réserves.

**Comptes rendus**
- Création de comptes rendus de réunion avec liste des présents, ordre du jour, décisions prises.
- Ajout de remarques et réserves sur chaque CR.

**Avenants**
- Création et suivi des avenants (ouvert → chiffré → validé CO → validé client).

**Planning**
- Planning général PPE par projet.
- Planning des interventions sous-traitants.

**Documents**
- Dépôt de documents dans la GED via le bouton "+ Deposer" présent dans toutes les pages.
- Consultation des documents reçus avec notification de lecture.

**Chat**
- Messagerie interne par projet ou par conversation directe.

**Taches**
- Gestion de ses tâches personnelles avec statuts et priorités.

---

### Commercial (`/commercial`)

Le commercial gère le cycle de vie commercial des projets, de la prospection à la contractualisation.

**Dashboard**
- Synthèse de ses dossiers en cours, taux de transformation, alertes.

**Gestion de projets**
- Liste de tous ses projets avec statut et phase.
- Création d'un nouveau projet via un formulaire en 4 étapes (informations générales, client, localisation, lots).
- Fiche projet avec 8 onglets : Informations, Proposition, Checklist contractuelle, Lots, Documents, Échanges, Historique, Notes.

**Propositions commerciales**
- Création et suivi des propositions envoyées au client.
- Historique des versions de proposition.

**Checklist contractuelle**
- Suivi des 5 étapes de contractualisation (offre, négociation, signature, acompte, démarrage).

**Documents**
- Dépôt et consultation des documents liés à ses projets (cahier des charges, devis, plans APD, contrat, etc.).

**Chat et taches**
- Messagerie interne, gestion de ses tâches.

---

### Economiste (`/economiste`)

L'économiste intervient sur la phase financière et technique des projets.

**Dashboard**
- Vue d'ensemble des projets en phase de chiffrage.

**Gestion de projets**
- Accès aux projets qui lui sont assignés, avec 5 onglets : Chiffrage, Lots, Avenants, Notices, Documents.

**Chiffrage**
- Création de versions de chiffrage (versionnées avec horodatage).
- Détail par lot avec quantités, prix unitaires, totaux.

**Devis sous-traitants**
- Réception et analyse des devis ST pour chaque lot.
- Scoring automatique IA (60 % prix / 40 % délai) pour aider à la sélection.
- Comparatif multi-devis par lot.

**Avenants**
- Chiffrage des avenants demandés par le CO.
- Suivi du statut (ouvert → chiffré → validé CO → validé client).

**Génération de notices CCTP**
- Transformation automatique d'une notice commerciale en notice technique CCTP via l'IA Claude.
- Paramètres : corps d'état, type de chantier, surface.

**Documents et chat**
- Dépôt de documents, messagerie interne, tâches.

---

### Gérant (`/gerant`)

Le gérant dispose d'une vue synthétique et décisionnelle sur l'ensemble de l'activité.

**Dashboard**
- Indicateurs clés : projets actifs, chiffre d'affaires en cours, alertes urgentes, activité récente.
- Répartition des projets par phase et par statut.

**Projets**
- Consultation de tous les projets de l'entreprise, toutes phases confondues.
- Lecture seule — le gérant consulte sans modifier.

**Documents**
- Accès à tous les documents de la plateforme.
- Dépôt de documents via "+ Deposer".

**Chat et taches**
- Messagerie interne, gestion de ses tâches.

---

### Dessin (`/dessin`)

Le dessinateur gère les plans techniques et documents graphiques des projets.

**Dashboard**
- Vue de ses projets assignés, plans en attente, alertes.

**Plans de conception**
- Création de fiches plan avec : projet (sélectionné depuis la base), lot concerné (chargé dynamiquement selon le projet), type de plan, phase (APD / EXE / DOE), statut (brouillon → en cours → émis → validé → archivé), indice de révision, date d'émission.
- Liste des plans avec filtres par projet, phase, statut.
- Modification et mise à jour des fiches plan.

**Documents**
- Dépôt de plans et documents techniques (plans EXE, plans APD, plans DOE).
- Consultation des documents reçus.

**Chat et taches**
- Messagerie interne, gestion de ses tâches.

---

### AT — Assistant Travaux (`/at`)

L'assistant travaux apporte un support administratif et logistique sur le terrain.

**Dashboard**
- Synthèse de ses tâches en cours et alertes.

**Taches**
- Gestion complète de ses tâches : création, assignation, statuts (todo → en cours → terminé), priorités.
- Vue par projet ou globale.

**Documents**
- Dépôt et consultation de documents de chantier.

**Chat**
- Messagerie interne par projet ou directe.

---

### RH — Ressources Humaines (`/rh`)

Le responsable RH gère les aspects liés au personnel de l'entreprise.

**Dashboard**
- Vue de ses actions en cours, alertes RH.

**Documents**
- Gestion des documents RH (contrats, Kbis, assurances, Urssaf, RIB, etc.).
- Dépôt via "+ Deposer", consultation et téléchargement.

**Chat et taches**
- Messagerie interne, gestion de ses tâches.

---

### CHO — Chargé de l'Hygiène et de l'Organisation (`/cho`)

Le CHO supervise les aspects sécurité, hygiène et organisation des chantiers.

**Dashboard**
- Synthèse de ses interventions et alertes.

**Documents**
- Accès et dépôt de documents liés à la sécurité et à l'organisation des chantiers.

**Chat et taches**
- Messagerie interne, gestion de ses tâches.

---

### Compta — Comptable (`/compta`)

Le comptable assure le suivi financier et la gestion des pièces comptables.

**Dashboard**
- Vue des projets avec leurs données financières, alertes comptables.

**Documents**
- Accès aux documents financiers : factures, devis, bons de commande, contrats.
- Dépôt et téléchargement de pièces comptables.

**Chat et taches**
- Messagerie interne, gestion de ses tâches.

---

### ST — Sous-traitant (`/st`)

Le sous-traitant accède uniquement aux informations qui le concernent directement.

**Dashboard**
- Ses interventions planifiées, les projets sur lesquels il est attributaire.

**Projets**
- Consultation des projets sur lesquels il intervient.
- Accès à ses lots attribués, planning d'intervention, documents du lot.

**Documents**
- Consultation et téléchargement des documents transmis par le CO ou l'économiste.
- Dépôt de ses propres documents (devis, attestations, factures).

**Chat et taches**
- Messagerie avec le CO ou l'économiste, gestion de ses tâches.

---

### Admin (`/admin`)

L'administrateur dispose d'un accès complet à toutes les données et paramètres de la plateforme.

**Dashboard**
- Vue globale : total utilisateurs, projets, documents, alertes non lues.
- Activité récente toutes équipes confondues.
- Répartition des projets par statut et par rôle assigné.

**Utilisateurs**
- Liste complète des utilisateurs avec rôle, statut, date de création.
- Activation / désactivation de comptes.
- Modification des rôles.
- Recherche et filtres par rôle.

**Projets**
- Vue de tous les projets de la plateforme.
- Filtres par statut et phase.
- Accès aux détails de chaque projet.

**Documents**
- Consultation de tous les documents déposés sur la plateforme (200 derniers).
- Filtres par type de document et par mot-clé.
- Téléchargement de tout document.
- Dépôt de nouveaux documents via "+ Deposer".

**Alertes**
- Consultation de toutes les alertes générées sur la plateforme.
- Filtres par priorité (faible, normale, haute, urgente) et par statut de lecture.
- Indicateur visuel pour les alertes non lues.

**Groupes**
- Gestion des groupes d'utilisateurs pour la messagerie et les notifications.

**Chat**
- Accès à toutes les conversations de la plateforme.
- Messagerie avec n'importe quel utilisateur ou groupe.

**Parametres**
- Configuration générale de la plateforme (nom de l'entreprise, paramètres d'envoi de notifications, etc.).

---

## Structure des routes

```
app/
├── (auth)/
│   ├── login/          # Connexion
│   └── signup/         # Création de compte
│
├── api/
│   └── generate-notice/  # POST — Génération de notice CCTP via Claude IA
│
├── co/
│   ├── dashboard/
│   └── projets/[id]/
│       ├── passation/
│       ├── achats/
│       ├── installation/
│       ├── chantier/
│       ├── controle/
│       ├── cloture/
│       └── gpa/
│
├── commercial/
│   ├── dashboard/
│   └── projets/
│       ├── page.tsx        # Liste des projets
│       ├── nouveau/        # Formulaire 4 étapes
│       └── [id]/           # Détail projet (8 onglets)
│
└── economiste/
    ├── dashboard/
    └── projets/[id]/       # Détail projet (5 onglets)
```

---

## Base de données

Toutes les tables métier sont dans le schéma `app`. Les requêtes Supabase utilisent systématiquement `.schema('app').from(...)`.

### Tables principales

| Table | Rôle |
|---|---|
| `utilisateurs` | Profils utilisateurs + rôle |
| `projets` | Dossiers projets (statut : passation → achats → installation → chantier → controle → cloture → gpa → termine) |
| `lots` | Lots de travaux par projet |
| `sous_traitants` | Base entreprises ST |
| `propositions` | Propositions commerciales |
| `checklist_contractuelle` | 5 étapes de contractualisation |
| `chiffrage_versions` | Versions de chiffrage économiste (versionnées) |
| `devis_recus` | Devis ST par lot (scoring IA 60% prix / 40% délai) |
| `echanges_st` | Journal des échanges avec les ST |
| `avenants` | Avenants (ouvert → chiffré → validé CO → validé client) |
| `comptes_rendus` | Comptes rendus de réunion |
| `remarques_cr` | Réserves et remarques sur CR |
| `checklists` | Checklists de visite chantier |
| `reserves` | Réserves OPR/GPA |
| `alertes` | Notifications in-app par utilisateur |
| `planning_ppe` | Planning général |
| `interventions_st` | Planning des ST |
| `prorata` | Gestion du prorata de chantier |
| `depenses_dic` | Dépenses DIC (eau, électricité, etc.) |
| `doe` | Dossier des Ouvrages Exécutés |

### Schéma `historique`

Tables d'historique pour les projets clôturés, performances ST, règles métier IA, documents archivés.

### Pattern `remarque`

Le champ `projets.remarque` (JSON texte) stocke les données ad-hoc qui ne justifient pas une colonne dédiée : `client_type`, `dessinatrice_id`, `date_passation`, `plan_statut`, `lancement_statut`, etc.

La fonction `updateProjetRemarque(id, patch)` fait un read-merge-write pour patcher ce JSON sans écraser les autres clés.

---

## API IA

### `POST /api/generate-notice`

Transforme une notice commerciale en notice technique CCTP.

**Body :**
```json
{
  "notice_commerciale": "...",
  "corps_etat": "Menuiserie",
  "type_chantier": "Bureaux",
  "surface_m2": 450
}
```

**Réponse :**
```json
{
  "notice_technique": "..."
}
```

---

## Hooks principaux

| Hook / fichier | Rôle |
|---|---|
| `hooks/useUser.ts` | Retourne `{ user, profil, loading }` depuis `app.utilisateurs` |
| `hooks/useProjects.ts` | CRUD projets, upload fichiers, alertes, checklist contractuelle, propositions |
| `hooks/useEconomisteProject.ts` | Chiffrage, lots, avenants, échanges ST — vue économiste |
| `hooks/useDevis.ts` | Devis ST par lot, scoring IA, sélection ST |
| `hooks/useUsers.ts` | Liste des utilisateurs par rôle (pour les selects d'assignation) |

---

## Composants UI

```
components/
├── co/           Sidebar, TopBar, PhaseNav, ProjetCard, StatCard
├── commercial/   Sidebar
├── economiste/   Sidebar
└── ui/           Badge (StatutBadge), Button, Card
```

Design commun : fond `bg-gray-50`, item actif sidebar `bg-gray-900 text-white`, cartes avec `shadow-card`, logo `/public/logo.png` dans tous les sidebars.

---

## Storage Supabase

Bucket `projets` — structure des fichiers :

```
{projet_id}/
└── commercial/
    ├── cahier-des-charges/
    ├── devis/
    ├── plan-apd/
    ├── contrat/
    └── autres/
```

---

## Démarrage rapide

1. Créer un projet Supabase
2. Désactiver la confirmation email : *Authentication → Providers → Email → Confirm email: OFF*
3. Appliquer les migrations SQL (schéma `app` + tables)
4. Copier `public/logo.png` (logo API)
5. Renseigner `.env.local`
6. `npm run dev` → [http://localhost:3000](http://localhost:3000)
7. Créer un premier compte → il sera redirigé selon son rôle
