'use client'

import { useCallback, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SousTraitant, ConsultationST } from '@/types/database'

/* ── Types ─────────────────────────────────────────────────── */

export interface SearchSTParams {
  lot_type?: string
  ville?: string
  departement?: string
  statut?: SousTraitant['statut']
  agrement?: SousTraitant['agrement']
  min_note?: number
}

export interface STAvecStats extends SousTraitant {
  nb_chantiers_realises: number
  note_moyenne: number | null
  derniere_evaluation: string | null // ISO date
}

export interface ConsultationAvecST extends ConsultationST {
  sous_traitant: Pick<SousTraitant, 'id' | 'raison_sociale' | 'contact_nom' | 'contact_email' | 'email' | 'telephone'> | null
}

type StatutConsultation = ConsultationST['statut']

/* ── Hook ──────────────────────────────────────────────────── */

export function useAchats() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function clearError() { setError(null) }

  /** Wrap async operations with loading/error */
  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setLoading(true)
    setError(null)
    try {
      const result = await fn()
      return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(msg)
      console.error('[useAchats]', msg)
      return null
    } finally {
      setLoading(false)
    }
  }

  /* ── searchSTs ── */

  const searchSTs = useCallback(async (params: SearchSTParams): Promise<STAvecStats[]> => {
    const { lot_type, ville, departement, statut, agrement, min_note } = params

    // 1. Query sous_traitants with filters
    let query = supabase.schema('app').from('sous_traitants')
      .select('*')
      .eq('statut', statut ?? 'actif')

    if (lot_type) {
      query = query.contains('specialites', [lot_type])
    }
    if (ville) {
      query = query.ilike('ville', `%${ville}%`)
    }
    if (departement) {
      query = query.eq('departement', departement)
    }
    if (agrement) {
      query = query.eq('agrement', agrement)
    }

    query = query.order('raison_sociale')

    const { data: sts, error: stError } = await query
    if (stError) throw new Error(stError.message)
    if (!sts?.length) return []

    // 2. Fetch all evaluations for these STs in one query
    const stIds = sts.map(s => s.id)
    const { data: evals } = await supabase.schema('app').from('evaluations_st')
      .select('st_id, note_globale, created_at')
      .in('st_id', stIds)
      .order('created_at', { ascending: false })

    // 3. Build stats per ST
    const evalsByStId = new Map<string, { notes: number[]; derniere: string | null }>()
    for (const e of evals ?? []) {
      if (!evalsByStId.has(e.st_id)) {
        evalsByStId.set(e.st_id, { notes: [], derniere: e.created_at })
      }
      evalsByStId.get(e.st_id)!.notes.push(Number(e.note_globale))
    }

    // 4. Merge and sort
    let results: STAvecStats[] = sts.map(st => {
      const stats = evalsByStId.get(st.id)
      const noteMoyenne = stats?.notes.length
        ? Math.round((stats.notes.reduce((a, b) => a + b, 0) / stats.notes.length) * 10) / 10
        : null
      return {
        ...st,
        nb_chantiers_realises: stats?.notes.length ?? 0,
        note_moyenne: noteMoyenne,
        derniere_evaluation: stats?.derniere ?? null,
      } as STAvecStats
    })

    // Filter by min_note
    if (min_note != null) {
      results = results.filter(st => st.note_moyenne != null && st.note_moyenne >= min_note)
    }

    // Sort by note_moyenne descending (nulls last)
    results.sort((a, b) => {
      if (a.note_moyenne == null && b.note_moyenne == null) return 0
      if (a.note_moyenne == null) return 1
      if (b.note_moyenne == null) return -1
      return b.note_moyenne - a.note_moyenne
    })

    return results
  }, [supabase])

  /* ── getConsultations ── */

  const getConsultations = useCallback(async (
    projetId: string,
    lotId: string,
  ): Promise<ConsultationAvecST[]> => {
    const { data, error: fetchErr } = await supabase.schema('app').from('consultations_st')
      .select('*')
      .eq('projet_id', projetId)
      .eq('lot_id', lotId)
      .order('created_at', { ascending: false })

    if (fetchErr) throw new Error(fetchErr.message)
    if (!data?.length) return []

    // Fetch ST info
    const stIds = Array.from(new Set(data.map(c => c.st_id)))
    const { data: sts } = await supabase.schema('app').from('sous_traitants')
      .select('id, raison_sociale, contact_nom, contact_email, email, telephone')
      .in('id', stIds)

    const stMap = new Map((sts ?? []).map(s => [s.id, s]))

    return data.map(c => ({
      ...c,
      sous_traitant: stMap.get(c.st_id) ?? null,
    })) as ConsultationAvecST[]
  }, [supabase])

  /* ── addConsultation ── */

  const addConsultation = useCallback(async (
    projetId: string,
    lotId: string,
    stId: string,
  ): Promise<ConsultationST | null> => {
    return run(async () => {
      const { data, error: insertErr } = await supabase.schema('app').from('consultations_st')
        .insert({
          projet_id: projetId,
          lot_id: lotId,
          st_id: stId,
          statut: 'a_contacter',
          attribue: false,
        })
        .select()
        .single()

      if (insertErr) throw new Error(insertErr.message)
      return data as ConsultationST
    })
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── updateStatutConsultation ── */

  const updateStatutConsultation = useCallback(async (
    id: string,
    statut: StatutConsultation,
    data?: Partial<Pick<ConsultationST,
      'note_contact' | 'montant_devis' | 'delai_propose' | 'note_negociation' | 'score_ia' | 'devis_recu_at'
    >>,
  ): Promise<boolean> => {
    const result = await run(async () => {
      const { error: updateErr } = await supabase.schema('app').from('consultations_st')
        .update({ statut, ...data })
        .eq('id', id)

      if (updateErr) throw new Error(updateErr.message)
      return true
    })
    return result ?? false
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── demanderDevis ── */

  const demanderDevis = useCallback(async (
    consultationId: string,
  ): Promise<boolean> => {
    const result = await run(async () => {
      // 1. Fetch the consultation to get ST + lot info
      const { data: consult, error: fetchErr } = await supabase.schema('app').from('consultations_st')
        .select('id, projet_id, lot_id, st_id')
        .eq('id', consultationId)
        .single()

      if (fetchErr || !consult) throw new Error(fetchErr?.message ?? 'Consultation introuvable')

      // 2. Call API to send the devis request
      const res = await fetch('/api/co/demande-devis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultation_id: consult.id,
          projet_id: consult.projet_id,
          lot_id: consult.lot_id,
          st_id: consult.st_id,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Erreur lors de l\'envoi de la demande de devis')
      }

      // 3. Update consultation status + timestamp
      const { error: updateErr } = await supabase.schema('app').from('consultations_st')
        .update({
          statut: 'devis_demande',
          email_envoye_at: new Date().toISOString(),
        })
        .eq('id', consultationId)

      if (updateErr) throw new Error(updateErr.message)
      return true
    })
    return result ?? false
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── attribuerLot ── */

  const attribuerLot = useCallback(async (
    consultationId: string,
  ): Promise<boolean> => {
    const result = await run(async () => {
      // 1. Fetch the consultation
      const { data: consult, error: fetchErr } = await supabase.schema('app').from('consultations_st')
        .select('id, lot_id, st_id')
        .eq('id', consultationId)
        .single()

      if (fetchErr || !consult) throw new Error(fetchErr?.message ?? 'Consultation introuvable')

      // 2. Set this consultation as attribue
      const { error: updateErr } = await supabase.schema('app').from('consultations_st')
        .update({ statut: 'attribue', attribue: true })
        .eq('id', consultationId)

      if (updateErr) throw new Error(updateErr.message)

      // 3. Refuse all other consultations for the same lot
      const { error: refuseErr } = await supabase.schema('app').from('consultations_st')
        .update({ statut: 'refuse', attribue: false })
        .eq('lot_id', consult.lot_id)
        .neq('id', consultationId)

      if (refuseErr) throw new Error(refuseErr.message)

      // 4. Update the lot with the retained ST
      const { error: lotErr } = await supabase.schema('app').from('lots')
        .update({ st_retenu_id: consult.st_id, statut: 'retenu' })
        .eq('id', consult.lot_id)

      if (lotErr) throw new Error(lotErr.message)

      return true
    })
    return result ?? false
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── calcScoreIA ── */

  const calcScoreIA = useCallback(async (
    montantDevis: number,
    delaiPropose: number,
    lotId: string,
  ): Promise<number | null> => {
    if (montantDevis <= 0 || delaiPropose <= 0) return null

    // 1. Get lot budget_prevu as price reference
    const { data: lot } = await supabase.schema('app').from('lots')
      .select('budget_prevu, projet_id')
      .eq('id', lotId)
      .single()

    const prixRef = lot?.budget_prevu

    // 2. Get active chiffrage for a more accurate reference if available
    let montantRef = prixRef
    if (lot?.projet_id && !montantRef) {
      const { data: chiffrage } = await supabase.schema('app').from('chiffrage_versions')
        .select('montant_total')
        .eq('projet_id', lot.projet_id)
        .eq('statut', 'actif')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()

      montantRef = chiffrage?.montant_total ?? null
    }

    if (!montantRef || montantRef <= 0) return null

    // 3. Get average delay from other consultations on the same lot as reference
    const { data: otherConsults } = await supabase.schema('app').from('consultations_st')
      .select('delai_propose')
      .eq('lot_id', lotId)
      .not('delai_propose', 'is', null)

    const delais = (otherConsults ?? [])
      .map(c => c.delai_propose as number)
      .filter(d => d > 0)

    // If no other delays, use the proposed delay as reference (score = neutral)
    const delaiRef = delais.length > 0
      ? delais.reduce((a, b) => a + b, 0) / delais.length
      : delaiPropose

    // 4. Calculate score: lower price and shorter delay = higher score
    const scorePrix = Math.min(montantRef / montantDevis, 2) // cap at 2x
    const scoreDelai = delaiRef > 0 ? Math.min(delaiRef / delaiPropose, 2) : 1

    const raw = scorePrix * 0.6 + scoreDelai * 0.4
    // Normalize: raw=1 means exactly at reference → score ~70
    // raw>1 means better than reference, raw<1 means worse
    const score = Math.round(Math.min(Math.max(raw * 70, 0), 100))

    return score
  }, [supabase])

  return {
    loading,
    error,
    clearError,
    searchSTs,
    getConsultations,
    addConsultation,
    updateStatutConsultation,
    demanderDevis,
    attribuerLot,
    calcScoreIA,
  }
}
