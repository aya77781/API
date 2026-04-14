'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'

type Mood = 'fatigue' | 'ca_va' | 'bien' | 'super'

const MOODS: { key: Mood; label: string; color: string; bg: string }[] = [
  { key: 'fatigue', label: 'Fatigué',  color: '#94A3B8', bg: 'bg-gray-50 hover:bg-gray-100 border-gray-200' },
  { key: 'ca_va',   label: 'Ça va',    color: '#64748B', bg: 'bg-gray-50 hover:bg-gray-100 border-gray-200' },
  { key: 'bien',    label: 'Bien',     color: '#475569', bg: 'bg-gray-50 hover:bg-gray-100 border-gray-200' },
  { key: 'super',   label: 'Super',    color: '#1E293B', bg: 'bg-gray-50 hover:bg-gray-100 border-gray-200' },
]

function FaceSvg({ mood, size = 28 }: { mood: Mood; size?: number }) {
  const m = MOODS.find(x => x.key === mood)!
  const c = m.color
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

export function MoodPicker() {
  const supabase = createClient()
  const { user } = useUser()
  const [todayMood, setTodayMood] = useState<Mood | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [quote, setQuote] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Load today's mood + quote
  useEffect(() => {
    if (!user) return
    const today = new Date().toISOString().slice(0, 10)
    supabase
      .from('humeurs')
      .select('humeur')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setTodayMood(data.humeur as Mood)
      })
    function loadQuote() {
      supabase
        .from('quotes_du_jour')
        .select('texte')
        .eq('date', today)
        .eq('actif', true)
        .maybeSingle()
        .then(({ data }) => setQuote((data?.texte as string | undefined) ?? null))
    }
    loadQuote()
    // Realtime : met à jour la quote dès que le CHO la change
    const channel = supabase
      .channel('quote_du_jour')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes_du_jour' }, () => {
        loadQuote()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function pick(mood: Mood) {
    if (!user) return
    setSaving(true)
    const today = new Date().toISOString().slice(0, 10)
    if (todayMood) {
      await supabase.from('humeurs').update({ humeur: mood }).eq('user_id', user.id).eq('date', today)
    } else {
      await supabase.from('humeurs').insert({ user_id: user.id, date: today, humeur: mood })
    }
    setTodayMood(mood)
    setSaving(false)
    setOpen(false)
  }

  if (!user) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        title={todayMood ? `Humeur du jour : ${MOODS.find(m => m.key === todayMood)?.label}` : 'Comment vous sentez-vous aujourd\'hui ?'}
      >
        {todayMood ? (
          <FaceSvg mood={todayMood} size={24} />
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" stroke="#D1D5DB" strokeWidth="1.5" strokeDasharray="3 2" />
            <circle cx="9" cy="10" r="1" fill="#D1D5DB" />
            <circle cx="15" cy="10" r="1" fill="#D1D5DB" />
            <path d="M8.5 14.5Q12 17 15.5 14.5" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-50 w-56">
          <p className="text-xs font-medium text-gray-600 mb-2">
            {todayMood ? 'Changer votre humeur du jour' : 'Comment vous sentez-vous ?'}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {MOODS.map(m => (
              <button
                key={m.key}
                onClick={() => pick(m.key)}
                disabled={saving}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition ${
                  todayMood === m.key ? m.bg + ' border-2' : 'border-gray-100 hover:border-gray-300'
                } disabled:opacity-50`}
              >
                <FaceSvg mood={m.key} size={32} />
                <span className="text-[10px] font-medium text-gray-600">{m.label}</span>
              </button>
            ))}
          </div>
          {todayMood && (
            <p className="text-[10px] text-gray-400 text-center mt-2">Vous pouvez changer d'avis</p>
          )}
          {quote && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[10px] text-purple-700 italic leading-relaxed">{quote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
