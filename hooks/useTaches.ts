'use client'

import { createClient } from '@/lib/supabase/client'

export type TacheStatut = 'a_faire' | 'en_cours' | 'en_attente' | 'fait'
export type TacheUrgence = 'faible' | 'normal' | 'urgent' | 'critique'

export interface Tache {
  id: string
  titre: string
  description: string | null
  projet_id: string | null
  creee_par: string
  assignee_a: string | null
  tags_utilisateurs: string[]
  tags_roles: string[]
  tag_tous: boolean
  urgence: TacheUrgence
  statut: TacheStatut
  date_echeance: string | null
  date_rappel: string | null
  created_at: string
  updated_at: string
  projet?: { id: string; nom: string; reference: string | null } | null
  createur?: { id: string; prenom: string; nom: string } | null
  assignee?: { id: string; prenom: string; nom: string } | null
  destinataires?: { id: string; prenom: string; nom: string }[]
}

export interface CreateTacheData {
  titre: string
  description: string | null
  projet_id: string | null
  urgence: TacheUrgence
  statut: TacheStatut
  date_echeance: string | null
  date_rappel: string | null
  tags_utilisateurs: string[]
  tags_roles: string[]
  tag_tous: boolean
  assignee_a: string | null
}

export function useTaches() {
  const supabase = createClient()

  async function fetchMesTaches(userId: string, userRole: string): Promise<Tache[]> {
    const { data, error } = await supabase.schema('app').from('taches')
      .select(`
        *,
        projet:projets(id, nom, reference),
        createur:utilisateurs!creee_par(id, prenom, nom)
      `)
      .or(`creee_par.eq.${userId},assignee_a.eq.${userId},tags_utilisateurs.cs.{${userId}},tags_roles.cs.{${userRole}},tag_tous.eq.true`)
      .order('created_at', { ascending: false })
    if (error) { console.error('fetchMesTaches error:', error); return [] }
    return enrichTaches(data ?? [])
  }

  async function fetchTachesProjet(projetId: string): Promise<Tache[]> {
    const { data } = await supabase.schema('app').from('taches')
      .select(`
        *,
        projet:projets(id, nom, reference),
        createur:utilisateurs!creee_par(id, prenom, nom)
      `)
      .eq('projet_id', projetId)
      .order('created_at', { ascending: false })
    return enrichTaches(data ?? [])
  }

  async function enrichTaches(taches: Record<string, unknown>[]): Promise<Tache[]> {
    if (!taches.length) return []
    const allUserIds = new Set<string>()
    for (const t of taches) {
      const tags = (t.tags_utilisateurs as string[]) ?? []
      tags.forEach(id => allUserIds.add(id))
      if (t.assignee_a) allUserIds.add(t.assignee_a as string)
    }
    const usersMap: Map<string, { id: string; prenom: string; nom: string }> = new Map()
    if (allUserIds.size > 0) {
      const { data: users } = await supabase.schema('app').from('utilisateurs')
        .select('id, prenom, nom').in('id', Array.from(allUserIds))
      for (const u of users ?? []) usersMap.set(u.id, u)
    }
    return taches.map(t => ({
      ...t,
      tags_utilisateurs: (t.tags_utilisateurs as string[]) ?? [],
      tags_roles: (t.tags_roles as string[]) ?? [],
      tag_tous: (t.tag_tous as boolean) ?? false,
      destinataires: ((t.tags_utilisateurs as string[]) ?? []).map(id => usersMap.get(id)).filter(Boolean) as { id: string; prenom: string; nom: string }[],
      assignee: t.assignee_a ? (usersMap.get(t.assignee_a as string) ?? null) : null,
    })) as Tache[]
  }

  async function createTache(
    data: CreateTacheData,
    creePar: string,
    createurNom: string,
    destinatairesIds: string[]
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.schema('app').from('taches')
      .insert({
        ...data,
        creee_par: creePar,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }

    if (destinatairesIds.length > 0) {
      const dateStr = data.date_echeance
        ? new Date(data.date_echeance).toLocaleDateString('fr-FR')
        : 'Non definie'
      await supabase.schema('app').from('alertes').insert(
        destinatairesIds.map(uid => ({
          utilisateur_id: uid,
          type: 'tache',
          titre: `${createurNom} vous a assigne une tache`,
          message: `${data.titre} - Echeance : ${dateStr}`,
          priorite: data.urgence === 'critique' ? 'urgent' : 'normal',
          lue: false,
        }))
      )
    }

    if (data.tag_tous) {
      const { data: allUsers } = await supabase.schema('app').from('utilisateurs')
        .select('id').eq('actif', true).neq('id', creePar)
      if (allUsers?.length) {
        const dateStr = data.date_echeance
          ? new Date(data.date_echeance).toLocaleDateString('fr-FR')
          : 'Non definie'
        await supabase.schema('app').from('alertes').insert(
          allUsers.map(u => ({
            utilisateur_id: u.id,
            type: 'tache',
            titre: `${createurNom} vous a assigne une tache`,
            message: `${data.titre} - Echeance : ${dateStr}`,
            priorite: data.urgence === 'critique' ? 'urgent' : 'normal',
            lue: false,
          }))
        )
      }
    }

    return { error: null }
  }

  async function updateTache(id: string, updates: Partial<CreateTacheData>): Promise<{ error: string | null }> {
    const { error } = await supabase.schema('app').from('taches')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    return { error: error?.message ?? null }
  }

  async function updateStatut(id: string, statut: TacheStatut): Promise<{ error: string | null }> {
    const { error } = await supabase.schema('app').from('taches')
      .update({ statut, updated_at: new Date().toISOString() })
      .eq('id', id)
    return { error: error?.message ?? null }
  }

  async function deleteTache(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase.schema('app').from('taches').delete().eq('id', id)
    return { error: error?.message ?? null }
  }

  async function fetchCountNonFaites(userId: string, userRole: string): Promise<number> {
    const { count } = await supabase.schema('app').from('taches')
      .select('id', { count: 'exact', head: true })
      .or(`assignee_a.eq.${userId},tags_utilisateurs.cs.{${userId}},tags_roles.cs.{${userRole}},tag_tous.eq.true`)
      .neq('statut', 'fait')
      .neq('creee_par', userId)
    return count ?? 0
  }

  async function fetchAllProjets(): Promise<{ id: string; nom: string; reference: string | null }[]> {
    const { data } = await supabase.schema('app').from('projets')
      .select('id, nom, reference').neq('statut', 'archive').order('nom')
    return data ?? []
  }

  async function fetchAllUsers(): Promise<{ id: string; prenom: string; nom: string; role: string }[]> {
    const { data } = await supabase.schema('app').from('utilisateurs')
      .select('id, prenom, nom, role').eq('actif', true).order('prenom')
    return data ?? []
  }

  return {
    fetchMesTaches, fetchTachesProjet, createTache, updateTache,
    updateStatut, deleteTache, fetchCountNonFaites, fetchAllProjets, fetchAllUsers,
  }
}
