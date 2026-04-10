'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Send, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'

type BirthdayPerson = { id: string; prenom: string | null; nom: string | null; role: string | null }

function CakeSvg({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#EC4899" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-8a2 2 0 00-2-2H6a2 2 0 00-2 2v8" />
      <path d="M4 16s.5-1 4-1 4.5 2 8 1 4-1 4-1" />
      <path d="M2 21h20" />
      <path d="M7 8v3" /><path d="M12 8v3" /><path d="M17 8v3" />
      <path d="M7 4.5a1.5 1.5 0 010 3" /><path d="M7 4.5a1.5 1.5 0 000 3" />
      <path d="M12 4.5a1.5 1.5 0 010 3" /><path d="M12 4.5a1.5 1.5 0 000 3" />
      <path d="M17 4.5a1.5 1.5 0 010 3" /><path d="M17 4.5a1.5 1.5 0 000 3" />
    </svg>
  )
}

export function BirthdayBanner() {
  const supabase = createClient()
  const { user } = useUser()
  const [birthdayPeople, setBirthdayPeople] = useState<BirthdayPerson[]>([])
  const [open, setOpen] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<BirthdayPerson | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [myVoeux, setMyVoeux] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)

  const [isMyBirthday, setIsMyBirthday] = useState(false)
  const [myMessages, setMyMessages] = useState<string[]>([])

  useEffect(() => {
    if (!user) return
    const today = new Date()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const todayStr = today.toISOString().slice(0, 10)

    // Fetch all users with birthday today
    supabase
      .schema('app')
      .from('utilisateurs')
      .select('id,prenom,nom,role,date_naissance')
      .eq('actif', true)
      .not('date_naissance', 'is', null)
      .then(({ data }) => {
        const all = (data ?? []) as (BirthdayPerson & { date_naissance: string })[]
        const matches = all.filter(u => {
          if (!u.date_naissance) return false
          const dn = new Date(u.date_naissance)
          return String(dn.getMonth() + 1).padStart(2, '0') === mm
            && String(dn.getDate()).padStart(2, '0') === dd
            && u.id !== user.id
        })
        setBirthdayPeople(matches)

        // Check if it's MY birthday
        const me = all.find(u => u.id === user.id)
        if (me?.date_naissance) {
          const myDn = new Date(me.date_naissance)
          if (String(myDn.getMonth() + 1).padStart(2, '0') === mm
            && String(myDn.getDate()).padStart(2, '0') === dd) {
            setIsMyBirthday(true)
            // Load my messages
            supabase
              .from('voeux_anniversaire')
              .select('message')
              .eq('destinataire', user.id)
              .eq('date', todayStr)
              .order('created_at')
              .then(({ data: voeux }) => {
                const msgs = (voeux ?? []).map((v: any) => v.message)
                // Prepend default message if not already there
                setMyMessages(['Joyeux anniversaire ! Toute l\'équipe API te souhaite une merveilleuse journée.', ...msgs])
              })
          }
        }
      })
  }, [user])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSelectedPerson(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function sendVoeu() {
    if (!message.trim() || !selectedPerson) return
    setSending(true)
    await supabase.from('voeux_anniversaire').insert({
      destinataire: selectedPerson.id,
      message: message.trim(),
    })
    setSent(prev => new Set(prev).add(selectedPerson.id))
    setMessage('')
    setSending(false)
    setSelectedPerson(null)
  }

  if (birthdayPeople.length === 0 && !isMyBirthday) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded-lg hover:bg-pink-50 transition-colors animate-[bounce_2s_ease-in-out_infinite]"
        title="Un anniversaire aujourd'hui !"
      >
        <CakeSvg size={22} />
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-pink-500 rounded-full border-2 border-white" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 w-72">
          {isMyBirthday && !selectedPerson ? (
            // Vue "c'est mon anniversaire" — lire les messages
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CakeSvg size={18} />
                  <p className="text-xs font-semibold text-pink-700">Joyeux anniversaire !</p>
                </div>
                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {myMessages.map((msg, i) => (
                  <div key={i} className={`rounded-lg px-3 py-2 text-sm ${i === 0 ? 'bg-pink-50 border border-pink-200 text-pink-800 font-medium' : 'bg-gray-50 text-gray-700'}`}>
                    {i === 0 ? (
                      <div className="flex items-center gap-2">
                        <CakeSvg size={16} />
                        <span>{msg}</span>
                      </div>
                    ) : (
                      <p className="italic">{msg}</p>
                    )}
                    <p className="text-[9px] text-gray-400 mt-1">{i === 0 ? 'API' : 'Un(e) collègue'}</p>
                  </div>
                ))}
              </div>
              {myMessages.length <= 1 && (
                <p className="text-[10px] text-gray-400 text-center">Les messages de vos collègues apparaîtront ici au fil de la journée</p>
              )}
              {/* Permet quand même d'envoyer un mot aux autres qui fêtent aussi leur anniv */}
              {birthdayPeople.length > 0 && (
                <div className="border-t border-gray-100 pt-3 mt-3">
                  <p className="text-[10px] text-gray-500 mb-2">Aussi aujourd'hui :</p>
                  {birthdayPeople.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPerson(p)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-pink-50 text-left text-xs"
                    >
                      <span className="font-medium text-gray-900">{p.prenom} {p.nom}</span>
                      {sent.has(p.id) ? (
                        <span className="text-[10px] text-emerald-600 ml-auto">Envoyé</span>
                      ) : (
                        <span className="text-[10px] text-pink-600 ml-auto">Dire un mot</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : selectedPerson ? (
            // Écrire un mot
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">Écrire un mot anonyme</p>
                <button onClick={() => setSelectedPerson(null)} className="text-gray-400 hover:text-gray-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-center py-2">
                <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-sm font-semibold text-pink-700 mx-auto mb-1">
                  {(selectedPerson.prenom?.[0] ?? '').toUpperCase()}{(selectedPerson.nom?.[0] ?? '').toUpperCase()}
                </div>
                <p className="text-sm font-medium text-gray-900">{selectedPerson.prenom} {selectedPerson.nom}</p>
              </div>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Bon anniversaire ! ..."
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-200 resize-none"
              />
              <button
                onClick={sendVoeu}
                disabled={sending || !message.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-pink-600 text-white text-sm font-medium rounded-lg hover:bg-pink-700 disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Envoyer anonymement
              </button>
              <p className="text-[10px] text-gray-400 text-center">Votre nom ne sera pas affiché</p>
            </div>
          ) : (
            // Liste des anniversaires
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3 px-1">
                <CakeSvg size={18} />
                <p className="text-xs font-semibold text-gray-700">Anniversaire aujourd'hui</p>
              </div>
              <div className="space-y-1">
                {birthdayPeople.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-pink-50 transition">
                    <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-xs font-semibold text-pink-700 flex-shrink-0">
                      {(p.prenom?.[0] ?? '').toUpperCase()}{(p.nom?.[0] ?? '').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{p.prenom} {p.nom}</p>
                      <p className="text-[10px] text-gray-400">{p.role ?? ''}</p>
                    </div>
                    {sent.has(p.id) ? (
                      <span className="text-[10px] text-emerald-600 font-medium">Envoyé</span>
                    ) : (
                      <button
                        onClick={() => setSelectedPerson(p)}
                        className="px-2 py-1 text-[10px] font-medium text-pink-700 bg-pink-50 border border-pink-200 rounded hover:bg-pink-100"
                      >
                        Dire un mot
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
