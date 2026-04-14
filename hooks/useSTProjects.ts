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

export type STDceInvitation = {
  id: string
  token: string
  lot_id: string
  projet_id: string
  statut: 'envoye' | 'ouvert' | 'en_cours' | 'soumis' | 'retenu' | 'refuse'
  date_limite: string | null
  created_at: string
  lot_nom: string | null
  projet_nom: string | null
  projet_reference: string | null
}

export function useSTProjects(userId: string | null) {
  const supabase = createClient()
  const [lots, setLots]                 = useState<STLot[]>([])
  const [alertes, setAlertes]           = useState<STAlerte[]>([])
  const [dceInvitations, setDceInvits]  = useState<STDceInvitation[]>([])
  const [loading, setLoading]           = useState(true)

  const fetchAll = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    const [{ data: lotsData }, { data: alertesData }, { data: dceData }] = await Promise.all([
      supabase.schema('app').from('lots')
        .select('id, projet_id, corps_etat, notice_technique, statut, numero, remarque, projets(id, nom, reference, adresse, statut, co_id)')
        .eq('st_retenu_id', userId),
      supabase.schema('app').from('alertes')
        .select('id, projet_id, type, titre, message, lue, created_at')
        .eq('utilisateur_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('dce_acces_st')
        .select('id, token, lot_id, projet_id, statut, date_limite, created_at')
        .eq('user_id', userId)
        .in('statut', ['envoye', 'ouvert', 'en_cours', 'soumis', 'retenu', 'refuse'])
        .order('created_at', { ascending: false }),
    ])

    setLots((lotsData ?? []).map((l: any) => ({ ...l, projet: l.projets })) as STLot[])
    setAlertes(
      ((alertesData ?? []) as any[]).map((a): STAlerte => ({
        id: a.id,
        projet_id: a.projet_id,
        type: a.type,
        message: a.titre ? (a.titre + (a.message ? ' — ' + a.message : '')) : (a.message ?? ''),
        lu: !!a.lue,
        created_at: a.created_at,
      })),
    )

    // Enrichir les invitations DCE avec nom du lot et du projet (2 requetes groupees).
    const rawInvits = (dceData ?? []) as Array<{
      id: string; token: string; lot_id: string; projet_id: string
      statut: STDceInvitation['statut']; date_limite: string | null; created_at: string
    }>
    if (rawInvits.length === 0) {
      setDceInvits([])
    } else {
      const lotIds = Array.from(new Set(rawInvits.map((r) => r.lot_id)))
      const projIds = Array.from(new Set(rawInvits.map((r) => r.projet_id)))
      const [{ data: lotsInfo }, { data: projsInfo }] = await Promise.all([
        supabase.from('lots').select('id, nom').in('id', lotIds),
        supabase.schema('app').from('projets').select('id, nom, reference').in('id', projIds),
      ])
      const lotMap = new Map((lotsInfo ?? []).map((l: any) => [l.id, l.nom as string]))
      const projMap = new Map((projsInfo ?? []).map((p: any) => [p.id, { nom: p.nom as string, reference: p.reference as string | null }]))
      setDceInvits(
        rawInvits.map((r) => ({
          ...r,
          lot_nom: lotMap.get(r.lot_id) ?? null,
          projet_nom: projMap.get(r.projet_id)?.nom ?? null,
          projet_reference: projMap.get(r.projet_id)?.reference ?? null,
        })),
      )
    }
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
    await supabase.schema('app').from('alertes').update({ lue: true }).eq('id', id)
    setAlertes(prev => prev.map(a => a.id === id ? { ...a, lu: true } : a))
  }

  async function markAllRead(stId: string) {
    await supabase.schema('app').from('alertes').update({ lue: true }).eq('utilisateur_id', stId).eq('lue', false)
    setAlertes(prev => prev.map(a => ({ ...a, lu: true })))
  }

  const unreadCount = alertes.filter(a => !a.lu).length

  return { lots, alertes, dceInvitations, loading, unreadCount, fetchAll, fetchLotDetail, markAlerteRead, markAllRead }
}
