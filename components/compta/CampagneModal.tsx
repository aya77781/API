'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Depense = {
  id: string
  libelle: string
  montant_ht: number
  fournisseur_id: string | null
  date_facture: string | null
}

type Fournisseur = { id: string; nom: string }

type Props = {
  projetId: string
  projetNom: string
  fournisseurs: Fournisseur[]
  onClose: () => void
  onSaved: () => void
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
}

export function CampagneModal({ projetId, projetNom, fournisseurs, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [depenses, setDepenses] = useState<Depense[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nom, setNom] = useState('')
  const [datePrevue, setDatePrevue] = useState<string>(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  )

  useEffect(() => {
    supabase
      .from('depenses')
      .select('id, libelle, montant_ht, fournisseur_id, date_facture')
      .eq('projet_id', projetId)
      .eq('statut', 'valide')
      .order('date_facture')
      .then(({ data }) => {
        const list = (data ?? []) as Depense[]
        setDepenses(list)
        setSelected(new Set(list.map(x => x.id)))
        setLoading(false)
      })
  }, [projetId]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = useMemo(
    () => depenses.filter(d => selected.has(d.id)).reduce((s, d) => s + Number(d.montant_ht), 0),
    [depenses, selected],
  )

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(prev => prev.size === depenses.length ? new Set() : new Set(depenses.map(d => d.id)))
  }

  const fournisseurNom = (id: string | null) =>
    id ? (fournisseurs.find(f => f.id === id)?.nom ?? '—') : '—'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!nom.trim()) { setError('Le nom de la campagne est requis.'); return }
    if (selected.size === 0) { setError('Sélectionnez au moins une dépense.'); return }
    setSaving(true)

    // 1. Créer la campagne
    const { data: camp, error: errC } = await (supabase.from('campagnes_virement') as unknown as {
      insert: (p: unknown) => { select: () => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> } }
    }).insert({
      nom: nom.trim(),
      date_prevue: datePrevue,
      statut: 'soumise',
      montant_total: total,
    }).select().single()

    if (errC || !camp) {
      setSaving(false)
      setError('Erreur création campagne : ' + (errC?.message ?? 'inconnue'))
      return
    }

    // 2. Lier les dépenses et passer leur statut à 'en_campagne'
    const ids = Array.from(selected)
    const { error: errLinks } = await (supabase.from('campagne_depenses') as unknown as {
      insert: (p: unknown) => Promise<{ error: { message: string } | null }>
    }).insert(ids.map(depense_id => ({ campagne_id: camp.id, depense_id, incluse: true })))

    if (!errLinks) {
      await (supabase.from('depenses') as unknown as {
        update: (p: unknown) => { in: (k: string, v: string[]) => Promise<unknown> }
      }).update({ statut: 'en_campagne' }).in('id', ids)
    }

    setSaving(false)
    if (errLinks) { setError('Erreur association dépenses : ' + errLinks.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Nouvelle campagne de virement</h2>
            <p className="text-xs text-gray-500 mt-0.5">Projet : <span className="font-medium text-gray-700">{projetNom}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nom de la campagne">
                <input
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Virement Avril 2026"
                  className="input"
                  required
                />
              </Field>
              <Field label="Date de virement prévue">
                <input
                  type="date"
                  value={datePrevue}
                  onChange={(e) => setDatePrevue(e.target.value)}
                  className="input"
                  required
                />
              </Field>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Dépenses validées éligibles ({depenses.length})
                </p>
                {depenses.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-gray-500 hover:text-gray-900"
                  >
                    {selected.size === depenses.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </button>
                )}
              </div>

              {loading ? (
                <div className="p-8 text-center"><Loader2 className="w-5 h-5 text-gray-400 mx-auto animate-spin" /></div>
              ) : depenses.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 border border-gray-200 rounded-lg">
                  Aucune dépense validée à régler pour ce projet.
                  <br />Les dépenses doivent avoir le statut « Validée » pour être éligibles.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        <th className="px-3 py-2 w-8"></th>
                        <th className="px-3 py-2">Libellé</th>
                        <th className="px-3 py-2">Fournisseur</th>
                        <th className="px-3 py-2">Date facture</th>
                        <th className="px-3 py-2 text-right">Montant HT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {depenses.map(d => (
                        <tr key={d.id} className={selected.has(d.id) ? 'bg-emerald-50/30' : ''}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selected.has(d.id)}
                              onChange={() => toggle(d.id)}
                              className="rounded"
                            />
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-800">{d.libelle}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">{fournisseurNom(d.fournisseur_id)}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(d.date_facture)}</td>
                          <td className="px-3 py-2 text-xs text-right tabular-nums font-medium text-gray-900">
                            {fmt(Number(d.montant_ht))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>

          <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between bg-gray-50">
            <div className="text-xs">
              <span className="text-gray-500">{selected.size} dépense{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''}</span>
              <span className="mx-2 text-gray-300">·</span>
              <span className="font-semibold text-gray-900">Total : {fmt(total)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              <button
                type="submit"
                disabled={saving || selected.size === 0 || !nom.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Créer la campagne
              </button>
            </div>
          </div>
        </form>
      </div>
      <style jsx>{`
        :global(.input) {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          border: 1px solid rgb(229 231 235);
          border-radius: 0.5rem;
          background: white;
        }
        :global(.input:focus) {
          outline: none;
          box-shadow: 0 0 0 2px rgb(17 24 39 / 0.1);
        }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
