'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useTachesBadge(userId: string | null, userRole: string | null) {
  const supabase = createClient()
  const [count, setCount] = useState(0)

  const fetchCount = useCallback(async () => {
    if (!userId || !userRole) { setCount(0); return }
    const { count: c } = await supabase.schema('app').from('taches')
      .select('id', { count: 'exact', head: true })
      .or(`assignee_a.eq.${userId},tags_utilisateurs.cs.{${userId}},tags_roles.cs.{${userRole}},tag_tous.eq.true`)
      .neq('statut', 'fait')
      .neq('creee_par', userId)
    setCount(c ?? 0)
  }, [userId, userRole])

  useEffect(() => {
    fetchCount()
    if (!userId) return
    const channel = supabase
      .channel(`taches_badge_${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'app', table: 'taches' }, () => fetchCount())
      .on('postgres_changes', { event: 'UPDATE', schema: 'app', table: 'taches' }, () => fetchCount())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, userRole, fetchCount])

  return { count }
}
