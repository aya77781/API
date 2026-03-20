'use client'

import { createClient } from '@/lib/supabase/client'
import type { Projet, Alerte, Proposition, ChecklistContractuelle } from '@/types/database'

export async function fetchProjects(userId: string): Promise<Projet[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .schema('app')
    .from('projets')
    .select('*')
    .eq('commercial_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Projet[]
}

export async function fetchProject(id: string): Promise<Projet | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .schema('app')
    .from('projets')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as Projet
}

export interface CreateProjectPayload {
  nom: string
  type_chantier: string | null
  adresse: string
  budget_total: number | null
  co_id: string | null
  economiste_id: string | null
  commercial_id: string
  client_nom: string
  client_email: string | null
  client_tel: string | null
  psychologie_client: string | null
  infos_hors_contrat: string | null
  alertes_cles: string | null
  remarque: string | null
}

export async function createProject(payload: CreateProjectPayload): Promise<Projet> {
  const supabase = createClient()
  const { data, error } = await supabase
    .schema('app')
    .from('projets')
    .insert({
      ...payload,
      statut: 'passation',
      phase_active: 'passation',
    })
    .select()
    .single()

  if (error) throw error
  return data as Projet
}

export async function uploadProjectFile(
  projetId: string,
  slot: string,
  file: File
): Promise<string> {
  const supabase = createClient()
  const path = `${projetId}/commercial/${slot}/${file.name}`
  const { error } = await supabase.storage
    .from('projets')
    .upload(path, file, { upsert: true })

  if (error) throw error
  return path
}

export interface StoredFile {
  name: string
  path: string
  size: number
  createdAt: string
  slot: string
}

export async function listProjectFiles(projetId: string): Promise<StoredFile[]> {
  const supabase = createClient()
  const basePath = `${projetId}/commercial`

  const slots = ['cahier-des-charges', 'devis', 'plan-apd', 'contrat', 'autres']
  const allFiles: StoredFile[] = []

  for (const slot of slots) {
    const { data } = await supabase.storage
      .from('projets')
      .list(`${basePath}/${slot}`)

    if (data) {
      allFiles.push(
        ...data.map((f) => ({
          name: f.name,
          path: `${basePath}/${slot}/${f.name}`,
          size: f.metadata?.size ?? 0,
          createdAt: f.created_at ?? '',
          slot,
        }))
      )
    }
  }

  return allFiles
}

export async function deleteProjectFile(path: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.storage.from('projets').remove([path])
  if (error) throw error
}

export function getFileUrl(path: string): string {
  const supabase = createClient()
  const { data } = supabase.storage.from('projets').getPublicUrl(path)
  return data.publicUrl
}

// ─── Alertes ─────────────────────────────────────────────────────────────────

export async function createAlerte(
  data: Omit<Alerte, 'id' | 'created_at'>
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.schema('app').from('alertes').insert(data)
  if (error) throw error
}

// ─── Projet remarque (JSON patch) ────────────────────────────────────────────

export async function updateProjetRemarque(
  id: string,
  patch: Record<string, unknown>
): Promise<Projet> {
  const supabase = createClient()
  const { data: current } = await supabase
    .schema('app')
    .from('projets')
    .select('remarque')
    .eq('id', id)
    .single()

  let existing: Record<string, unknown> = {}
  try {
    if (current?.remarque) existing = JSON.parse(current.remarque)
  } catch {}

  const merged = { ...existing, ...patch }
  const { data, error } = await supabase
    .schema('app')
    .from('projets')
    .update({ remarque: JSON.stringify(merged) })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Projet
}

// ─── Propositions ────────────────────────────────────────────────────────────

export async function fetchPropositions(projetId: string): Promise<Proposition[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .schema('app')
    .from('propositions')
    .select('*')
    .eq('projet_id', projetId)
    .order('numero', { ascending: true })

  if (error) throw error
  return (data ?? []) as Proposition[]
}

export async function createProposition(
  data: Omit<Proposition, 'id' | 'created_at'>
): Promise<Proposition> {
  const supabase = createClient()
  const { data: result, error } = await supabase
    .schema('app')
    .from('propositions')
    .insert(data)
    .select()
    .single()

  if (error) throw error
  return result as Proposition
}

export async function updateProposition(
  id: string,
  patch: Partial<Omit<Proposition, 'id' | 'created_at'>>
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .schema('app')
    .from('propositions')
    .update(patch)
    .eq('id', id)

  if (error) throw error
}

// ─── Checklist contractuelle ─────────────────────────────────────────────────

const CHECKLIST_ETAPES = [
  { ordre: 1, etape: 'Contrat rédigé' },
  { ordre: 2, etape: 'Contrat signé par le client' },
  { ordre: 3, etape: 'Plan APD validé par la dessinatrice' },
  { ordre: 4, etape: 'Plan signé et annexé au contrat par le client' },
  { ordre: 5, etape: 'Dossier prêt pour passation CO' },
]

export async function fetchChecklistContractuelle(
  projetId: string
): Promise<ChecklistContractuelle[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .schema('app')
    .from('checklist_contractuelle')
    .select('*')
    .eq('projet_id', projetId)
    .order('ordre', { ascending: true })

  if (error) throw error
  return (data ?? []) as ChecklistContractuelle[]
}

export async function initChecklistContractuelle(projetId: string): Promise<void> {
  const supabase = createClient()
  const rows = CHECKLIST_ETAPES.map(({ ordre, etape }) => ({
    projet_id: projetId,
    etape,
    ordre,
    fait: false,
    fait_par: null,
    fait_le: null,
  }))

  const { error } = await supabase
    .schema('app')
    .from('checklist_contractuelle')
    .insert(rows)

  if (error) throw error
}

export async function toggleChecklistItem(
  id: string,
  fait: boolean,
  faitPar: string | null
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .schema('app')
    .from('checklist_contractuelle')
    .update({
      fait,
      fait_par: fait ? faitPar : null,
      fait_le: fait ? new Date().toISOString() : null,
    })
    .eq('id', id)

  if (error) throw error
}
