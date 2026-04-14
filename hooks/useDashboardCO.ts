'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/* ── Types ── */

export interface ProjetActif {
  id: string
  nom: string
  reference: string | null
  statut: string
  date_livraison: string | null
  remarque: string | null
}

export interface TacheDashboard {
  id: string
  titre: string
  statut: string
  due_date: string | null
  projet?: { id: string; nom: string } | null
}

export interface WeekStats {
  done: number
  total: number
}

export interface CalendarEvent {
  type: 'tache' | 'cr' | 'alerte'
  label: string
  id: string
}

export type CalendarData = Record<string, CalendarEvent[]> // key: YYYY-MM-DD

/* ── Helpers ── */

function getWeekBounds(): { monday: string; friday: string; sunday: string } {
  const now = new Date()
  const day = now.getDay()
  const diffMon = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffMon)
  monday.setHours(0, 0, 0, 0)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  friday.setHours(23, 59, 59, 999)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return {
    monday: monday.toISOString(),
    friday: friday.toISOString(),
    sunday: sunday.toISOString(),
  }
}

function getWeekDates(): string[] {
  const now = new Date()
  const day = now.getDay()
  const diffMon = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffMon)
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

/* ── Hook ── */

export function useDashboardCO(userId: string | null) {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [loading, setLoading] = useState(true)
  const [projetsActifs, setProjetsActifs] = useState<ProjetActif[]>([])
  const [visitesStats, setVisitesStats] = useState<WeekStats>({ done: 0, total: 0 })
  const [tachesStats, setTachesStats] = useState<WeekStats>({ done: 0, total: 0 })
  const [crStats, setCrStats] = useState<WeekStats>({ done: 0, total: 0 })
  const [devisStats, setDevisStats] = useState<WeekStats>({ done: 0, total: 0 })
  const [tachesSansDate, setTachesSansDate] = useState<TacheDashboard[]>([])
  const [evenementsSemaine, setEvenementsSemaine] = useState<CalendarData>({})

  const loadAll = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    const { monday, sunday } = getWeekBounds()
    const weekDates = getWeekDates()

    // ── Parallel queries ──
    const [
      projetsRes,
      tachesWeekRes,
      tachesSansDateRes,
      checklistsRes,
      crsRes,
      alertesRes,
    ] = await Promise.all([
      // Projets actifs du CO
      supabase.schema('app').from('projets')
        .select('id, nom, reference, statut, date_livraison, remarque')
        .eq('co_id', userId)
        .not('statut', 'eq', 'termine')
        .order('nom'),

      // Taches de la semaine (via due_date)
      supabase.schema('app').from('taches')
        .select('id, titre, statut, due_date, projet:projets(id, nom)')
        .or(`creee_par.eq.${userId},assignee_a.eq.${userId},tags_utilisateurs.cs.{${userId}}`)
        .gte('due_date', monday.split('T')[0])
        .lte('due_date', sunday.split('T')[0]),

      // Taches sans date (due_date IS NULL)
      supabase.schema('app').from('taches')
        .select('id, titre, statut, due_date, projet:projets(id, nom)')
        .or(`creee_par.eq.${userId},assignee_a.eq.${userId},tags_utilisateurs.cs.{${userId}}`)
        .is('due_date', null)
        .neq('statut', 'fait')
        .order('created_at', { ascending: false }),

      // Checklists de la semaine (visites terrain)
      supabase.schema('app').from('checklists')
        .select('id, created_at')
        .eq('co_id', userId)
        .gte('created_at', monday)
        .lte('created_at', sunday),

      // CR de la semaine
      supabase.schema('app').from('comptes_rendus')
        .select('id, statut, date_reunion, created_at')
        .gte('created_at', monday)
        .lte('created_at', sunday),

      // Alertes non lues
      supabase.schema('app').from('alertes')
        .select('id, titre, created_at')
        .eq('utilisateur_id', userId)
        .eq('lue', false)
        .gte('created_at', monday)
        .lte('created_at', sunday),
    ])

    const projets = (projetsRes.data ?? []) as ProjetActif[]
    setProjetsActifs(projets)

    // ── Visites stats ──
    const projetCount = projets.filter(p =>
      ['chantier', 'controle', 'cloture', 'gpa'].includes(p.statut)
    ).length
    setVisitesStats({
      done: checklistsRes.data?.length ?? 0,
      total: projetCount, // 1 visite prevue par projet en chantier
    })

    // ── Taches stats ──
    const tachesSemaine = (tachesWeekRes.data ?? []) as unknown as TacheDashboard[]
    setTachesStats({
      done: tachesSemaine.filter(t => t.statut === 'fait').length,
      total: tachesSemaine.length,
    })

    // ── Taches sans date ──
    setTachesSansDate((tachesSansDateRes.data ?? []) as unknown as TacheDashboard[])

    // ── CR stats ──
    const crs = crsRes.data ?? []
    const projetIds = projets.map(p => p.id)
    const myCrs = crs.filter((c: { id: string; statut: string }) =>
      // Filter by project if possible
      true
    )
    setCrStats({
      done: myCrs.filter((c: { statut: string }) => c.statut === 'valide' || c.statut === 'envoye').length,
      total: myCrs.length,
    })

    // ── Devis stats ──
    if (projetIds.length > 0) {
      const { data: consults } = await supabase.schema('app').from('consultations_st')
        .select('id, statut, email_envoye_at')
        .in('projet_id', projetIds)
        .gte('email_envoye_at', monday)
        .lte('email_envoye_at', sunday)

      const c = consults ?? []
      setDevisStats({
        done: c.filter((x: { statut: string }) => x.statut === 'devis_recu' || x.statut === 'attribue').length,
        total: c.length,
      })
    }

    // ── Calendar events ──
    const cal: CalendarData = {}
    for (const d of weekDates) cal[d] = []

    // Taches
    for (const t of tachesSemaine) {
      if (t.due_date) {
        const key = t.due_date.split('T')[0]
        if (cal[key]) cal[key].push({ type: 'tache', label: t.titre, id: t.id })
      }
    }

    // CR brouillons
    for (const cr of (crsRes.data ?? []) as { id: string; statut: string; date_reunion: string; created_at: string }[]) {
      if (cr.statut === 'brouillon') {
        const key = cr.date_reunion?.split('T')[0] ?? cr.created_at.split('T')[0]
        if (cal[key]) cal[key].push({ type: 'cr', label: 'CR a valider', id: cr.id })
      }
    }

    // Alertes
    for (const a of (alertesRes.data ?? []) as { id: string; titre: string; created_at: string }[]) {
      const key = a.created_at.split('T')[0]
      if (cal[key]) cal[key].push({ type: 'alerte', label: a.titre, id: a.id })
    }

    setEvenementsSemaine(cal)
    setLoading(false)
  }, [userId, supabase])

  useEffect(() => { loadAll() }, [loadAll])

  return {
    loading,
    projetsActifs,
    visitesStats,
    tachesStats,
    crStats,
    devisStats,
    tachesSansDate,
    setTachesSansDate,
    evenementsSemaine,
    refresh: loadAll,
  }
}
