'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar, FileText, Download, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { ReunionChantier } from '@/components/co/visite/ReunionChantier'
import { createClient } from '@/lib/supabase/client'
import {
  cn, getMondayOf, toISODate, formatSemaineDebut, listSemaines, shortSemaineLabel,
} from '@/lib/utils'

interface CRDoc {
  id: string
  nom_fichier: string
  storage_path: string
  created_at: string
  message_depot: string | null
}

interface Props { projetId: string }

export function CompteRenduWeek({ projetId }: Props) {
  const supabase = useRef(createClient()).current
  const [semaine, setSemaine] = useState<string>(() => toISODate(getMondayOf(new Date())))
  const [allDocs, setAllDocs] = useState<CRDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set())

  const weeks = listSemaines(6, 1)

  useEffect(() => {
    async function load() {
      setLoading(true)
      // Recupere tous les CR sur 12 semaines (passees + future) pour pouvoir construire historique
      const oldest = new Date(weeks[0] + 'T00:00:00')
      const newest = new Date(weeks[weeks.length - 1] + 'T00:00:00')
      newest.setDate(newest.getDate() + 7)
      const { data } = await supabase.schema('app').from('documents')
        .select('id, nom_fichier, storage_path, created_at, message_depot')
        .eq('projet_id', projetId)
        .eq('type_doc', 'cr')
        .gte('created_at', oldest.toISOString())
        .lt('created_at', newest.toISOString())
        .order('created_at', { ascending: false })
      setAllDocs((data ?? []) as CRDoc[])
      setLoading(false)
    }
    load()
  }, [projetId, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDownload(doc: CRDoc) {
    const { data } = await supabase.storage.from('projets').createSignedUrl(doc.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  // Regroupe les docs par lundi de leur semaine
  const docsByWeek = new Map<string, CRDoc[]>()
  for (const d of allDocs) {
    const monday = toISODate(getMondayOf(new Date(d.created_at)))
    if (!docsByWeek.has(monday)) docsByWeek.set(monday, [])
    docsByWeek.get(monday)!.push(d)
  }
  const currentWeekDocs = docsByWeek.get(semaine) ?? []
  const pastWeeks = Array.from(docsByWeek.entries())
    .filter(([w]) => w !== semaine)
    .sort((a, b) => b[0].localeCompare(a[0]))

  function toggleWeek(w: string) {
    setExpandedWeeks(prev => {
      const next = new Set(prev)
      if (next.has(w)) next.delete(w); else next.add(w)
      return next
    })
  }

  const currentWeek = toISODate(getMondayOf(new Date()))
  const isPastWeek = semaine < currentWeek

  return (
    <div className="space-y-5">
      {/* Semaine selector */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-card px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <p className="text-xs font-medium text-gray-700">Semaine</p>
          <span className="text-[10px] text-gray-400">— {formatSemaineDebut(semaine)}</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {weeks.map(w => {
            const hasDocs = (docsByWeek.get(w)?.length ?? 0) > 0
            const isActive = w === semaine
            return (
              <button key={w} onClick={() => setSemaine(w)}
                title={formatSemaineDebut(w)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap inline-flex items-center gap-1',
                  isActive
                    ? 'bg-gray-900 text-white'
                    : hasDocs
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700',
                )}>
                <Calendar className="w-3 h-3" />
                {shortSemaineLabel(w)}
                {hasDocs && <Check className={cn('w-3 h-3', isActive ? 'text-emerald-300' : 'text-emerald-600')} />}
              </button>
            )
          })}
        </div>
      </div>

      {/* CR de la semaine selectionnee */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <p className="text-sm font-medium text-gray-900 flex-1">
            Comptes rendus — {shortSemaineLabel(semaine)}
          </p>
          <span className="text-[10px] text-gray-400">{currentWeekDocs.length}</span>
        </div>
        {loading ? (
          <div className="px-5 py-4 text-xs text-gray-400">Chargement...</div>
        ) : currentWeekDocs.length === 0 ? (
          <div className="px-5 py-6 text-center">
            <p className="text-xs text-gray-400">Aucun compte rendu pour cette semaine</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {currentWeekDocs.map(d => (
              <div key={d.id} className="px-5 py-3 flex items-center gap-3">
                <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{d.nom_fichier}</p>
                  {d.message_depot && (
                    <p className="text-[10px] text-gray-400 truncate">{d.message_depot}</p>
                  )}
                  <p className="text-[10px] text-gray-400">
                    {new Date(d.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button onClick={() => handleDownload(d)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded transition-colors">
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Creation flow */}
      {isPastWeek ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
          Vous consultez une semaine passee. Pour creer un nouveau compte rendu, selectionnez la semaine en cours.
        </div>
      ) : showForm ? (
        <div>
          <button onClick={() => setShowForm(false)}
            className="text-xs text-gray-400 hover:text-gray-700 mb-3">
            ← Masquer le formulaire
          </button>
          <ReunionChantier projetId={projetId} />
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
          + Creer un nouveau compte rendu
        </button>
      )}

      {/* Historique semaines passees */}
      {pastWeeks.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Historique — semaines passees
          </p>
          <div className="space-y-2">
            {pastWeeks.map(([w, docs]) => {
              const isOpen = expandedWeeks.has(w)
              return (
                <div key={w} className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
                  <button onClick={() => toggleWeek(w)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                    <span className="text-xs font-semibold bg-gray-900 text-white rounded px-2 py-0.5">
                      {shortSemaineLabel(w)}
                    </span>
                    <span className="text-xs text-gray-500 flex-1">{formatSemaineDebut(w)}</span>
                    <span className="text-[10px] font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                      <FileText className="w-3 h-3" />{docs.length}
                    </span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {docs.map(d => (
                        <div key={d.id} className="px-4 py-2.5 flex items-center gap-3">
                          <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{d.nom_fichier}</p>
                            <p className="text-[10px] text-gray-400">
                              {new Date(d.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <button onClick={() => handleDownload(d)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 rounded transition-colors">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
