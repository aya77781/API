'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── Types ──────────────────────────────────────────────────────────────────

export type BiblioType = 'lot' | 'chapitre' | 'ouvrage'

export type BiblioItem = {
  id: string
  type: BiblioType
  parent_id: string | null
  designation: string
  detail: string | null
  unite: string | null
  prix_ref: number | null
  ordre: number
  source_code: string | null
  created_at: string
  updated_at: string
}

export type BiblioLotSummary = {
  id: string
  designation: string
  ordre: number
  source_code: string | null
  nb_chapitres: number
  nb_ouvrages: number
  created_at: string
}

const UNITES_OK = ['u', 'ml', 'm2', 'm3', 'kg', 'h', 'jour', 'forfait', 'ens', 'ft'] as const

// ─── Lecture ────────────────────────────────────────────────────────────────

export async function listLots(search?: string): Promise<BiblioLotSummary[]> {
  const supabase = createClient()
  const { data: lots } = await supabase
    .from('biblio_items')
    .select('id, designation, ordre, source_code, created_at')
    .eq('type', 'lot')
    .order('ordre')
  const rows = (lots ?? []) as Array<{
    id: string; designation: string; ordre: number; source_code: string | null; created_at: string
  }>

  // Compte chapitres et ouvrages par lot via traversal
  const result: BiblioLotSummary[] = []
  for (const lot of rows) {
    const ids = await collectDescendantIds(supabase, lot.id)
    const { data: byType } = await supabase
      .from('biblio_items')
      .select('type')
      .in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000'])
    const counts = ((byType ?? []) as Array<{ type: BiblioType }>).reduce(
      (acc, r) => { acc[r.type] = (acc[r.type] ?? 0) + 1; return acc },
      {} as Record<string, number>,
    )
    result.push({
      ...lot,
      nb_chapitres: counts.chapitre ?? 0,
      nb_ouvrages: counts.ouvrage ?? 0,
    })
  }

  if (search && search.trim()) {
    const s = search.toLowerCase()
    return result.filter((l) =>
      l.designation.toLowerCase().includes(s) || (l.source_code ?? '').toLowerCase().includes(s),
    )
  }
  return result
}

export async function getLotTree(lotId: string): Promise<BiblioItem[]> {
  const supabase = createClient()
  const ids = await collectDescendantIds(supabase, lotId)
  ids.unshift(lotId)
  const { data } = await supabase
    .from('biblio_items')
    .select('*')
    .in('id', ids)
    .order('ordre')
  return ((data ?? []) as BiblioItem[])
}

export async function getOuvrage(id: string): Promise<BiblioItem | null> {
  const supabase = createClient()
  const { data } = await supabase.from('biblio_items').select('*').eq('id', id).single()
  return (data as unknown as BiblioItem | null) ?? null
}

// Helper recursif pour recuperer tous les descendants
async function collectDescendantIds(
  supabase: ReturnType<typeof createClient>,
  rootId: string,
): Promise<string[]> {
  const all: string[] = []
  let queue = [rootId]
  while (queue.length > 0) {
    const { data } = await supabase
      .from('biblio_items')
      .select('id')
      .in('parent_id', queue)
    const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id)
    all.push(...ids)
    queue = ids
  }
  return all
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function createLot(designation: string): Promise<{ id: string }> {
  if (!designation.trim()) throw new Error('Designation obligatoire')
  const supabase = createClient()
  const { data: max } = await supabase
    .from('biblio_items').select('ordre').eq('type', 'lot').order('ordre', { ascending: false }).limit(1).maybeSingle()
  const ordre = ((max as { ordre: number } | null)?.ordre ?? -1) + 1
  const { data, error } = await supabase
    .from('biblio_items')
    .insert({ type: 'lot', designation: designation.trim(), ordre } as never)
    .select('id').single()
  if (error) throw new Error(error.message)
  revalidatePath('/economiste/bibliotheque')
  return { id: (data as { id: string }).id }
}

export async function createChapitre(parentId: string, designation: string): Promise<{ id: string }> {
  if (!designation.trim()) throw new Error('Designation obligatoire')
  const supabase = createClient()
  const { data: max } = await supabase
    .from('biblio_items').select('ordre').eq('parent_id', parentId).order('ordre', { ascending: false }).limit(1).maybeSingle()
  const ordre = ((max as { ordre: number } | null)?.ordre ?? -1) + 1
  const { data, error } = await supabase
    .from('biblio_items')
    .insert({ type: 'chapitre', parent_id: parentId, designation: designation.trim(), ordre } as never)
    .select('id').single()
  if (error) throw new Error(error.message)
  revalidatePath('/economiste/bibliotheque')
  return { id: (data as { id: string }).id }
}

export async function createOuvrage(input: {
  parentId: string
  designation: string
  detail?: string
  unite: string
  prix_ref?: number
}): Promise<{ id: string }> {
  if (!input.designation.trim()) throw new Error('Designation obligatoire')
  if (!UNITES_OK.includes(input.unite as typeof UNITES_OK[number])) throw new Error('Unite invalide')
  const supabase = createClient()
  const { data: max } = await supabase
    .from('biblio_items').select('ordre').eq('parent_id', input.parentId).order('ordre', { ascending: false }).limit(1).maybeSingle()
  const ordre = ((max as { ordre: number } | null)?.ordre ?? -1) + 1
  const { data, error } = await supabase
    .from('biblio_items')
    .insert({
      type: 'ouvrage',
      parent_id: input.parentId,
      designation: input.designation.trim(),
      detail: input.detail?.trim() || null,
      unite: input.unite,
      prix_ref: input.prix_ref ?? null,
      ordre,
    } as never)
    .select('id').single()
  if (error) throw new Error(error.message)
  revalidatePath('/economiste/bibliotheque')
  return { id: (data as { id: string }).id }
}

export async function updateItem(id: string, patch: {
  designation?: string
  detail?: string | null
  unite?: string
  prix_ref?: number | null
}): Promise<void> {
  if (patch.unite && !UNITES_OK.includes(patch.unite as typeof UNITES_OK[number])) throw new Error('Unite invalide')
  const supabase = createClient()
  const { error } = await supabase.from('biblio_items').update(patch as never).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/economiste/bibliotheque')
}

export async function deleteItem(id: string): Promise<void> {
  const supabase = createClient()
  // CASCADE supprime les enfants automatiquement
  const { error } = await supabase.from('biblio_items').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/economiste/bibliotheque')
}

// ─── Import vers une affaire (snapshot independant) ─────────────────────────

export async function importFromBiblio(input: {
  itemId: string  // id du lot, chapitre ou ouvrage source
  projetId: string
  lotId: string  // lot cible dans chiffrage_lignes
  parentLigneId?: string | null  // ou inserer dans le lot cible
}): Promise<{ insertedIds: string[] }> {
  const supabase = createClient()

  // 1. Recuperer la sous-arborescence depuis biblio_items
  const sourceIds = await collectDescendantIds(supabase, input.itemId)
  sourceIds.unshift(input.itemId)
  const { data: sourceData } = await supabase
    .from('biblio_items').select('*').in('id', sourceIds).order('ordre')
  const source = (sourceData ?? []) as BiblioItem[]
  if (source.length === 0) return { insertedIds: [] }

  // 2. Recuperer ordre max actuel dans le lot cible
  const { data: maxRow } = await supabase
    .from('chiffrage_lignes').select('ordre').eq('lot_id', input.lotId)
    .order('ordre', { ascending: false }).limit(1).maybeSingle()
  let nextOrdre = ((maxRow as { ordre: number } | null)?.ordre ?? -1) + 1

  // 3. Insertion en preservant la hierarchie : map source.id → new chiffrage_ligne.id
  const idMap = new Map<string, string>()
  const inserted: string[] = []
  // Tri topologique : parents avant enfants (source est deja triee par BFS via collectDescendantIds)

  for (const item of source) {
    const newParentId = item.id === input.itemId
      ? (input.parentLigneId ?? null)
      : (item.parent_id ? idMap.get(item.parent_id) ?? null : null)

    // Si l'item importe est un "lot" biblio, on le converti en "chapitre" dans le chiffrage
    // (un chiffrage a deja son lot top-level via lot_id)
    const targetType = item.type === 'lot' ? 'chapitre' : item.type

    const payload = {
      lot_id: input.lotId,
      projet_id: input.projetId,
      designation: item.designation,
      detail: item.detail,
      quantite: targetType === 'ouvrage' ? 0 : null,
      unite: targetType === 'ouvrage' ? item.unite : null,
      prix_unitaire: targetType === 'ouvrage' ? (item.prix_ref ?? 0) : null,
      ordre: nextOrdre++,
      type: targetType,
      parent_id: newParentId,
    }
    const { data, error } = await supabase
      .from('chiffrage_lignes').insert(payload as never).select('id').single()
    if (error) throw new Error(`Import : ${error.message}`)
    const newId = (data as { id: string }).id
    idMap.set(item.id, newId)
    inserted.push(newId)
  }

  return { insertedIds: inserted }
}
