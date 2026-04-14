'use client'

import { createClient } from '@/lib/supabase/client'
import type { DevisRecu, SousTraitant } from '@/types/database'

export interface DevisAvecST extends DevisRecu {
  sous_traitant: SousTraitant | null
  source?: 'devis' | 'dce'
  dce_acces_id?: string | null
  dce_token?: string | null
  st_nom_display?: string | null
}

export async function fetchDevisByLot(lotId: string): Promise<DevisAvecST[]> {
  const supabase = createClient()

  const [{ data: devis, error }, dceOffres] = await Promise.all([
    supabase
      .schema('app')
      .from('devis_recus')
      .select('*')
      .eq('lot_id', lotId)
      .order('montant_ht', { ascending: true }),
    fetchDceOffresAsDevis(lotId),
  ])

  if (error) throw error

  const devisArr: DevisAvecST[] = []

  if (devis?.length) {
    const stIds = [...new Set(devis.map((d) => d.st_id).filter(Boolean))] as string[]
    const { data: sts } = await supabase
      .schema('app')
      .from('sous_traitants')
      .select('*')
      .in('id', stIds)
    const stMap = Object.fromEntries((sts ?? []).map((s) => [s.id, s]))

    devis.forEach((d) => {
      const st = d.st_id ? (stMap[d.st_id] as SousTraitant | undefined) ?? null : null
      devisArr.push({
        ...(d as DevisRecu),
        sous_traitant: st,
        source: 'devis',
        st_nom_display: st?.raison_sociale ?? null,
      })
    })
  }

  devisArr.push(...dceOffres)

  // Tri final par montant croissant (null en fin).
  devisArr.sort((a, b) => {
    const ma = a.montant_ht ?? Number.POSITIVE_INFINITY
    const mb = b.montant_ht ?? Number.POSITIVE_INFINITY
    return ma - mb
  })

  return devisArr
}

async function fetchDceOffresAsDevis(lotId: string): Promise<DevisAvecST[]> {
  const supabase = createClient()

  // 1) Accès DCE soumis pour ce lot.
  const { data: acces } = await supabase
    .from('dce_acces_st')
    .select('id, token, lot_id, projet_id, st_nom, st_societe, st_email, user_id, statut')
    .eq('lot_id', lotId)
    .in('statut', ['soumis', 'retenu'])

  const accesRows = (acces ?? []) as Array<{
    id: string; token: string; lot_id: string; projet_id: string
    st_nom: string | null; st_societe: string | null; st_email: string | null
    user_id: string | null; statut: string
  }>
  if (accesRows.length === 0) return []

  // 2) Montant total par accès.
  const accesIds = accesRows.map((a) => a.id)
  const { data: offres } = await supabase
    .from('dce_offres_st')
    .select('acces_id, montant_total_ht')
    .in('acces_id', accesIds)

  const totalByAcces = new Map<string, number>()
  ;(offres ?? []).forEach((o: any) => {
    // montant_total_ht est repete sur chaque ligne d'une meme soumission => on prend max (=valeur unique).
    const prev = totalByAcces.get(o.acces_id) ?? 0
    const v = Number(o.montant_total_ht) || 0
    if (v > prev) totalByAcces.set(o.acces_id, v)
  })

  return accesRows.map((a): DevisAvecST => ({
    id: `dce:${a.id}`,
    projet_id: a.projet_id,
    lot_id: a.lot_id,
    st_id: a.user_id,
    montant_ht: totalByAcces.get(a.id) ?? null,
    delai_semaines: null,
    statut: a.statut === 'retenu' ? 'retenu' : 'recu',
    score_ia: null,
    note_eco: null,
    devis_url: null,
    created_at: new Date().toISOString(),
    sous_traitant: null,
    source: 'dce',
    dce_acces_id: a.id,
    dce_token: a.token,
    st_nom_display: a.st_societe || a.st_nom || a.st_email || 'ST invité',
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
