'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ClipboardCheck, ListChecks, FileText, Receipt,
  Calendar, Check, ChevronRight, CalendarPlus,
} from 'lucide-react'
import { TopBar } from '@/components/co/TopBar'
import { useUser } from '@/hooks/useUser'
import { useDashboardCO, type TacheDashboard } from '@/hooks/useDashboardCO'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/* ── Phase config ── */

const PHASE_PCT: Record<string, number> = {
  passation: 5, achats: 20, installation: 35, chantier: 60,
  controle: 75, cloture: 90, gpa: 97,
}

const PHASE_COLORS: Record<string, string> = {
  passation: 'bg-slate-400', achats: 'bg-amber-500', installation: 'bg-blue-400',
  chantier: 'bg-blue-600', controle: 'bg-purple-500', cloture: 'bg-gray-600', gpa: 'bg-red-400',
}

const PHASE_LABELS: Record<string, string> = {
  passation: 'Passation', achats: 'Achats', installation: 'Installation',
  chantier: 'Chantier', controle: 'Controle', cloture: 'Cloture', gpa: 'GPA',
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']

const EVENT_STYLES: Record<string, string> = {
  tache: 'bg-gray-100 text-gray-700',
  cr: 'bg-amber-50 text-amber-700',
  alerte: 'bg-red-50 text-red-600',
}

/* ── Component ── */

export default function DashboardPage() {
  const { user, profil } = useUser()
  const {
    loading, projetsActifs,
    visitesStats, tachesStats, crStats, devisStats,
    tachesSansDate, setTachesSansDate, evenementsSemaine,
  } = useDashboardCO(user?.id ?? null)

  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set())
  const [planningId, setPlanningId] = useState<string | null>(null)
  const [planningDate, setPlanningDate] = useState('')

  const today = new Date().toISOString().split('T')[0]
  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const weekDates = Object.keys(evenementsSemaine).sort()

  /* ── Task actions ── */

  async function handleCompleteTache(id: string) {
    setCompletingIds(prev => new Set(prev).add(id))
    const supabase = createClient()
    await supabase.schema('app').from('taches')
      .update({ statut: 'fait', updated_at: new Date().toISOString() })
      .eq('id', id)
    // Remove after animation
    setTimeout(() => {
      setTachesSansDate(prev => prev.filter(t => t.id !== id))
      setCompletingIds(prev => { const n = new Set(prev); n.delete(id); return n })
    }, 500)
  }

  async function handlePlanTache(id: string) {
    if (!planningDate) return
    const supabase = createClient()
    await supabase.schema('app').from('taches')
      .update({ due_date: planningDate, updated_at: new Date().toISOString() })
      .eq('id', id)
    setTachesSansDate(prev => prev.filter(t => t.id !== id))
    setPlanningId(null)
    setPlanningDate('')
  }

  /* ── Render ── */

  return (
    <div>
      {/* ZONE 1 -- Header */}
      <TopBar
        title="Tableau de bord"
        subtitle={loading ? '...' : `${projetsActifs.length} projets actifs`}
      />

      <div className="p-6 space-y-6">

        {/* Date */}
        <p className="text-xs text-gray-400 capitalize">{dateStr}</p>

        {/* ZONE 2 -- Progression semaine */}
        <div className="grid grid-cols-4 gap-3">
          <MetricCard
            icon={ClipboardCheck}
            label="Visites"
            done={visitesStats.done}
            total={visitesStats.total}
            sub="cette semaine"
            color="bg-blue-500"
            loading={loading}
          />
          <MetricCard
            icon={ListChecks}
            label="Taches"
            done={tachesStats.done}
            total={tachesStats.total}
            sub="completees"
            color="bg-emerald-500"
            loading={loading}
          />
          <MetricCard
            icon={FileText}
            label="CR envoyes"
            done={crStats.done}
            total={crStats.total}
            sub="cette semaine"
            color={crStats.done === 0 && crStats.total > 0 ? 'bg-amber-500' : 'bg-orange-500'}
            loading={loading}
          />
          <MetricCard
            icon={Receipt}
            label="Devis recus"
            done={devisStats.done}
            total={devisStats.total}
            sub="cette semaine"
            color={devisStats.done === 0 && devisStats.total > 0 ? 'bg-red-500' : 'bg-violet-500'}
            loading={loading}
          />
        </div>

        {/* ZONE 3 -- Calendrier semaine */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              Semaine
            </h2>
          </div>
          <div className="grid grid-cols-5 divide-x divide-gray-100">
            {weekDates.map((date, i) => {
              const isToday = date === today
              const dayNum = new Date(date).getDate()
              const events = evenementsSemaine[date] ?? []
              return (
                <div key={date} className={cn('p-3 min-h-[120px]', isToday && 'bg-blue-50/40')}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-medium text-gray-400 uppercase">{DAY_LABELS[i]}</span>
                    <span className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                      isToday ? 'bg-blue-600 text-white' : 'text-gray-500',
                    )}>
                      {dayNum}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {events.length === 0 ? (
                      <p className="text-[10px] text-gray-300">Libre</p>
                    ) : (
                      events.map((ev, j) => (
                        <div key={`${ev.id}-${j}`}
                          className={cn('px-2 py-1 rounded text-[10px] font-medium truncate', EVENT_STYLES[ev.type])}>
                          {ev.label}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ZONE 4 -- Taches sans date */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
              <ListChecks className="w-3.5 h-3.5 text-gray-400" />
              Taches a planifier
            </h2>
            <span className="text-[10px] text-gray-400">{tachesSansDate.length} tache{tachesSansDate.length > 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : tachesSansDate.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Check className="w-6 h-6 text-emerald-300 mx-auto mb-1.5" />
              <p className="text-xs text-gray-400">Tout est planifie cette semaine</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {tachesSansDate.map(t => {
                const completing = completingIds.has(t.id)
                return (
                  <div key={t.id}
                    className={cn(
                      'flex items-center gap-3 px-5 py-2.5 transition-all duration-500',
                      completing && 'opacity-0 h-0 py-0 overflow-hidden',
                    )}>
                    <button onClick={() => handleCompleteTache(t.id)}
                      className={cn(
                        'w-4.5 h-4.5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors',
                        completing ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 hover:border-emerald-400',
                      )}>
                      {completing && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm text-gray-700', completing && 'line-through text-gray-400')}>{t.titre}</p>
                      {t.projet && (
                        <p className="text-[10px] text-gray-400 truncate">{t.projet.nom}</p>
                      )}
                    </div>
                    {planningId === t.id ? (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <input type="date" value={planningDate} onChange={e => setPlanningDate(e.target.value)}
                          className="px-2 py-1 border border-gray-200 rounded text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900" />
                        <button onClick={() => handlePlanTache(t.id)} disabled={!planningDate}
                          className="px-2 py-1 bg-gray-900 text-white rounded text-xs font-medium hover:bg-gray-800 disabled:opacity-40 transition-colors">
                          OK
                        </button>
                        <button onClick={() => { setPlanningId(null); setPlanningDate('') }}
                          className="text-xs text-gray-400 hover:text-gray-700">
                          x
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setPlanningId(t.id)}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors flex-shrink-0">
                        <CalendarPlus className="w-3 h-3" />
                        Planifier
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ZONE 5 -- Avancement chantiers */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
              Avancement chantiers
            </h2>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : projetsActifs.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-xs text-gray-400">Aucun projet actif</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {projetsActifs.map(p => {
                const pct = PHASE_PCT[p.statut] ?? 0
                const color = PHASE_COLORS[p.statut] ?? 'bg-gray-400'
                const label = PHASE_LABELS[p.statut] ?? p.statut
                const daysLeft = p.date_livraison
                  ? Math.ceil((new Date(p.date_livraison).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null

                return (
                  <Link key={p.id} href={`/co/projets/${p.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.nom}</p>
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', color, 'text-white')}>
                          {label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-gray-500 w-8 text-right">{pct}%</span>
                      </div>
                      {daysLeft != null && (
                        <p className={cn(
                          'text-[10px] mt-1',
                          daysLeft < 30 ? 'text-red-500' : daysLeft < 90 ? 'text-amber-500' : 'text-gray-400',
                        )}>
                          {daysLeft > 0 ? `Livraison dans ${daysLeft} jours` : daysLeft === 0 ? "Livraison aujourd'hui" : `Depassee de ${Math.abs(daysLeft)} jours`}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Metric Card ── */

function MetricCard({
  icon: Icon, label, done, total, sub, color, loading,
}: {
  icon: typeof ClipboardCheck
  label: string
  done: number
  total: number
  sub: string
  color: string
  loading: boolean
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  if (loading) {
    return <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">
        {done} <span className="text-sm font-normal text-gray-400">/ {total}</span>
      </p>
      <p className="text-[10px] text-gray-400 mb-2">{sub}</p>
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
