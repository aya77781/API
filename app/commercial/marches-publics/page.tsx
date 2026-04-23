'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, FileText, X, Check, Loader2, EyeOff, RefreshCw, AlertCircle } from 'lucide-react'
import { createMarchesClient } from '@/lib/supabase/marchesClient'
import { TopBar } from '@/components/co/TopBar'
import { cn } from '@/lib/utils'

type Statut = 'nouvelle' | 'en_etude' | 'interesse' | 'dossier_depose' | 'gagne' | 'perdu' | 'ignore'

interface Marche {
  id: string
  nom_offre: string
  lien: string
  date_publication: string | null
  source: string | null
  statut: Statut | null
  montant_estime: number | null
  notes: string | null
  created_at: string
}

const STATUT_OPTIONS: { key: Statut; label: string; badge: string }[] = [
  { key: 'nouvelle',       label: 'Nouvelle',       badge: 'bg-[#E6F1FB] text-[#185FA5]' },
  { key: 'en_etude',       label: 'En etude',       badge: 'bg-[#FAEEDA] text-[#854F0B]' },
  { key: 'interesse',      label: 'Interesse',      badge: 'bg-[#EEEDFE] text-[#534AB7]' },
  { key: 'dossier_depose', label: 'Dossier depose', badge: 'bg-[#FAEEDA] text-[#633806]' },
  { key: 'gagne',          label: 'Gagne',          badge: 'bg-[#EAF3DE] text-[#3B6D11]' },
  { key: 'perdu',          label: 'Perdu',          badge: 'bg-[#FCEBEB] text-[#A32D2D]' },
  { key: 'ignore',         label: 'Ignore',         badge: 'bg-[#F1EFE8] text-[#888780]' },
]

const FILTERS: { label: string; value: Statut | null }[] = [
  { label: 'Tous',        value: null },
  { label: 'Nouvelles',   value: 'nouvelle' },
  { label: 'En etude',    value: 'en_etude' },
  { label: 'Interessees', value: 'interesse' },
  { label: 'Deposees',    value: 'dossier_depose' },
  { label: 'Gagnees',     value: 'gagne' },
  { label: 'Perdues',     value: 'perdu' },
  { label: 'Ignorees',    value: 'ignore' },
]

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateFr(iso: string | null): string {
  if (!iso) return '--'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export default function MarchesPublicsPage() {
  const supabase = useMemo(() => createMarchesClient(), [])
  const [marches, setMarches] = useState<Marche[]>([])
  const [fetching, setFetching] = useState(true)
  const [filtre, setFiltre] = useState<Statut | null>(null)
  const [notesFor, setNotesFor] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null)

  const loadMarches = useCallback(async () => {
    const { data } = await supabase
      .from('marches_publics')
      .select('*')
      .order('date_publication', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    const rows = (data ?? []) as unknown as Marche[]
    setMarches(rows)
    return rows
  }, [supabase])

  useEffect(() => {
    setFetching(true)
    loadMarches().finally(() => setFetching(false))
  }, [loadMarches])

  async function handleRefresh() {
    setRefreshing(true)
    setToast(null)

    const startTime = new Date().toISOString()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const res = await fetch('https://apiprojet.app.n8n.cloud/webhook/api-renovation-boamp-marches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'commercial_app' }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!res.ok) throw new Error(String(res.status))

      await loadMarches()

      const { count } = await supabase
        .from('marches_publics')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startTime)

      const nouveauCount = count ?? 0
      if (nouveauCount > 0) {
        setToast({
          type: 'success',
          text: `${nouveauCount} nouvelle${nouveauCount > 1 ? 's' : ''} offre${nouveauCount > 1 ? 's' : ''} ajoutee${nouveauCount > 1 ? 's' : ''}`,
        })
      } else {
        setToast({
          type: 'info',
          text: 'Aucune nouvelle offre -- tout est deja a jour',
        })
      }
      setTimeout(() => setToast(null), 5000)
    } catch {
      clearTimeout(timeoutId)
      setToast({ type: 'error', text: 'Erreur de connexion -- reessayer' })
    } finally {
      setRefreshing(false)
    }
  }

  const nouvellesAujourdhui = useMemo(() => {
    const today = todayIso()
    return marches.filter(m => m.date_publication === today && (m.statut ?? 'nouvelle') === 'nouvelle').length
  }, [marches])

  const filtered = useMemo(() => {
    if (!filtre) return marches.filter(m => (m.statut ?? 'nouvelle') !== 'ignore')
    return marches.filter(m => (m.statut ?? 'nouvelle') === filtre)
  }, [marches, filtre])

  const updateLocal = useCallback((id: string, fields: Partial<Marche>) => {
    setMarches(prev => prev.map(m => m.id === id ? { ...m, ...fields } : m))
  }, [])

  const setStatut = useCallback(async (id: string, statut: Statut) => {
    const current = marches.find(m => m.id === id)
    updateLocal(id, { statut })
    const { error } = await supabase.from('marches_publics').update({ statut }).eq('id', id)
    if (error && current) updateLocal(id, { statut: current.statut })
  }, [marches, supabase, updateLocal])

  const activeNotes = notesFor ? marches.find(m => m.id === notesFor) ?? null : null

  return (
    <div>
      <TopBar
        title="Marches publics"
        subtitle={`${nouvellesAujourdhui} nouvelle${nouvellesAujourdhui !== 1 ? 's' : ''} offre${nouvellesAujourdhui !== 1 ? 's' : ''} aujourd'hui`}
      />

      <div className="p-6 space-y-4">
        {/* Filtres + bouton Actualiser */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {FILTERS.map(f => (
              <button
                key={f.label}
                onClick={() => setFiltre(f.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
                  filtre === f.value
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {refreshing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Recherche en cours...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Actualiser les offres
              </>
            )}
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm border',
              toast.type === 'success' && 'bg-emerald-50 border-emerald-200 text-emerald-700',
              toast.type === 'info' && 'bg-blue-50 border-blue-200 text-blue-700',
              toast.type === 'error' && 'bg-red-50 border-red-200 text-red-700',
            )}
          >
            {toast.type === 'error'
              ? <AlertCircle className="w-4 h-4 flex-shrink-0" />
              : <Check className="w-4 h-4 flex-shrink-0" />
            }
            <span>{toast.text}</span>
            {toast.type === 'error' && (
              <button onClick={handleRefresh} className="ml-auto text-xs font-medium underline hover:no-underline">
                Reessayer
              </button>
            )}
          </div>
        )}

        {/* Table */}
        {fetching ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : marches.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-16 text-center">
            <FileText className="w-10 h-10 text-gray-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-700">Aucune offre</p>
            <p className="text-xs text-gray-400 mt-1">
              Cliquez sur Actualiser pour recuperer les dernieres offres BOAMP
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-16 text-center">
            <FileText className="w-10 h-10 text-gray-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-700">Aucune offre dans ce filtre</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 w-28">Date</th>
                    <th className="px-4 py-3">Nom de l&apos;offre</th>
                    <th className="px-4 py-3 w-24">Source</th>
                    <th className="px-4 py-3 w-40">Statut</th>
                    <th className="px-4 py-3 w-20">Notes</th>
                    <th className="px-4 py-3 w-24 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(m => (
                    <MarcheRow
                      key={m.id}
                      marche={m}
                      onSetStatut={setStatut}
                      onOpenNotes={() => setNotesFor(m.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {activeNotes && (
        <NotesDrawer
          marche={activeNotes}
          onClose={() => setNotesFor(null)}
          onChange={fields => updateLocal(activeNotes.id, fields)}
        />
      )}
    </div>
  )
}

function MarcheRow({ marche, onSetStatut, onOpenNotes }: {
  marche: Marche
  onSetStatut: (id: string, s: Statut) => void
  onOpenNotes: () => void
}) {
  const statut = (marche.statut ?? 'nouvelle') as Statut
  const statutCfg = STATUT_OPTIONS.find(s => s.key === statut)
  const hasNotes = !!(marche.notes && marche.notes.trim())
  const isIgnored = statut === 'ignore'

  return (
    <tr className={cn('hover:bg-gray-50 transition-colors', isIgnored && 'opacity-60')}>
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
        {formatDateFr(marche.date_publication)}
      </td>
      <td className="px-4 py-3">
        <a href={marche.lien} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors group">
          <span className="line-clamp-2">{marche.nom_offre}</span>
          <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-blue-500 flex-shrink-0 mt-0.5" />
        </a>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-medium rounded-full">
          {marche.source ?? 'BOAMP'}
        </span>
      </td>
      <td className="px-4 py-3">
        <select
          value={statut}
          onChange={e => onSetStatut(marche.id, e.target.value as Statut)}
          className={cn(
            'text-[11px] font-medium rounded-full px-2.5 py-1 border-0 outline-none cursor-pointer focus:ring-2 focus:ring-gray-900/10',
            statutCfg?.badge ?? 'bg-gray-100 text-gray-700',
          )}
        >
          {STATUT_OPTIONS.map(s => (
            <option key={s.key} value={s.key} className="bg-white text-gray-900">{s.label}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <button onClick={onOpenNotes}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors',
            hasNotes
              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              : 'text-gray-500 hover:bg-gray-100',
          )}>
          <FileText className="w-3.5 h-3.5" />
          {hasNotes ? 'Voir' : 'Ajouter'}
        </button>
      </td>
      <td className="px-4 py-3 text-right">
        {!isIgnored ? (
          <button onClick={() => onSetStatut(marche.id, 'ignore')} title="Ignorer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <EyeOff className="w-3.5 h-3.5" />
            Ignorer
          </button>
        ) : (
          <button onClick={() => onSetStatut(marche.id, 'nouvelle')} title="Restaurer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            Restaurer
          </button>
        )}
      </td>
    </tr>
  )
}

function NotesDrawer({ marche, onClose, onChange }: {
  marche: Marche
  onClose: () => void
  onChange: (fields: Partial<Marche>) => void
}) {
  const supabase = useMemo(() => createMarchesClient(), [])
  const [notes, setNotes] = useState(marche.notes ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef(false)

  useEffect(() => {
    setNotes(marche.notes ?? '')
  }, [marche.id, marche.notes])

  const commit = useCallback(async (value: string) => {
    pending.current = false
    setStatus('saving')
    const { error } = await supabase
      .from('marches_publics')
      .update({ notes: value.trim() || null })
      .eq('id', marche.id)
    if (!error) {
      onChange({ notes: value.trim() || null })
      setStatus('saved')
      setTimeout(() => setStatus(s => s === 'saved' ? 'idle' : s), 1500)
    } else {
      setStatus('idle')
    }
  }, [marche.id, onChange, supabase])

  function onNotesChange(v: string) {
    setNotes(v)
    pending.current = true
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => commit(v), 1000)
  }

  function handleClose() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (pending.current) commit(notes)
    onClose()
  }

  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [])

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
      <aside className="absolute right-0 top-0 h-full w-full sm:w-[420px] bg-white shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Notes</p>
            <h2 className="text-sm font-semibold text-gray-900 truncate mt-0.5">{marche.nom_offre}</h2>
            {marche.source && <p className="text-xs text-gray-400 mt-0.5">{marche.source}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {status === 'saving' && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                Enregistrement
              </span>
            )}
            {status === 'saved' && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                <Check className="w-3 h-3" />
                Enregistre
              </span>
            )}
            <button onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <textarea
            value={notes}
            onChange={e => onNotesChange(e.target.value)}
            rows={16}
            autoFocus
            placeholder="Notes libres sur cette offre (sauvegarde auto)..."
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
          />
        </div>

        <div className="px-5 py-3 border-t border-gray-100">
          <a href={marche.lien} target="_blank" rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
            <ExternalLink className="w-4 h-4" />
            Ouvrir l&apos;offre
          </a>
        </div>
      </aside>
    </div>
  )
}
