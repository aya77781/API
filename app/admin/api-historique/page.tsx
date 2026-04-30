'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, History, MessageSquare, User as UserIcon, Sparkles, X } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface ConvRow {
  id: string
  utilisateur_id: string | null
  projet_id: string | null
  messages: Message[]
  created_at: string
  updated_at: string
  utilisateur_nom: string | null
  utilisateur_role: string | null
  projet_nom: string | null
}

const ROLE_LABELS: Record<string, string> = {
  co: "Charge d'operations", commercial: 'Commercial', economiste: 'Economiste',
  dessinatrice: 'Dessinatrice', comptable: 'Comptable', gerant: 'Gerant',
  admin: 'Administrateur', rh: 'RH', cho: 'CHO', assistant_travaux: 'AT', st: 'ST',
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "a l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'hier'
  return `il y a ${days} j`
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminApiHistoriquePage() {
  const supabase = createClient()
  const [convs, setConvs] = useState<ConvRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [selected, setSelected] = useState<ConvRow | null>(null)

  useEffect(() => {
    async function load() {
      const [convsRes, usersRes, projetsRes] = await Promise.all([
        supabase.schema('app').from('conversations_assistant')
          .select('id, utilisateur_id, projet_id, messages, created_at, updated_at')
          .order('updated_at', { ascending: false })
          .limit(300),
        supabase.schema('app').from('utilisateurs').select('id, prenom, nom, role'),
        supabase.schema('app').from('projets').select('id, nom'),
      ])

      const usersMap = new Map((usersRes.data ?? []).map(u => [u.id, u]))
      const projetsMap = new Map((projetsRes.data ?? []).map(p => [p.id, p.nom]))

      const rows: ConvRow[] = (convsRes.data ?? []).map(c => {
        const u = c.utilisateur_id ? usersMap.get(c.utilisateur_id) : null
        return {
          id: c.id,
          utilisateur_id: c.utilisateur_id,
          projet_id: c.projet_id,
          messages: (c.messages as Message[]) ?? [],
          created_at: c.created_at,
          updated_at: c.updated_at,
          utilisateur_nom: u ? `${u.prenom} ${u.nom}` : null,
          utilisateur_role: u?.role ?? null,
          projet_nom: c.projet_id ? (projetsMap.get(c.projet_id) ?? null) : null,
        }
      })
      setConvs(rows)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => convs.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q
      || (c.utilisateur_nom ?? '').toLowerCase().includes(q)
      || (c.projet_nom ?? '').toLowerCase().includes(q)
      || c.messages.some(m => m.content.toLowerCase().includes(q))
    const matchRole = !filterRole || c.utilisateur_role === filterRole
    return matchSearch && matchRole
  }), [convs, search, filterRole])

  const totalMessages = convs.reduce((sum, c) => sum + c.messages.length, 0)

  return (
    <div>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div>
          <h1 className="text-base font-semibold text-gray-900">API historique</h1>
          <p className="text-xs text-gray-400">
            {convs.length} conversations · {totalMessages} messages
          </p>
        </div>
      </header>

      <div className="p-6 space-y-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par utilisateur, projet ou message…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            />
          </div>
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">Tous les roles</option>
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <History className="w-8 h-8 text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">Aucune conversation trouvee</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-2.5">Utilisateur</th>
                  <th className="text-left px-5 py-2.5">Role</th>
                  <th className="text-left px-5 py-2.5">Premier message</th>
                  <th className="text-left px-5 py-2.5">Projet</th>
                  <th className="text-right px-5 py-2.5">Messages</th>
                  <th className="text-right px-5 py-2.5">Derniere activite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(c => {
                  const firstUserMsg = c.messages.find(m => m.role === 'user')
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <UserIcon className="w-3.5 h-3.5 text-gray-500" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {c.utilisateur_nom ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {c.utilisateur_role ? (
                          <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                            {ROLE_LABELS[c.utilisateur_role] ?? c.utilisateur_role}
                          </span>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3 max-w-xs">
                        <p className="text-xs text-gray-600 truncate">
                          {firstUserMsg?.content ?? '—'}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-gray-500">
                          {c.projet_nom ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                          {c.messages.length}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-gray-400">
                        {timeAgo(c.updated_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center p-6"
          onClick={() => setSelected(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-xl border border-gray-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  {selected.utilisateur_nom ?? '—'}
                  {selected.utilisateur_role && (
                    <span className="ml-2 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {ROLE_LABELS[selected.utilisateur_role] ?? selected.utilisateur_role}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selected.messages.length} messages · creee le {formatDate(selected.created_at)}
                  {selected.projet_nom && <> · {selected.projet_nom}</>}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {selected.messages.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Aucun message</p>
              ) : selected.messages.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    m.role === 'user' ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-500 to-purple-500'
                  }`}>
                    {m.role === 'user'
                      ? <UserIcon className="w-3.5 h-3.5 text-white" />
                      : <Sparkles className="w-3.5 h-3.5 text-white" />
                    }
                  </div>
                  <div className={`flex-1 max-w-[80%] ${m.role === 'user' ? 'flex flex-col items-end' : ''}`}>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-gray-900 text-white rounded-tr-sm'
                        : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    }`}>
                      {m.content}
                    </div>
                    <p className="text-xs text-gray-400 mt-1 px-1">{formatDate(m.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-2 text-xs text-gray-400 flex-shrink-0">
              <MessageSquare className="w-3.5 h-3.5" />
              Conversation IA · derniere activite {timeAgo(selected.updated_at)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
