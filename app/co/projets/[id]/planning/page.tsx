'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { Plus, Sparkles, Loader2, X, Calendar, Trash2, Save, ZoomIn, ZoomOut, Printer, FileDown, FileSpreadsheet, CalendarClock, FolderPlus, ListPlus } from 'lucide-react'
import { generatePlanningPdf, buildPlanningCsv, triggerDownload } from '@/lib/pdf/planning'
import { PlanningGantt, type PlanningGanttHandle, type PlanningZoom, type PlanningGroup } from '@/components/co/PlanningGantt'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { cn } from '@/lib/utils'
import { Abbr } from '@/components/shared/Abbr'

/* ── Types ── */

interface Intervention {
  id: string
  projet_id: string
  lot_id: string | null
  st_id: string | null
  corps_etat: string
  nom_tache: string | null
  st_nom: string | null
  date_debut: string
  date_fin: string
  avancement_pct: number
  statut: 'planifie' | 'confirme' | 'en_cours' | 'termine' | 'retarde'
  couleur: string | null
  notes: string | null
}

interface Lot {
  id: string
  corps_etat: string
  budget_prevu: number | null
  source: 'app' | 'public' | 'biblio'
  numero?: number | null
}

interface STOption {
  st_id: string
  nom: string
}

interface AIProposed {
  corps_etat: string
  date_debut: string
  date_fin: string
  couleur: string
  ordre: number
}

const STATUT_COLORS: Record<string, string> = {
  planifie: '#3b82f6',
  confirme: '#10b981',
  en_cours: '#f59e0b',
  termine: '#9ca3af',
  retarde: '#ef4444',
}

const STATUT_LABELS: Record<string, string> = {
  planifie: 'Planifie',
  confirme: 'Confirme',
  en_cours: 'En cours',
  termine: 'Termine',
  retarde: 'Retarde',
}

type View = 'co' | 'client' | 'st'

const ZOOM_LEVELS = ['Day', 'Week', 'Month', 'Quarter'] as const
type ZoomLevel = PlanningZoom

/* ── Component ── */

export default function PlanningPage() {
  const { id: projetId } = useParams<{ id: string }>()
  const { user } = useUser()
  const supabase = createClient()
  const ganttHandle = useRef<PlanningGanttHandle>(null)

  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('co')
  const [addModalMode, setAddModalMode] = useState<'lot' | 'tache' | null>(null)
  const [editing, setEditing] = useState<Intervention | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiProposed, setAiProposed] = useState<AIProposed[] | null>(null)
  const [zoom, setZoom] = useState<ZoomLevel>('Week')
  const [projetInfo, setProjetInfo] = useState<{ nom: string; reference: string | null; date_debut: string | null; date_livraison: string | null }>({ nom: 'Projet', reference: null, date_debut: null, date_livraison: null })

  useEffect(() => {
    supabase.schema('app').from('projets').select('nom, reference, date_debut, date_livraison').eq('id', projetId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = data as { nom: string | null; reference: string | null; date_debut: string | null; date_livraison: string | null }
          setProjetInfo({
            nom: d.nom ?? 'Projet',
            reference: d.reference ?? null,
            date_debut: d.date_debut ?? null,
            date_livraison: d.date_livraison ?? null,
          })
        }
      })
  }, [projetId]) // eslint-disable-line react-hooks/exhaustive-deps

  function planningPayload() {
    return {
      projet_nom: projetInfo.nom,
      projet_reference: projetInfo.reference,
      rows: [...interventions]
        .sort((a, b) => a.date_debut.localeCompare(b.date_debut))
        .map(i => ({
          corps_etat: i.corps_etat,
          st_nom: i.st_nom,
          date_debut: i.date_debut,
          date_fin: i.date_fin,
          avancement_pct: i.avancement_pct,
          statut: i.statut,
          notes: i.notes,
        })),
    }
  }

  function handlePrint() {
    window.print()
  }

  function handleExportPdf() {
    if (interventions.length === 0) return
    const blob = generatePlanningPdf(planningPayload())
    const stamp = new Date().toISOString().slice(0, 10)
    const ref = projetInfo.reference ? `_${projetInfo.reference}` : ''
    triggerDownload(blob, `Planning${ref}_${stamp}.pdf`)
  }

  function handleExportCsv() {
    if (interventions.length === 0) return
    const csv = buildPlanningCsv(planningPayload())
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const stamp = new Date().toISOString().slice(0, 10)
    const ref = projetInfo.reference ? `_${projetInfo.reference}` : ''
    triggerDownload(blob, `Planning${ref}_${stamp}.csv`)
  }

  /* ── Load ── */
  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .schema('app')
      .from('planning_interventions')
      .select('*')
      .eq('projet_id', projetId)
      .order('date_debut')
    setInterventions((data ?? []) as Intervention[])
    setLoading(false)
  }, [projetId, supabase])

  useEffect(() => { load() }, [load])

  /* ── Build groups (lots + leurs taches) ── */
  const groups = useMemo<PlanningGroup[]>(() => {
    if (interventions.length === 0) return []
    if (view === 'client') {
      // Jalons synthetiques en 3 "lots" virtuels
      const sorted = [...interventions].sort((a, b) => a.date_debut.localeCompare(b.date_debut))
      const earliest = sorted[0].date_debut
      const latest = [...interventions].sort((a, b) => b.date_fin.localeCompare(a.date_fin))[0].date_fin
      const midMs = (new Date(earliest).getTime() + new Date(latest).getTime()) / 2
      const midDate = new Date(midMs).toISOString().split('T')[0]
      const make = (id: string, corps: string, d1: string, d2: string, st: Intervention['statut'], pct: number): Intervention => ({
        id, projet_id: '', lot_id: null, st_id: null, corps_etat: corps, nom_tache: null, st_nom: null,
        date_debut: d1, date_fin: d2, avancement_pct: pct, statut: st, couleur: null, notes: null,
      })
      return [
        { lot: make('jalon-debut', 'Demarrage chantier', earliest, earliest, 'confirme', 100), tasks: [] },
        { lot: make('jalon-mi', 'Mi-chantier', midDate, midDate, 'en_cours', 50), tasks: [] },
        { lot: make('jalon-fin', 'Livraison', latest, latest, 'planifie', 0), tasks: [] },
      ]
    }
    if (view === 'st') {
      // Vue ST : groupe par sous-traitant ; chaque ST = un "lot" virtuel, tasks = toutes ses interventions
      const map = new Map<string, Intervention[]>()
      for (const i of interventions) {
        const key = (i.st_nom?.trim()) || 'Non assigné'
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(i)
      }
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([stName, items]) => {
          const sorted = items.sort((a, b) => a.date_debut.localeCompare(b.date_debut))
          const earliest = sorted[0].date_debut
          const latest = sorted.reduce((m, i) => (i.date_fin > m ? i.date_fin : m), sorted[0].date_fin)
          return {
            lot: {
              id: `st-${stName}`,
              projet_id: items[0].projet_id,
              lot_id: null,
              st_id: null,
              corps_etat: stName,
              nom_tache: null,
              st_nom: stName,
              date_debut: earliest,
              date_fin: latest,
              avancement_pct: 0,
              statut: 'planifie' as const,
              couleur: null,
              notes: null,
            },
            tasks: sorted,
          }
        })
    }
    // Vue CO : groupe par lot, lot parent + ses taches
    const groupKey = (i: Intervention) => i.lot_id ?? `corps:${i.corps_etat}`
    const map = new Map<string, { parent?: Intervention; tasks: Intervention[]; earliest: string; corps: string }>()
    for (const i of interventions) {
      const k = groupKey(i)
      const g = map.get(k) ?? { parent: undefined, tasks: [], earliest: i.date_debut, corps: i.corps_etat }
      if (i.nom_tache?.trim()) g.tasks.push(i)
      else g.parent = g.parent ?? i
      if (i.date_debut < g.earliest) g.earliest = i.date_debut
      map.set(k, g)
    }
    const sortedGroups = Array.from(map.values()).sort((a, b) => a.earliest.localeCompare(b.earliest))
    return sortedGroups.map(g => {
      // si pas de lot parent (taches orphelines), synthese : englobe la plage des taches
      let parent = g.parent
      if (!parent && g.tasks.length > 0) {
        const tStart = g.tasks.reduce((m, t) => (t.date_debut < m ? t.date_debut : m), g.tasks[0].date_debut)
        const tEnd = g.tasks.reduce((m, t) => (t.date_fin > m ? t.date_fin : m), g.tasks[0].date_fin)
        parent = {
          id: `synth-${g.tasks[0].id}`,
          projet_id: g.tasks[0].projet_id,
          lot_id: g.tasks[0].lot_id,
          st_id: null,
          corps_etat: g.corps,
          nom_tache: null,
          st_nom: null,
          date_debut: tStart,
          date_fin: tEnd,
          avancement_pct: 0,
          statut: 'planifie',
          couleur: null,
          notes: null,
        }
      }
      return {
        lot: parent!,
        tasks: g.tasks.sort((a, b) => a.date_debut.localeCompare(b.date_debut)),
      }
    })
  }, [interventions, view])

  function scrollToToday() {
    ganttHandle.current?.scrollToToday()
  }

  function zoomIn()  { setZoom(z => ZOOM_LEVELS[Math.max(0, ZOOM_LEVELS.indexOf(z) - 1)]) }
  function zoomOut() { setZoom(z => ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, ZOOM_LEVELS.indexOf(z) + 1)]) }

  /* ── AI Generation ── */
  async function handleGenerateAI() {
    setAiLoading(true)
    try {
      // Charger les lots du projet + dates du projet
      const [{ data: lots }, { data: projet }] = await Promise.all([
        supabase.schema('app').from('lots').select('id, corps_etat, budget_prevu').eq('projet_id', projetId),
        supabase.schema('app').from('projets').select('date_debut, date_livraison').eq('id', projetId).single(),
      ])

      if (!lots?.length || !projet) {
        alert('Aucun lot ou dates de projet manquantes')
        return
      }

      const res = await fetch('/api/co/generer-planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projet_id: projetId,
          lots,
          date_debut_projet: (projet as { date_debut: string }).date_debut,
          date_fin_projet: (projet as { date_livraison: string }).date_livraison,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur IA')
      setAiProposed(json.interventions)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setAiLoading(false)
    }
  }

  async function handleValidateAIPlanning() {
    if (!aiProposed || !user) return
    const rows = aiProposed.map(p => ({
      projet_id: projetId,
      corps_etat: p.corps_etat,
      date_debut: p.date_debut,
      date_fin: p.date_fin,
      couleur: p.couleur,
      avancement_pct: 0,
      statut: 'planifie',
      created_by: user.id,
    }))
    await supabase.schema('app').from('planning_interventions').insert(rows)
    setAiProposed(null)
    load()
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body * { visibility: hidden; }
          .planning-print-zone, .planning-print-zone * { visibility: visible; }
          .planning-print-zone { position: absolute; top: 0; left: 0; right: 0; }
          .planning-no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="planning-no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {(['co', 'client', 'st'] as View[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-3 sm:px-4 py-1.5 text-xs font-medium rounded-md transition-colors',
                view === v ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900',
              )}
            >
              Vue {v === 'co' ? <Abbr k="CO" /> : v === 'client' ? 'Client' : <Abbr k="ST" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom controls (echelle de temps) */}
          <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg p-0.5">
            <button
              onClick={zoomOut}
              disabled={zoom === 'Month'}
              title="Dezoomer"
              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-medium text-gray-500 px-1.5 min-w-[60px] text-center">{zoom}</span>
            <button
              onClick={zoomIn}
              disabled={zoom === 'Day'}
              title="Zoomer"
              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Today */}
          <button
            onClick={scrollToToday}
            disabled={interventions.length === 0}
            title="Aller a aujourd'hui"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            Aujourd&apos;hui
          </button>
          {/* Export */}
          <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg p-0.5">
            <button onClick={handlePrint} disabled={interventions.length === 0}
              title="Imprimer"
              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
              <Printer className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleExportPdf} disabled={interventions.length === 0}
              title="Telecharger PDF"
              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
              <FileDown className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleExportCsv} disabled={interventions.length === 0}
              title="Telecharger CSV"
              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={handleGenerateAI}
            disabled={aiLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
            Generer avec l&apos;IA
          </button>
          <button
            onClick={() => setAddModalMode('tache')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter une tache
          </button>
        </div>
      </div>

      {/* Reference dates + Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          {projetInfo.date_debut ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-md">
              <Calendar className="w-3 h-3" />
              <span className="font-medium">Demarrage chantier :</span>
              <span>{new Date(projetInfo.date_debut).toLocaleDateString('fr-FR')}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-md">
              <Calendar className="w-3 h-3" />
              <span>Date de demarrage non renseignee</span>
            </span>
          )}
          {projetInfo.date_livraison && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-200 text-gray-600 rounded-md">
              <span className="font-medium">Livraison :</span>
              <span>{new Date(projetInfo.date_livraison).toLocaleDateString('fr-FR')}</span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
          {Object.entries(STATUT_LABELS).map(([k, label]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: STATUT_COLORS[k] }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Gantt container */}
      <div className="planning-print-zone bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="hidden print:block mb-4">
          <h1 className="text-lg font-bold">Planning — {projetInfo.nom}</h1>
          {projetInfo.reference && <p className="text-xs text-gray-500">{projetInfo.reference}</p>}
        </div>
        {loading ? (
          <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
        ) : groups.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <Calendar className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">Aucune intervention planifiee</p>
            {projetInfo.date_debut ? (
              <p className="text-xs text-gray-400 mt-1">
                Le planning demarrera le {new Date(projetInfo.date_debut).toLocaleDateString('fr-FR')}
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">Cliquez sur Ajouter ou Generer avec l&apos;IA</p>
            )}
          </div>
        ) : (
          <PlanningGantt
            ref={ganttHandle}
            groups={groups}
            zoom={zoom}
            onClickItem={(it) => {
              if (it.id.startsWith('jalon-') || it.id.startsWith('synth-') || it.id.startsWith('st-')) return
              const found = interventions.find(i => i.id === it.id)
              if (found) setEditing(found)
            }}
            onItemDatesChange={async (id, date_debut, date_fin) => {
              if (id.startsWith('jalon-') || id.startsWith('synth-') || id.startsWith('st-')) return
              // Optimistic update local
              setInterventions(prev => prev.map(i => i.id === id ? { ...i, date_debut, date_fin } : i))
              await supabase
                .schema('app')
                .from('planning_interventions')
                .update({ date_debut, date_fin } as never)
                .eq('id', id)
              await load()
            }}
          />
        )}
      </div>

      {/* Add Modal */}
      {addModalMode && (
        <AddInterventionModal
          mode={addModalMode}
          projetId={projetId}
          userId={user?.id}
          defaultDateDebut={projetInfo.date_debut}
          defaultDateFin={projetInfo.date_livraison}
          existingLots={interventions.filter(i => !i.nom_tache?.trim())}
          onClose={() => setAddModalMode(null)}
          onSaved={() => { setAddModalMode(null); load() }}
        />
      )}

      {/* Edit Modal */}
      {editing && (
        <EditInterventionModal
          intervention={editing}
          allInterventions={interventions}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}

      {/* AI Proposal Modal */}
      {aiProposed && (
        <AIProposalModal
          proposed={aiProposed}
          onChange={setAiProposed}
          onClose={() => setAiProposed(null)}
          onValidate={handleValidateAIPlanning}
        />
      )}
    </div>
  )
}

/* ── Add Modal ── */

function AddInterventionModal({
  mode, projetId, userId, defaultDateDebut, defaultDateFin, existingLots, onClose, onSaved,
}: {
  mode: 'lot' | 'tache'
  projetId: string
  userId: string | undefined
  defaultDateDebut: string | null
  defaultDateFin: string | null
  existingLots: Intervention[]
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [lots, setLots] = useState<Lot[]>([])
  const [sts, setSts] = useState<STOption[]>([])
  const [lotId, setLotId] = useState('')
  const [parentLotInterventionId, setParentLotInterventionId] = useState('')
  const [stId, setStId] = useState('')
  const [nomTache, setNomTache] = useState('')
  const [dateDebut, setDateDebut] = useState(defaultDateDebut ?? '')
  const [dateFin, setDateFin] = useState(defaultDateFin ?? '')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Lot parent selectionne en mode tache
  const parentLot = mode === 'tache'
    ? existingLots.find(l => l.id === parentLotInterventionId) ?? null
    : null

  // Quand on selectionne un lot parent en mode tache, pre-remplit les dates dans la fourchette
  useEffect(() => {
    if (mode === 'tache' && parentLot) {
      setDateDebut(prev => {
        if (!prev || prev < parentLot.date_debut || prev > parentLot.date_fin) return parentLot.date_debut
        return prev
      })
      setDateFin(prev => {
        if (!prev || prev > parentLot.date_fin || prev < parentLot.date_debut) return parentLot.date_fin
        return prev
      })
    }
  }, [mode, parentLot])

  // Charge prioritairement les lots reels du projet (public.lots) ; fallback app.lots si vide
  useEffect(() => {
    async function load() {
      const [pubRes, appRes] = await Promise.all([
        supabase.from('lots')
          .select('id, nom, total_ht, ordre')
          .eq('projet_id', projetId)
          .order('ordre', { nullsFirst: false }),
        supabase.schema('app').from('lots')
          .select('id, corps_etat, budget_prevu')
          .eq('projet_id', projetId),
      ])
      const merged: Lot[] = []
      const pubLots = (pubRes.data ?? []) as Array<{ id: string; nom: string | null; total_ht: number | null; ordre: number | null }>
      pubLots.forEach((l, idx) => {
        merged.push({
          id: l.id,
          corps_etat: l.nom ?? '—',
          budget_prevu: l.total_ht,
          source: 'public',
          numero: idx + 1,
        })
      })
      // Fallback uniquement si aucun lot reel n'existe encore (projet ancien sans economiste)
      if (pubLots.length === 0) {
        for (const l of (appRes.data ?? []) as Array<{ id: string; corps_etat: string | null; budget_prevu: number | null }>) {
          merged.push({ id: l.id, corps_etat: l.corps_etat ?? '—', budget_prevu: l.budget_prevu, source: 'app' })
        }
      }
      setLots(merged)
    }
    load()
  }, [projetId, supabase])

  // Load STs validated for selected lot (mode lot : depuis le selecteur ; mode tache : depuis parent lot)
  useEffect(() => {
    if (mode === 'lot') {
      const lot = lots.find(l => l.id === lotId)
      if (!lotId || !lot) { setSts([]); setStId(''); return }
      if (lot.source === 'app') {
        supabase.schema('app').from('sts_prospection')
          .select('st_id, nom')
          .eq('lot_id', lotId)
          .eq('statut', 'validé')
          .then(({ data }) => setSts((data ?? []) as STOption[]))
      } else if (lot.source === 'public') {
        supabase.from('acces_dce')
          .select('st_id, st_nom')
          .eq('lot_id', lotId)
          .then(({ data }) => {
            const rows = (data ?? []) as Array<{ st_id: string | null; st_nom: string | null }>
            const opts: STOption[] = rows
              .filter(r => r.st_id && r.st_nom)
              .map(r => ({ st_id: r.st_id as string, nom: r.st_nom as string }))
            setSts(opts)
          })
      } else {
        setSts([])
      }
    } else if (mode === 'tache' && parentLot) {
      // Pre-remplit avec le ST du lot parent ; charge la liste depuis le lot_id si disponible
      if (parentLot.st_id && parentLot.st_nom) {
        setSts([{ st_id: parentLot.st_id, nom: parentLot.st_nom }])
        setStId(parentLot.st_id)
      } else if (parentLot.lot_id) {
        supabase.schema('app').from('sts_prospection')
          .select('st_id, nom')
          .eq('lot_id', parentLot.lot_id)
          .eq('statut', 'validé')
          .then(({ data }) => setSts((data ?? []) as STOption[]))
      } else {
        setSts([])
      }
    }
  }, [mode, lotId, lots, parentLot, supabase])

  async function handleSave() {
    if (!dateDebut || !dateFin) return
    if (mode === 'lot' && !lotId) return
    if (mode === 'tache') {
      if (!parentLotInterventionId || !nomTache.trim()) return
      if (!parentLot) return
      if (dateDebut < parentLot.date_debut || dateFin > parentLot.date_fin) {
        alert(`La tache doit etre comprise entre ${parentLot.date_debut} et ${parentLot.date_fin} (limites du lot "${parentLot.corps_etat}").`)
        return
      }
    }
    setSaving(true)
    const st = sts.find(s => s.st_id === stId)
    let payloadLotId: string | null = null
    let payloadStId: string | null = null
    let payloadCorpsEtat = ''
    if (mode === 'lot') {
      const lot = lots.find(l => l.id === lotId)
      payloadLotId = lot?.source === 'app' ? lotId : null
      payloadStId = lot?.source === 'app' ? (stId || null) : null
      payloadCorpsEtat = lot?.corps_etat ?? ''
    } else if (parentLot) {
      // tache : herite du lot parent
      payloadLotId = parentLot.lot_id
      payloadStId = stId || null
      payloadCorpsEtat = parentLot.corps_etat
    }
    await supabase.schema('app').from('planning_interventions').insert({
      projet_id: projetId,
      lot_id: payloadLotId,
      st_id: payloadStId,
      corps_etat: payloadCorpsEtat,
      nom_tache: mode === 'tache' ? nomTache.trim() : null,
      st_nom: st?.nom ?? null,
      date_debut: dateDebut,
      date_fin: dateFin,
      avancement_pct: 0,
      statut: 'planifie',
      notes: notes || null,
      created_by: userId,
    })
    setSaving(false)
    onSaved()
  }

  return (
    <ModalShell title={mode === 'lot' ? 'Ajouter un lot au planning' : 'Ajouter une tache dans un lot'} onClose={onClose}>
      <div className="space-y-4">
        <div className={cn(
          'flex items-start gap-2 p-2.5 rounded-lg text-xs',
          mode === 'lot' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200',
        )}>
          {mode === 'lot' ? <FolderPlus className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <ListPlus className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          <span>
            {mode === 'lot'
              ? 'Phase principale du chantier (ex: Maconnerie, Peinture). Le nom du lot sera affiche sur le Gantt.'
              : 'Sous-element affine a l\'interieur d\'un lot existant (ex: Pose carrelage RDC, Curage etage 2).'}
          </span>
        </div>

        {mode === 'lot' ? (
          <Field label="Lot">
            <select value={lotId} onChange={e => setLotId(e.target.value)} className={inputCls}>
              <option value="">{lots.length === 0 ? 'Aucun lot dans ce projet' : 'Selectionner un lot...'}</option>
              {lots.map(l => (
                <option key={l.id} value={l.id}>
                  {l.numero ? `${String(l.numero).padStart(2, '0')} — ${l.corps_etat}` : l.corps_etat}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Lot parent">
            <select value={parentLotInterventionId} onChange={e => setParentLotInterventionId(e.target.value)} className={inputCls}>
              <option value="">{existingLots.length === 0 ? 'Aucun lot dans le planning — ajoutez-en un d\'abord' : 'Selectionner un lot du planning...'}</option>
              {existingLots
                .slice()
                .sort((a, b) => a.date_debut.localeCompare(b.date_debut))
                .map(l => (
                  <option key={l.id} value={l.id}>
                    {l.corps_etat} ({l.date_debut} -&gt; {l.date_fin})
                  </option>
                ))}
            </select>
            {parentLot && (
              <p className="text-[10px] text-amber-700 mt-1">
                La tache doit etre comprise entre <b>{parentLot.date_debut}</b> et <b>{parentLot.date_fin}</b>.
              </p>
            )}
          </Field>
        )}

        {mode === 'tache' && (
          <Field label="Nom de la tache">
            <input
              type="text"
              value={nomTache}
              onChange={e => setNomTache(e.target.value)}
              placeholder="Ex: Curage interieur, Pose carrelage RDC..."
              className={inputCls}
              required
            />
          </Field>
        )}

        <Field label="Sous-traitant (optionnel)">
          {(() => {
            const isLotChosen = mode === 'lot' ? !!lotId : !!parentLotInterventionId
            const placeholder = !isLotChosen
              ? "Choisir un lot d'abord"
              : sts.length
              ? 'Selectionner un ST...'
              : 'Aucun ST consulte pour ce lot'
            return (
              <select value={stId} onChange={e => setStId(e.target.value)}
                disabled={!isLotChosen} className={inputCls}>
                <option value="">{placeholder}</option>
                {sts.map(s => <option key={s.st_id} value={s.st_id}>{s.nom}</option>)}
              </select>
            )
          })()}
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Date debut">
            <input
              type="date"
              value={dateDebut}
              onChange={e => setDateDebut(e.target.value)}
              min={mode === 'tache' && parentLot ? parentLot.date_debut : undefined}
              max={mode === 'tache' && parentLot ? parentLot.date_fin : undefined}
              className={inputCls}
            />
          </Field>
          <Field label="Date fin">
            <input
              type="date"
              value={dateFin}
              onChange={e => setDateFin(e.target.value)}
              min={mode === 'tache' && parentLot ? parentLot.date_debut : undefined}
              max={mode === 'tache' && parentLot ? parentLot.date_fin : undefined}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Notes (optionnel)">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className={cn(inputCls, 'resize-none')} placeholder="Remarques..." />
        </Field>

        <button
          onClick={handleSave}
          disabled={
            !dateDebut || !dateFin || saving ||
            (mode === 'lot' && !lotId) ||
            (mode === 'tache' && (!parentLotInterventionId || !nomTache.trim()))
          }
          className="w-full px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : mode === 'lot' ? 'Ajouter le lot' : 'Ajouter la tache'}
        </button>
      </div>
    </ModalShell>
  )
}

/* ── Edit Modal ── */

function EditInterventionModal({
  intervention, allInterventions, onClose, onSaved,
}: {
  intervention: Intervention
  allInterventions: Intervention[]
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [nomTache, setNomTache] = useState(intervention.nom_tache ?? '')
  const [dateDebut, setDateDebut] = useState(intervention.date_debut)
  const [dateFin, setDateFin] = useState(intervention.date_fin)
  const [statut, setStatut] = useState(intervention.statut)
  const [avancement, setAvancement] = useState(intervention.avancement_pct)
  const [notes, setNotes] = useState(intervention.notes ?? '')
  const [saving, setSaving] = useState(false)

  const isTask = !!intervention.nom_tache?.trim()
  // Tous les lots parents disponibles (interventions sans nom_tache)
  const availableLots = useMemo(
    () => allInterventions.filter(i => !i.nom_tache?.trim() && i.id !== intervention.id),
    [allInterventions, intervention.id],
  )
  // Lot parent actuel : meme lot_id ou meme corps_etat
  const currentParent = isTask
    ? availableLots.find(i =>
        (intervention.lot_id && i.lot_id === intervention.lot_id) ||
        (!intervention.lot_id && i.corps_etat === intervention.corps_etat),
      )
    : null
  const [parentLotId, setParentLotId] = useState<string>(currentParent?.id ?? '')
  const parentLot = isTask ? (availableLots.find(l => l.id === parentLotId) ?? currentParent ?? null) : null

  async function handleSave() {
    if (isTask) {
      if (!parentLot) {
        alert('Selectionnez un lot parent pour cette tache.')
        return
      }
      if (dateDebut < parentLot.date_debut || dateFin > parentLot.date_fin) {
        alert(`La tache doit etre comprise entre ${parentLot.date_debut} et ${parentLot.date_fin} (limites du lot "${parentLot.corps_etat}").`)
        return
      }
    }
    setSaving(true)
    const update: Record<string, unknown> = {
      nom_tache: nomTache.trim() || null,
      date_debut: dateDebut,
      date_fin: dateFin,
      statut,
      avancement_pct: avancement,
      notes: notes || null,
    }
    // Reattacher la tache a un nouveau lot parent si modifie
    if (isTask && parentLot && parentLot.id !== currentParent?.id) {
      update.lot_id = parentLot.lot_id
      update.corps_etat = parentLot.corps_etat
      update.st_id = parentLot.st_id
      update.st_nom = parentLot.st_nom
    }
    await supabase.schema('app').from('planning_interventions')
      .update(update)
      .eq('id', intervention.id)
    setSaving(false)
    onSaved()
  }

  async function handleDelete() {
    if (!confirm('Supprimer cette intervention ?')) return
    await supabase.schema('app').from('planning_interventions').delete().eq('id', intervention.id)
    onSaved()
  }

  return (
    <ModalShell title={`${intervention.nom_tache?.trim() || intervention.corps_etat}${intervention.st_nom ? ' - ' + intervention.st_nom : ''}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nom de la tache">
          <input
            type="text"
            value={nomTache}
            onChange={e => setNomTache(e.target.value)}
            placeholder={intervention.corps_etat}
            className={inputCls}
          />
          <p className="text-[10px] text-gray-400 mt-1">Laisser vide pour utiliser le nom du lot ({intervention.corps_etat})</p>
        </Field>

        {isTask && (
          <Field label="Lot parent">
            <select
              value={parentLotId}
              onChange={e => setParentLotId(e.target.value)}
              className={inputCls}
            >
              {availableLots.length === 0 && <option value="">Aucun lot disponible</option>}
              {availableLots
                .slice()
                .sort((a, b) => a.date_debut.localeCompare(b.date_debut))
                .map(l => (
                  <option key={l.id} value={l.id}>
                    {l.corps_etat} ({l.date_debut} → {l.date_fin})
                  </option>
                ))}
            </select>
            {parentLot && (
              <p className="text-[10px] text-amber-700 mt-1">
                La tache doit etre comprise entre <b>{parentLot.date_debut}</b> et <b>{parentLot.date_fin}</b>.
              </p>
            )}
          </Field>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Date debut">
            <input
              type="date"
              value={dateDebut}
              onChange={e => setDateDebut(e.target.value)}
              min={isTask && parentLot ? parentLot.date_debut : undefined}
              max={isTask && parentLot ? parentLot.date_fin : undefined}
              className={inputCls}
            />
          </Field>
          <Field label="Date fin">
            <input
              type="date"
              value={dateFin}
              onChange={e => setDateFin(e.target.value)}
              min={isTask && parentLot ? parentLot.date_debut : undefined}
              max={isTask && parentLot ? parentLot.date_fin : undefined}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Statut">
          <select value={statut} onChange={e => setStatut(e.target.value as Intervention['statut'])} className={inputCls}>
            {Object.entries(STATUT_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </Field>

        <Field label={`Avancement (${avancement}%)`}>
          <input type="range" min={0} max={100} value={avancement} onChange={e => setAvancement(parseInt(e.target.value))}
            className="w-full" />
        </Field>

        <Field label="Notes">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={cn(inputCls, 'resize-none')} />
        </Field>

        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Enregistrer</>}
          </button>
          <button onClick={handleDelete}
            className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

/* ── AI Proposal Modal ── */

function AIProposalModal({
  proposed, onChange, onClose, onValidate,
}: {
  proposed: AIProposed[]
  onChange: (p: AIProposed[]) => void
  onClose: () => void
  onValidate: () => void
}) {
  function update(idx: number, field: keyof AIProposed, value: string) {
    const next = [...proposed]
    next[idx] = { ...next[idx], [field]: value }
    onChange(next)
  }

  return (
    <ModalShell title="Planning propose par l'IA" onClose={onClose} wide>
      <div className="space-y-3">
        <p className="text-xs text-gray-500">Modifie les dates si necessaire avant de valider.</p>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {proposed.map((p, i) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: p.couleur }} />
                <span className="text-sm font-medium text-gray-900 truncate">{p.corps_etat}</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="date" value={p.date_debut} onChange={e => update(i, 'date_debut', e.target.value)}
                  className="px-2 py-1 border border-gray-200 rounded text-xs" />
                <span className="text-gray-300">-</span>
                <input type="date" value={p.date_fin} onChange={e => update(i, 'date_fin', e.target.value)}
                  className="px-2 py-1 border border-gray-200 rounded text-xs" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Annuler
          </button>
          <button onClick={onValidate}
            className="flex-1 px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
            Valider et inserer
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

/* ── UI helpers ── */

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

function ModalShell({ title, onClose, children, wide }: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className={cn(
        'bg-white rounded-2xl shadow-xl w-full max-h-[90vh] overflow-hidden flex flex-col',
        wide ? 'max-w-2xl' : 'max-w-md',
      )}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
