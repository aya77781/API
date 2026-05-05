# Phase Conception — Architecture & écarts vs spec

Workflow Commercial → Dessinatrice → Économiste avec versioning des propositions
(V1 → V2 → APD), basé sur des **demandes** émises par le Commercial.

## Écarts par rapport au prompt initial

Le prompt proposait des tables neuves (`app.demandes_conception`, `app.brief_client`,
`app.notices_commerciales`) et un système `notifications`. La base contient déjà des
structures voisines : on a réutilisé l'existant pour éviter la fragmentation.

| Demandé | Réalité existante | Décision |
|---|---|---|
| Table `app.demandes_conception` | `app.demandes_travail` (mêmes colonnes de base) | **Étendre** `demandes_travail` (ajout `version`, `brief_snapshot`, `notices_snapshot`, `fichiers_joints`, `message_demandeur`, `livrable_3d_url`, `livrable_montant`, `notes_livreur`, `date_livraison_souhaitee`, `date_livraison_effective`) |
| Table `app.notices_commerciales` | `app.dessin_notices` (autre usage : production Dessinatrice) | **Créer** `app.notices_commerciales` distincte (saisie Commercial) |
| Table `app.brief_client` | n'existe pas | **Créer** |
| `propositions.version SMALLINT` | `app.propositions.numero INT` | **Réutiliser** `numero` comme version (1=V1, 2=V2, 3=APD) |
| `propositions.plan_3d_url`, `montant_total_ht`, `commentaire_client`, `is_archived`, `verrouillee_apres_signature` | absents | **Ajouter** colonnes |
| Table `notifications` | `app.alertes` déjà câblée (notifications role + priorité) | **Utiliser** `app.alertes` (types : `demande_conception`, `livraison_conception`, `plan_mis_a_jour`, `proposition_acceptee`) |
| ENUMs `demande_type` / `demande_statut` | colonnes `text` actuelles | **Créer** ENUMs `app.demande_conception_type`, `app.demande_conception_statut` (préfixés pour ne pas entrer en conflit) — appliqués via CHECK constraints sans casser les usages existants de `demandes_travail` |

## Mapping versioning

| Version | `propositions.numero` | Demande plan | Demande chiffrage |
|---|---|---|---|
| V1 | 1 | `plan_intention` | `estimation_initiale` |
| V2 | 2 | `plan_proposition` | `chiffrage_proposition` |
| APD | 3 | `plan_apd` | `chiffrage_apd` |

## Tables ajoutées / modifiées

### `app.brief_client` (nouvelle)
Une ligne par projet (UNIQUE sur `projet_id`). Saisie Commercial.

### `app.notices_commerciales` (nouvelle)
Liste de notices par projet (lot + contenu + ordre). Saisie Commercial.

### `app.demandes_travail` (étendue)
Colonnes ajoutées :
- `version SMALLINT` — 1 / 2 / 3
- `brief_snapshot JSONB` — figé à la création
- `notices_snapshot JSONB` — figé à la création
- `fichiers_joints TEXT[]`
- `message_demandeur TEXT`
- `livrable_3d_url TEXT`
- `livrable_montant NUMERIC(12,2)`
- `notes_livreur TEXT`
- `date_livraison_souhaitee DATE` (alias logique de `date_livraison_prevue`)
- `date_livraison_effective TIMESTAMPTZ` (alias de `date_livraison_reelle`)

CHECK constraint sur `type` pour les 6 valeurs Conception : `plan_intention`, `plan_proposition`, `plan_apd`, `estimation_initiale`, `chiffrage_proposition`, `chiffrage_apd` (tout en restant compatible avec les autres types existants).

### `app.propositions` (étendue)
Colonnes ajoutées :
- `plan_3d_url TEXT`
- `montant_total_ht NUMERIC(14,2)` (alias renforcé de `montant_ht`)
- `commentaire_client TEXT` (existait déjà comme `retours_client`, on aligne le nom dans le code)
- `date_reponse_client DATE` (alias `date_retour_client`)
- `is_archived BOOLEAN DEFAULT FALSE`
- `verrouillee_apres_signature BOOLEAN DEFAULT FALSE`
- `chiffrage_id UUID` (référence optionnelle à `app.chiffrage_versions`)

CHECK constraint sur `statut` : `en_preparation | envoyee | acceptee | refusee | en_negociation`.

## RLS

- **Commercial** : CRUD demandes où `demandeur_id = auth.uid()`.
- **Dessinatrice / Économiste** : SELECT + UPDATE des demandes où `destinataire_id = auth.uid()`.
- **Gérant / Admin** : SELECT total.

Les rôles Supabase sont vérifiés via `app.utilisateurs.role` joint sur `auth.users.id`.

## Server Actions

`app/_actions/conception.ts` expose :
- `upsertBriefClient(projetId, data)`
- `addNotice / updateNotice / deleteNotice / reorderNotices`
- `creerDemande({ projetId, type, version, destinataireId, message, dateLimite })`
- `livrerDemande({ demandeId, livrableUrl, livrable3dUrl, montant, notes, lignesEstimation })`
- `enregistrerRetourClient({ propositionId, statut, commentaire, modifsPlan, modifsBudget })`

## Notifications (`app.alertes`)

Types utilisés :
- `demande_conception` — Commercial → Dessinatrice/Économiste
- `livraison_conception` — Dessinatrice/Économiste → Commercial
- `plan_mis_a_jour` — Dessinatrice → Économiste (cross-flow V2+)
- `proposition_acceptee` — système → Commercial

Pattern : `app.alertes` reçoit `{ utilisateur_id, type, titre, message, priorite, metadata }`.

## Storage

Bucket `projets/conception/` pour les livrables (plan PDF/DWG, estimations).
Bucket `briefs/` pour les pièces jointes du brief client.

## Chronologie d'implémentation

1. Migration 1 — Tables `brief_client`, `notices_commerciales`, extensions `demandes_travail`, extensions `propositions`, ENUMs (CHECK), RLS.
2. Server Actions et helpers.
3. Composants partagés (`DemandeCard`, `PropositionVersionBadge`, `ContextePanel`).
4. Page Commercial (5 blocs).
5. Page Dessinatrice.
6. Page Économiste.
7. Extension cross-flow V2/APD/retour client/bascule Passation.
8. Seed data.
