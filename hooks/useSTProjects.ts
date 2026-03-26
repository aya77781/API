'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export type STLot = {
  id: string
  projet_id: string
  corps_etat: string
  notice_technique: string | null
  statut: string
  numero: number
  remarque: string | null
  projet: {
    id: string
    nom: string
    reference: string | null
    adresse: string | null
    statut: string
    co_id: string | null
  }
}

export type STReserve = {
  id: string
  projet_id: string
  lot_id: string | null
  description: string
  localisation: string | null
  photo_signalement_url: string | null
  photo_levee_url: string | null
  statut: string
  date_echeance: string | null
  date_signalement: string
}

export type STAlerte = {
  id: string
  projet_id: string | null
  type: string
  message: string
  lu: boolean
  created_at: string
}

export type STDocument = {
  id: string
  projet_id: string
  lot_id: string | null
  type: string
  nom_fichier: string
  url: string
  date_expiration: string | null
  version: number
  statut: string
  commentaire_co: string | null
  created_at: string
}

export function useSTProjects(userId: string | null) {
  const supabase = createClient()
  const [lots, setLots]         = useState<STLot[]>([])
  const [alertes, setAlertes]   = useState<STAlerte[]>([])
  const [loading, setLoading]   = useState(true)

  const fetchAll = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    const [{ data: lotsData }, { data: alertesData }] = await Promise.all([
      supabase.schema('app').from('lots')
        .select('id, projet_id, corps_etat, notice_technique, statut, numero, remarque, projets(id, nom, reference, adresse, statut, co_id)')
        .eq('st_retenu_id', userId),
      supabase.schema('app').from('st_alertes')
        .select('*').eq('st_id', userId).order('created_at', { ascending: false }).limit(50),
    ])

    setLots((lotsData ?? []).map((l: any) => ({ ...l, projet: l.projets })) as STLot[])
    setAlertes((alertesData ?? []) as STAlerte[])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function fetchLotDetail(lotId: string, projetId: string) {
    const [
      { data: lot },
      { data: reserves },
      { data: documents },
      { data: crs },
    ] = await Promise.all([
      supabase.schema('app').from('lots').select('*, projets(id, nom, reference, adresse, statut, co_id, client_nom, date_debut, date_livraison)').eq('id', lotId).single(),
      supabase.schema('app').from('reserves').select('*').eq('lot_id', lotId).eq('st_id', userId ?? ''),
      supabase.schema('app').from('st_documents').select('*').eq('lot_id', lotId).eq('st_id', userId ?? '').order('created_at', { ascending: false }),
      supabase.schema('app').from('comptes_rendus').select('id, numero, type, date_reunion, statut, prochaine_reunion').eq('projet_id', projetId).eq('statut', 'envoye').order('date_reunion', { ascending: false }).limit(10),
    ])

    return { lot, reserves: (reserves ?? []) as STReserve[], documents: (documents ?? []) as STDocument[], crs: crs ?? [] }
  }

  async function markAlerteRead(id: string) {
    await supabase.schema('app').from('st_alertes').update({ lu: true }).eq('id', id)
    setAlertes(prev => prev.map(a => a.id === id ? { ...a, lu: true } : a))
  }

  async function markAllRead(stId: string) {
    await supabase.schema('app').from('st_alertes').update({ lu: true }).eq('st_id', stId).eq('lu', false)
    setAlertes(prev => prev.map(a => ({ ...a, lu: true })))
  }

  const unreadCount = alertes.filter(a => !a.lu).length

  return { lots, alertes, loading, unreadCount, fetchAll, fetchLotDetail, markAlerteRead, markAllRead }
}
