'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Bell, AlertTriangle, Info, Eye, CheckCircle, Upload } from 'lucide-react'
import { DocumentUploadModal } from '@/components/shared/DocumentUploadModal'

interface AlerteRow {
  id: string
  titre: string
  message: string | null
  type: string
  priorite: 'low' | 'normal' | 'high' | 'urgent'
  lue: boolean
  created_at: string
  utilisateur_nom: string | null
  projet_nom: string | null
}

const PRIORITE_LABELS: Record<string, string> = {
  low: 'Faible', normal: 'Normale', high: 'Haute', urgent: 'Urgente',
}

function PrioriteIcon({ p }: { p: string }) {
  if (p === 'urgent' || p === 'high') return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
  if (p === 'normal') return <Info className="w-3.5 h-3.5 text-gray-400" />
  return <Info className="w-3.5 h-3.5 text-gray-300" />
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `il y a ${days} j`
}

export default function AdminAlertesPage() {
  const supabase = createClient()
  const [alertes, setAlertes] = useState<AlerteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPriorite, setFilterPriorite] = useState('')
  const [filterLue, setFilterLue] = useState<'all' | 'lue' | 'non_lue'>('all')
  const [uploadOpen, setUploadOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const [alertesRes, usersRes, projetsRes] = await Promise.all([
        supabase.schema('app').from('alertes')
          .select('id, titre, message, type, priorite, lue, created_at, utilisateur_id, projet_id')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.schema('app').from('utilisateurs').select('id, prenom, nom'),
        supabase.schema('app').from('projets').select('id, nom'),
      ])

      const usersMap = new Map((usersRes.data ?? []).map(u => [u.id, `${u.prenom} ${u.nom}`]))
      const projetsMap = new Map((projetsRes.data ?? []).map(p => [p.id, p.nom]))

      const rows: AlerteRow[] = (alertesRes.data ?? []).map(a => ({
        id: a.id,
        titre: a.titre,
        message: a.message,
        type: a.type,
        priorite: a.priorite,
        lue: a.lue,
        created_at: a.created_at,
        utilisateur_nom: a.utilisateur_id ? (usersMap.get(a.utilisateur_id) ?? null) : null,
        projet_nom: a.projet_id ? (projetsMap.get(a.projet_id) ?? null) : null,
      }))
      setAlertes(rows)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => alertes.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = !q || a.titre.toLowerCase().includes(q) || (a.utilisateur_nom ?? '').toLowerCase().includes(q)
    const matchPriorite = !filterPriorite || a.priorite === filterPriorite
    const matchLue = filterLue === 'all' || (filterLue === 'lue' ? a.lue : !a.lue)
    return matchSearch && matchPriorite && matchLue
  }), [alertes, search, filterPriorite, filterLue])

  const nonLues = alertes.filter(a => !a.lue).length

  return (
    <div>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Alertes</h1>
          <p className="text-xs text-gray-400">
            {alertes.length} alertes · {nonLues} non lues
          </p>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          Deposer
        </button>
      </header>

      <div className="p-6 space-y-4">
        {/* Filtres */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par titre ou utilisateur…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            />
          </div>
          <select
            value={filterPriorite}
            onChange={e => setFilterPriorite(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">Toutes les priorités</option>
            {Object.entries(PRIORITE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(['all', 'non_lue', 'lue'] as const).map(v => (
              <button key={v} onClick={() => setFilterLue(v)}
                className={`px-3 py-2 font-medium transition-colors ${
                  filterLue === v ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}>
                {v === 'all' ? 'Toutes' : v === 'non_lue' ? 'Non lues' : 'Lues'}
              </button>
            ))}
          </div>
        </div>

        {/* Liste */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <Bell className="w-8 h-8 text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">Aucune alerte trouvée</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(a => (
                <div key={a.id} className={`flex items-start gap-4 px-5 py-3.5 ${!a.lue ? 'bg-blue-50/40' : ''}`}>
                  <div className="mt-0.5 flex-shrink-0">
                    <PrioriteIcon p={a.priorite} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.titre}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                        a.priorite === 'urgent' ? 'bg-red-100 text-red-700'
                        : a.priorite === 'high' ? 'bg-orange-100 text-orange-700'
                        : 'bg-gray-100 text-gray-600'
                      }`}>
                        {PRIORITE_LABELS[a.priorite]}
                      </span>
                      {!a.lue && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />}
                    </div>
                    {a.message && <p className="text-xs text-gray-500 mt-0.5 truncate">{a.message}</p>}
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      {a.utilisateur_nom && <span>{a.utilisateur_nom}</span>}
                      {a.projet_nom && <span>· {a.projet_nom}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {a.lue
                      ? <CheckCircle className="w-3.5 h-3.5 text-gray-300" />
                      : <Eye className="w-3.5 h-3.5 text-gray-300" />
                    }
                    <span className="text-xs text-gray-400">{timeAgo(a.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DocumentUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => setUploadOpen(false)}
      />
    </div>
  )
}
