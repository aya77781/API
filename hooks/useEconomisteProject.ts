'use client'

import { createClient } from '@/lib/supabase/client'
import type {
  Projet, Lot, ChiffrageVersion, Avenant, EchangeST, SousTraitant,
} from '@/types/database'

// ─── Projet + sous-données ───────────────────────────────────────────────────

export interface ProjetEco extends Projet {
  lots: Lot[]
  chiffrage_versions: ChiffrageVersion[]
  avenants: Avenant[]
}

export async function fetchProjectEco(id: string): Promise<ProjetEco | null> {
  const supabase = createClient()

  const [projetRes, lotsRes, chiffrageRes, avenantsRes] = await Promise.all([
    supabase.schema('app').from('projets').select('*').eq('id', id).single(),
    supabase.schema('app').from('lots').select('*').eq('projet_id', id).order('numero'),
    supabase.schema('app').from('chiffrage_versions').select('*').eq('projet_id', id).order('version', { ascending: false }),
    supabase.schema('app').from('avenants').select('*').eq('projet_id', id).order('numero'),
  ])

  if (projetRes.error || !projetRes.data) return null

  return {
    ...(projetRes.data as Projet),
    lots: (lotsRes.data ?? []) as Lot[],
    chiffrage_versions: (chiffrageRes.data ?? []) as ChiffrageVersion[],
    avenants: (avenantsRes.data ?? []) as Avenant[],
  }
}

export async function fetchProjectsEco(economisteId: string): Promise<Projet[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .schema('app')
    .from('projets')
    .select('*')
    .eq('economiste_id', economisteId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Projet[]
}

// ─── Chiffrage versions ──────────────────────────────────────────────────────

export async function submitChiffrage(
  projetId: string,
  montant: number,
  motif: string,
  creePar: string,
): Promise<ChiffrageVersion> {
  const supabase = createClient()

  // Archiver la version active précédente
  await supabase
    .schema('app')
    .from('chiffrage_versions')
    .update({ statut: 'archive' })
    .eq('projet_id', projetId)
    .eq('statut', 'actif')

  // Calculer le prochain numéro de version
  const { data: existing } = await supabase
    .schema('app')
    .from('chiffrage_versions')
    .select('version')
    .eq('projet_id', projetId)
    .order('version', { ascending: false })
    .limit(1)

  const nextVersion = ((existing?.[0]?.version ?? 0) + 1)

  const { data, error } = await supabase
    .schema('app')
    .from('chiffrage_versions')
    .insert({
      projet_id: projetId,
      version: nextVersion,
      montant_total: montant,
      motif_revision: motif,
      statut: 'actif',
      cree_par: creePar,
    })
    .select()
    .single()

  if (error) throw error
  return data as ChiffrageVersion
}

// ─── Lots ────────────────────────────────────────────────────────────────────

export async function updateLot(
  id: string,
  patch: Partial<Lot>,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .schema('app')
    .from('lots')
    .update(patch)
    .eq('id', id)

  if (error) throw error
}

export async function addLot(projetId: string, corpsEtat: string): Promise<Lot> {
  const supabase = createClient()

  // Prochain numéro
  const { data: existing } = await supabase
    .schema('app')
    .from('lots')
    .select('numero')
    .eq('projet_id', projetId)
    .order('numero', { ascending: false })
    .limit(1)

  const nextNumero = ((existing?.[0]?.numero ?? 0) + 1)

  const { data, error } = await supabase
    .schema('app')
    .from('lots')
    .insert({
      projet_id: projetId,
      numero: nextNumero,
      corps_etat: corpsEtat,
      statut: 'en_attente',
    })
    .select()
    .single()

  if (error) throw error
  return data as Lot
}

// ─── Faisabilité / Soumission CO ─────────────────────────────────────────────

export async function submitFaisabilite(
  projetId: string,
  lotId: string,
  lotLabel: string,
  coId: string,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.schema('app').from('alertes').insert({
    projet_id:      projetId,
    utilisateur_id: coId,
    type:           'faisabilite_lot',
    titre:          `Faisabilité à valider — ${lotLabel}`,
    message:        'L\'économiste soumet la faisabilité budgétaire de ce lot pour validation.',
    priorite:       'normal',
    lue:            false,
  })
  if (error) throw error
}

export async function soumettrChiffrageAuCommercial(
  projetId: string,
  nomProjet: string,
  commercialId: string,
  montant: number,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.schema('app').from('alertes').insert({
    projet_id:      projetId,
    utilisateur_id: commercialId,
    type:           'chiffrage_soumis',
    titre:          `Chiffrage APD soumis — ${nomProjet}`,
    message:        `L'économiste a soumis un chiffrage de ${montant.toLocaleString('fr-FR')} € HT pour validation.`,
    priorite:       'high',
    lue:            false,
  })
  if (error) throw error
}

export async function soumettreChiffrageAuGerant(
  projetId: string,
  montant: number,
  ecoId: string,
): Promise<void> {
  const supabase = createClient()

  const { data: existing } = await supabase
    .schema('app')
    .from('propositions')
    .select('numero')
    .eq('projet_id', projetId)
    .order('numero', { ascending: false })
    .limit(1)

  const nextNumero = ((existing as { numero: number }[] | null)?.[0]?.numero ?? 0) + 1

  const { error } = await supabase.schema('app').from('propositions').insert({
    projet_id:  projetId,
    numero:     nextNumero,
    montant_ht: montant,
    statut:     'valide_eco',
    date_envoi: null,
    valide_par: ecoId,
    valide_le:  new Date().toISOString(),
    remarque:   null,
  })
  if (error) throw error
}

// ─── Retenir un ST ───────────────────────────────────────────────────────────

export async function retenirST(
  projetId: string,
  lotId: string,
  stId: string,
  motif: string,
  coId: string | null,
): Promise<void> {
  const supabase = createClient()

  await supabase
    .schema('app')
    .from('lots')
    .update({ st_retenu_id: stId, statut: 'retenu' })
    .eq('id', lotId)

  await supabase
    .schema('app')
    .from('devis_recus')
    .update({ statut: 'retenu' })
    .eq('lot_id', lotId)
    .eq('st_id', stId)

  await supabase
    .schema('app')
    .from('devis_recus')
    .update({ statut: 'refuse' })
    .eq('lot_id', lotId)
    .neq('st_id', stId)

  if (coId) {
    await supabase.schema('app').from('alertes').insert({
      projet_id:      projetId,
      utilisateur_id: coId,
      type:           'st_retenu',
      titre:          `ST retenu sur un lot`,
      message:        `Motif : ${motif}`,
      priorite:       'normal',
      lue:            false,
    })
  }
}

// ─── Avenants ────────────────────────────────────────────────────────────────

export async function createAvenant(
  projetId: string,
  description: string,
  demandePar: string,
): Promise<Avenant> {
  const supabase = createClient()

  const { data: existing } = await supabase
    .schema('app')
    .from('avenants')
    .select('numero')
    .eq('projet_id', projetId)
    .order('numero', { ascending: false })
    .limit(1)

  const nextNumero = ((existing?.[0]?.numero ?? 0) + 1)

  const { data, error } = await supabase
    .schema('app')
    .from('avenants')
    .insert({
      projet_id:   projetId,
      numero:      nextNumero,
      description,
      statut:      'ouvert',
      demande_par: demandePar,
    })
    .select()
    .single()

  if (error) throw error
  return data as Avenant
}

export async function updateAvenant(
  id: string,
  patch: Partial<Avenant>,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .schema('app')
    .from('avenants')
    .update(patch)
    .eq('id', id)

  if (error) throw error
}

// ─── Échanges ST ─────────────────────────────────────────────────────────────

export async function fetchEchangesByLot(lotId: string): Promise<EchangeST[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .schema('app')
    .from('echanges_st')
    .select('*')
    .eq('lot_id', lotId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as EchangeST[]
}

export async function addEchange(
  data: Omit<EchangeST, 'id' | 'created_at'>,
): Promise<EchangeST> {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .schema('app')
    .from('echanges_st')
    .insert(data)
    .select()
    .single()

  if (error) throw error
  return result as EchangeST
}

export async function updateEchange(
  id: string,
  decision: 'accepte' | 'refuse',
  motif: string,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .schema('app')
    .from('echanges_st')
    .update({ decision, motif_decision: motif })
    .eq('id', id)

  if (error) throw error
}

// ─── ST lookup ───────────────────────────────────────────────────────────────

export async function fetchST(id: string): Promise<SousTraitant | null> {
  const supabase = createClient()
  const { data } = await supabase
    .schema('app')
    .from('sous_traitants')
    .select('*')
    .eq('id', id)
    .single()
  return data as SousTraitant | null
}
