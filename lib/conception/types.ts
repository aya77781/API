// Types Phase Conception

export const DEMANDE_TYPES = [
  'plan_intention',
  'plan_proposition',
  'plan_apd',
  'estimation_initiale',
  'chiffrage_proposition',
  'chiffrage_apd',
] as const
export type DemandeType = typeof DEMANDE_TYPES[number]

export const DEMANDE_STATUTS = ['en_attente', 'en_cours', 'livree', 'annulee'] as const
export type DemandeStatut = typeof DEMANDE_STATUTS[number]

export const PROPOSITION_STATUTS = [
  'en_preparation',
  'envoyee',
  'acceptee',
  'refusee',
  'en_negociation',
] as const
export type PropositionStatut = typeof PROPOSITION_STATUTS[number]

// Version : numéro entier >= 1. APD est un drapeau séparé (pas une version implicite).
// V1 = première intention, V2..Vn = affinages successifs, APD = version finale signable.
export type Version = number

export type BriefClient = {
  id: string
  projet_id: string
  besoin_exprime: string | null
  contraintes: string | null
  style_inspiration: string | null
  budget_evoque: number | null
  delais_souhaites: string | null
  documents_urls: string[] | null
  auteur_id: string | null
  created_at: string
  updated_at: string
}

export type NoticeCommerciale = {
  id: string
  projet_id: string
  lot_nom: string
  contenu_texte: string
  ordre: number
  auteur_id: string | null
  created_at: string
  updated_at: string
}

export type DemandeConception = {
  id: string
  projet_id: string
  proposition_id: string | null
  version: number | null
  type: DemandeType | string | null
  statut: DemandeStatut | string | null
  demandeur_id: string | null
  destinataire_id: string | null
  brief_snapshot: unknown
  notices_snapshot: unknown
  fichiers_joints: string[] | null
  message_demandeur: string | null
  livrable_url: string | null
  livrable_3d_url: string | null
  livrable_montant: number | null
  notes_livreur: string | null
  date_demande: string | null
  date_livraison_souhaitee: string | null
  date_livraison_prevue: string | null
  date_livraison_effective: string | null
  date_livraison_reelle: string | null
}

export type Proposition = {
  id: string
  projet_id: string
  numero: number
  type: string | null
  statut: string | null
  plan_url: string | null
  plan_3d_url: string | null
  plan_valide: boolean | null
  budget_estime: number | null
  chiffrage_url: string | null
  chiffrage_id: string | null
  chiffrage_valide: boolean | null
  montant_ht: number | null
  montant_total_ht: number | null
  retours_client: string | null
  commentaire_client: string | null
  date_envoi: string | null
  date_soumission: string | null
  date_retour: string | null
  date_retour_client: string | null
  date_reponse_client: string | null
  motif_refus: string | null
  commentaire: string | null
  is_archived: boolean | null
  verrouillee_apres_signature: boolean | null
  remarque: string | null
  created_at: string
}

// Mapping version <-> types de demande
// isAPD : si true, retourne le type APD quel que soit le numéro de version.
// Sinon : V1 → intention, V2+ → proposition (affinage).
export function planTypeForVersion(v: Version, isAPD: boolean = false): DemandeType {
  if (isAPD) return 'plan_apd'
  if (v === 1) return 'plan_intention'
  return 'plan_proposition'
}

export function chiffrageTypeForVersion(v: Version, isAPD: boolean = false): DemandeType {
  if (isAPD) return 'chiffrage_apd'
  if (v === 1) return 'estimation_initiale'
  return 'chiffrage_proposition'
}

// Type de proposition à stocker dans propositions.type (CHECK : premiere / affinee / finale)
export function propositionTypeForVersion(v: Version, isAPD: boolean = false): string {
  if (isAPD) return 'finale'
  if (v === 1) return 'premiere'
  return 'affinee'
}

export function labelType(t: DemandeType | string | null): string {
  switch (t) {
    case 'plan_intention': return 'Plan d\'intention (V1)'
    case 'plan_proposition': return 'Plan affiné (V2)'
    case 'plan_apd': return 'Plan APD'
    case 'estimation_initiale': return 'Estimation initiale (V1)'
    case 'chiffrage_proposition': return 'Chiffrage affiné (V2)'
    case 'chiffrage_apd': return 'Chiffrage APD'
    default: return t ?? '—'
  }
}

export function labelVersion(v: number | null | undefined, isAPD: boolean = false): string {
  if (isAPD) return 'APD'
  return v ? `V${v}` : '—'
}

export function isPlanType(t: string | null | undefined): boolean {
  return !!t && t.startsWith('plan_')
}

export function isChiffrageType(t: string | null | undefined): boolean {
  return !!t && (t.includes('chiffrage') || t.includes('estimation'))
}

export function formatEuros(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

// ─── Input types pour Server Actions ────────────────────────────────────────

export type BriefClientInput = {
  projet_id: string
  besoin_exprime?: string | null
  contraintes?: string | null
  style_inspiration?: string | null
  budget_evoque?: number | null
  delais_souhaites?: string | null
  documents_urls?: string[]
}

export type CreerDemandeInput = {
  projetId: string
  type: DemandeType
  version: Version
  isAPD?: boolean
  destinataireId: string
  message?: string
  dateLimite?: string | null
  fichiersJoints?: string[]
}

export type LignesEstimationInput = {
  lot_id?: string | null
  designation: string
  quantite?: number | null
  unite?: string | null
  prix_unitaire?: number | null
  total_ht?: number | null
  ordre?: number | null
}[]

export type LivrerDemandeInput = {
  demandeId: string
  livrableUrl?: string | null
  livrable3dUrl?: string | null
  montant?: number | null
  notes?: string | null
  lignesEstimation?: LignesEstimationInput
}

export type RetourClientInput = {
  propositionId: string
  statut: 'acceptee' | 'refusee' | 'en_negociation'
  commentaire?: string | null
  modifsPlan?: boolean
  modifsBudget?: boolean
}
