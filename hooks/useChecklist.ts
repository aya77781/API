'use client'

import { useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/* ── Types ─────────────────────────────────────────────────── */

export type PointStatut = 'ok' | 'a_surveiller' | 'probleme' | 'non_verifie'

export interface ChecklistPoint {
  id: string
  label: string
  statut: PointStatut
  note: string
  photos: string[]   // storage paths
  custom: boolean     // user-added point
}

export interface LotChecklist {
  lotId: string
  lotNumero: number
  lotCorpsEtat: string
  points: ChecklistPoint[]
}

export interface ChecklistData {
  lots: LotChecklist[]
}

export interface Lot {
  id: string
  numero: number
  corps_etat: string
  statut: string
}

/* ── Default points per corps d'état ── */

const DEFAULT_POINTS: Record<string, string[]> = {
  'Gros œuvre': [
    'État des fondations / radier',
    'Alignement et aplomb des murs',
    'Qualité du béton (fissures, nid de cailloux)',
    'Réservations (gaines, passages)',
    'Étanchéité en pied de mur',
  ],
  'Plomberie': [
    'Étanchéité des réseaux EU/EV',
    'Repérage et isolation des canalisations',
    'Pression des réseaux (essai)',
    'Évacuations et pentes',
    'Raccordements sanitaires',
  ],
  'Électricité': [
    'Conformité du tableau électrique',
    'Passage des gaines et chemin de câble',
    'Mise à la terre',
    'Appareillage (prises, interrupteurs)',
    'Éclairage (type, positionnement)',
  ],
  'CVC': [
    'Pose des unités intérieures/extérieures',
    'Réseau de gaines aérauliques',
    'Isolation des réseaux',
    'Raccordement et mise en service',
    'Régulation et thermostat',
  ],
  'Menuiserie': [
    'Pose des huisseries',
    'Alignement et jeu des ouvrants',
    'Quincaillerie et serrurerie',
    'Vitrage (type, épaisseur)',
    'Joints et étanchéité',
  ],
  'Peinture': [
    'Préparation des supports',
    'Nombre de couches appliquées',
    'Teintes conformes au choix client',
    'Uniformité et finition',
    'Protection des ouvrages adjacents',
  ],
  'Revêtement de sol': [
    'Planéité du support',
    'Pose (alignement, joints)',
    'Découpes (plinthes, seuils)',
    'Propreté de finition',
    'Protection des sols posés',
  ],
}

function getDefaultPoints(corpsEtat: string): string[] {
  // Try exact match first, then partial match
  const exact = DEFAULT_POINTS[corpsEtat]
  if (exact) return exact

  const lower = corpsEtat.toLowerCase()
  for (const [key, points] of Object.entries(DEFAULT_POINTS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return points
    }
  }

  // Generic fallback
  return [
    'Conformité à la commande / plans',
    'Qualité de mise en œuvre',
    'Propreté du poste de travail',
    'Respect des délais',
    'Sécurité (EPI, balisage)',
  ]
}

function makePointId(): string {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function buildInitialPoints(corpsEtat: string): ChecklistPoint[] {
  return getDefaultPoints(corpsEtat).map(label => ({
    id: makePointId(),
    label,
    statut: 'non_verifie',
    note: '',
    photos: [],
    custom: false,
  }))
}

export function createCustomPoint(label: string): ChecklistPoint {
  return {
    id: makePointId(),
    label,
    statut: 'non_verifie',
    note: '',
    photos: [],
    custom: true,
  }
}

/* ── Hook ──────────────────────────────────────────────────── */

export function useChecklist() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  /** Fetch templates from DB, with hardcoded fallback */
  const fetchTemplatePoints = useCallback(async (
    corpsEtat: string,
    type: 'terrain' | 'opr' | 'gpa' = 'terrain',
  ): Promise<ChecklistPoint[]> => {
    const { data } = await supabase.schema('app').from('checklists_templates')
      .select('points')
      .eq('lot_type', corpsEtat)
      .eq('type', type)
      .maybeSingle()

    if (data?.points && Array.isArray(data.points) && data.points.length > 0) {
      return (data.points as { id: string; label: string; ordre: number }[])
        .sort((a, b) => a.ordre - b.ordre)
        .map(p => ({
          id: p.id,
          label: p.label,
          statut: 'non_verifie' as PointStatut,
          note: '',
          photos: [],
          custom: false,
        }))
    }

    // Fallback to hardcoded defaults
    return buildInitialPoints(corpsEtat)
  }, [supabase])

  /** Fetch lots for a project */
  const fetchLots = useCallback(async (projetId: string): Promise<Lot[]> => {
    const { data, error } = await supabase.schema('app').from('lots')
      .select('id, numero, corps_etat, statut')
      .eq('projet_id', projetId)
      .order('numero')
    if (error) { console.error('fetchLots:', error); return [] }
    return data ?? []
  }, [supabase])

  /** Save checklist to DB (upsert) */
  const saveChecklist = useCallback(async (
    projetId: string,
    coId: string,
    checklistData: ChecklistData,
    existingId?: string,
  ): Promise<string | null> => {
    const row = {
      projet_id: projetId,
      type: 'terrain' as const,
      points: checklistData as unknown as Record<string, unknown>,
      created_by: coId,
    }

    if (existingId) {
      const { error } = await supabase.schema('app').from('checklists')
        .update({ points: row.points }).eq('id', existingId)
      if (error) { console.error('updateChecklist:', error); return null }
      return existingId
    }

    const { data, error } = await supabase.schema('app').from('checklists')
      .insert(row).select('id').single()
    if (error) { console.error('insertChecklist:', error); return null }
    return data?.id ?? null
  }, [supabase])

  /** Load today's checklist for a project if it exists */
  const loadTodayChecklist = useCallback(async (
    projetId: string,
  ): Promise<{ id: string; data: ChecklistData } | null> => {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase.schema('app').from('checklists')
      .select('id, points')
      .eq('projet_id', projetId)
      .eq('type', 'terrain')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null
    return { id: data.id, data: data.points as unknown as ChecklistData }
  }, [supabase])

  /** Upload a photo to storage and return the path */
  const uploadPhoto = useCallback(async (
    projetId: string,
    file: File,
  ): Promise<string | null> => {
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${projetId}/tournee-terrain/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`

    const { error } = await supabase.storage.from('projets')
      .upload(path, file, { upsert: false })
    if (error) { console.error('uploadPhoto:', error); return null }
    return path
  }, [supabase])

  /** Get signed URL for a photo */
  const getPhotoUrl = useCallback(async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage.from('projets')
      .createSignedUrl(path, 3600)
    if (error) return null
    return data.signedUrl
  }, [supabase])

  /** Create a summary CR from checklist and insert it into comptes_rendus */
  const finishTournee = useCallback(async (
    projetId: string,
    checklistData: ChecklistData,
    coId: string,
  ): Promise<{ error: string | null }> => {
    // Build summary of problematic points
    const lines: string[] = [
      `COMPTE RENDU DE TOURNÉE TERRAIN`,
      `Date : ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      '',
    ]

    for (const lot of checklistData.lots) {
      const flagged = lot.points.filter(p => p.statut === 'a_surveiller' || p.statut === 'probleme')
      if (flagged.length === 0) continue

      lines.push(`--- Lot ${lot.lotNumero} — ${lot.lotCorpsEtat} ---`)
      for (const pt of flagged) {
        const badge = pt.statut === 'probleme' ? '[PROBLÈME]' : '[À SURVEILLER]'
        lines.push(`  ${badge} ${pt.label}`)
        if (pt.note) lines.push(`    Note : ${pt.note}`)
        if (pt.photos.length > 0) lines.push(`    Photos : ${pt.photos.length} jointe(s)`)
      }
      lines.push('')
    }

    // Stats
    const allPts = checklistData.lots.flatMap(l => l.points)
    const ok = allPts.filter(p => p.statut === 'ok').length
    const surv = allPts.filter(p => p.statut === 'a_surveiller').length
    const prob = allPts.filter(p => p.statut === 'probleme').length
    lines.push(`--- Synthèse ---`)
    lines.push(`OK : ${ok}  |  À surveiller : ${surv}  |  Problème : ${prob}  |  Total : ${allPts.length}`)

    // Get next CR number
    const { data: lastCr } = await supabase.schema('app').from('comptes_rendus')
      .select('numero')
      .eq('projet_id', projetId)
      .order('numero', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextNum = (lastCr?.numero ?? 0) + 1

    const { error } = await supabase.schema('app').from('comptes_rendus')
      .insert({
        projet_id: projetId,
        numero: nextNum,
        type: 'tournee_terrain',
        date_reunion: new Date().toISOString().split('T')[0],
        transcription: lines.join('\n'),
        statut: 'brouillon',
      })

    if (error) return { error: error.message }
    return { error: null }
  }, [supabase])

  return {
    fetchLots,
    fetchTemplatePoints,
    saveChecklist,
    loadTodayChecklist,
    uploadPhoto,
    getPhotoUrl,
    finishTournee,
    buildInitialPoints,
    createCustomPoint,
  }
}
