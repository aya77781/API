'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useDocumentsBadge(userId: string | null) {
  const supabase = createClient()
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchCount = useCallback(async () => {
    if (!userId) return
    const { count } = await supabase
      .schema('app')
      .from('notifs_documents')
      .select('id', { count: 'exact', head: true })
      .eq('destinataire_id', userId)
      .eq('lu', false)
    setUnreadCount(count ?? 0)
  }, [userId])

  useEffect(() => {
    fetchCount()
    if (!userId) return

    const channel = supabase
      .channel(`docs_badge_${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'app', table: 'notifs_documents', filter: `destinataire_id=eq.${userId}` },
        () => fetchCount()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'app', table: 'notifs_documents', filter: `destinataire_id=eq.${userId}` },
        () => fetchCount()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchCount])

  return { unreadCount }
}
