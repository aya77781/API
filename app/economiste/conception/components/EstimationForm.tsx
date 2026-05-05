'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Loader2, CheckCircle, Play } from 'lucide-react'
import { livrerDemande, marquerEnCours } from '@/app/_actions/conception'
import { useRouter } from 'next/navigation'
import { formatEuros, labelType } from '@/lib/conception/types'
import { Abbr } from '@/components/shared/Abbr'

type Demande = {
  id: string
  type: string | null
  version: number | null
  statut: string | null
  livrable_montant: number | null
  notes_livreur: string | null
  projet_id: string
}

type Ligne = {
  designation: string
  quantite: string
  unite: string
  prix_unitaire: string
}

const UNITES = ['m²', 'ml', 'u', 'forfait', 'lot']

export function EstimationForm({ demande }: { demande: Demande }) {
  const router = useRouter()
  const dejaLivre = demande.statut === 'livree'

  const [lignes, setLignes] = useState<Ligne[]>([
    { designation: 'Gros œuvre', quantite: '', unite: 'forfait', prix_unitaire: '' },
  ])
  const [aleasPct, setAleasPct] = useState(10)
  const [notes, setNotes] = useState(demande.notes_livreur ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function ajouterLigne() {
    setLignes(prev => [...prev, { designation: '', quantite: '', unite: 'forfait', prix_unitaire: '' }])
  }
  function supprimerLigne(idx: number) {
    setLignes(prev => prev.filter((_, i) => i !== idx))
  }
  function patch(idx: number, key: keyof Ligne, value: string) {
    setLignes(prev => prev.map((l, i) => i === idx ? { ...l, [key]: value } : l))
  }

  const totalLignes = lignes.reduce((acc, l) => {
    const q = parseFloat(l.quantite || '0') || 0
    const pu = parseFloat(l.prix_unitaire || '0') || 0
    return acc + q * pu
  }, 0)
  const aleas = totalLignes * (aleasPct / 100)
  const totalHT = totalLignes + aleas

  function clic_marquer_en_cours() {
    startTransition(async () => {
      await marquerEnCours(demande.id)
      router.refresh()
    })
  }

  async function livrer() {
    setError(null)
    if (totalHT <= 0) { setError('Saisir au moins une ligne avec quantité et prix unitaire'); return }

    const lignesPayload = lignes
      .filter(l => l.designation.trim())
      .map((l, i) => {
        const q = parseFloat(l.quantite || '0') || null
        const pu = parseFloat(l.prix_unitaire || '0') || null
        const total = q != null && pu != null ? q * pu : null
        return {
          designation: l.designation,
          quantite: q,
          unite: l.unite || null,
          prix_unitaire: pu,
          total_ht: total,
          ordre: i,
        }
      })

    if (aleas > 0) {
      lignesPayload.push({
        designation: `Aléas (${aleasPct}%)`,
        quantite: 1,
        unite: 'forfait',
        prix_unitaire: aleas,
        total_ht: aleas,
        ordre: lignesPayload.length,
      })
    }

    startTransition(async () => {
      try {
        await livrerDemande({
          demandeId: demande.id,
          montant: totalHT,
          notes: notes || null,
          lignesEstimation: lignesPayload,
        })
        router.push('/economiste/conception')
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  const inputCls = 'w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">{labelType(demande.type)}</p>
        {demande.statut === 'en_attente' && !dejaLivre && (
          <button
            onClick={clic_marquer_en_cours}
            disabled={pending}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-50 disabled:opacity-50"
          >
            <Play className="w-3 h-3" /> Marquer en cours
          </button>
        )}
      </div>

      {dejaLivre && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">
            Estimation déjà livrée — montant : <span className="font-semibold">{formatEuros(demande.livrable_montant)}</span>.
            Vous pouvez ré-estimer ci-dessous (les lignes seront ajoutées).
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
              <th className="py-2 pr-2 font-semibold">Lot / désignation</th>
              <th className="py-2 px-2 font-semibold w-20">Quantité</th>
              <th className="py-2 px-2 font-semibold w-24">Unité</th>
              <th className="py-2 px-2 font-semibold w-28">PU (€ <Abbr k="HT" />)</th>
              <th className="py-2 px-2 font-semibold w-28 text-right">Total</th>
              <th className="py-2 pl-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => {
              const q = parseFloat(l.quantite || '0') || 0
              const pu = parseFloat(l.prix_unitaire || '0') || 0
              const total = q * pu
              return (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1.5 pr-2">
                    <input value={l.designation} onChange={e => patch(i, 'designation', e.target.value)} className={inputCls} placeholder="Ex : Cloisons" />
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="number" value={l.quantite} onChange={e => patch(i, 'quantite', e.target.value)} className={inputCls} />
                  </td>
                  <td className="py-1.5 px-2">
                    <select value={l.unite} onChange={e => patch(i, 'unite', e.target.value)} className={`${inputCls} bg-white`}>
                      {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="number" value={l.prix_unitaire} onChange={e => patch(i, 'prix_unitaire', e.target.value)} className={inputCls} />
                  </td>
                  <td className="py-1.5 px-2 text-right text-gray-700 tabular-nums">
                    {total ? formatEuros(total) : '—'}
                  </td>
                  <td className="py-1.5 pl-2">
                    <button onClick={() => supprimerLigne(i)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <button
        onClick={ajouterLigne}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-700 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50"
      >
        <Plus className="w-3 h-3" /> Ajouter une ligne
      </button>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
        <label className="text-sm text-gray-600">
          Aléas
          <input
            type="number"
            value={aleasPct}
            onChange={e => setAleasPct(Math.max(0, Math.min(100, parseFloat(e.target.value || '0') || 0)))}
            className="w-14 ml-2 mr-1 border border-gray-200 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          %
        </label>
        <span className="text-sm text-gray-500">·</span>
        <span className="text-sm text-gray-600">Sous-total : <span className="text-gray-700 font-medium">{formatEuros(totalLignes)}</span></span>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <span className="text-sm text-gray-500">Total <Abbr k="HT" /></span>
        <span className="text-xl font-bold text-gray-900">{formatEuros(totalHT)}</span>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Notes pour le Commercial</label>
        <textarea
          rows={3}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Hypothèses, mises en garde, options…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none placeholder-gray-300"
        />
      </div>

      {error && <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="flex justify-end">
        <button
          onClick={livrer}
          disabled={pending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Livrer au Commercial
        </button>
      </div>
    </div>
  )
}
