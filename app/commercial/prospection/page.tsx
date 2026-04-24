'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Target, Flame, TrendingUp, CalendarClock, Trash2, Mail, Phone, Briefcase, ArrowRightCircle, Check, Loader2 } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { formatCurrency, formatDateShort, cn } from '@/lib/utils'

type Statut = 'premier_contact' | 'reunion_decouverte' | 'proposition_envoyee' | 'negociation' | 'gagne' | 'perdu'
type Temperature = 'froid' | 'chaud' | 'brulant'
type Source = 'recommandation' | 'ancien_client' | 'prospection' | 'appel_offres' | 'site_web' | 'linkedin' | 'evenement' | 'autre'

interface Prospect {
  id: string
  nom: string
  societe: string | null
  email: string | null
  telephone: string | null
  source: Source | null
  apporteur: string | null
  statut: Statut
  temperature: Temperature | null
  motif_perte: string | null
  budget_estime: number | null
  prochaine_action: string | null
  date_prochaine_action: string | null
  notes: string | null
  commercial_id: string | null
  converti_projet_id: string | null
  created_at: string
  updated_at: string
}

const COLUMNS: { key: Statut; label: string; dot: string }[] = [
  { key: 'premier_contact',     label: 'Premier contact',     dot: 'bg-gray-400' },
  { key: 'reunion_decouverte',  label: 'Réunion découverte',  dot: 'bg-orange-500' },
  { key: 'proposition_envoyee', label: 'Proposition envoyée', dot: 'bg-blue-500' },
  { key: 'negociation',         label: 'Négociation',         dot: 'bg-violet-500' },
  { key: 'gagne',               label: 'Gagné',               dot: 'bg-emerald-500' },
  { key: 'perdu',               label: 'Perdu',               dot: 'bg-red-500' },
]

const SOURCE_LABELS: Record<Source, string> = {
  recommandation: 'Recommandation',
  ancien_client:  'Ancien client',
  prospection:    'Prospection',
  appel_offres:   "Appel d'offres",
  site_web:       'Site web',
  linkedin:       'LinkedIn',
  evenement:      'Événement',
  autre:          'Autre',
}

const TEMPERATURE_STYLES: Record<Temperature, { bg: string; text: string; label: string }> = {
  froid:   { bg: '#F1EFE8', text: '#5F5E5A', label: 'Froid' },
  chaud:   { bg: '#FAEEDA', text: '#854F0B', label: 'Chaud' },
  brulant: { bg: '#FCEBEB', text: '#A32D2D', label: 'Brûlant' },
}

function todayIso() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function ProspectionPage() {
  const { user, loading } = useUser()
  const supabase = useMemo(() => createClient(), [])
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [fetching, setFetching]   = useState(true)
  const [newOpen, setNewOpen]     = useState(false)
  const [activeId, setActiveId]   = useState<string | null>(null)
  const [defaultStatut, setDefaultStatut] = useState<Statut>('premier_contact')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<Statut | null>(null)

  useEffect(() => {
    if (!user) return
    setFetching(true)
    supabase
      .from('prospects')
      .select('*')
      .eq('commercial_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setProspects((data ?? []) as unknown as Prospect[])
        setFetching(false)
      })
  }, [user, supabase])

  const byStatut = useMemo(() => {
    const map: Record<Statut, Prospect[]> = {
      premier_contact: [], reunion_decouverte: [], proposition_envoyee: [],
      negociation: [], gagne: [], perdu: [],
    }
    for (const p of prospects) map[p.statut]?.push(p)
    return map
  }, [prospects])

  const metrics = useMemo(() => {
    const actifs = prospects.filter(p => p.statut !== 'gagne' && p.statut !== 'perdu')
    const brulants = actifs.filter(p => p.temperature === 'brulant').length
    const pipeline = actifs.reduce((sum, p) => sum + (p.budget_estime ?? 0), 0)
    const today = todayIso()
    const relances = prospects.filter(p => p.date_prochaine_action === today).length
    return { actifs: actifs.length, pipeline, brulants, relances }
  }, [prospects])

  const updateLocal = useCallback((p: Prospect) => {
    setProspects(prev => prev.map(x => x.id === p.id ? p : x))
  }, [])

  const removeLocal = useCallback((id: string) => {
    setProspects(prev => prev.filter(x => x.id !== id))
    setActiveId(null)
  }, [])

  const addLocal = useCallback((p: Prospect) => {
    setProspects(prev => [p, ...prev])
  }, [])

  const moveToStatut = useCallback(async (id: string, statut: Statut) => {
    const current = prospects.find(p => p.id === id)
    if (!current || current.statut === statut) return
    setProspects(prev => prev.map(x => x.id === id ? { ...x, statut } : x))
    const { error } = await supabase
      .from('prospects')
      .update({ statut })
      .eq('id', id)
    if (error) {
      setProspects(prev => prev.map(x => x.id === id ? { ...x, statut: current.statut } : x))
    }
  }, [prospects, supabase])

  const changeTemperature = useCallback(async (id: string, temperature: Temperature) => {
    const current = prospects.find(p => p.id === id)
    if (!current || current.temperature === temperature) return
    setProspects(prev => prev.map(x => x.id === id ? { ...x, temperature } : x))
    const { error } = await supabase
      .from('prospects')
      .update({ temperature })
      .eq('id', id)
    if (error) {
      setProspects(prev => prev.map(x => x.id === id ? { ...x, temperature: current.temperature } : x))
    }
  }, [prospects, supabase])

  const active = activeId ? prospects.find(p => p.id === activeId) ?? null : null

  return (
    <div>
      <TopBar
        title="Prospection"
        subtitle={`${prospects.length} prospect${prospects.length !== 1 ? 's' : ''} dans votre pipeline`}
      />

      <div className="p-6 space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Prospects actifs"
            value={String(metrics.actifs)}
            icon={<Target className="w-4 h-4 text-blue-500" />}
            tint="bg-blue-50"
          />
          <MetricCard
            label="Pipeline total"
            value={formatCurrency(metrics.pipeline || 0)}
            icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
            tint="bg-emerald-50"
          />
          <MetricCard
            label="Prospects brûlants"
            value={String(metrics.brulants)}
            icon={<Flame className="w-4 h-4 text-red-500" />}
            tint="bg-red-50"
          />
          <MetricCard
            label="Relances aujourd'hui"
            value={String(metrics.relances)}
            icon={<CalendarClock className="w-4 h-4 text-amber-500" />}
            tint="bg-amber-50"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end">
          <button
            onClick={() => { setDefaultStatut('premier_contact'); setNewOpen(true) }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau prospect
          </button>
        </div>

        {/* Kanban */}
        {loading || fetching ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {COLUMNS.map(col => (
                <KanbanColumn
                  key={col.key}
                  column={col}
                  items={byStatut[col.key]}
                  onCardClick={id => setActiveId(id)}
                  onAdd={col.key === 'perdu' ? null : () => {
                    setDefaultStatut(col.key)
                    setNewOpen(true)
                  }}
                  draggingId={draggingId}
                  isDragOver={dragOverCol === col.key}
                  onDragStart={id => setDraggingId(id)}
                  onDragEnd={() => { setDraggingId(null); setDragOverCol(null) }}
                  onDragEnterCol={() => setDragOverCol(col.key)}
                  onDropCol={id => {
                    moveToStatut(id, col.key)
                    setDraggingId(null)
                    setDragOverCol(null)
                  }}
                  onChangeTemp={changeTemperature}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {newOpen && user && (
        <NewProspectModal
          userId={user.id}
          defaultStatut={defaultStatut}
          onClose={() => setNewOpen(false)}
          onCreated={p => { addLocal(p); setNewOpen(false) }}
        />
      )}

      {active && (
        <ProspectDrawer
          prospect={active}
          onClose={() => setActiveId(null)}
          onChange={updateLocal}
          onDelete={removeLocal}
        />
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */

function MetricCard({ label, value, icon, tint }: { label: string; value: string; icon: React.ReactNode; tint: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4 flex items-center gap-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', tint)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-base font-semibold text-gray-900 truncate">{value}</p>
      </div>
    </div>
  )
}

function KanbanColumn({
  column, items, onCardClick, onAdd,
  draggingId, isDragOver, onDragStart, onDragEnd, onDragEnterCol, onDropCol, onChangeTemp,
}: {
  column: { key: Statut; label: string; dot: string }
  items: Prospect[]
  onCardClick: (id: string) => void
  onAdd: (() => void) | null
  draggingId: string | null
  isDragOver: boolean
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDragEnterCol: () => void
  onDropCol: (id: string) => void
  onChangeTemp: (id: string, t: Temperature) => void
}) {
  return (
    <div
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
      onDragEnter={onDragEnterCol}
      onDrop={e => {
        e.preventDefault()
        const id = e.dataTransfer.getData('text/plain') || draggingId
        if (id) onDropCol(id)
      }}
      className={cn(
        'flex-shrink-0 w-60 rounded-lg flex flex-col transition-colors',
        isDragOver && 'ring-2 ring-gray-900/20',
      )}
      style={{ backgroundColor: 'var(--color-background-secondary, #f5f5f0)' }}
    >
      <div className="px-3 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', column.dot)} />
          <h3 className="text-sm font-semibold text-gray-800 truncate">{column.label}</h3>
        </div>
        <span className="text-xs text-gray-500 font-medium">{items.length}</span>
      </div>

      <div className="flex-1 px-2 space-y-2 pb-2 min-h-[120px]">
        {items.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">Aucun prospect</p>
        ) : (
          items.map(p => (
            <ProspectCard
              key={p.id}
              prospect={p}
              onClick={() => onCardClick(p.id)}
              isDragging={draggingId === p.id}
              onDragStart={e => {
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', p.id)
                onDragStart(p.id)
              }}
              onDragEnd={onDragEnd}
              onChangeTemp={t => onChangeTemp(p.id, t)}
            />
          ))
        )}
      </div>

      {onAdd && (
        <div className="p-2">
          <button
            onClick={onAdd}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-white/60 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </button>
        </div>
      )}
    </div>
  )
}

function ProspectCard({
  prospect, onClick, isDragging, onDragStart, onDragEnd, onChangeTemp,
}: {
  prospect: Prospect
  onClick: () => void
  isDragging: boolean
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
  onChangeTemp: (t: Temperature) => void
}) {
  const isPerdu = prospect.statut === 'perdu'
  const sourceLabel = prospect.source ? SOURCE_LABELS[prospect.source] : null

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className={cn(
        'w-full text-left bg-white rounded-lg border-[0.5px] border-gray-200 shadow-card p-3 hover:border-gray-300 hover:shadow transition-all space-y-2 cursor-grab active:cursor-grabbing',
        isPerdu && 'opacity-70',
        isDragging && 'opacity-40',
      )}
    >
      <div>
        <p className="text-sm font-semibold text-gray-900 truncate">{prospect.nom}</p>
        {prospect.societe && (
          <p className="text-xs text-gray-500 truncate">{prospect.societe}</p>
        )}
        {sourceLabel && (
          <p className="text-[11px] text-gray-400 mt-1">Via {sourceLabel}</p>
        )}
      </div>

      {(prospect.budget_estime || isPerdu) && <div className="h-px bg-gray-100" />}

      {prospect.budget_estime != null && (
        <p className="text-xs font-semibold text-gray-700">
          {formatCurrency(prospect.budget_estime)}
        </p>
      )}

      {isPerdu && prospect.motif_perte && (
        <span
          className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: '#FCEBEB', color: '#A32D2D' }}
        >
          {prospect.motif_perte}
        </span>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[11px] text-gray-400 truncate">
          {prospect.date_prochaine_action
            ? formatDateShort(prospect.date_prochaine_action)
            : '—'}
        </span>
        <TemperaturePicker
          value={prospect.temperature}
          onChange={onChangeTemp}
        />
      </div>
    </div>
  )
}

function TemperaturePicker({
  value, onChange,
}: {
  value: Temperature | null
  onChange: (t: Temperature) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = value ? TEMPERATURE_STYLES[value] : null

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div
      ref={ref}
      className="relative flex-shrink-0"
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      draggable
      onDragStart={e => { e.preventDefault(); e.stopPropagation() }}
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="text-[10px] font-medium px-2 py-0.5 rounded-full hover:ring-2 hover:ring-gray-200 transition"
        style={current
          ? { backgroundColor: current.bg, color: current.text }
          : { backgroundColor: '#F1EFE8', color: '#5F5E5A' }
        }
      >
        {current ? current.label : 'Définir'}
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[110px]">
          {(Object.keys(TEMPERATURE_STYLES) as Temperature[]).map(t => {
            const s = TEMPERATURE_STYLES[t]
            const active = value === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => { onChange(t); setOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-gray-50 transition-colors',
                  active && 'bg-gray-50',
                )}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.text }}
                />
                <span className="text-gray-700 flex-1">{s.label}</span>
                {active && <Check className="w-3 h-3 text-gray-500" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */

const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/10'
const labelCls = 'text-xs font-medium text-gray-500 mb-1 block'

function NewProspectModal({
  userId, defaultStatut, onClose, onCreated,
}: {
  userId: string
  defaultStatut: Statut
  onClose: () => void
  onCreated: (p: Prospect) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [nom, setNom] = useState('')
  const [societe, setSociete] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [source, setSource] = useState<Source | ''>('')
  const [apporteur, setApporteur] = useState('')
  const [budget, setBudget] = useState('')
  const [temperature, setTemperature] = useState<Temperature>('froid')
  const [statut, setStatut] = useState<Statut>(defaultStatut)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Relance automatique
  const [relancePreset, setRelancePreset] = useState<'none' | '3' | '7' | '14' | '30' | 'custom'>('7')
  const [relanceCustom, setRelanceCustom] = useState('')

  function computeRelanceDate(): string | null {
    let days: number | null = null
    if (relancePreset === 'custom') {
      const n = parseInt(relanceCustom)
      if (!isNaN(n) && n > 0) days = n
    } else if (relancePreset !== 'none') {
      days = parseInt(relancePreset)
    }
    if (days === null) return null
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
  }

  async function save() {
    if (!nom.trim()) { setErr('Le nom est obligatoire'); return }
    setSaving(true); setErr('')
    const payload = {
      nom: nom.trim(),
      societe: societe.trim() || null,
      email: email.trim() || null,
      telephone: telephone.trim() || null,
      source: source || null,
      apporteur: apporteur.trim() || null,
      statut,
      temperature,
      budget_estime: budget ? parseFloat(budget) : null,
      notes: notes.trim() || null,
      commercial_id: userId,
    }
    const { data, error } = await supabase.from('prospects').insert(payload).select('*').single()
    if (error || !data) { setSaving(false); setErr(error?.message ?? 'Erreur création'); return }

    // Creer une tache de relance si une date a ete definie
    const relanceDate = computeRelanceDate()
    if (relanceDate) {
      const labelSociete = societe.trim() ? ` (${societe.trim()})` : ''
      await supabase.schema('app').from('taches').insert({
        titre: `Relancer ${nom.trim()}${labelSociete}`,
        description: `Relance prospect.${notes.trim() ? ` Notes : ${notes.trim()}` : ''}`,
        creee_par: userId,
        assignee_a: userId,
        tags_utilisateurs: [],
        tags_roles: [],
        tag_tous: false,
        urgence: temperature === 'brulant' ? 'urgent' : temperature === 'chaud' ? 'normal' : 'faible',
        statut: 'a_faire',
        date_echeance: relanceDate,
      } as never)
    }

    setSaving(false)
    onCreated(data as unknown as Prospect)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Nouveau prospect</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className={labelCls}>Nom <span className="text-red-500">*</span></label>
            <input value={nom} onChange={e => setNom(e.target.value)} className={inputCls} autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Société</label>
              <input value={societe} onChange={e => setSociete(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Apporteur d'affaires</label>
              <input value={apporteur} onChange={e => setApporteur(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Téléphone</label>
              <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Source</label>
              <select value={source} onChange={e => setSource(e.target.value as Source | '')} className={inputCls}>
                <option value="">—</option>
                {(Object.keys(SOURCE_LABELS) as Source[]).map(s => (
                  <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Budget estimé (€)</label>
              <input type="number" min={0} value={budget} onChange={e => setBudget(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Température</label>
              <select value={temperature} onChange={e => setTemperature(e.target.value as Temperature)} className={inputCls}>
                <option value="froid">Froid</option>
                <option value="chaud">Chaud</option>
                <option value="brulant">Brûlant</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Statut initial</label>
              <select value={statut} onChange={e => setStatut(e.target.value as Statut)} className={inputCls}>
                {COLUMNS.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={cn(inputCls, 'resize-none')} />
          </div>

          {/* Relance automatique */}
          <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 space-y-2">
            <label className={labelCls}>Programmer une relance</label>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { val: 'none',   lab: 'Aucune' },
                { val: '3',      lab: '3 jours' },
                { val: '7',      lab: '1 semaine' },
                { val: '14',     lab: '2 semaines' },
                { val: '30',     lab: '1 mois' },
                { val: 'custom', lab: 'Autre...' },
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setRelancePreset(opt.val as typeof relancePreset)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-full border transition-colors',
                    relancePreset === opt.val
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                  )}
                >
                  {opt.lab}
                </button>
              ))}
            </div>
            {relancePreset === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={relanceCustom}
                  onChange={e => setRelanceCustom(e.target.value)}
                  placeholder="Nombre de jours"
                  className={cn(inputCls, 'flex-1')}
                />
                <span className="text-sm text-gray-500">jours</span>
              </div>
            )}
            {relancePreset !== 'none' && computeRelanceDate() && (
              <p className="text-xs text-blue-700">
                Une tache de relance sera creee pour le {new Date(computeRelanceDate()!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>

          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>

        <div className="sticky bottom-0 bg-white flex justify-end gap-2 px-6 py-3 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Annuler</button>
          <button
            onClick={save}
            disabled={saving || !nom.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {saving && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            Créer
          </button>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */

function ProspectDrawer({
  prospect, onClose, onChange, onDelete,
}: {
  prospect: Prospect
  onClose: () => void
  onChange: (p: Prospect) => void
  onDelete: (id: string) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [local, setLocal] = useState<Prospect>(prospect)
  const [confirmDel, setConfirmDel] = useState(false)
  const [converting, setConverting] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingFields = useRef<Partial<Prospect>>({})
  const idRef = useRef(prospect.id)

  useEffect(() => {
    idRef.current = prospect.id
    setLocal(prospect)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    pendingFields.current = {}
    setSaveStatus('idle')
  }, [prospect])

  const commit = useCallback(async () => {
    if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null }
    const fields = pendingFields.current
    if (Object.keys(fields).length === 0) return
    pendingFields.current = {}
    setSaveStatus('saving')
    const { data, error } = await supabase
      .from('prospects')
      .update(fields)
      .eq('id', idRef.current)
      .select('*')
      .single()
    if (!error && data) {
      const next = data as unknown as Prospect
      setLocal(next)
      onChange(next)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 1500)
    } else {
      setSaveStatus('idle')
    }
  }, [onChange, supabase])

  const scheduleSave = useCallback((fields: Partial<Prospect>, delay = 800) => {
    pendingFields.current = { ...pendingFields.current, ...fields }
    setLocal(prev => ({ ...prev, ...fields }))
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => { commit() }, delay)
  }, [commit])

  const saveNow = useCallback(async (fields: Partial<Prospect>) => {
    pendingFields.current = { ...pendingFields.current, ...fields }
    setLocal(prev => ({ ...prev, ...fields }))
    await commit()
  }, [commit])

  // Flush pending changes when unmounting or closing
  useEffect(() => {
    return () => { commit() }
  }, [commit])

  function handleClose() {
    commit()
    onClose()
  }

  async function handleDelete() {
    await supabase.from('prospects').delete().eq('id', local.id)
    onDelete(local.id)
  }

  async function convertToProjet() {
    setConverting(true)
    const params = new URLSearchParams()
    params.set('prospect_id', local.id)
    if (local.nom) params.set('nom', local.nom)
    if (local.societe) params.set('client_nom', local.societe)
    else if (local.nom) params.set('client_nom', local.nom)
    if (local.email) params.set('client_email', local.email)
    if (local.telephone) params.set('client_tel', local.telephone)
    if (local.budget_estime != null) params.set('budget_total', String(local.budget_estime))
    router.push(`/commercial/projets/nouveau?${params.toString()}`)
  }

  const tempStyle = local.temperature ? TEMPERATURE_STYLES[local.temperature] : null
  const statutLabel = COLUMNS.find(c => c.key === local.statut)?.label ?? local.statut
  const statutDot = COLUMNS.find(c => c.key === local.statut)?.dot ?? 'bg-gray-300'

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
      <aside className="absolute right-0 top-0 h-full w-full sm:w-[420px] bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-gray-900 truncate">{local.nom}</h2>
            {local.societe && <p className="text-xs text-gray-500 truncate">{local.societe}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                <span className={cn('w-1.5 h-1.5 rounded-full', statutDot)} />
                {statutLabel}
              </span>
              {tempStyle && (
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: tempStyle.bg, color: tempStyle.text }}
                >
                  {tempStyle.label}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <SaveIndicator status={saveStatus} />
            <button onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Coordonnées */}
          <Section title="Coordonnées">
            <div className="space-y-2">
              {local.email ? (
                <a href={`mailto:${local.email}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  {local.email}
                </a>
              ) : (
                <p className="flex items-center gap-2 text-sm text-gray-400">
                  <Mail className="w-3.5 h-3.5" />
                  Non renseigné
                </p>
              )}
              {local.telephone ? (
                <p className="flex items-center gap-2 text-sm text-gray-700">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  {local.telephone}
                </p>
              ) : (
                <p className="flex items-center gap-2 text-sm text-gray-400">
                  <Phone className="w-3.5 h-3.5" />
                  Non renseigné
                </p>
              )}
              <p className="flex items-center gap-2 text-sm text-gray-700">
                <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                {local.source ? SOURCE_LABELS[local.source] : 'Source inconnue'}
                {local.apporteur && <span className="text-gray-400">· {local.apporteur}</span>}
              </p>
            </div>
          </Section>

          {/* Pipeline */}
          <Section title="Pipeline">
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Statut</label>
                <select
                  value={local.statut}
                  onChange={e => saveNow({ statut: e.target.value as Statut })}
                  className={inputCls}
                >
                  {COLUMNS.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Température</label>
                <select
                  value={local.temperature ?? 'froid'}
                  onChange={e => saveNow({ temperature: e.target.value as Temperature })}
                  className={inputCls}
                >
                  <option value="froid">Froid</option>
                  <option value="chaud">Chaud</option>
                  <option value="brulant">Brûlant</option>
                </select>
              </div>
              {local.statut === 'perdu' && (
                <div>
                  <label className={labelCls}>Motif de perte</label>
                  <input
                    value={local.motif_perte ?? ''}
                    onChange={e => scheduleSave({ motif_perte: e.target.value || null })}
                    className={inputCls}
                    placeholder="Prix, délai, concurrent..."
                  />
                </div>
              )}
            </div>
          </Section>

          {/* Budget & Projet */}
          <Section title="Budget & Projet">
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Budget estimé (€)</label>
                <input
                  type="number"
                  min={0}
                  value={local.budget_estime ?? ''}
                  onChange={e => scheduleSave({ budget_estime: e.target.value === '' ? null : parseFloat(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Prochaine action</label>
                <textarea
                  value={local.prochaine_action ?? ''}
                  onChange={e => scheduleSave({ prochaine_action: e.target.value || null })}
                  rows={2}
                  className={cn(inputCls, 'resize-none')}
                />
              </div>
              <div>
                <label className={labelCls}>Date prochaine action</label>
                <input
                  type="date"
                  value={local.date_prochaine_action ?? ''}
                  onChange={e => saveNow({ date_prochaine_action: e.target.value || null })}
                  className={inputCls}
                />
              </div>
            </div>
          </Section>

          {/* Notes */}
          <Section title="Notes">
            <textarea
              value={local.notes ?? ''}
              onChange={e => scheduleSave({ notes: e.target.value || null }, 1000)}
              rows={5}
              placeholder="Notes libres (sauvegarde auto)..."
              className={cn(inputCls, 'resize-none')}
            />
          </Section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 space-y-2">
          {local.statut === 'gagne' && !local.converti_projet_id && (
            <button
              onClick={convertToProjet}
              disabled={converting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              <ArrowRightCircle className="w-4 h-4" />
              Convertir en projet
            </button>
          )}
          {local.converti_projet_id && (
            <button
              onClick={() => router.push(`/commercial/projets/${local.converti_projet_id}`)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
            >
              Voir le projet associé
            </button>
          )}

          <div className="flex items-center gap-2">
            {!confirmDel ? (
              <button
                onClick={() => setConfirmDel(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
            ) : (
              <>
                <button
                  onClick={() => setConfirmDel(false)}
                  className="flex-1 px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
                >
                  Confirmer
                </button>
              </>
            )}
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Fermer
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

function SaveIndicator({ status }: { status: 'idle' | 'saving' | 'saved' }) {
  if (status === 'idle') return null
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
        <Loader2 className="w-3 h-3 animate-spin" />
        Enregistrement
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
      <Check className="w-3 h-3" />
      Enregistré
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  )
}
