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

L'application gère 9 rôles, chacun avec son propre espace :

| Rôle | Préfixe de route | Description |
|---|---|---|
| `co` | `/co` | Chargé d'Opérations — pilotage des chantiers |
| `commercial` | `/commercial` | Création et suivi des dossiers clients |
| `economiste` | `/economiste` | Chiffrage, notices CCTP, avenants |
| `gerant` | `/gerant` | Vue dirigeant |
| `dessinatrice` | `/dessinatrice` | Plans et documents techniques |
| `assistant_travaux` | `/assistant` | Support terrain |
| `comptable` | `/comptable` | Suivi financier |
| `rh` | `/rh` | Ressources humaines |
| `cho` | `/cho` | CHO |

Le routage par rôle est géré par `middleware.ts` : tout utilisateur authentifié est automatiquement redirigé vers son dashboard selon le rôle stocké dans `app.utilisateurs`.

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
