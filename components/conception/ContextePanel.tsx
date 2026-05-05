'use client'

import { FileText, Lightbulb, Calendar, Euro, ListChecks, AlertCircle } from 'lucide-react'
import { formatEuros } from '@/lib/conception/types'

type BriefSnapshot = {
  besoin_exprime?: string | null
  contraintes?: string | null
  style_inspiration?: string | null
  budget_evoque?: number | null
  delais_souhaites?: string | null
  documents_urls?: string[] | null
} | null

type NoticeSnapshot = {
  id?: string
  lot_nom: string
  contenu_texte: string
  ordre?: number
}

export function ContextePanel({
  brief,
  notices,
  fichiersJoints,
  messageDemandeur,
  versionPrecedentePlanUrl,
  warningPasDePlan,
}: {
  brief: BriefSnapshot
  notices: NoticeSnapshot[]
  fichiersJoints?: string[] | null
  messageDemandeur?: string | null
  versionPrecedentePlanUrl?: string | null
  warningPasDePlan?: boolean
}) {
  return (
    <div className="space-y-4">
      {messageDemandeur && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
          <p className="text-xs font-semibold text-blue-700 mb-1">Message du Commercial</p>
          <p className="text-sm text-blue-800 whitespace-pre-wrap">{messageDemandeur}</p>
        </div>
      )}

      {warningPasDePlan && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Travail à l&apos;aveugle — pas de plan disponible pour cette version.
          </p>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <h4 className="text-sm font-semibold text-gray-900">Brief client</h4>
        </div>
        {!brief ? (
          <p className="text-sm text-gray-400 italic">Aucun brief saisi.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {brief.besoin_exprime && (
              <div>
                <p className="text-xs text-gray-500 font-semibold">Besoin exprimé</p>
                <p className="text-gray-700 whitespace-pre-wrap">{brief.besoin_exprime}</p>
              </div>
            )}
            {brief.contraintes && (
              <div>
                <p className="text-xs text-gray-500 font-semibold">Contraintes</p>
                <p className="text-gray-700 whitespace-pre-wrap">{brief.contraintes}</p>
              </div>
            )}
            {brief.style_inspiration && (
              <div>
                <p className="text-xs text-gray-500 font-semibold">Style / inspiration</p>
                <p className="text-gray-700 whitespace-pre-wrap">{brief.style_inspiration}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {brief.budget_evoque != null && (
                <div className="flex items-center gap-2">
                  <Euro className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-500">Budget</span>
                  <span className="text-sm font-medium text-gray-700">{formatEuros(brief.budget_evoque)}</span>
                </div>
              )}
              {brief.delais_souhaites && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-500">Délais</span>
                  <span className="text-sm font-medium text-gray-700">
                    {new Date(brief.delais_souhaites).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-violet-500" />
          <h4 className="text-sm font-semibold text-gray-900">Notices commerciales</h4>
          <span className="text-xs text-gray-400">({notices.length})</span>
        </div>
        {notices.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Aucune notice.</p>
        ) : (
          <ul className="space-y-2">
            {notices.map((n, i) => (
              <li key={n.id ?? i} className="border-l-2 border-violet-200 pl-3">
                <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">{n.lot_nom}</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap mt-0.5">{n.contenu_texte || <em className="text-gray-400">vide</em>}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {versionPrecedentePlanUrl && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-semibold mb-2">Plan version précédente</p>
          <a href={versionPrecedentePlanUrl} target="_blank" rel="noreferrer"
             className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
            <FileText className="w-4 h-4" /> Ouvrir le plan
          </a>
        </div>
      )}

      {fichiersJoints && fichiersJoints.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-semibold mb-2">Documents joints</p>
          <ul className="space-y-1">
            {fichiersJoints.map((url, i) => (
              <li key={i}>
                <a href={url} target="_blank" rel="noreferrer"
                   className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <FileText className="w-3.5 h-3.5" />
                  {url.split('/').pop() ?? `Fichier ${i + 1}`}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
