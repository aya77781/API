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

export type STAtValidation = {
  id: string
  kbis_ok: boolean | null
  kbis_date: string | null
  urssaf_ok: boolean | null
  urssaf_date: string | null
  rib_ok: boolean | null
  rc_ok: boolean | null
  rc_validite: string | null
  decennale_ok: boolean | null
  decennale_validite: string | null
  attestation_ca_ok: boolean | null
  fiscalite_ok: boolean | null
  salaries_etrangers_ok: boolean | null
  statut: string | null
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

    const [{ data: accesRetenus }, { data: alertesData }, { data: dceData }] = await Promise.all([
      // Lots ou le ST a ete retenu : on lit l'acces DCE (source de verite ST-projet)
      supabase.from('dce_acces_st')
        .select('lot_id, projet_id, statut')
        .eq('user_id', userId)
        .eq('statut', 'retenu'),
      supabase.schema('app').from('alertes')
        .select('id, projet_id, type, titre, message, lue, created_at')
        .eq('utilisateur_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('dce_acces_st')
        .select('id, token, lot_id, projet_id, statut, date_limite, created_at')
        .eq('user_id', userId)
        // Les statuts terminaux (retenu/refuse) ne doivent plus apparaitre dans "Offres a deposer"
        .in('statut', ['envoye', 'ouvert', 'en_cours', 'soumis'])
        .order('created_at', { ascending: false }),
    ])

    /* Resoud les lots et projets pour la vue ST */
    const retenusRows = ((accesRetenus ?? []) as Array<{ lot_id: string | null; projet_id: string; statut: string }>)
      .filter((r) => r.lot_id)
    if (retenusRows.length === 0) {
      setLots([])
    } else {
      const lotIds   = Array.from(new Set(retenusRows.map((r) => r.lot_id!)))
      const projIds  = Array.from(new Set(retenusRows.map((r) => r.projet_id)))
      const [{ data: lotsInfo }, { data: projsInfo }] = await Promise.all([
        supabase.from('lots').select('id, projet_id, nom, ordre').in('id', lotIds),
        supabase.schema('app').from('projets').select('id, nom, reference, adresse, statut, co_id').in('id', projIds),
      ])
      const projMap = new Map((projsInfo ?? []).map((p: any) => [p.id, p]))
      const lotsData = (lotsInfo ?? []).map((l: any): STLot => ({
        id:               l.id,
        projet_id:        l.projet_id,
        corps_etat:       l.nom ?? '',
        notice_technique: null,
        statut:           'retenu',
        numero:           l.ordre ?? 0,
        remarque:         null,
        projet:           projMap.get(l.projet_id) ?? {
          id: l.projet_id, nom: '', reference: null, adresse: null, statut: '', co_id: null,
        },
      }))
      setLots(lotsData)
    }
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
    /* Resoud le ST AT pour ce user sur ce projet (avec ses flags de validation) */
    const { data: acces } = await supabase
      .from('dce_acces_st')
      .select('id')
      .eq('user_id', userId ?? '')
      .eq('projet_id', projetId)
    const accesIds = ((acces ?? []) as Array<{ id: string }>).map((a) => a.id)
    let atStId = ''
    let atSt: STAtValidation | null = null
    if (accesIds.length > 0) {
      const { data: stRow } = await supabase
        .schema('app').from('at_sous_traitants')
        .select('id, kbis_ok, kbis_date, urssaf_ok, urssaf_date, rib_ok, rc_ok, rc_validite, decennale_ok, decennale_validite, attestation_ca_ok, fiscalite_ok, salaries_etrangers_ok, statut')
        .in('dce_acces_id', accesIds)
        .maybeSingle()
      if (stRow) {
        atSt = stRow as unknown as STAtValidation
        atStId = atSt.id
      }
    }

    const [
      { data: lot },
      { data: projet },
      { data: reserves },
      { data: documentsGlobal },
      { data: crs },
    ] = await Promise.all([
      supabase.from('lots').select('*').eq('id', lotId).single(),
      supabase.schema('app').from('projets').select('id, nom, reference, adresse, statut, co_id, client_nom, date_debut, date_livraison').eq('id', projetId).maybeSingle(),
      atStId
        ? supabase.schema('app').from('reserves').select('*').eq('lot_id', lotId).eq('st_id', atStId)
        : Promise.resolve({ data: [] as any[] }),
      atStId
        ? supabase.schema('app').from('documents_st')
            .select('id, st_id, projet_id, lot_id, type_document, nom_fichier, fichier_url, date_validite, date_depot, version, statut, commentaire_co')
            .eq('st_id', atStId)
            .order('date_depot', { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      /* CRs accessibles au ST : tout sauf les brouillons en cours de redaction */
      supabase.schema('app').from('comptes_rendus').select('id, numero, type, date_reunion, statut, prochaine_reunion, pdf_url, contenu').eq('projet_id', projetId).neq('statut', 'brouillon').order('date_reunion', { ascending: false }).limit(20),
    ])

    /* Map des documents_st (schema global ST) vers le shape STDocument utilise par la UI */
    const documents: STDocument[] = ((documentsGlobal ?? []) as Array<{
      id: string; st_id: string; projet_id: string | null; lot_id: string | null;
      type_document: string; nom_fichier: string | null; fichier_url: string;
      date_validite: string | null; date_depot: string; version: number | null;
      statut: string; commentaire_co: string | null;
    }>).map((d) => ({
      id:              d.id,
      projet_id:       d.projet_id ?? projetId,
      lot_id:          d.lot_id,
      type:            d.type_document,
      nom_fichier:     d.nom_fichier ?? (d.fichier_url ? d.fichier_url.split('/').pop() ?? '' : ''),
      url:             d.fichier_url,
      date_expiration: d.date_validite,
      version:         d.version ?? 1,
      statut:          d.statut,
      commentaire_co:  d.commentaire_co,
      created_at:      d.date_depot,
    }))

    const lotEnriched = lot ? { ...(lot as any), projets: projet } : null
    return { lot: lotEnriched, atSt, reserves: (reserves ?? []) as STReserve[], documents, crs: crs ?? [] }
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
