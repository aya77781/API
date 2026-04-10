'use client'

import { useState, useEffect } from 'react'
import { Loader2, TrendingUp, TrendingDown, Minus, Users, Calendar, Sparkles, Check, X, Quote } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Humeur = { id: string; user_id: string; date: string; humeur: 'fatigue' | 'ca_va' | 'bien' | 'super' }
type ProfilLight = { id: string; prenom: string | null; nom: string | null; role: string | null }
type QuoteDuJour = { id: string; texte: string; contexte: string | null; date: string; actif: boolean }
type GeneratedQuote = { texte: string; auteur: string }

const MOOD_CONFIG = {
  fatigue: { label: 'Fatigué',  color: '#E11D48', bg: 'bg-white',  text: 'text-rose-700',    border: 'border-gray-200', score: 1 },
  ca_va:   { label: 'Ça va',    color: '#D97706', bg: 'bg-white',  text: 'text-amber-700',   border: 'border-gray-200', score: 2 },
  bien:    { label: 'Bien',     color: '#2563EB', bg: 'bg-white',  text: 'text-blue-700',    border: 'border-gray-200', score: 3 },
  super:   { label: 'Super',    color: '#059669', bg: 'bg-white',  text: 'text-emerald-700', border: 'border-gray-200', score: 4 },
} as const

type MoodKey = keyof typeof MOOD_CONFIG

function FaceSvg({ mood, size = 32 }: { mood: MoodKey; size?: number }) {
  const c = MOOD_CONFIG[mood].color
  const r = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <circle cx={r} cy={r} r={r - 1} stroke={c} strokeWidth="1.2" opacity="0.5" />
      {mood === 'fatigue' ? (
        <>
          <line x1={r * 0.6} y1={r * 0.78} x2={r * 0.85} y2={r * 0.85} stroke={c} strokeWidth="1.2" strokeLinecap="round" />
          <line x1={r * 1.15} y1={r * 0.85} x2={r * 1.4} y2={r * 0.78} stroke={c} strokeWidth="1.2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx={r * 0.7} cy={r * 0.8} r={size * 0.045} fill={c} />
          <circle cx={r * 1.3} cy={r * 0.8} r={size * 0.045} fill={c} />
        </>
      )}
      {mood === 'fatigue' && (
        <path d={`M${r * 0.7} ${r * 1.3} Q${r} ${r * 1.18} ${r * 1.3} ${r * 1.3}`} stroke={c} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      )}
      {mood === 'ca_va' && (
        <line x1={r * 0.7} y1={r * 1.22} x2={r * 1.3} y2={r * 1.22} stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      )}
      {mood === 'bien' && (
        <path d={`M${r * 0.7} ${r * 1.15} Q${r} ${r * 1.4} ${r * 1.3} ${r * 1.15}`} stroke={c} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      )}
      {mood === 'super' && (
        <path d={`M${r * 0.6} ${r * 1.1} Q${r} ${r * 1.5} ${r * 1.4} ${r * 1.1}`} stroke={c} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      )}
    </svg>
  )
}

function getScoreLabel(avg: number): { label: string; mood: MoodKey } {
  if (avg >= 3.5) return { label: 'Super', mood: 'super' }
  if (avg >= 2.5) return { label: 'Bien', mood: 'bien' }
  if (avg >= 1.5) return { label: 'Ça va', mood: 'ca_va' }
  return { label: 'Fatigué', mood: 'fatigue' }
}

function getLast7Days() {
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

export default function ClimatSocialPage() {
  const supabase = createClient()
  const [humeurs, setHumeurs] = useState<Humeur[]>([])
  const [profils, setProfils] = useState<ProfilLight[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7' | '30' | '90'>('7')

  async function load() {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - Number(period))
    const [h, p] = await Promise.all([
      supabase.from('humeurs').select('*').gte('date', since.toISOString().slice(0, 10)).order('date', { ascending: false }),
      supabase.schema('app').from('utilisateurs').select('id,prenom,nom,role'),
    ])
    setHumeurs((h.data ?? []) as Humeur[])
    setProfils((p.data ?? []) as ProfilLight[])
    setLoading(false)
  }
  useEffect(() => { load() }, [period])

  const today = new Date().toISOString().slice(0, 10)
  const humeursToday = humeurs.filter(h => h.date === today)
  const avgToday = humeursToday.length
    ? humeursToday.reduce((s, h) => s + MOOD_CONFIG[h.humeur].score, 0) / humeursToday.length
    : 0

  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)
  const humeursYesterday = humeurs.filter(h => h.date === yesterdayStr)
  const avgYesterday = humeursYesterday.length
    ? humeursYesterday.reduce((s, h) => s + MOOD_CONFIG[h.humeur].score, 0) / humeursYesterday.length
    : 0

  const trend = avgToday - avgYesterday

  const avgGlobal = humeurs.length
    ? humeurs.reduce((s, h) => s + MOOD_CONFIG[h.humeur].score, 0) / humeurs.length
    : 0
  const globalMood = getScoreLabel(avgGlobal)

  // Breakdown today
  const moodCounts: Record<MoodKey, number> = { fatigue: 0, ca_va: 0, bien: 0, super: 0 }
  for (const h of humeursToday) moodCounts[h.humeur]++

  // 7 derniers jours
  const last7 = getLast7Days()
  const dailyAvg = last7.map(day => {
    const dayHumeurs = humeurs.filter(h => h.date === day)
    return {
      day,
      avg: dayHumeurs.length ? dayHumeurs.reduce((s, h) => s + MOOD_CONFIG[h.humeur].score, 0) / dayHumeurs.length : 0,
      count: dayHumeurs.length,
    }
  })

  // Votes récents (dernières 20)
  const recents = humeurs.slice(0, 20)

  const profilNom = (uid: string) => {
    const p = profils.find(x => x.id === uid)
    return p ? `${p.prenom ?? ''} ${p.nom ?? ''}`.trim() || 'Utilisateur' : 'Utilisateur'
  }

  const participationToday = humeursToday.length
  const totalUsers = profils.length

  return (
    <div>
      <TopBar title="Climat Social" subtitle="Moral & bien-être de l'équipe" />
      <div className="p-6 space-y-6">

        {loading ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <Loader2 className="w-6 h-6 text-gray-400 mx-auto animate-spin" />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Score du jour */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center gap-4">
                <div className="flex-shrink-0">
                  {avgToday > 0 ? <FaceSvg mood={getScoreLabel(avgToday).mood} size={48} /> : (
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <Minus className="w-5 h-5 text-gray-300" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Humeur du jour</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {avgToday > 0 ? getScoreLabel(avgToday).label : 'Pas de vote'}
                  </p>
                  {avgToday > 0 && (
                    <p className="text-xs text-gray-400">{avgToday.toFixed(1)} / 4</p>
                  )}
                </div>
              </div>

              {/* Tendance */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  trend > 0 ? 'bg-emerald-50' : trend < 0 ? 'bg-red-50' : 'bg-gray-50'
                }`}>
                  {trend > 0 ? <TrendingUp className="w-5 h-5 text-emerald-600" /> :
                   trend < 0 ? <TrendingDown className="w-5 h-5 text-red-600" /> :
                   <Minus className="w-5 h-5 text-gray-400" />}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Tendance</p>
                  <p className={`text-xl font-semibold ${trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {trend > 0 ? '+' : ''}{trend.toFixed(1)}
                  </p>
                  <p className="text-xs text-gray-400">vs hier</p>
                </div>
              </div>

              {/* Participation */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Participation</p>
                  <p className="text-xl font-semibold text-gray-900">{participationToday}/{totalUsers}</p>
                  <p className="text-xs text-gray-400">votes aujourd'hui</p>
                </div>
              </div>

              {/* Moyenne période */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center gap-4">
                <div className="flex-shrink-0">
                  {avgGlobal > 0 ? <FaceSvg mood={globalMood.mood} size={48} /> : (
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-gray-300" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Moyenne {period}j</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {avgGlobal > 0 ? globalMood.label : '—'}
                  </p>
                  {avgGlobal > 0 && <p className="text-xs text-gray-400">{avgGlobal.toFixed(1)} / 4</p>}
                </div>
              </div>
            </div>

            {/* Période */}
            <div className="flex items-center gap-2">
              {(['7', '30', '90'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    period === p ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {p === '7' ? '7 jours' : p === '30' ? '30 jours' : '90 jours'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Colonne gauche : graphique + breakdown */}
              <div className="lg:col-span-2 space-y-6">
                {/* Mini chart 7 jours */}
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Évolution sur 7 jours</h3>
                  <div className="flex items-end gap-2 h-32">
                    {dailyAvg.map(d => {
                      const pct = d.avg > 0 ? (d.avg / 4) * 100 : 0
                      const mood = d.avg > 0 ? getScoreLabel(d.avg) : null
                      const dayLabel = new Date(d.day).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
                      return (
                        <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                          {mood && <FaceSvg mood={mood.mood} size={20} />}
                          <div className="w-full bg-gray-100 rounded-t-lg relative" style={{ height: '80px' }}>
                            <div
                              className="absolute bottom-0 left-0 right-0 rounded-t-lg transition-all"
                              style={{
                                height: `${pct}%`,
                                backgroundColor: mood ? MOOD_CONFIG[mood.mood].color : '#E5E7EB',
                                opacity: 0.6,
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400">{dayLabel}</span>
                          {d.count > 0 && <span className="text-[9px] text-gray-300">{d.count}v</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Répartition du jour */}
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Répartition du jour</h3>
                  {humeursToday.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Aucun vote aujourd'hui</p>
                  ) : (
                    <div className="space-y-3">
                      {(Object.keys(MOOD_CONFIG) as MoodKey[]).map(key => {
                        const conf = MOOD_CONFIG[key]
                        const count = moodCounts[key]
                        const pct = humeursToday.length ? Math.round((count / humeursToday.length) * 100) : 0
                        return (
                          <div key={key} className="flex items-center gap-3">
                            <FaceSvg mood={key} size={22} />
                            <span className="text-xs text-gray-600 w-16">{conf.label}</span>
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gray-700 rounded-full transition-all"
                                style={{ width: `${pct}%`, opacity: 0.3 + (MOOD_CONFIG[key].score / 4) * 0.7 }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-700 w-8 text-right">{count}</span>
                            <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Colonne droite : votes récents */}
              <div>
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Votes récents</h3>
                  {recents.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Aucun vote</p>
                  ) : (
                    <div className="space-y-2 max-h-[480px] overflow-y-auto">
                      {recents.map(h => {
                        const conf = MOOD_CONFIG[h.humeur]
                        return (
                          <div key={h.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                            <FaceSvg mood={h.humeur} size={24} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">Anonyme</p>
                              <p className="text-[10px] text-gray-400">
                                {new Date(h.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              </p>
                            </div>
                            <span className={`text-[10px] font-medium ${conf.text}`}>{conf.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quote du jour */}
            <QuoteSection />
          </>
        )}
      </div>
    </div>
  )
}

/* ────────────────────── QUOTE DU JOUR ────────────────────── */

function QuoteSection() {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)
  const [currentQuote, setCurrentQuote] = useState<QuoteDuJour | null>(null)
  const [contexte, setContexte] = useState('')
  const [generating, setGenerating] = useState(false)
  const [suggestions, setSuggestions] = useState<GeneratedQuote[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('quotes_du_jour')
      .select('*')
      .eq('date', today)
      .eq('actif', true)
      .maybeSingle()
      .then(({ data }) => { if (data) setCurrentQuote(data as QuoteDuJour) })
  }, [])

  async function generate() {
    if (!contexte.trim()) { setError('Décrivez le contexte'); return }
    setError(null)
    setGenerating(true)
    setSuggestions([])
    try {
      const res = await fetch('/api/generate-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contexte: contexte.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Erreur ${res.status}`)
      }
      const { quotes } = await res.json()
      setSuggestions(quotes as GeneratedQuote[])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  async function pickQuote(q: GeneratedQuote) {
    setSaving(true)
    const texte = q.auteur ? `${q.texte} — ${q.auteur}` : q.texte
    // Upsert : remplace si déjà une quote aujourd'hui
    if (currentQuote) {
      await supabase.from('quotes_du_jour').update({ texte, contexte: contexte.trim() }).eq('id', currentQuote.id)
    } else {
      await supabase.from('quotes_du_jour').insert({ texte, contexte: contexte.trim(), date: today, actif: true })
    }
    setCurrentQuote({ id: currentQuote?.id ?? '', texte, contexte: contexte.trim(), date: today, actif: true })
    setSuggestions([])
    setSaving(false)
  }

  async function removeQuote() {
    if (!currentQuote) return
    await supabase.from('quotes_du_jour').update({ actif: false }).eq('id', currentQuote.id)
    setCurrentQuote(null)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Quote className="w-4 h-4 text-purple-500" />
        <h3 className="text-sm font-semibold text-gray-700">Citation du jour</h3>
      </div>

      {/* Quote active */}
      {currentQuote && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 relative">
          <Quote className="w-5 h-5 text-purple-300 absolute top-3 left-3" />
          <p className="text-sm text-purple-900 italic pl-7">{currentQuote.texte}</p>
          {currentQuote.contexte && (
            <p className="text-[10px] text-purple-400 mt-2 pl-7">Contexte : {currentQuote.contexte}</p>
          )}
          <button
            onClick={removeQuote}
            className="absolute top-3 right-3 p-1 text-purple-300 hover:text-purple-600"
            title="Retirer la citation"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Générateur */}
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          Décrivez le contexte du jour (jour spécial, projet en cours, ambiance...) et l'IA génère 3 citations adaptées.
        </p>
        <div className="flex gap-2">
          <input
            value={contexte}
            onChange={e => setContexte(e.target.value)}
            placeholder="Ex : veille de vacances, deadline projet POPY2, journée mondiale du sourire..."
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-200"
            onKeyDown={e => e.key === 'Enter' && generate()}
          />
          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 flex-shrink-0"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'Génération...' : 'Générer'}
          </button>
        </div>
        {/* Contextes rapides */}
        <div className="flex flex-wrap gap-1.5">
          {['Lundi motivation', 'Vendredi', 'Début de mois', 'Projet en deadline', 'Journée détente', 'Fête nationale'].map(c => (
            <button
              key={c}
              onClick={() => setContexte(c)}
              className="px-2 py-1 text-[10px] bg-gray-50 border border-gray-200 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              {c}
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {/* Suggestions IA */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600">Choisissez une citation :</p>
          {suggestions.map((q, i) => (
            <div
              key={i}
              className="group flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3 hover:border-purple-300 transition cursor-pointer"
              onClick={() => pickQuote(q)}
            >
              <div className="flex-1">
                <p className="text-sm text-gray-800 italic">{q.texte}</p>
                {q.auteur && <p className="text-xs text-gray-400 mt-1">— {q.auteur}</p>}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); pickQuote(q) }}
                disabled={saving}
                className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 group-hover:text-purple-600 group-hover:bg-purple-50 transition"
                title="Choisir cette citation"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
