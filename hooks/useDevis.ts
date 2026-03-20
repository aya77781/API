'use client'

import { createClient } from '@/lib/supabase/client'
import type { DevisRecu, SousTraitant } from '@/types/database'

export interface DevisAvecST extends DevisRecu {
  sous_traitant: SousTraitant | null
}

export async function fetchDevisByLot(lotId: string): Promise<DevisAvecST[]> {
  const supabase = createClient()

  const { data: devis, error } = await supabase
    .schema('app')
    .from('devis_recus')
    .select('*')
    .eq('lot_id', lotId)
    .order('montant_ht', { ascending: true })

  if (error) throw error
  if (!devis?.length) return []

  const stIds = [...new Set(devis.map((d) => d.st_id).filter(Boolean))] as string[]

  const { data: sts } = await supabase
    .schema('app')
    .from('sous_traitants')
    .select('*')
    .in('id', stIds)

  const stMap = Object.fromEntries((sts ?? []).map((s) => [s.id, s]))

  return devis.map((d) => ({
    ...(d as DevisRecu),
    sous_traitant: d.st_id ? (stMap[d.st_id] as SousTraitant) ?? null : null,
  }))
}

export async function addDevis(
  data: Omit<DevisRecu, 'id' | 'created_at'>,
): Promise<DevisRecu> {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .schema('app')
    .from('devis_recus')
    .insert(data)
    .select()
    .single()

  if (error) throw error
  return result as DevisRecu
}

export async function updateDevisStatut(
  id: string,
  statut: DevisRecu['statut'],
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .schema('app')
    .from('devis_recus')
    .update({ statut })
    .eq('id', id)

  if (error) throw error
}

/** Score simple : pondération 60% prix + 40% délai (normalisé par rapport au lot) */
export function scoreDevis(devis: DevisRecu[], cibleDevis: DevisRecu): number {
  if (!devis.length) return 0
  const montants = devis.map((d) => d.montant_ht ?? 0).filter(Boolean)
  const delais   = devis.map((d) => d.delai_semaines ?? 0).filter(Boolean)
  if (!montants.length) return 0

  const minM = Math.min(...montants)
  const maxM = Math.max(...montants)
  const minD = Math.min(...delais)
  const maxD = Math.max(...delais)

  const m = cibleDevis.montant_ht ?? 0
  const d = cibleDevis.delai_semaines ?? 0

  const scorePrix   = maxM === minM ? 1 : 1 - (m - minM) / (maxM - minM)
  const scoreDelai  = maxD === minD ? 1 : 1 - (d - minD) / (maxD - minD)

  return Math.round((scorePrix * 0.6 + scoreDelai * 0.4) * 100)
}

export async function fetchSTActifs(): Promise<SousTraitant[]> {
  const supabase = createClient()
  const { data } = await supabase
    .schema('app')
    .from('sous_traitants')
    .select('*')
    .eq('statut', 'actif')
    .order('raison_sociale')
  return (data ?? []) as SousTraitant[]
}
