'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Plus, Sparkles, Loader2, X, Calendar, Trash2, Save, ZoomIn, ZoomOut } from 'lucide-react'
import Gantt from 'frappe-gantt'
// CSS importe via globals.css car le package n'expose pas le chemin direct
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { cn } from '@/lib/utils'

/* ── Types ── */

interface Intervention {
  id: string
  projet_id: string
  lot_id: string | null
  st_id: string | null
  corps_etat: string
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

const ZOOM_LEVELS = ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month'] as const
type ZoomLevel = typeof ZOOM_LEVELS[number]

/* ── Component ── */

export default function PlanningPage() {
  const { id: projetId } = useParams<{ id: string }>()
  const { user } = useUser()
  const supabase = createClient()
  const ganttRef = useRef<HTMLDivElement>(null)

  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('co')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editing, setEditing] = useState<Intervention | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiProposed, setAiProposed] = useState<AIProposed[] | null>(null)
  const [zoom, setZoom] = useState<ZoomLevel>('Month')

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

  /* ── Build tasks for Gantt according to view ── */
  const buildTasks = useCallback(() => {
    if (interventions.length === 0) return []

    if (view === 'client') {
      const sorted = [...interventions].sort((a, b) => a.date_debut.localeCompare(b.date_debut))
      const earliest = sorted[0].date_debut
      const latest = [...interventions].sort((a, b) => b.date_fin.localeCompare(a.date_fin))[0].date_fin
      const midMs = (new Date(earliest).getTime() + new Date(latest).getTime()) / 2
      const midDate = new Date(midMs).toISOString().split('T')[0]

      return [
        { id: 'jalon-debut', name: 'Demarrage chantier', start: earliest, end: earliest, progress: 100, custom_class: 'bar-confirme' },
        { id: 'jalon-mi',    name: 'Mi-chantier',         start: midDate,  end: midDate,  progress: 50,  custom_class: 'bar-en_cours' },
        { id: 'jalon-fin',   name: 'Livraison',           start: latest,   end: latest,   progress: 0,   custom_class: 'bar-planifie' },
      ]
    }

    let filtered = [...interventions]
    if (view === 'st') {
      filtered.sort((a, b) => (a.st_nom ?? '').localeCompare(b.st_nom ?? '') || a.date_debut.localeCompare(b.date_debut))
    }

    return filtered.map(i => ({
      id: i.id,
      name: view === 'st' && i.st_nom ? `${i.st_nom} - ${i.corps_etat}` : `${i.corps_etat}${i.st_nom ? ' - ' + i.st_nom : ''}`,
      start: i.date_debut,
      end: i.date_fin,
      progress: i.avancement_pct,
      custom_class: `bar-${i.statut}`,
    }))
  }, [interventions, view])

  /* ── Render Gantt ── */
  useEffect(() => {
    if (!ganttRef.current || loading) return
    const tasks = buildTasks()
    if (tasks.length === 0) {
      ganttRef.current.innerHTML = ''
      return
    }

    ganttRef.current.innerHTML = ''

    // Calcule column_width dynamique pour faire tenir tout dans la largeur dispo
    const containerWidth = ganttRef.current.clientWidth || 800
    const COLUMN_WIDTHS: Record<ZoomLevel, number> = {
      'Quarter Day': 38,
      'Half Day': 38,
      'Day': 38,
      'Week': 140,
      'Month': Math.max(50, Math.floor(containerWidth / 12)),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new Gantt(ganttRef.current, tasks as any, {
      view_mode: zoom,
      column_width: COLUMN_WIDTHS[zoom],
      bar_height: 28,
      bar_corner_radius: 4,
      padding: 18,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      on_click: (task: any) => {
        if (task.id.startsWith('jalon-')) return
        const found = interventions.find(i => i.id === task.id)
        if (found) setEditing(found)
      },
    })
  }, [buildTasks, loading, interventions, zoom])

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
      {/* CSS for Gantt bar colors */}
      <style jsx global>{`
        .bar-planifie .bar { fill: ${STATUT_COLORS.planifie} !important; }
        .bar-confirme .bar { fill: ${STATUT_COLORS.confirme} !important; }
        .bar-en_cours .bar { fill: ${STATUT_COLORS.en_cours} !important; }
        .bar-termine .bar  { fill: ${STATUT_COLORS.termine}  !important; }
        .bar-retarde .bar  { fill: ${STATUT_COLORS.retarde}  !important; }
        .gantt .bar-progress { fill: rgba(0,0,0,0.15) !important; }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
              Vue {v === 'co' ? 'CO' : v === 'client' ? 'Client' : 'ST'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
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
              disabled={zoom === 'Quarter Day'}
              title="Zoomer"
              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
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
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
        {Object.entries(STATUT_LABELS).map(([k, label]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: STATUT_COLORS[k] }} />
            {label}
          </div>
        ))}
      </div>

      {/* Gantt container */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 overflow-x-auto">
        {loading ? (
          <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
        ) : interventions.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <Calendar className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">Aucune intervention planifiee</p>
            <p className="text-xs text-gray-400 mt-1">Cliquez sur Ajouter ou Generer avec l&apos;IA</p>
          </div>
        ) : (
          <div ref={ganttRef} className="gantt-target" />
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <AddInterventionModal
          projetId={projetId}
          userId={user?.id}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); load() }}
        />
      )}

      {/* Edit Modal */}
      {editing && (
        <EditInterventionModal
          intervention={editing}
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
  projetId, userId, onClose, onSaved,
}: {
  projetId: string
  userId: string | undefined
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [lots, setLots] = useState<Lot[]>([])
  const [sts, setSts] = useState<STOption[]>([])
  const [lotId, setLotId] = useState('')
  const [stId, setStId] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Load lots
  useEffect(() => {
    supabase.schema('app').from('lots').select('id, corps_etat, budget_prevu').eq('projet_id', projetId)
      .then(({ data }) => setLots((data ?? []) as Lot[]))
  }, [projetId, supabase])

  // Load STs validated for selected lot
  useEffect(() => {
    if (!lotId) { setSts([]); setStId(''); return }
    supabase.schema('app').from('sts_prospection')
      .select('st_id, nom')
      .eq('lot_id', lotId)
      .eq('statut', 'validé')
      .then(({ data }) => setSts((data ?? []) as STOption[]))
  }, [lotId, supabase])

  async function handleSave() {
    if (!lotId || !dateDebut || !dateFin) return
    setSaving(true)
    const lot = lots.find(l => l.id === lotId)
    const st = sts.find(s => s.st_id === stId)
    await supabase.schema('app').from('planning_interventions').insert({
      projet_id: projetId,
      lot_id: lotId,
      st_id: stId || null,
      corps_etat: lot?.corps_etat ?? '',
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
    <ModalShell title="Ajouter au planning" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Lot">
          <select value={lotId} onChange={e => setLotId(e.target.value)} className={inputCls}>
            <option value="">Selectionner un lot...</option>
            {lots.map(l => <option key={l.id} value={l.id}>{l.corps_etat}</option>)}
          </select>
        </Field>

        <Field label="Sous-traitant (optionnel)">
          <select value={stId} onChange={e => setStId(e.target.value)} disabled={!lotId} className={inputCls}>
            <option value="">{lotId ? (sts.length ? 'Selectionner un ST...' : 'Aucun ST valide pour ce lot') : 'Choisir un lot d\'abord'}</option>
            {sts.map(s => <option key={s.st_id} value={s.st_id}>{s.nom}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Date debut">
            <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Date fin">
            <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Field label="Notes (optionnel)">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className={cn(inputCls, 'resize-none')} placeholder="Remarques..." />
        </Field>

        <button
          onClick={handleSave}
          disabled={!lotId || !dateDebut || !dateFin || saving}
          className="w-full px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Ajouter au planning'}
        </button>
      </div>
    </ModalShell>
  )
}

/* ── Edit Modal ── */

function EditInterventionModal({
  intervention, onClose, onSaved,
}: {
  intervention: Intervention
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [dateDebut, setDateDebut] = useState(intervention.date_debut)
  const [dateFin, setDateFin] = useState(intervention.date_fin)
  const [statut, setStatut] = useState(intervention.statut)
  const [avancement, setAvancement] = useState(intervention.avancement_pct)
  const [notes, setNotes] = useState(intervention.notes ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await supabase.schema('app').from('planning_interventions')
      .update({ date_debut: dateDebut, date_fin: dateFin, statut, avancement_pct: avancement, notes: notes || null })
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
    <ModalShell title={`${intervention.corps_etat}${intervention.st_nom ? ' - ' + intervention.st_nom : ''}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Date debut">
            <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Date fin">
            <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} className={inputCls} />
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
