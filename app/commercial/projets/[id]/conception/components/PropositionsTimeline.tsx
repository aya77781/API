'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, Clock, FileText, Calculator, Send, Eye, X, Forward, Plus } from 'lucide-react'
import { PropositionVersionBadge } from '@/components/conception/PropositionVersionBadge'
import {
  type DemandeConception,
  type Proposition,
  formatEuros,
  isPlanType,
  isChiffrageType,
  labelType,
} from '@/lib/conception/types'
import { marquerPropositionEnvoyee, lancerPhaseSuivante } from '@/app/_actions/conception'

export function PropositionsTimeline({
  propositions,
  demandes,
  projetId,
}: {
  propositions: Proposition[]
  demandes: DemandeConception[]
  projetId: string
}) {
  const [details, setDetails] = useState<Proposition | null>(null)
  const [pending, startTransition] = useTransition()

  // Une ligne par proposition existante (active ou archivée), triée par numero
  const sorted = [...propositions].sort((a, b) => a.numero - b.numero)
  const apdSignee = propositions.some(p => p.type === 'finale' && p.verrouillee_apres_signature)
  const maxNum = sorted.length ? Math.max(...sorted.map(p => p.numero)) : 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Aucune proposition encore. Lancez une demande de plan ou d&apos;estimation.</p>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-2 top-2 bottom-2 w-px bg-gray-200" />
          {sorted.map(prop => {
            const isAPD = prop.type === 'finale'
            const demandePlan = demandes.find(d => isPlanType(d.type) && d.version === prop.numero)
            const demandeChiffrage = demandes.find(d => isChiffrageType(d.type) && d.version === prop.numero)

            const tone = prop.statut === 'acceptee' ? 'vert'
              : prop.statut === 'refusee' ? 'rouge'
              : prop.statut === 'envoyee' ? 'bleu'
              : 'gris-actif'

            const dotCls = tone === 'vert' ? 'bg-green-500' :
                            tone === 'rouge' ? 'bg-red-500' :
                            tone === 'bleu' ? 'bg-blue-500' : 'bg-gray-500'

            const labelV = isAPD ? 'APD' : `V${prop.numero}`
            const canLancerSuivante = prop.statut === 'acceptee' && !prop.is_archived && !apdSignee

            return (
              <div key={prop.id} className="relative pb-6 last:pb-0">
                <span className={`absolute -left-4 top-1 w-3 h-3 rounded-full border-2 border-white ${dotCls}`} />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-1.5 py-0.5 text-xs font-bold rounded bg-gray-900 text-white">{labelV}</span>
                      <PropositionVersionBadge version={prop.numero} statut={prop.statut} />
                      {prop.montant_total_ht != null && (
                        <span className="text-sm font-semibold text-gray-700">
                          {formatEuros(prop.montant_total_ht)} HT
                        </span>
                      )}
                      {prop.is_archived && <span className="text-xs text-gray-400">archivée</span>}
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Sublignee
                        icon={<FileText className="w-3.5 h-3.5" />}
                        label="Plan"
                        url={prop.plan_url ?? null}
                        demande={demandePlan}
                      />
                      <Sublignee
                        icon={<Calculator className="w-3.5 h-3.5" />}
                        label="Chiffrage"
                        montant={prop.montant_total_ht ?? null}
                        demande={demandeChiffrage}
                      />
                    </div>
                    {prop.commentaire_client && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                        <span className="text-xs text-gray-500 font-semibold">Retour client : </span>
                        {prop.commentaire_client}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                    {prop.plan_url && prop.montant_total_ht != null && prop.statut === 'en_preparation' && (
                      <button
                        onClick={() => startTransition(() => marquerPropositionEnvoyee(prop.id, projetId))}
                        disabled={pending}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Send className="w-3 h-3" /> Envoyer client
                      </button>
                    )}
                    {canLancerSuivante && (
                      <div className="flex flex-col gap-1 items-end">
                        <button
                          onClick={() => startTransition(() => lancerPhaseSuivante(projetId, prop.numero, false))}
                          disabled={pending}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
                        >
                          <Forward className="w-3 h-3" /> Lancer V{prop.numero + 1}
                        </button>
                        <button
                          onClick={() => startTransition(() => lancerPhaseSuivante(projetId, prop.numero, true))}
                          disabled={pending}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs border border-violet-300 text-violet-700 rounded-lg hover:bg-violet-50 disabled:opacity-50"
                        >
                          <Forward className="w-3 h-3" /> Lancer APD
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => setDetails(prop)}
                      className="text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" /> Détails
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {sorted.length > 0 && !apdSignee && (
        <div className="text-xs text-gray-400 pl-6">
          Prochaine version : <span className="font-medium text-gray-600">V{maxNum + 1}</span> ou <span className="font-medium text-violet-700">APD</span>.
        </div>
      )}

      {details && <DetailsModal proposition={details} demandes={demandes.filter(d => d.version === details.numero)} onClose={() => setDetails(null)} />}
    </div>
  )
}

function Sublignee({
  icon, label, url, montant, demande,
}: {
  icon: React.ReactNode
  label: string
  url?: string | null
  montant?: number | null
  demande?: DemandeConception
}) {
  let badge: React.ReactNode
  if (url || montant != null) {
    badge = <span className="text-xs text-green-600 inline-flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Livré</span>
  } else if (demande?.statut === 'en_attente' || demande?.statut === 'en_cours') {
    badge = <span className="text-xs text-amber-600 inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {demande.statut === 'en_cours' ? 'En cours' : 'En attente'}</span>
  } else {
    badge = <span className="text-xs text-gray-400">À demander</span>
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-400">{icon}</span>
      <span className="text-gray-600">{label}</span>
      <span>{badge}</span>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Ouvrir</a>
      )}
      {montant != null && (
        <span className="ml-auto text-xs text-gray-500">{formatEuros(montant)}</span>
      )}
    </div>
  )
}

function DetailsModal({ proposition, demandes, onClose }: {
  proposition: Proposition
  demandes: DemandeConception[]
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">
            Proposition {proposition.type === 'finale' ? 'APD' : `V${proposition.numero}`}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <Row label="Statut" value={proposition.statut} />
          <Row label="Plan" value={proposition.plan_url ? <a href={proposition.plan_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Ouvrir</a> : '—'} />
          <Row label="Plan 3D" value={proposition.plan_3d_url ? <a href={proposition.plan_3d_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Ouvrir</a> : '—'} />
          <Row label="Montant" value={proposition.montant_total_ht != null ? `${formatEuros(proposition.montant_total_ht)} HT` : '—'} />
          <Row label="Date envoi client" value={proposition.date_envoi ?? '—'} />
          <Row label="Date réponse client" value={proposition.date_reponse_client ?? '—'} />
          {proposition.commentaire_client && (
            <Row label="Commentaire client" value={proposition.commentaire_client} />
          )}
          <div className="pt-3 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-500 mb-2">Demandes associées</p>
            <ul className="space-y-1">
              {demandes.length === 0 ? <li className="text-gray-400 italic">Aucune</li> :
                demandes.map(d => (
                  <li key={d.id} className="text-xs text-gray-600">
                    {labelType(d.type)} · {d.statut}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-xs text-gray-500 font-semibold">{label}</span>
      <span className="text-gray-700 text-right">{value}</span>
    </div>
  )
}
