'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Sparkles, X, Send, Loader2, Check } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  action?: string | null
}

const SUGGESTIONS_BY_ROLE: Record<string, string[]> = {
  co: [
    'Quel est le statut de mes projets ?',
    'Combien de tâches j\'ai en retard ?',
    'Trouve des électriciens à Lyon',
    'Rappelle-moi de relancer le ST demain',
  ],
  at: [
    'Quels DOE sont à clôturer ce mois ?',
    'Liste les ST sans Kbis à jour',
    'Quelles factures ST attendent validation ?',
    'Rappelle-moi de relancer la mairie pour la DAACT',
  ],
  rh: [
    'Combien de candidats nouveaux cette semaine ?',
    'Qui est en onboarding actuellement ?',
    'Quels entretiens annuels sont à planifier ?',
    'Quel est le total de la masse salariale du mois ?',
  ],
  compta: [
    'Quelles factures sont en attente de paiement ?',
    'Quel est le solde de trésorerie ce mois ?',
    'Liste les NDF à valider',
    'Combien de règlements clients en retard ?',
  ],
  commercial: [
    'Quels dossiers commerciaux sont en cours ?',
    'Liste mes prospects à relancer',
    'Quel est mon taux de transformation ce mois ?',
    'Crée un nouveau dossier client',
  ],
  dessin: [
    'Quels plans EXE sont en attente de validation ?',
    'Liste les projets en phase APD',
    'Quels CCTP doivent être finalisés cette semaine ?',
    'Rappelle-moi de mettre à jour les plans DOE',
  ],
  economiste: [
    'Quels chiffrages sont en cours ?',
    'Liste les avenants à valider',
    'Quel est le coût moyen au m² de mes projets ?',
    'Trouve un bordereau type pour gros œuvre',
  ],
  gerant: [
    'Quel est le CA du mois ?',
    'Quels projets sont en alerte ?',
    'Quelle est la rentabilité de l\'équipe ce trimestre ?',
    'Donne-moi le reporting hebdomadaire',
  ],
  cho: [
    'Quels événements sont à venir ?',
    'Quel est le climat social actuel ?',
    'Liste les actions cadre de vie en cours',
    'Planifie une activité d\'équipe',
  ],
  st: [
    'Quels chantiers sont prévus cette semaine ?',
    'Quelles factures j\'ai envoyées ?',
    'Mes documents (Kbis, assurance) sont-ils à jour ?',
    'Liste mes interventions à planifier',
  ],
  admin: [
    'Combien d\'utilisateurs actifs ?',
    'Quels comptes attendent validation ?',
    'Liste les groupes de chat actifs',
    'Donne-moi un état général de la plateforme',
  ],
}
const DEFAULT_SUGGESTIONS = [
  'Quel est le statut de mes projets ?',
  'Combien de tâches en retard ?',
  'Donne-moi un résumé de la journée',
  'Que dois-je faire aujourd\'hui ?',
]

export function AssistantChat() {
  const { user, profil } = useUser()
  const params = useParams()

  // Extract projet_id from URL if on /co/projets/[id]/...
  const projetId = (params?.id as string) ?? null

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // Clear action badge after 3s
  useEffect(() => {
    if (lastAction) {
      const t = setTimeout(() => setLastAction(null), 3000)
      return () => clearTimeout(t)
    }
  }, [lastAction])

  async function handleSend() {
    if (!input.trim() || !user || loading) return

    const userMsg: Message = { role: 'user', content: input.trim(), timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setLastAction(null)

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          conversation_id: conversationId,
          user_id: user.id,
          role: profil?.role ?? 'co',
        }),
      })

      const data = await res.json()

      if (data.reply) {
        const assistantMsg: Message = {
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toISOString(),
          action: data.action_taken,
        }
        setMessages(prev => [...prev, assistantMsg])
        if (data.action_taken) setLastAction(data.action_taken)
      }

      if (data.conversation_id) setConversationId(data.conversation_id)
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Erreur de connexion. Reessayez.',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
    }
  }

  function formatContent(content: string) {
    // Basic markdown: bold and lists
    return content
      .split('\n')
      .map((line, i) => {
        const bold = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return `<li key="${i}" class="ml-4">${bold.slice(2)}</li>`
        }
        return bold
      })
      .join('<br/>')
  }

  // Don't render if not logged in
  if (!user || !profil) return null

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 w-12 h-12 bg-gray-900 text-white rounded-full shadow-lg hover:bg-gray-800 transition-all flex items-center justify-center hover:scale-105">
          <Sparkles className="w-5 h-5" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-32px)] sm:w-[360px] max-h-[70vh] sm:max-h-[480px] bg-white border border-gray-200 rounded-2xl shadow-xl flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Assistant API</p>
                {projetId && <p className="text-[10px] text-gray-400">Contexte projet actif</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {lastAction && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  <Check className="w-2.5 h-2.5" />{lastAction}
                </span>
              )}
              <button onClick={() => setOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="h-[320px] overflow-y-auto px-3 py-2.5 space-y-2.5">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <Sparkles className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Comment puis-je vous aider ?</p>
                <div className="mt-4 space-y-1.5">
                  {(SUGGESTIONS_BY_ROLE[profil?.role ?? ''] ?? DEFAULT_SUGGESTIONS).map(suggestion => (
                    <button key={suggestion} onClick={() => { setInput(suggestion); inputRef.current?.focus() }}
                      className="block w-full text-left px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors">
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] px-3 py-2 rounded-lg text-sm',
                  msg.role === 'user'
                    ? 'bg-gray-900 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-700 rounded-bl-sm',
                )}>
                  <div dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} />
                  {msg.action && (
                    <div className="mt-1.5 pt-1.5 border-t border-gray-200/30">
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                        <Check className="w-2.5 h-2.5" />{msg.action}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-500 px-3 py-2 rounded-lg rounded-bl-sm flex items-center gap-2 text-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  L&apos;assistant reflechit...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 h-14 border-t border-gray-100 flex-shrink-0">
            <input ref={inputRef} type="text" value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Posez votre question..."
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />
            <button onClick={handleSend} disabled={!input.trim() || loading}
              className="p-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
