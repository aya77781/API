'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useChatBadge(userId: string | null) {
  const supabase = createClient()
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchCount = useCallback(async () => {
    if (!userId) { setUnreadCount(0); return }

    const { data: memberships } = await supabase
      .schema('app').from('chat_membres').select('groupe_id').eq('utilisateur_id', userId)

    if (!memberships?.length) { setUnreadCount(0); return }
    const ids = memberships.map((m: { groupe_id: string }) => m.groupe_id)

    const [msgRes, lecRes] = await Promise.all([
      supabase.schema('app').from('chat_messages')
        .select('groupe_id, auteur_id, created_at')
        .in('groupe_id', ids).eq('supprime', false).neq('auteur_id', userId),
      supabase.schema('app').from('chat_lectures')
        .select('groupe_id, lu_le').eq('utilisateur_id', userId),
    ])

    const lectureMap = new Map((lecRes.data ?? []).map((l: { groupe_id: string; lu_le: string | null }) => [l.groupe_id, l.lu_le]))
    setUnreadCount((msgRes.data ?? []).filter((m: { groupe_id: string; created_at: string }) => {
      const luLe = lectureMap.get(m.groupe_id) as string | undefined
      return !luLe || new Date(m.created_at) > new Date(luLe)
    }).length)
  }, [userId])

  useEffect(() => {
    fetchCount()
    if (!userId) return
    const channel = supabase
      .channel(`chat_badge_${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'app', table: 'chat_messages' }, () => fetchCount())
      .on('postgres_changes', { event: 'UPDATE', schema: 'app', table: 'chat_lectures', filter: `utilisateur_id=eq.${userId}` }, () => fetchCount())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchCount])

  return { unreadCount }
}
