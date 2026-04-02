# API -- Plateforme de gestion de chantiers

Application web multi-roles pour la gestion complete de projets de construction, de la phase commerciale jusqu'a la cloture GPA.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js 14.2.35 (App Router) |
| Langage | TypeScript |
| Style | Tailwind CSS + DM Sans (police par defaut) |
| Backend / BDD | Supabase (PostgreSQL schema `app`, Auth, Storage) |
| IA -- Transcription | OpenAI Whisper (`whisper-1`) |
| IA -- Generation | Claude API (`claude-sonnet-4-20250514`) via fetch direct |
| Email | Resend |
| Icones | Lucide React (jamais d'emojis dans le code ou l'UI) |
| Auth SSR | `@supabase/ssr` |
| Drag & Drop | `@hello-pangea/dnd` |

---

## Regles de developpement

- **Pas d'emojis** dans le code, les composants ou l'UI. Utiliser les icones Lucide React.
- Toutes les requetes Supabase utilisent `.schema('app').from(...)`.
- Les pages sont en francais. Les noms de variables/fonctions sont en francais quand ils representent des concepts metier (projet, lot, tache, devis).
- Le design suit un systeme coherent : fond `bg-gray-50`, cards avec `bg-white rounded-xl border border-gray-200 shadow-sm`, boutons actifs en `bg-gray-900 text-white`.
- Chaque role a son propre prefixe de route, sa sidebar et son layout.

---

## Variables d'environnement

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# IA
ANTHROPIC_API_KEY=xxx
OPENAI_API_KEY=xxx

# Email
RESEND_API_KEY=xxx
RESEND_FROM_EMAIL=contact@api-projet.fr

# Optionnel
N8N_WEBHOOK_URL=xxx
N8N_API_KEY=xxx
```

---

## Installation

```bash
npm install
cp .env.example .env.local  # remplir les valeurs
npm run dev
```

---

## Architecture des fichiers

```
app/
  (auth)/login, signup, inscription-st   -- Pages publiques d'authentification
  auth/callback/route.ts                 -- Callback OAuth Supabase
  api/
    admin/users, lots                    -- CRUD admin
    co/transcribe/route.ts               -- Whisper + Claude (transcription audio -> CR)
    co/demande-devis/route.ts            -- Generation email devis via Claude + envoi Resend
    generate-notice/route.ts             -- Generation notice CCTP via Claude
    st/signup, lots-disponibles          -- Endpoints ST publics
  co/                                    -- Espace CO (Charge d'Operations)
  commercial/                            -- Espace Commercial
  economiste/                            -- Espace Economiste
  dessin/                                -- Espace Dessinatrice
  at/                                    -- Espace Assistant Travaux
  compta/                                -- Espace Comptable
  rh/                                    -- Espace RH
  cho/                                   -- Espace CHO (Securite/Organisation)
  gerant/                                -- Espace Gerant
  st/                                    -- Espace Sous-Traitant
  admin/                                 -- Espace Admin

components/
  ui/          -- Button, Card, Badge, ComingSoon
  shared/      -- ChatPage, DocumentsPage, DocumentUploadModal, TodoList, TachesPage, NotificationPanel
  co/          -- Sidebar, TopBar, PhaseNav, ProjetCard, StatCard, ProjectToolbar
  co/achats/   -- AchatsFlow (flow multi-etapes achats)
  co/visite/   -- ReunionChantier, TourneeTerrainCO
  co/preparation/ -- PreparationVisite (checklist hebdo)
  {role}/      -- Sidebar specifique par role (admin, at, cho, commercial, compta, dessin, economiste, gerant, rh, st)

hooks/
  useUser.ts              -- Profil utilisateur connecte (user, profil, loading)
  useUsers.ts             -- Fetch utilisateurs par role
  useMyProjets.ts         -- Projets assignes au user (co_id, commercial_id, economiste_id + chat)
  useProjects.ts          -- CRUD projets generique
  useDashboardCO.ts       -- Donnees agregees du dashboard CO (stats semaine, calendrier, taches)
  useAchats.ts            -- Recherche ST, consultations, demande devis, attribution lots, score IA
  useChecklist.ts         -- Checklists terrain/OPR/GPA, templates, photos, CR tournee
  useTaches.ts            -- CRUD taches (creation, statut, assignation, tags)
  useTachesBadge.ts       -- Badge temps reel taches non faites
  useDevis.ts             -- Devis recus par lot, scoring IA 60%/40%
  useEconomisteProject.ts -- Chiffrage, lots, avenants, echanges ST
  useDocuments.ts         -- Upload/download documents GED, notifications
  useDocumentsBadge.ts    -- Badge docs non lus
  useChat.ts              -- Messagerie par groupe/projet
  useChatBadge.ts         -- Badge messages non lus
  useNotifications.ts     -- Alertes et notifs documents
  useSTProjects.ts        -- Projets cote sous-traitant
  useSTUpload.ts          -- Upload fichiers ST

lib/
  utils.ts                       -- cn(), formatCurrency(), formatDate(), PHASE_ORDER, STATUT_LABELS
  supabase/client.ts             -- Client Supabase navigateur (singleton)
  supabase/server.ts             -- Client Supabase serveur (cookies)
  supabase/admin.ts              -- Client service role (admin)
  documents/searchDossiers.ts    -- Arborescence GED avec filtrage par role

types/
  database.ts    -- Types TypeScript complets du schema Supabase (toutes les tables)

supabase/migrations/
  create_documents_ged.sql       -- Table documents + notifs_documents + RLS
  create_visite_chantier.sql     -- Tables checklists + checklists_templates + ALTER comptes_rendus
  create_phase_achats.sql        -- ALTER sous_traitants + tables evaluations_st + consultations_st
```

---

## Roles utilisateurs

Le middleware.ts redirige chaque utilisateur vers son dashboard selon le champ `role` de `app.utilisateurs`.

| Role DB | Prefixe route | Label UI | Description |
|---|---|---|---|
| `co` | `/co` | Charge d'Operations | Pilotage operationnel des chantiers |
| `commercial` | `/commercial` | Commercial | Cycle de vie commercial des projets |
| `economiste` | `/economiste` | Economiste | Chiffrage, CCTP, avenants |
| `gerant` | `/gerant` | Gerant | Vue dirigeant, synthese globale |
| `dessinatrice` | `/dessin` | Dessinatrice | Plans techniques et conception |
| `assistant_travaux` | `/at` | Assistant Travaux | Support terrain et administratif |
| `comptable` | `/compta` | Comptable | Suivi financier |
| `rh` | `/rh` | RH | Ressources humaines |
| `cho` | `/cho` | CHO | Securite, hygiene, organisation |
| `st` | `/st` | Sous-traitant | Acces restreint a ses dossiers |
| `admin` | `/admin` | Administrateur | Acces complet |

---

## Base de donnees (schema `app`)

### Tables principales

| Table | Description | Colonnes cles |
|---|---|---|
| `projets` | Dossiers projets | `nom, reference, statut, co_id, commercial_id, economiste_id, budget_total, date_livraison, client_nom/email/tel, adresse, type_chantier, surface_m2, psychologie_client, alertes_cles, remarque` |
| `lots` | Lots de travaux par projet | `projet_id, numero, corps_etat, budget_prevu, budget_final, st_retenu_id, statut (en_attente/consultation/negociation/retenu/en_cours/termine)` |
| `utilisateurs` | Profils utilisateurs | `email, nom, prenom, role, actif, categorie (interne/st/controle/client)` |
| `sous_traitants` | Base entreprises ST | `raison_sociale, corps_etat[], specialites[], email, telephone, ville, departement, region, agrement, note_globale, statut` |
| `consultations_st` | Suivi consultation achats | `projet_id, lot_id, st_id, statut (a_contacter->contacte->devis_demande->devis_recu->refuse/attribue), montant_devis, delai_propose, score_ia, email_envoye_at` |
| `evaluations_st` | Notes ST par projet | `st_id, projet_id, co_id, note_qualite/delai/communication (1-5), note_globale (GENERATED)` |
| `taches` | Taches assignables | `titre, creee_par, assignee_a, tags_utilisateurs[], statut (a_faire/en_cours/en_attente/fait), urgence, date_echeance, projet_id` |
| `comptes_rendus` | CR de reunion | `projet_id, numero, type (passation/lancement/chantier/opr/autre/reunion/tournee_terrain), transcription, audio_url, participants, statut (brouillon/valide/envoye)` |
| `checklists` | Checklists de visite | `projet_id, lot_id, type (terrain/opr/gpa), points (JSONB), created_by` |
| `checklists_templates` | Modeles de points par corps d'etat | `lot_type, type, points (JSONB)` |
| `documents` | GED documents | `projet_id, lot_id, nom_fichier, type_doc, dossier_ged, storage_path, uploaded_by, tags_utilisateurs[], message_depot` |
| `alertes` | Notifications in-app | `utilisateur_id, type, titre, message, priorite, lue, projet_id` |
| `devis_recus` | Devis ST par lot | `projet_id, lot_id, st_id, montant_ht, delai_semaines, score_ia, statut` |
| `reserves` | Reserves OPR/GPA | `projet_id, lot_id, st_id, description, statut, photo_signalement_url` |
| `remarques_cr` | Remarques sur CR | `cr_id, lot_id, contenu, statut, photos[]` |
| `avenants` | Avenants projet | `projet_id, numero, description, montant_ht, statut` |
| `propositions` | Propositions commerciales | `projet_id, montant_ht, statut` |
| `planning_ppe` | Planning general | `projet_id, date_debut_chantier, date_livraison` |
| `interventions_st` | Planning ST | `planning_id, lot_id, st_id, date_debut, date_fin, statut` |

### Cycle de vie d'un projet

```
passation -> achats -> installation -> chantier -> controle -> cloture -> gpa -> termine
```

Chaque phase correspond a un onglet dans `/co/projets/[id]/` via le composant PhaseNav.

### Pattern `remarque`

Le champ `projets.remarque` (texte JSON) stocke des donnees ad-hoc : `client_type`, `dessinatrice_id`, `date_passation`, `plan_statut`, `lancement_statut`, etc. La fonction `updateProjetRemarque(id, patch)` fait un read-merge-write.

---

## Fonctionnalites implementees (CO)

### Dashboard (`/co/dashboard`)

5 zones verticales :
1. En-tete avec date et nombre de projets actifs
2. 4 metric cards : visites, taches, CR envoyes, devis recus (avec barre de progression)
3. Calendrier semaine (Lun-Ven) avec taches, CR a valider, alertes
4. Taches sans date (checkbox + bouton "Planifier" avec date picker inline)
5. Avancement chantiers (barre de progression par phase, compte a rebours livraison)

### Sidebar CO

Liens dans l'ordre : Tableau de bord, Projets, Achats, Preparation, Visite chantier, Todo List, Documents, Messages.

### Vue projet (`/co/projets/[id]`)

Page d'ensemble avec : 4 indicateurs (phase, lots, budget, livraison), infos client, liste des lots, equipe, dates, alertes non lues, acces rapides.

### Achats (`/co/achats`)

Flow multi-etapes :
1. Selectionner un projet (filtre par co_id du user)
2. Selectionner ou creer un lot (select avec 15 corps d'etat standard : Demolition, Maconnerie, Menuiseries int/ext, Revetements sols/muraux, Faux-plafonds, Peinture, Electricite CFO/CFA, Plomberie, CVC, Desenfumage, Serrurerie, Signaletique, Nettoyage)
3. Recommandations ST : top 10 tries par note moyenne, top 3 pre-selectionnes, filtres par specialite + departement
4. Envoi automatique des demandes de devis (email via Claude + Resend)
5. Suivi : statut par ST, bouton relance (surbrillance apres 3j), depot devis recu (montant + delai + PDF), calcul score IA, attribution lot

### Preparation visite (`/co/preparation`)

Checklist hebdomadaire en 3 phases (46 points) :
- AVANT : documents (7 points), anticipation M+1 (3 points)
- PENDANT : reunion (8 points), tournee terrain 14 lots, controle securite (4 points), photos (2 points)
- APRES : CR (4 points), suivi (4 points)

Sauvegarde auto 30s. Selecteur de semaine. Barre de progression globale.

### Visite chantier (`/co/visite`)

2 modes switchables :
- **Reunion de chantier** : participants (plateforme + externes), ordre du jour, enregistrement audio (MediaRecorder), transcription Whisper, generation CR par Claude, depot dans la GED avec notifications
- **Tournee terrain** : selection lots, checklist par lot (points predefinis par corps d'etat + custom), statut OK/A surveiller/Probleme, notes, photos (capture camera), notes vocales (Whisper), autosave, generation resume

### Todo List (`/co/todo`)

Composant partage (`components/shared/TodoList.tsx`) utilise par tous les roles. Affiche les taches creees ET celles partagees avec l'utilisateur. Filtres par statut. Badge "Partage par X" pour les taches recues.

### Documents GED

Upload multi-format avec selection de dossier, tagging utilisateurs/groupes, notifications. 11 dossiers GED (00_client a 10_sav), 16 types de documents.

### Chat

Messagerie par groupe/projet avec support fichiers.

---

## Routes API

### `POST /api/co/transcribe`

Pipeline en 2 etapes :
1. **Whisper** : transcription audio (webm/mp4) en texte francais
2. **Claude** : generation du CR structure (ou transcription seule si `transcription_only=true`)

FormData : `audio` (File), `participants` (JSON), `ordre_du_jour` (string), `projet_id` (string), `transcription_only` (string)

Retourne : `{ transcription: string, compte_rendu?: string }`

### `POST /api/co/demande-devis`

1. Fetch donnees (ST, projet, lot, CO) depuis Supabase
2. Generation email par Claude (prompt pro avec projet, lot, date limite J+7)
3. Envoi via Resend avec header `X-Consultation-Id`
4. Creation de 2 alertes relance (J+3 normal, J+7 urgent avec tel ST)
5. MAJ consultation : `statut='devis_demande'`, `email_envoye_at=now()`

Body : `{ consultation_id, st_id, projet_id, lot_id, co_id }`

### `POST /api/generate-notice`

Transforme une notice commerciale en notice technique CCTP via Claude.

Body : `{ notice_commerciale, corps_etat, type_chantier, surface_m2 }`

---

## Hooks principaux -- reference rapide

| Hook | Utilise par | Fonction principale |
|---|---|---|
| `useUser()` | Partout | `{ user, profil, loading }` -- session Supabase + profil `app.utilisateurs` |
| `useMyProjets()` | `/co/projets` | Projets ou `co_id/commercial_id/economiste_id = user.id` + projets via chat |
| `useDashboardCO(userId)` | `/co/dashboard` | Stats semaine, calendrier, taches sans date, projets actifs |
| `useAchats()` | `/co/achats` | `searchSTs`, `getConsultations`, `addConsultation`, `demanderDevis`, `attribuerLot`, `calcScoreIA` |
| `useChecklist()` | Visite/Tournee | `fetchLots`, `fetchTemplatePoints`, `saveChecklist`, `loadTodayChecklist`, `uploadPhoto`, `finishTournee` |
| `useTaches()` | Todo/Taches | `fetchMesTaches`, `createTache`, `updateStatut`, `deleteTache` |
| `useDocuments()` | GED | `uploadDocument`, `fetchDocumentsProjet`, `fetchDocumentsRecus`, `markLu` |
| `useDevis()` | Economiste | `fetchDevisByLot`, `addDevis`, `scoreDevis` |
| `useEconomisteProject()` | Economiste | Chiffrage versions, lots, avenants, echanges ST |
| `useChat()` | Chat | Groupes, messages, envoi |
| `useNotifications(userId)` | TopBar | Alertes + notifs documents temps reel |

---

## Composants partages

| Composant | Description |
|---|---|
| `shared/TodoList` | Liste de taches avec filtre statut, partage multi-user. Prop `role` pour le fetch. |
| `shared/TachesPage` | Kanban taches avec drag & drop, filtres vue/urgence/projet |
| `shared/ChatPage` | Interface chat complete avec envoi fichiers |
| `shared/DocumentsPage` | Liste documents avec filtres dossier/type, groupement, badges notification |
| `shared/DocumentUploadModal` | Upload en 3 etapes : projet -> dossier -> fichier + tags |
| `shared/NotificationPanel` | Panneau lateral alertes + notifs docs |

---

## Conventions de code

### Supabase

```typescript
// Client navigateur
const supabase = createClient() // depuis lib/supabase/client
supabase.schema('app').from('projets').select('*').eq('co_id', userId)

// Client serveur (dans les API routes et server components)
const supabase = createClient() // depuis lib/supabase/server
```

### Filtrage projets par CO

```typescript
// Pour afficher UNIQUEMENT les projets du CO connecte :
.or(`co_id.eq.${user.id},economiste_id.eq.${user.id},commercial_id.eq.${user.id}`)
```

### Style des composants

```
- Cards : bg-white rounded-xl border border-gray-200 shadow-sm
- Boutons primaires : bg-gray-900 text-white rounded-lg hover:bg-gray-800
- Boutons secondaires : bg-white border border-gray-200 text-gray-700
- Labels/titres de section : text-xs font-bold text-gray-900 uppercase tracking-wide
- Texte secondaire : text-xs text-gray-400
- Skeletons loading : div bg-gray-100 rounded-lg animate-pulse
- Barres de progression : h-1.5 bg-gray-100 rounded-full + child avec bg-{color}
```

### Sidebar par role

Chaque role a son sidebar dans `components/{role}/Sidebar.tsx`. Le sidebar du CO utilise une fonction `navItem(href, label, Icon)`. Les autres utilisent un tableau `navLinks` itere dans le render.

Tous les sidebars incluent le lien Todo List avec l'icone `ListTodo`.

---

## Pages a implementer (placeholders actuels)

Les pages suivantes existent mais affichent un placeholder "Phase X" :

| Route | Phase | Description prevue |
|---|---|---|
| `/co/projets/[id]/passation` | Passation | Checklists de passation, transfert documents, annuaire ST |
| `/co/projets/[id]/achats` | Achats | Placeholder (le flow achats est dans `/co/achats`) |
| `/co/projets/[id]/installation` | Installation | Installation chantier, planning previsionnel |
| `/co/projets/[id]/chantier` | Chantier | Comptes rendus, planning Gantt, reserves, prorata |
| `/co/projets/[id]/controle` | Controle | Reception travaux, levee reserves, OPR |
| `/co/projets/[id]/cloture` | Cloture | DOE, decomptes finaux, solde prorata |
| `/co/projets/[id]/gpa` | GPA | Suivi desordres GPA, liberation cautions |

Les espaces des autres roles (commercial, economiste, etc.) ont leurs propres pages partiellement implementees.

---

## Migrations SQL

Les migrations sont dans `supabase/migrations/` et doivent etre executees manuellement dans l'editeur SQL de Supabase. L'ordre d'execution :

1. Schema initial (cree directement dans Supabase -- tables projets, lots, utilisateurs, etc.)
2. `create_documents_ged.sql` -- GED + notifications documents
3. `create_visite_chantier.sql` -- Checklists + templates + modification comptes_rendus
4. `create_phase_achats.sql` -- Colonnes sous_traitants + evaluations_st + consultations_st

### RLS (Row Level Security)

Toutes les tables ont RLS active. Policies principales :
- `checklists` : lecture ouverte, ecriture restreinte au createur
- `checklists_templates` : lecture ouverte, ecriture admin
- `evaluations_st` : CO voit/ecrit ses evaluations, admin voit tout
- `consultations_st` : lecture ouverte, ecriture CO + admin
- `documents` : politique ouverte (a resserrer en production)

---

## Storage Supabase

Bucket `projets` :

```
{projet_id}/
  commercial/cahier-des-charges, devis, plan-apd, contrat
  comptes-rendus/
  devis/{timestamp}_{st_id}.pdf
  tournee-terrain/{timestamp}_{random}.jpg
```

---

## Demarrage rapide

1. Creer un projet Supabase
2. Desactiver la confirmation email : Authentication > Providers > Email > Confirm email: OFF
3. Appliquer les migrations SQL dans l'ordre
4. Copier `public/logo.png` (logo API)
5. Renseigner `.env.local`
6. `npm run dev` -> http://localhost:3000
7. Creer un premier compte -> redirection automatique selon le role
