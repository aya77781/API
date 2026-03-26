'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface NotifDocument {
  id: string
  document_id: string
  projet_id: string
  destinataire_id: string
  destinataire_role: string | null
  lu: boolean
  lu_le: string | null
  created_at: string
  document: {
    nom_fichier: string
    type_doc: string
    dossier_ged: string
    storage_path: string
    message_depot: string | null
    uploaded_by: string | null
    uploadeur: { prenom: string; nom: string; role: string } | null
  } | null
  projet: { id: string; nom: string } | null
}

export function useNotifications(userId: string | null) {
  const supabase = createClient()
  const [notifs, setNotifs] = useState<NotifDocument[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchNotifs = useCallback(async () => {
    if (!userId) { setLoading(false); return }

    const { data } = await supabase
      .schema('app')
      .from('notifs_documents')
      .select(`
        *,
        document:documents(
          nom_fichier, type_doc, dossier_ged, storage_path, message_depot, uploaded_by,
          uploadeur:utilisateurs!uploaded_by(prenom, nom, role)
        ),
        projet:projets(id, nom)
      `)
      .eq('destinataire_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)

    const list = (data ?? []) as NotifDocument[]
    setNotifs(list)
    setUnreadCount(list.filter(n => !n.lu).length)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchNotifs()

    if (!userId) return

    const channel = supabase
      .channel(`notifs_docs_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'app',
          table: 'notifs_documents',
          filter: `destinataire_id=eq.${userId}`,
        },
        () => fetchNotifs()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchNotifs])

  async function markAllLu() {
    if (!userId) return
    await supabase
      .schema('app')
      .from('notifs_documents')
      .update({ lu: true, lu_le: new Date().toISOString() })
      .eq('destinataire_id', userId)
      .eq('lu', false)
    fetchNotifs()
  }

  async function markOneLu(notifId: string) {
    await supabase
      .schema('app')
      .from('notifs_documents')
      .update({ lu: true, lu_le: new Date().toISOString() })
      .eq('id', notifId)
    setNotifs(prev => prev.map(n => n.id === notifId ? { ...n, lu: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  return { notifs, unreadCount, loading, markAllLu, markOneLu, refetch: fetchNotifs }
}
