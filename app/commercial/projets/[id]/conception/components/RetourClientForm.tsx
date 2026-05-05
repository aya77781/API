'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, AlertTriangle, XCircle, Loader2, Send } from 'lucide-react'
import { enregistrerRetourClient } from '@/app/_actions/conception'
import type { Proposition } from '@/lib/conception/types'

type Reponse = 'acceptee' | 'en_negociation' | 'refusee'

export function RetourClientForm({
  projetId,
  proposition,
  dessinatriceProjetId,
  economisteProjetId,
}: {
  projetId: string
  proposition: Proposition
  dessinatriceProjetId: string | null
  economisteProjetId: string | null
}) {
  const [reponse, setReponse] = useState<Reponse | null>(null)
  const [commentaire, setCommentaire] = useState('')
  const [modifsPlan, setModifsPlan] = useState(true)
  const [modifsBudget, setModifsBudget] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isAPD = proposition.type === 'finale'

  function envoyer() {
    if (!reponse) return
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      try {
        const res = await enregistrerRetourClient({
          propositionId: proposition.id,
          statut: reponse,
          commentaire: commentaire || undefined,
          modifsPlan,
          modifsBudget,
        })
        if (res?.passationDeclenchee) {
          setSuccess('APD accepté — projet basculé en phase Passation')
        } else if (reponse === 'en_negociation') {
          setSuccess('Version suivante lancée')
        } else {
          setSuccess('Retour client enregistré')
        }
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  const radio = 'flex-1 cursor-pointer border-2 rounded-lg p-3 text-sm font-medium transition-all'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Proposition <span className="font-semibold">{isAPD ? 'APD' : `V${proposition.numero}`}</span> envoyée au client le{' '}
          <span className="font-semibold">{proposition.date_envoi ?? '—'}</span>.
        </p>
        {isAPD && (
          <p className="text-xs text-violet-700 mt-1">Cette proposition est l&apos;APD final — son acceptation déclenche la phase Passation.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <label className={`${radio} ${reponse === 'acceptee' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-gray-300'}`}>
          <input type="radio" name="r" className="hidden" checked={reponse === 'acceptee'} onChange={() => setReponse('acceptee')} />
          <CheckCircle className="w-4 h-4 inline mr-1.5" />Acceptée
        </label>
        <label className={`${radio} ${reponse === 'en_negociation' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 hover:border-gray-300'} ${isAPD ? 'opacity-50 pointer-events-none' : ''}`}>
          <input type="radio" name="r" className="hidden" checked={reponse === 'en_negociation'} onChange={() => setReponse('en_negociation')} disabled={isAPD} />
          <AlertTriangle className="w-4 h-4 inline mr-1.5" />Demande modifs
        </label>
        <label className={`${radio} ${reponse === 'refusee' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 hover:border-gray-300'}`}>
          <input type="radio" name="r" className="hidden" checked={reponse === 'refusee'} onChange={() => setReponse('refusee')} />
          <XCircle className="w-4 h-4 inline mr-1.5" />Refusée
        </label>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Commentaire client</label>
        <textarea
          rows={3}
          value={commentaire}
          onChange={e => setCommentaire(e.target.value)}
          placeholder="Ce que le client a dit / écrit…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none placeholder-gray-300"
        />
      </div>

      {reponse === 'en_negociation' && !isAPD && (
        <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={modifsPlan} onChange={e => setModifsPlan(e.target.checked)} className="accent-amber-600" disabled={!dessinatriceProjetId} />
            Plan à revoir
            {!dessinatriceProjetId && <span className="text-xs text-amber-700">(pas de dessinatrice assignée)</span>}
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={modifsBudget} onChange={e => setModifsBudget(e.target.checked)} className="accent-amber-600" disabled={!economisteProjetId} />
            Budget à revoir
            {!economisteProjetId && <span className="text-xs text-amber-700">(pas d&apos;économiste assigné)</span>}
          </label>
        </div>
      )}

      {error && <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {success && <div className="p-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>}

      <div className="flex justify-end">
        <button
          onClick={envoyer}
          disabled={!reponse || pending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 disabled:opacity-40"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {reponse === 'en_negociation' ? 'Lancer la version suivante' : 'Enregistrer le retour'}
        </button>
      </div>
    </div>
  )
}
