'use client'

import { createClient } from '@/lib/supabase/client'

export interface ChatGroupe {
  id: string
  nom: string
  type: 'projet' | 'libre'
  projet_id: string | null
  description: string | null
  actif: boolean
  created_at: string
  projet?: { id: string; nom: string } | null
  dernierMessage?: ChatMessage | null
  unreadCount?: number
}

export interface ChatMembre {
  id: string
  groupe_id: string
  utilisateur_id: string
  est_admin: boolean
  utilisateur?: { id: string; prenom: string; nom: string; role: string } | null
}

export interface ChatMessage {
  id: string
  groupe_id: string
  auteur_id: string
  contenu: string | null
  document_id: string | null
  mentions: string[]
  created_at: string
  modifie_at: string | null
  supprime: boolean
  auteur?: { id: string; prenom: string; nom: string; role: string } | null
  document?: {
    id: string
    nom_fichier: string
    type_doc: string
    taille_octets: number | null
    storage_path: string
  } | null
}

export function useChat() {
  const supabase = createClient()

  async function fetchMesGroupes(userId: string): Promise<ChatGroupe[]> {
    const { data: memberships } = await supabase
      .schema('app')
      .from('chat_membres')
      .select('groupe_id')
      .eq('utilisateur_id', userId)

    if (!memberships?.length) return []
    const ids = memberships.map((m: { groupe_id: string }) => m.groupe_id)

    const [groupesRes, messagesRes, lecturesRes] = await Promise.all([
      supabase.schema('app').from('chat_groupes')
        .select('*, projet:projets(id, nom)')
        .in('id', ids).eq('actif', true).order('created_at', { ascending: false }),
      supabase.schema('app').from('chat_messages')
        .select('id, groupe_id, auteur_id, contenu, document_id, created_at')
        .in('groupe_id', ids).eq('supprime', false).order('created_at', { ascending: false }),
      supabase.schema('app').from('chat_lectures')
        .select('groupe_id, lu_le').eq('utilisateur_id', userId),
    ])

    const allMsgs = messagesRes.data ?? []
    const lectureMap = new Map((lecturesRes.data ?? []).map((l: { groupe_id: string; lu_le: string | null }) => [l.groupe_id, l.lu_le]))
    const lastMsgMap = new Map<string, typeof allMsgs[0]>()
    const unreadMap = new Map<string, number>()

    for (const msg of allMsgs) {
      if (!lastMsgMap.has(msg.groupe_id)) lastMsgMap.set(msg.groupe_id, msg)
    }

    for (const gid of ids) {
      const luLe = lectureMap.get(gid) as string | undefined
      unreadMap.set(gid, allMsgs.filter((m: { groupe_id: string; auteur_id: string; created_at: string }) =>
        m.groupe_id === gid && m.auteur_id !== userId &&
        (!luLe || new Date(m.created_at) > new Date(luLe))
      ).length)
    }

    return (groupesRes.data ?? []).map((g: Record<string, unknown>) => ({
      ...g,
      projet: (g.projet as { id: string; nom: string } | null) ?? null,
      dernierMessage: (lastMsgMap.get(g.id as string) ?? null) as ChatMessage | null,
      unreadCount: unreadMap.get(g.id as string) ?? 0,
    })) as ChatGroupe[]
  }

  async function fetchMessages(groupeId: string, limit = 50, offset = 0): Promise<ChatMessage[]> {
    const { data } = await supabase
      .schema('app')
      .from('chat_messages')
      .select('*, auteur:utilisateurs!auteur_id(id, prenom, nom, role), document:documents(id, nom_fichier, type_doc, taille_octets, storage_path)')
      .eq('groupe_id', groupeId)
      .eq('supprime', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    return ((data ?? []) as ChatMessage[]).reverse()
  }

  async function fetchGroupeMembers(groupeId: string): Promise<ChatMembre[]> {
    const { data } = await supabase
      .schema('app')
      .from('chat_membres')
      .select('*, utilisateur:utilisateurs(id, prenom, nom, role)')
      .eq('groupe_id', groupeId)
    return (data ?? []) as ChatMembre[]
  }

  async function sendMessage(groupeId: string, auteurId: string, contenu: string, mentions: string[] = []): Promise<{ error: string | null }> {
    const { error } = await supabase.schema('app').from('chat_messages')
      .insert({
        groupe_id: groupeId,
        auteur_id: auteurId,
        contenu,
        mentions: mentions.length > 0 ? mentions : null,
      })
    if (error) console.error('sendMessage error:', error)
    return { error: error?.message ?? null }
  }

  async function sendDocument(groupeId: string, auteurId: string, documentId: string): Promise<{ error: string | null }> {
    const { error } = await supabase.schema('app').from('chat_messages')
      .insert({
        groupe_id: groupeId,
        auteur_id: auteurId,
        contenu: null,
        document_id: documentId,
        mentions: null,
      })
    if (error) console.error('sendDocument error:', error)
    return { error: error?.message ?? null }
  }

  async function markLu(groupeId: string, userId: string, messageId: string): Promise<void> {
    await supabase.schema('app').from('chat_lectures')
      .upsert({ groupe_id: groupeId, utilisateur_id: userId, dernier_message_lu: messageId, lu_le: new Date().toISOString() },
        { onConflict: 'groupe_id,utilisateur_id' })
  }

  async function fetchUnreadTotal(userId: string): Promise<number> {
    const { data: memberships } = await supabase.schema('app').from('chat_membres').select('groupe_id').eq('utilisateur_id', userId)
    if (!memberships?.length) return 0
    const ids = memberships.map((m: { groupe_id: string }) => m.groupe_id)

    const [msgRes, lecRes] = await Promise.all([
      supabase.schema('app').from('chat_messages').select('groupe_id, auteur_id, created_at').in('groupe_id', ids).eq('supprime', false).neq('auteur_id', userId),
      supabase.schema('app').from('chat_lectures').select('groupe_id, lu_le').eq('utilisateur_id', userId),
    ])

    const lectureMap = new Map((lecRes.data ?? []).map((l: { groupe_id: string; lu_le: string | null }) => [l.groupe_id, l.lu_le]))
    return (msgRes.data ?? []).filter((m: { groupe_id: string; created_at: string }) => {
      const luLe = lectureMap.get(m.groupe_id) as string | undefined
      return !luLe || new Date(m.created_at) > new Date(luLe)
    }).length
  }

  async function createGroupe(
    nom: string, type: 'projet' | 'libre', projetId: string | null, description: string | null,
    creePar: string, membres: { userId: string; estAdmin: boolean }[]
  ): Promise<{ error: string | null; groupeId?: string }> {
    const { data: groupe, error } = await supabase.schema('app').from('chat_groupes')
      .insert({ nom, type, projet_id: projetId || null, description, cree_par: creePar, actif: true })
      .select('id').single()

    if (error || !groupe) return { error: error?.message ?? 'Erreur' }

    if (membres.length > 0) {
      await supabase.schema('app').from('chat_membres').insert(
        membres.map(m => ({ groupe_id: groupe.id, utilisateur_id: m.userId, est_admin: m.estAdmin }))
      )
      await supabase.schema('app').from('alertes').insert(
        membres.map(m => ({
          utilisateur_id: m.userId, type: 'chat',
          titre: `Vous avez été ajouté au groupe "${nom}"`,
          message: description ?? '', priorite: 'normal', lue: false,
        }))
      )
    }
    return { error: null, groupeId: groupe.id }
  }

  async function archiverGroupe(groupeId: string): Promise<void> {
    await supabase.schema('app').from('chat_groupes').update({ actif: false }).eq('id', groupeId)
  }

  async function fetchTousGroupes(): Promise<(ChatGroupe & { membres_count: number })[]> {
    const [groupesRes, membresRes] = await Promise.all([
      supabase.schema('app').from('chat_groupes').select('*, projet:projets(id, nom)').order('created_at', { ascending: false }),
      supabase.schema('app').from('chat_membres').select('groupe_id'),
    ])
    const countMap = new Map<string, number>()
    for (const m of membresRes.data ?? []) countMap.set(m.groupe_id, (countMap.get(m.groupe_id) ?? 0) + 1)
    return (groupesRes.data ?? []).map((g: Record<string, unknown>) => ({
      ...g, projet: (g.projet as { id: string; nom: string } | null) ?? null,
      membres_count: countMap.get(g.id as string) ?? 0,
    })) as (ChatGroupe & { membres_count: number })[]
  }

  async function fetchAllUsers(): Promise<{ id: string; prenom: string; nom: string; role: string }[]> {
    const { data } = await supabase.schema('app').from('utilisateurs').select('id, prenom, nom, role').eq('actif', true).order('prenom')
    return data ?? []
  }

  async function fetchAllProjets(): Promise<{ id: string; nom: string; reference: string | null }[]> {
    const { data } = await supabase.schema('app').from('projets').select('id, nom, reference').order('nom')
    return data ?? []
  }

  return {
    fetchMesGroupes, fetchMessages, fetchGroupeMembers, sendMessage, sendDocument,
    markLu, fetchUnreadTotal, createGroupe, archiverGroupe, fetchTousGroupes,
    fetchAllUsers, fetchAllProjets,
  }
}
