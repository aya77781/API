'use client'

import { createClient } from '@/lib/supabase/client'
import type { Projet } from '@/types/database'

export async function fetchMyProjets(userId: string): Promise<Projet[]> {
  const supabase = createClient()

  // 1. Projects where the user is directly assigned (known columns)
  const { data: directProjets } = await supabase
    .schema('app')
    .from('projets')
    .select('*')
    .or(`co_id.eq.${userId},economiste_id.eq.${userId},commercial_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  const directIds = new Set((directProjets ?? []).map((p: Projet) => p.id))

  // 2. Projects via chat group membership (covers dessinatrice_id + extra_membres
  //    stored in remarque, plus any future tagging done through the chat system)
  const { data: memberships } = await supabase
    .schema('app')
    .from('chat_membres')
    .select('groupe_id')
    .eq('utilisateur_id', userId)

  let chatProjets: Projet[] = []

  if (memberships?.length) {
    const groupeIds = memberships.map((m: { groupe_id: string }) => m.groupe_id)

    const { data: groupes } = await supabase
      .schema('app')
      .from('chat_groupes')
      .select('projet_id')
      .in('id', groupeIds)
      .eq('type', 'projet')
      .not('projet_id', 'is', null)

    if (groupes?.length) {
      const projetIds = [...new Set(groupes.map((g: { projet_id: string }) => g.projet_id))]
        .filter(id => !directIds.has(id)) // exclude already fetched

      if (projetIds.length) {
        const { data } = await supabase
          .schema('app')
          .from('projets')
          .select('*')
          .in('id', projetIds)
          .order('created_at', { ascending: false })

        chatProjets = (data ?? []) as Projet[]
      }
    }
  }

  // Merge and sort by created_at desc
  const all = [...(directProjets ?? []) as Projet[], ...chatProjets]
  all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return all
}
