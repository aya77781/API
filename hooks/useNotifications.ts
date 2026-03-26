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

export interface Alerte {
  id: string
  projet_id: string | null
  utilisateur_id: string | null
  type: string
  titre: string
  message: string | null
  priorite: 'low' | 'normal' | 'high' | 'urgent'
  lue: boolean
  created_at: string
}

export function useNotifications(userId: string | null) {
  const supabase = createClient()
  const [notifs, setNotifs]       = useState<NotifDocument[]>([])
  const [alertes, setAlertes]     = useState<Alerte[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading]     = useState(true)

  const fetchNotifs = useCallback(async () => {
    if (!userId) { setLoading(false); return }

    const [notifsRes, alertesRes] = await Promise.all([
      supabase
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
        .limit(30),

      supabase
        .schema('app')
        .from('alertes')
        .select('*')
        .eq('utilisateur_id', userId)
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    const notifList  = (notifsRes.data ?? []) as NotifDocument[]
    const alerteList = (alertesRes.data ?? []) as Alerte[]

    setNotifs(notifList)
    setAlertes(alerteList)
    setUnreadCount(
      notifList.filter(n => !n.lu).length +
      alerteList.filter(a => !a.lue).length
    )
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchNotifs()
    if (!userId) return

    const channel = supabase
      .channel(`notifs_all_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'app', table: 'notifs_documents',
        filter: `destinataire_id=eq.${userId}`,
      }, () => fetchNotifs())
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'app', table: 'notifs_documents',
        filter: `destinataire_id=eq.${userId}`,
      }, () => fetchNotifs())
      .on('postgres_changes', {
        event: 'INSERT', schema: 'app', table: 'alertes',
        filter: `utilisateur_id=eq.${userId}`,
      }, () => fetchNotifs())
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'app', table: 'alertes',
        filter: `utilisateur_id=eq.${userId}`,
      }, () => fetchNotifs())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchNotifs])

  async function markAllLu() {
    if (!userId) return
    await Promise.all([
      supabase.schema('app').from('notifs_documents')
        .update({ lu: true, lu_le: new Date().toISOString() })
        .eq('destinataire_id', userId).eq('lu', false),
      supabase.schema('app').from('alertes')
        .update({ lue: true })
        .eq('utilisateur_id', userId).eq('lue', false),
    ])
    fetchNotifs()
  }

  async function markOneLu(notifId: string) {
    await supabase.schema('app').from('notifs_documents')
      .update({ lu: true, lu_le: new Date().toISOString() })
      .eq('id', notifId)
    setNotifs(prev => prev.map(n => n.id === notifId ? { ...n, lu: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  async function markAlerteRead(alerteId: string) {
    await supabase.schema('app').from('alertes')
      .update({ lue: true }).eq('id', alerteId)
    setAlertes(prev => prev.map(a => a.id === alerteId ? { ...a, lue: true } : a))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  return { notifs, alertes, unreadCount, loading, markAllLu, markOneLu, markAlerteRead, refetch: fetchNotifs }
}
