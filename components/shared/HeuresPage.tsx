'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { useUser } from '@/hooks/useUser'
import { dateKey, isFerie, isWeekend, joursFeriesFR } from '@/lib/joursFeries'
import {
  ChevronLeft, ChevronRight, Plus, X, Loader2, Trash2, Pencil,
  Calendar as CalendarIcon, Clock, Send, Palmtree, CheckCircle2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Projet = { id: string; nom: string; reference: string | null }

type Entry = {
  id: string
  utilisateur_id: string
  date: string
  projet_id: string | null
  description: string
  heures: number
  created_at: string
}

type Vue = 'jour' | 'semaine' | 'mois' | 'annee'

type CongeType = 'CP' | 'RTT' | 'maladie' | 'sans_solde' | 'familial' | 'autre'
type CongeStatut = 'demande' | 'valide' | 'refuse'

type Conge = {
  id: string
  utilisateur_id: string
  date_debut: string
  date_fin: string
  type: CongeType
  motif: string | null
  statut: CongeStatut
}

const CONGE_TYPE_LABEL: Record<CongeType, string> = {
  CP: 'Conges payes',
  RTT: 'RTT',
  maladie: 'Maladie',
  sans_solde: 'Sans solde',
  familial: 'Familial',
  autre: 'Autre',
}

const CONGE_TYPE_COLOR: Record<CongeType, string> = {
  CP:         'bg-sky-100 text-sky-700 border-sky-200',
  RTT:        'bg-teal-100 text-teal-700 border-teal-200',
  maladie:    'bg-red-100 text-red-700 border-red-200',
  sans_solde: 'bg-gray-100 text-gray-700 border-gray-200',
  familial:   'bg-pink-100 text-pink-700 border-pink-200',
  autre:      'bg-amber-100 text-amber-700 border-amber-200',
}

const CONGE_STATUT_COLOR: Record<CongeStatut, string> = {
  demande: 'bg-amber-100 text-amber-700',
  valide:  'bg-green-100 text-green-700',
  refuse:  'bg-red-100 text-red-700',
}

// Renvoie le conge couvrant la date (ou null)
function congeForDate(d: Date, conges: Conge[]): Conge | null {
  const k = dateKey(d)
  for (const c of conges) {
    if (k >= c.date_debut && k <= c.date_fin) return c
  }
  return null
}

function nbJoursOuvres(start: string, end: string): number {
  const s = new Date(start), e = new Date(end)
  let n = 0
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const wd = d.getDay()
    if (wd !== 0 && wd !== 6) n++
  }
  return n
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfWeek(d: Date): Date {
  const r = new Date(d)
  const wd = r.getDay() // 0=dim, 1=lun, ...
  const diff = wd === 0 ? -6 : 1 - wd
  r.setDate(r.getDate() + diff)
  r.setHours(0, 0, 0, 0)
  return r
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }

const JOURS_COURTS = ['lun','mar','mer','jeu','ven','sam','dim']
const MOIS_LONGS = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre']

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HeuresPage({ roleLabel = 'Collaborateur' }: { roleLabel?: string }) {
  const supabase = useMemo(() => createClient(), [])
  const { profil } = useUser()

  const [projets, setProjets] = useState<Projet[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [conges, setConges]   = useState<Conge[]>([])
  const [loading, setLoading] = useState(true)

  const [vue, setVue] = useState<Vue>('jour')
  const [curDate, setCurDate] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d })

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [showCongeModal, setShowCongeModal] = useState(false)
  const [editingConge, setEditingConge] = useState<Conge | null>(null)

  // Plage chargee selon la vue
  const range = useMemo(() => {
    if (vue === 'jour')    return { from: curDate, to: curDate }
    if (vue === 'semaine') return { from: startOfWeek(curDate), to: addDays(startOfWeek(curDate), 6) }
    if (vue === 'mois')    return { from: startOfMonth(curDate), to: endOfMonth(curDate) }
    return { from: new Date(curDate.getFullYear(), 0, 1), to: new Date(curDate.getFullYear(), 11, 31) }
  }, [vue, curDate])

  async function refresh() {
    if (!profil) return
    setLoading(true)
    const [{ data: pData }, { data: eData }, { data: cData }] = await Promise.all([
      supabase.schema('app').from('projets').select('id, nom, reference').order('nom'),
      supabase.schema('app').from('heures_travail')
        .select('*')
        .eq('utilisateur_id', profil.id)
        .gte('date', dateKey(range.from))
        .lte('date', dateKey(range.to))
        .order('date'),
      // Tous les conges qui chevauchent la plage
      supabase.schema('app').from('conges')
        .select('*')
        .eq('utilisateur_id', profil.id)
        .lte('date_debut', dateKey(range.to))
        .gte('date_fin', dateKey(range.from))
        .order('date_debut'),
    ])
    setProjets((pData ?? []) as Projet[])
    setEntries((eData ?? []) as Entry[])
    setConges((cData ?? []) as Conge[])
    setLoading(false)
  }

  async function supprimerConge(id: string) {
    if (!confirm('Supprimer ce conge ?')) return
    await supabase.schema('app').from('conges').delete().eq('id', id)
    refresh()
  }
  useEffect(() => { refresh() }, [profil?.id, range.from.getTime(), range.to.getTime()])

  function navigate(delta: number) {
    const d = new Date(curDate)
    if (vue === 'jour')    d.setDate(d.getDate() + delta)
    if (vue === 'semaine') d.setDate(d.getDate() + delta * 7)
    if (vue === 'mois')    d.setMonth(d.getMonth() + delta)
    if (vue === 'annee')   d.setFullYear(d.getFullYear() + delta)
    setCurDate(d)
  }

  async function supprimer(id: string) {
    if (!confirm('Supprimer cette ligne ?')) return
    await supabase.schema('app').from('heures_travail').delete().eq('id', id)
    refresh()
  }

  // Dates a afficher selon la vue
  const totalRange = entries.reduce((acc, e) => acc + Number(e.heures), 0)

  const titreNav = vue === 'jour'
    ? curDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : vue === 'semaine'
    ? `Semaine du ${startOfWeek(curDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} au ${addDays(startOfWeek(curDate), 6).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : vue === 'mois'
    ? `${MOIS_LONGS[curDate.getMonth()]} ${curDate.getFullYear()}`
    : `Annee ${curDate.getFullYear()}`

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Heures de travail" subtitle={`Suivi du temps — ${roleLabel}`} />

      {/* Barre vue + nav */}
      <div className="mx-6 mt-4 bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3 flex-wrap">
        <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-1">
          {(['jour','semaine','mois','annee'] as Vue[]).map(v => (
            <button key={v} onClick={() => setVue(v)}
              className={`px-3 py-1 text-sm font-medium rounded-md capitalize transition-colors ${
                vue === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>{v === 'annee' ? 'annee' : v}</button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className="px-3 py-1.5 text-sm font-medium text-gray-900 capitalize min-w-[200px] text-center">
            {titreNav}
          </div>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
          <button onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setCurDate(d) }}
            className="ml-1 px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
            Aujourd&apos;hui
          </button>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-gray-500">Total : <span className="font-bold text-gray-900 tabular-nums">{totalRange.toFixed(1)} h</span></span>
          <button onClick={() => { setEditingConge(null); setShowCongeModal(true) }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-sky-300 text-sky-700 rounded-lg hover:bg-sky-50">
            <Palmtree className="w-3.5 h-3.5" /> Marquer un conge
          </button>
          <button onClick={() => { setEditing(null); setShowModal(true) }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700">
            <Plus className="w-3.5 h-3.5" /> Ajouter une saisie
          </button>
        </div>
      </div>

      {/* Contenu selon vue */}
      <div className="px-6 pt-4 pb-8">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-12">Chargement...</p>
        ) : vue === 'jour' ? (
          <VueJour
            date={curDate}
            entries={entries}
            projets={projets}
            conges={conges}
            onEdit={(e) => { setEditing(e); setShowModal(true) }}
            onDelete={supprimer}
            onEditConge={(c) => { setEditingConge(c); setShowCongeModal(true) }}
            onDeleteConge={supprimerConge}
          />
        ) : vue === 'semaine' ? (
          <VueSemaine
            startDate={startOfWeek(curDate)}
            entries={entries}
            projets={projets}
            conges={conges}
            onCellClick={(d) => { setCurDate(d); setVue('jour') }}
          />
        ) : vue === 'mois' ? (
          <VueMois
            cur={curDate}
            entries={entries}
            conges={conges}
            onDayClick={(d) => { setCurDate(d); setVue('jour') }}
          />
        ) : (
          <VueAnnee
            year={curDate.getFullYear()}
            entries={entries}
            conges={conges}
            onMonthClick={(m) => { setCurDate(new Date(curDate.getFullYear(), m, 1)); setVue('mois') }}
            onDayClick={(d) => { setCurDate(d); setVue('jour') }}
            onEditConge={(c) => { setEditingConge(c); setShowCongeModal(true) }}
            onDeleteConge={supprimerConge}
          />
        )}
      </div>

      {showModal && profil && (
        <SaisieModal
          uid={profil.id}
          date={curDate}
          projets={projets}
          editing={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={() => { setShowModal(false); setEditing(null); refresh() }}
        />
      )}

      {showCongeModal && profil && (
        <CongeModal
          uid={profil.id}
          dateDefault={curDate}
          editing={editingConge}
          onClose={() => { setShowCongeModal(false); setEditingConge(null) }}
          onSaved={() => { setShowCongeModal(false); setEditingConge(null); refresh() }}
        />
      )}
    </div>
  )
}

// ─── Vue Jour ─────────────────────────────────────────────────────────────────

function VueJour({
  date, entries, projets, conges, onEdit, onDelete, onEditConge, onDeleteConge,
}: {
  date: Date
  entries: Entry[]
  projets: Projet[]
  conges: Conge[]
  onEdit: (e: Entry) => void
  onDelete: (id: string) => void
  onEditConge: (c: Conge) => void
  onDeleteConge: (id: string) => void
}) {
  const k = dateKey(date)
  const items = entries.filter(e => e.date === k)
  const total = items.reduce((acc, e) => acc + Number(e.heures), 0)
  const ferie = isFerie(date)
  const weekend = isWeekend(date)
  const conge = congeForDate(date, conges)

  // Group par projet
  const byProjet = new Map<string, Entry[]>()
  for (const e of items) {
    const k = e.projet_id ?? 'sans-projet'
    if (!byProjet.has(k)) byProjet.set(k, [])
    byProjet.get(k)!.push(e)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={`p-4 border-b border-gray-200 flex items-center justify-between ${
        conge ? 'bg-sky-50' : ferie ? 'bg-red-50' : weekend ? 'bg-amber-50' : 'bg-gray-50'
      }`}>
        <div>
          <p className="text-sm font-semibold text-gray-900 capitalize">
            {date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          {ferie && <p className="text-xs text-red-600 mt-0.5">{ferie} (ferie)</p>}
          {!ferie && weekend && <p className="text-xs text-amber-700 mt-0.5">Week-end</p>}
        </div>
        <span className="text-lg font-bold text-gray-900 tabular-nums">{total.toFixed(1)} h</span>
      </div>

      {conge && (
        <div className={`p-3 border-b border-gray-200 flex items-center justify-between ${CONGE_TYPE_COLOR[conge.type]} border-l-4`}>
          <div className="flex items-center gap-2 min-w-0">
            <Palmtree className="w-4 h-4 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {CONGE_TYPE_LABEL[conge.type]}
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${CONGE_STATUT_COLOR[conge.statut]}`}>{conge.statut}</span>
              </p>
              <p className="text-xs opacity-80">
                Du {new Date(conge.date_debut).toLocaleDateString('fr-FR')} au {new Date(conge.date_fin).toLocaleDateString('fr-FR')}
                {conge.motif ? ` — ${conge.motif}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => onEditConge(conge)} title="Modifier" className="p-1 opacity-70 hover:opacity-100">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDeleteConge(conge.id)} title="Supprimer" className="p-1 opacity-70 hover:opacity-100 hover:text-red-700">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-10 h-10 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Aucune saisie pour cette journee</p>
          <p className="text-xs text-gray-300 mt-1">Clique sur « Ajouter une saisie » pour demarrer</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {[...byProjet.entries()].map(([projetId, list]) => {
            const projet = projets.find(p => p.id === projetId)
            const sub = list.reduce((acc, e) => acc + Number(e.heures), 0)
            return (
              <div key={projetId} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-900">
                    {projet ? `${projet.reference ? `${projet.reference} — ` : ''}${projet.nom}` : 'Sans projet'}
                  </p>
                  <span className="text-sm font-medium text-gray-700 tabular-nums">{sub.toFixed(1)} h</span>
                </div>
                <ul className="space-y-1">
                  {list.map(e => (
                    <li key={e.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 group">
                      <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 flex-1">{e.description}</span>
                      <span className="text-sm font-medium text-gray-900 tabular-nums">{Number(e.heures).toFixed(1)} h</span>
                      <button onClick={() => onEdit(e)} className="text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDelete(e.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Vue Semaine ──────────────────────────────────────────────────────────────

function VueSemaine({
  startDate, entries, projets, conges, onCellClick,
}: {
  startDate: Date
  entries: Entry[]
  projets: Projet[]
  conges: Conge[]
  onCellClick: (d: Date) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, i))

  // Map projet_id -> Map date_key -> total
  const grid = new Map<string, Map<string, number>>()
  const totalsByProjet = new Map<string, number>()
  for (const e of entries) {
    const pid = e.projet_id ?? 'sans-projet'
    if (!grid.has(pid)) grid.set(pid, new Map())
    const m = grid.get(pid)!
    m.set(e.date, (m.get(e.date) ?? 0) + Number(e.heures))
    totalsByProjet.set(pid, (totalsByProjet.get(pid) ?? 0) + Number(e.heures))
  }

  const projetsAffiches = [...grid.keys()]
  const totalsByDay = days.map(d => {
    const k = dateKey(d)
    return entries.filter(e => e.date === k).reduce((acc, e) => acc + Number(e.heures), 0)
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left p-3 font-semibold text-gray-600 sticky left-0 bg-white">Projet</th>
            {days.map(d => {
              const ferie = isFerie(d)
              const we = isWeekend(d)
              const c = congeForDate(d, conges)
              return (
                <th key={dateKey(d)}
                  onClick={() => onCellClick(d)}
                  className={`p-2 text-center font-semibold text-xs cursor-pointer hover:bg-gray-50 ${
                    c ? 'bg-sky-50 text-sky-700' : ferie ? 'bg-red-50 text-red-700' : we ? 'bg-amber-50 text-amber-700' : 'text-gray-600'
                  }`}>
                  <div className="capitalize">{JOURS_COURTS[d.getDay() === 0 ? 6 : d.getDay() - 1]}</div>
                  <div className="text-base text-gray-900 mt-0.5">{d.getDate()}</div>
                  {c && <div className="text-[10px] mt-0.5 truncate inline-flex items-center gap-0.5"><Palmtree className="w-2.5 h-2.5" />{c.type}</div>}
                  {!c && ferie && <div className="text-[10px] mt-0.5 truncate" title={ferie}>{ferie}</div>}
                </th>
              )
            })}
            <th className="p-3 text-right text-xs text-gray-500 bg-gray-50">Total</th>
          </tr>
        </thead>
        <tbody>
          {projetsAffiches.length === 0 ? (
            <tr>
              <td colSpan={9} className="text-center py-12 text-gray-400 text-sm">Aucune heure saisie cette semaine</td>
            </tr>
          ) : (
            projetsAffiches.map(pid => {
              const projet = projets.find(p => p.id === pid)
              const cells = grid.get(pid)!
              const total = totalsByProjet.get(pid) ?? 0
              return (
                <tr key={pid} className="border-b border-gray-100">
                  <td className="p-3 font-medium text-gray-900 sticky left-0 bg-white">
                    {projet ? `${projet.reference ? `${projet.reference} — ` : ''}${projet.nom}` : 'Sans projet'}
                  </td>
                  {days.map(d => {
                    const v = cells.get(dateKey(d))
                    const ferie = isFerie(d)
                    const we = isWeekend(d)
                    const c = congeForDate(d, conges)
                    return (
                      <td key={dateKey(d)}
                        onClick={() => onCellClick(d)}
                        className={`p-2 text-center cursor-pointer hover:bg-gray-50 tabular-nums ${
                          c ? 'bg-sky-50/60' : ferie ? 'bg-red-50/40' : we ? 'bg-amber-50/40' : ''
                        }`}>
                        {v ? <span className="text-sm font-medium text-gray-900">{v.toFixed(1)}</span> :
                          c ? <Palmtree className="w-3.5 h-3.5 text-sky-600 inline" /> :
                          <span className="text-gray-200">—</span>}
                      </td>
                    )
                  })}
                  <td className="p-3 text-right font-semibold text-gray-900 tabular-nums bg-gray-50">{total.toFixed(1)}</td>
                </tr>
              )
            })
          )}
          <tr className="border-t-2 border-gray-200 bg-gray-50/50">
            <td className="p-3 font-semibold text-gray-700 sticky left-0 bg-gray-50/50">Total</td>
            {totalsByDay.map((t, i) => (
              <td key={i} className="p-2 text-center font-bold text-gray-900 tabular-nums">
                {t > 0 ? t.toFixed(1) : '—'}
              </td>
            ))}
            <td className="p-3 text-right font-bold text-gray-900 tabular-nums bg-gray-100">
              {totalsByDay.reduce((a, b) => a + b, 0).toFixed(1)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Vue Mois ─────────────────────────────────────────────────────────────────

function VueMois({
  cur, entries, conges, onDayClick,
}: {
  cur: Date
  entries: Entry[]
  conges: Conge[]
  onDayClick: (d: Date) => void
}) {
  const start = startOfMonth(cur)
  const end = endOfMonth(cur)
  // Premiere case = lundi de la semaine du 1er
  const gridStart = startOfWeek(start)
  const totalCells = 42 // 6 semaines max
  const cells = Array.from({ length: totalCells }, (_, i) => addDays(gridStart, i))
  // On coupe au dernier jour du mois (mais on garde des semaines completes pour aligner)
  const lastWeekendShown = cells.findIndex(c => c > end && c.getDay() === 1)
  const truncated = lastWeekendShown > 0 ? cells.slice(0, lastWeekendShown) : cells

  // Sum par jour
  const totals = new Map<string, number>()
  for (const e of entries) totals.set(e.date, (totals.get(e.date) ?? 0) + Number(e.heures))
  const monthTotal = entries.reduce((a, e) => a + Number(e.heures), 0)

  const month = cur.getMonth()

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-200">
        {JOURS_COURTS.map(j => (
          <div key={j} className="p-2 text-center text-xs font-semibold text-gray-500 capitalize border-r border-gray-100 last:border-r-0">{j}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {truncated.map((d, i) => {
          const k = dateKey(d)
          const inMonth = d.getMonth() === month
          const ferie = isFerie(d)
          const we = isWeekend(d)
          const c = congeForDate(d, conges)
          const total = totals.get(k) ?? 0
          const isToday = dateKey(new Date()) === k
          return (
            <button key={i} onClick={() => onDayClick(d)}
              className={`p-2 min-h-[80px] text-left border-r border-b border-gray-100 last:border-r-0 transition-colors ${
                !inMonth ? 'bg-gray-50/50 text-gray-300' :
                c ? 'bg-sky-50 hover:bg-sky-100' :
                ferie ? 'bg-red-50 hover:bg-red-100' :
                we ? 'bg-amber-50 hover:bg-amber-100' :
                'hover:bg-gray-50'
              }`}>
              <div className="flex items-start justify-between">
                <span className={`text-sm font-medium ${
                  isToday && inMonth ? 'bg-gray-900 text-white px-1.5 rounded-full' :
                  c && inMonth ? 'text-sky-700' :
                  ferie && inMonth ? 'text-red-700' :
                  we && inMonth ? 'text-amber-700' :
                  inMonth ? 'text-gray-900' : 'text-gray-300'
                }`}>{d.getDate()}</span>
                {total > 0 && inMonth && (
                  <span className="text-xs font-semibold text-gray-900 tabular-nums">{total.toFixed(1)}h</span>
                )}
              </div>
              {c && inMonth && (
                <p className="text-[10px] text-sky-700 mt-1 inline-flex items-center gap-0.5"><Palmtree className="w-2.5 h-2.5" />{CONGE_TYPE_LABEL[c.type]}</p>
              )}
              {!c && ferie && inMonth && (
                <p className="text-[10px] text-red-600 mt-1 line-clamp-2">{ferie}</p>
              )}
            </button>
          )
        })}
      </div>
      <div className="px-4 py-2.5 border-t border-gray-200 flex justify-between items-center bg-gray-50">
        <span className="text-xs text-gray-500">
          <span className="inline-block w-3 h-3 rounded bg-red-100 align-middle mr-1" /> Ferie
          <span className="inline-block w-3 h-3 rounded bg-amber-100 align-middle ml-3 mr-1" /> Week-end
          <span className="inline-block w-3 h-3 rounded bg-sky-100 align-middle ml-3 mr-1" /> Conge
        </span>
        <span className="text-sm font-bold text-gray-900 tabular-nums">Total mois : {monthTotal.toFixed(1)} h</span>
      </div>
    </div>
  )
}

// ─── Vue Annee ────────────────────────────────────────────────────────────────

function VueAnnee({
  year, entries, conges, onMonthClick, onDayClick, onEditConge, onDeleteConge,
}: {
  year: number
  entries: Entry[]
  conges: Conge[]
  onMonthClick: (month: number) => void
  onDayClick: (d: Date) => void
  onEditConge: (c: Conge) => void
  onDeleteConge: (id: string) => void
}) {
  // Total par jour pour la heatmap
  const totalsByDay = new Map<string, number>()
  for (const e of entries) totalsByDay.set(e.date, (totalsByDay.get(e.date) ?? 0) + Number(e.heures))

  // Total par mois
  const totalsByMonth = Array(12).fill(0) as number[]
  for (const e of entries) {
    const d = new Date(e.date)
    if (d.getFullYear() === year) totalsByMonth[d.getMonth()] += Number(e.heures)
  }
  const yearTotal = totalsByMonth.reduce((a, b) => a + b, 0)
  const maxDay = Math.max(...[...totalsByDay.values()], 0)

  // Compteurs conges
  const congesByType = new Map<CongeType, number>()
  for (const c of conges) {
    // ne compter que les jours dans l'annee, ouvres
    const debut = c.date_debut < `${year}-01-01` ? `${year}-01-01` : c.date_debut
    const fin   = c.date_fin   > `${year}-12-31` ? `${year}-12-31` : c.date_fin
    if (debut > fin) continue
    const n = nbJoursOuvres(debut, fin)
    congesByType.set(c.type, (congesByType.get(c.type) ?? 0) + n)
  }
  const totalConges = [...congesByType.values()].reduce((a, b) => a + b, 0)

  function intensityCls(h: number): string {
    if (h <= 0) return 'bg-gray-100'
    if (maxDay === 0) return 'bg-gray-100'
    const ratio = h / maxDay
    if (ratio < 0.25) return 'bg-violet-100'
    if (ratio < 0.5)  return 'bg-violet-300'
    if (ratio < 0.75) return 'bg-violet-500'
    return 'bg-violet-700'
  }

  return (
    <div className="space-y-4">
      {/* Resume conges */}
      {totalConges > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Palmtree className="w-4 h-4 text-sky-600" /> Conges {year}
            </h4>
            <span className="text-sm font-bold text-gray-900 tabular-nums">{totalConges} jour{totalConges > 1 ? 's' : ''} ouvre{totalConges > 1 ? 's' : ''}</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {[...congesByType.entries()].map(([type, n]) => (
              <div key={type} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${CONGE_TYPE_COLOR[type]}`}>
                <span className="font-semibold">{CONGE_TYPE_LABEL[type]}</span>
                <span className="font-bold tabular-nums">{n}j</span>
              </div>
            ))}
          </div>
          <ul className="divide-y divide-gray-100">
            {conges
              .filter(c => c.date_debut <= `${year}-12-31` && c.date_fin >= `${year}-01-01`)
              .map(c => {
                const debut = c.date_debut < `${year}-01-01` ? `${year}-01-01` : c.date_debut
                const fin   = c.date_fin   > `${year}-12-31` ? `${year}-12-31` : c.date_fin
                const nbJ = nbJoursOuvres(debut, fin)
                return (
                  <li key={c.id} className="py-2 flex items-center gap-3 group">
                    <span className={`text-xs px-2 py-0.5 rounded border ${CONGE_TYPE_COLOR[c.type]} flex-shrink-0`}>
                      {CONGE_TYPE_LABEL[c.type]}
                    </span>
                    <span className="text-sm text-gray-700 flex-1">
                      Du {new Date(c.date_debut).toLocaleDateString('fr-FR')} au {new Date(c.date_fin).toLocaleDateString('fr-FR')}
                      {c.motif && <span className="text-gray-500"> — {c.motif}</span>}
                    </span>
                    <span className="text-xs text-gray-500 tabular-nums">{nbJ}j ouvres</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${CONGE_STATUT_COLOR[c.statut]}`}>{c.statut}</span>
                    <button onClick={() => onEditConge(c)} className="text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDeleteConge(c.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                )
              })}
          </ul>
        </div>
      )}

      {/* Tuiles mensuelles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {MOIS_LONGS.map((mois, i) => {
          const total = totalsByMonth[i]
          return (
            <button key={mois} onClick={() => onMonthClick(i)}
              className="bg-white rounded-xl border border-gray-200 p-3 text-left hover:shadow-md hover:border-gray-300 transition-all">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-700 capitalize">{mois}</p>
                <span className="text-xs text-gray-400">{year}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">{total.toFixed(1)}<span className="text-sm text-gray-400 ml-0.5">h</span></p>
              {/* mini barre */}
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all"
                  style={{ width: `${maxDay > 0 ? Math.min(100, (total / Math.max(...totalsByMonth)) * 100) : 0}%` }} />
              </div>
            </button>
          )
        })}
      </div>

      {/* Heatmap (1 case par jour) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900">Activite quotidienne</h4>
          <span className="text-sm font-bold text-gray-900 tabular-nums">Total annee : {yearTotal.toFixed(1)} h</span>
        </div>
        <YearHeatmap year={year} totalsByDay={totalsByDay} maxDay={maxDay} conges={conges} intensityCls={intensityCls} onDayClick={onDayClick} />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            <span className="inline-block w-3 h-3 rounded bg-red-100 align-middle mr-1" /> Ferie
            <span className="inline-block w-3 h-3 rounded bg-sky-300 align-middle ml-3 mr-1" /> Conge
          </span>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>Moins</span>
            <span className="inline-block w-3 h-3 rounded bg-gray-100" />
            <span className="inline-block w-3 h-3 rounded bg-violet-100" />
            <span className="inline-block w-3 h-3 rounded bg-violet-300" />
            <span className="inline-block w-3 h-3 rounded bg-violet-500" />
            <span className="inline-block w-3 h-3 rounded bg-violet-700" />
            <span>Plus</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function YearHeatmap({
  year, totalsByDay, maxDay, conges, intensityCls, onDayClick,
}: {
  year: number
  totalsByDay: Map<string, number>
  maxDay: number
  conges: Conge[]
  intensityCls: (h: number) => string
  onDayClick: (d: Date) => void
}) {
  // 53 colonnes (semaines), 7 lignes (lun-dim)
  // Premier jour : lundi de la semaine du 1er janvier
  const jan1 = new Date(year, 0, 1)
  const start = startOfWeek(jan1)
  const dec31 = new Date(year, 11, 31)
  const totalWeeks = Math.ceil(((dec31.getTime() - start.getTime()) / 86400000 + 1) / 7)

  const months: { month: number; col: number }[] = []
  let lastMonth = -1
  for (let w = 0; w < totalWeeks; w++) {
    const d = addDays(start, w * 7 + 3) // milieu de semaine pour determiner le mois
    if (d.getFullYear() === year && d.getMonth() !== lastMonth) {
      months.push({ month: d.getMonth(), col: w })
      lastMonth = d.getMonth()
    }
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Mois en haut */}
        <div className="grid grid-flow-col gap-[3px] mb-1 ml-[28px] text-[10px] text-gray-500 capitalize" style={{ gridTemplateColumns: `repeat(${totalWeeks}, 12px)` }}>
          {Array.from({ length: totalWeeks }, (_, w) => {
            const m = months.find(x => x.col === w)
            return <div key={w} className="text-left">{m ? MOIS_LONGS[m.month].slice(0, 3) : ''}</div>
          })}
        </div>

        <div className="flex gap-1">
          {/* Labels jours a gauche */}
          <div className="grid grid-rows-7 gap-[3px] text-[10px] text-gray-400 pr-1.5 w-[24px]">
            {['lun','','mer','','ven','','dim'].map((j, i) => (
              <div key={i} className="h-[12px] leading-[12px] text-right">{j}</div>
            ))}
          </div>

          {/* Cellules : 7 lignes × N colonnes */}
          <div className="grid grid-rows-7 grid-flow-col gap-[3px]">
            {Array.from({ length: totalWeeks * 7 }, (_, idx) => {
              const w = Math.floor(idx / 7)
              const r = idx % 7
              const d = addDays(start, w * 7 + r)
              const inYear = d.getFullYear() === year
              if (!inYear) {
                return <div key={idx} className="w-[12px] h-[12px]" />
              }
              const k = dateKey(d)
              const h = totalsByDay.get(k) ?? 0
              const ferie = isFerie(d)
              const c = congeForDate(d, conges)
              const cls = c ? 'bg-sky-300' : (ferie && h === 0) ? 'bg-red-100' : intensityCls(h)
              return (
                <button
                  key={idx}
                  onClick={() => onDayClick(d)}
                  title={`${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}${ferie ? ` (${ferie})` : ''}${c ? ` — ${CONGE_TYPE_LABEL[c.type]}` : ''} — ${h.toFixed(1)} h`}
                  className={`w-[12px] h-[12px] rounded-[2px] ${cls} hover:ring-2 hover:ring-gray-900 hover:ring-offset-1 transition-all`}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modale saisie ────────────────────────────────────────────────────────────

function SaisieModal({
  uid, date, projets, editing, onClose, onSaved,
}: {
  uid: string
  date: Date
  projets: Projet[]
  editing: Entry | null
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [dateStr, setDateStr] = useState(editing?.date ?? dateKey(date))
  const [lignes, setLignes] = useState<{ projet_id: string; description: string; heures: string }[]>(
    editing
      ? [{ projet_id: editing.projet_id ?? '', description: editing.description, heures: String(editing.heures) }]
      : [{ projet_id: '', description: '', heures: '' }]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function patch(i: number, k: 'projet_id' | 'description' | 'heures', v: string) {
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l))
  }
  function ajouter() {
    setLignes(prev => [...prev, { projet_id: prev[prev.length - 1]?.projet_id ?? '', description: '', heures: '' }])
  }
  function supprimer(i: number) {
    setLignes(prev => prev.filter((_, idx) => idx !== i))
  }

  const total = lignes.reduce((a, l) => a + (parseFloat(l.heures || '0') || 0), 0)

  async function envoyer() {
    setError(null)
    if (!dateStr) { setError('Date requise'); return }
    const valides = lignes.filter(l => l.description.trim() && (parseFloat(l.heures || '0') || 0) > 0)
    if (valides.length === 0) { setError('Saisis au moins une ligne (tache + heures)'); return }
    if (total > 24) { setError('Total > 24h sur la journee'); return }
    setSaving(true)
    try {
      if (editing) {
        const l = valides[0]
        const { error: e } = await supabase.schema('app').from('heures_travail').update({
          date: dateStr,
          projet_id: l.projet_id || null,
          description: l.description.trim(),
          heures: parseFloat(l.heures),
        }).eq('id', editing.id)
        if (e) throw e
      } else {
        const payload = valides.map(l => ({
          utilisateur_id: uid,
          date: dateStr,
          projet_id: l.projet_id || null,
          description: l.description.trim(),
          heures: parseFloat(l.heures),
        }))
        const { error: e } = await supabase.schema('app').from('heures_travail').insert(payload)
        if (e) throw e
      }
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    }
    setSaving(false)
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              {editing ? 'Modifier la saisie' : 'Saisie d\'heures'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Choisis projet, decris la tache, indique le temps passe.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Date *</label>
            <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} className={inputCls} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-600">Lignes</label>
              {!editing && (
                <button onClick={ajouter}
                  className="text-xs text-gray-700 inline-flex items-center gap-1 px-2 py-1 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50">
                  <Plus className="w-3 h-3" /> Ajouter une ligne
                </button>
              )}
            </div>
            {lignes.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start bg-gray-50 p-2 rounded-lg">
                <div className="col-span-4">
                  <select value={l.projet_id} onChange={e => patch(i, 'projet_id', e.target.value)}
                    className={`${inputCls} bg-white`}>
                    <option value="">Sans projet</option>
                    {projets.map(p => (
                      <option key={p.id} value={p.id}>{p.reference ? `${p.reference} — ` : ''}{p.nom}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-6">
                  <input value={l.description} onChange={e => patch(i, 'description', e.target.value)}
                    placeholder="Tache realisee (ex: Plan APD V2 indice B)" className={inputCls} />
                </div>
                <div className="col-span-2 flex items-center gap-1">
                  <input type="number" step="0.25" min="0" max="24"
                    value={l.heures} onChange={e => patch(i, 'heures', e.target.value)}
                    placeholder="2.5" className={inputCls} />
                  {!editing && lignes.length > 1 && (
                    <button onClick={() => supprimer(i)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200">
            <span className="text-sm text-gray-500">Total :</span>
            <span className={`text-lg font-bold tabular-nums ${total > 24 ? 'text-red-600' : 'text-gray-900'}`}>
              {total.toFixed(1)} h
            </span>
          </div>

          {error && <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
          <button onClick={envoyer} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {editing ? 'Enregistrer' : 'Enregistrer la saisie'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modale Conge ─────────────────────────────────────────────────────────────

function CongeModal({
  uid, dateDefault, editing, onClose, onSaved,
}: {
  uid: string
  dateDefault: Date
  editing: Conge | null
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [dateDebut, setDateDebut] = useState(editing?.date_debut ?? dateKey(dateDefault))
  const [dateFin, setDateFin]     = useState(editing?.date_fin ?? dateKey(dateDefault))
  const [type, setType]           = useState<CongeType>(editing?.type ?? 'CP')
  const [motif, setMotif]         = useState(editing?.motif ?? '')
  const [statut, setStatut]       = useState<CongeStatut>(editing?.statut ?? 'demande')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const nbJ = dateDebut && dateFin && dateDebut <= dateFin ? nbJoursOuvres(dateDebut, dateFin) : 0

  async function envoyer() {
    setError(null)
    if (!dateDebut || !dateFin) { setError('Dates requises'); return }
    if (dateDebut > dateFin) { setError('Date de fin avant la date de debut'); return }
    setSaving(true)
    try {
      const payload = {
        utilisateur_id: uid,
        date_debut: dateDebut,
        date_fin: dateFin,
        type,
        motif: motif.trim() || null,
        statut,
      }
      if (editing) {
        const { error: e } = await supabase.schema('app').from('conges').update(payload).eq('id', editing.id)
        if (e) throw e
      } else {
        const { error: e } = await supabase.schema('app').from('conges').insert([payload])
        if (e) throw e
      }
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    }
    setSaving(false)
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Palmtree className="w-4 h-4 text-sky-600" />
              {editing ? 'Modifier le conge' : 'Marquer un conge'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Selectionne la periode et le type</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Type *</label>
            <div className="grid grid-cols-3 gap-2">
              {(['CP','RTT','maladie','sans_solde','familial','autre'] as CongeType[]).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                    type === t ? `${CONGE_TYPE_COLOR[t]} font-semibold` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}>
                  {CONGE_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Du *</label>
              <input type="date" value={dateDebut} onChange={e => { setDateDebut(e.target.value); if (e.target.value > dateFin) setDateFin(e.target.value) }} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Au *</label>
              <input type="date" value={dateFin} min={dateDebut} onChange={e => setDateFin(e.target.value)} className={inputCls} />
            </div>
          </div>

          {nbJ > 0 && (
            <div className="p-2 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-800 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {nbJ} jour{nbJ > 1 ? 's' : ''} ouvre{nbJ > 1 ? 's' : ''}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Motif (optionnel)</label>
            <textarea rows={2} value={motif} onChange={e => setMotif(e.target.value)}
              placeholder="Voyage, RDV medical, etc." className={`${inputCls} resize-none placeholder-gray-300`} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Statut</label>
            <div className="flex gap-2">
              {(['demande','valide','refuse'] as CongeStatut[]).map(s => (
                <button key={s} onClick={() => setStatut(s)}
                  className={`flex-1 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    statut === s ? `${CONGE_STATUT_COLOR[s]} font-semibold border-transparent` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
          <button onClick={envoyer} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-40">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Palmtree className="w-3.5 h-3.5" />}
            {editing ? 'Enregistrer' : 'Marquer le conge'}
          </button>
        </div>
      </div>
    </div>
  )
}
