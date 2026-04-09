'use client'

import { useEffect, useState } from 'react'
import { Plus, Receipt, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Depense = {
  id: string
  projet_id: string | null
  fournisseur_id: string | null
  categorie: string
  libelle: string
  montant_ht: number
  tva_pct: number
  date_facture: string
  date_paiement: string | null
  statut: string
}
type Fournisseur = { id: string; nom: string }
type Projet = { id: string; nom: string }

const CATEGORIES = [
  'sous_traitant', 'materiau', 'location_materiel', 'bureau',
  'logiciel', 'deplacement', 'loyer', 'assurance', 'abonnement', 'autre',
]
const STATUTS = [
  'en_attente', 'attente_validation_co', 'valide', 'en_campagne', 'paye',
]

const STATUT_BADGE: Record<string, string> = {
  en_attente:             'bg-gray-100 text-gray-600 border border-gray-200',
  attente_validation_co:  'bg-amber-50 text-amber-700 border border-amber-200',
  valide:                 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  en_campagne:            'bg-purple-50 text-purple-700 border border-purple-200',
  paye:                   'bg-blue-50 text-blue-700 border border-blue-200',
}

const STATUT_LABEL: Record<string, string> = {
  en_attente: 'En attente',
  attente_validation_co: 'À valider CO',
  valide: 'Validée',
  en_campagne: 'En campagne',
  paye: 'Payée',
}

export default function DepensesPage() {
  const supabase = createClient()
  const [depenses, setDepenses] = useState<Depense[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [projets, setProjets] = useState<Projet[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterStatut, setFilterStatut] = useState<string>('all')

  async function load() {
    setLoading(true)
    const [d, f, p] = await Promise.all([
      supabase.from('depenses').select('*').order('date_facture', { ascending: false }),
      supabase.from('fournisseurs').select('id,nom').eq('actif', true).order('nom'),
      supabase.from('projets').select('id,nom').order('nom'),
    ])
    setDepenses((d.data ?? []) as Depense[])
    setFournisseurs((f.data ?? []) as Fournisseur[])
    setProjets((p.data ?? []) as Projet[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = filterStatut === 'all'
    ? depenses
    : depenses.filter(d => d.statut === filterStatut)

  const fournisseurNom = (id: string | null) =>
    fournisseurs.find(f => f.id === id)?.nom ?? '—'
  const projetNom = (id: string | null) =>
    id ? (projets.find(p => p.id === id)?.nom ?? '—') : 'Charge générale'

  return (
    <div>
      <TopBar
        title="Dépenses"
        subtitle="Saisie des factures fournisseurs, sous-traitants et charges"
      />
      <div className="p-6 space-y-6">
        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <select
              value={filterStatut}
              onChange={(e) => setFilterStatut(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              <option value="all">Tous statuts</option>
              {STATUTS.map(s => (
                <option key={s} value={s}>{STATUT_LABEL[s]}</option>
              ))}
            </select>
            <span className="text-xs text-gray-400">{filtered.length} dépense{filtered.length > 1 ? 's' : ''}</span>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Nouvelle dépense
          </button>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Loader2 className="w-6 h-6 text-gray-400 mx-auto animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Receipt className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Aucune dépense</p>
            <p className="text-xs text-gray-400 mt-1">Cliquez sur « Nouvelle dépense » pour commencer la saisie.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Libellé</th>
                  <th className="px-4 py-3">Fournisseur</th>
                  <th className="px-4 py-3">Projet</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3 text-right">Montant HT</th>
                  <th className="px-4 py-3 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{new Date(d.date_facture).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{d.libelle}</td>
                    <td className="px-4 py-3 text-gray-600">{fournisseurNom(d.fournisseur_id)}</td>
                    <td className="px-4 py-3 text-gray-600">{projetNom(d.projet_id)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{d.categorie}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {d.montant_ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUT_BADGE[d.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUT_LABEL[d.statut] ?? d.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <DepenseForm
          fournisseurs={fournisseurs}
          projets={projets}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}

function DepenseForm({
  fournisseurs, projets, onClose, onSaved,
}: {
  fournisseurs: Fournisseur[]
  projets: Projet[]
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    libelle: '',
    projet_nom: '',
    fournisseur_nom: '',
    categorie: 'materiau',
    montant_ht: '',
    tva_pct: '20',
    date_facture: new Date().toISOString().slice(0, 10),
    statut: 'en_attente',
  })

  function update<K extends keyof typeof form>(key: K, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.libelle.trim())          { setError('Le libellé est requis.'); return }
    if (!form.fournisseur_nom.trim())  { setError('Le fournisseur est requis.'); return }
    if (!form.montant_ht || isNaN(Number(form.montant_ht))) { setError('Montant invalide.'); return }

    setSaving(true)

    // Resolution fournisseur (lookup case-insensitive, ou creation auto)
    const nomFournisseur = form.fournisseur_nom.trim()
    let fournisseur_id = fournisseurs.find(
      f => f.nom.toLowerCase() === nomFournisseur.toLowerCase()
    )?.id
    if (!fournisseur_id) {
      const { data: newF, error: errF } = await supabase
        .from('fournisseurs')
        .insert({ nom: nomFournisseur, actif: true })
        .select('id')
        .single()
      if (errF) { setError('Erreur creation fournisseur : ' + errF.message); setSaving(false); return }
      fournisseur_id = newF!.id
    }

    // Resolution projet (juste lookup, on ne cree pas de projet auto)
    const nomProjet = form.projet_nom.trim()
    const projet_id = nomProjet
      ? projets.find(p => p.nom.toLowerCase() === nomProjet.toLowerCase())?.id ?? null
      : null

    const { error: err } = await supabase.from('depenses').insert({
      libelle:        form.libelle.trim(),
      projet_id,
      fournisseur_id,
      categorie:      form.categorie,
      montant_ht:     Number(form.montant_ht),
      tva_pct:        Number(form.tva_pct),
      date_facture:   form.date_facture,
      statut:         form.statut,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Nouvelle dépense</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Libellé">
            <input
              value={form.libelle}
              onChange={(e) => update('libelle', e.target.value)}
              className="input"
              placeholder="Facture matériaux Leroy Merlin"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fournisseur">
              <input
                list="fournisseurs-list"
                value={form.fournisseur_nom}
                onChange={(e) => update('fournisseur_nom', e.target.value)}
                placeholder="Tapez ou sélectionnez..."
                className="input"
                autoComplete="off"
                required
              />
              <datalist id="fournisseurs-list">
                {fournisseurs.map(f => <option key={f.id} value={f.nom} />)}
              </datalist>
            </Field>
            <Field label="Projet (optionnel)">
              <input
                list="projets-list"
                value={form.projet_nom}
                onChange={(e) => update('projet_nom', e.target.value)}
                placeholder="Charge générale si vide"
                className="input"
                autoComplete="off"
              />
              <datalist id="projets-list">
                {projets.map(p => <option key={p.id} value={p.nom} />)}
              </datalist>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Catégorie">
              <select value={form.categorie} onChange={(e) => update('categorie', e.target.value)} className="input">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Date facture">
              <input type="date" value={form.date_facture} onChange={(e) => update('date_facture', e.target.value)} className="input" required />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Montant HT (€)">
              <input type="number" step="0.01" value={form.montant_ht} onChange={(e) => update('montant_ht', e.target.value)} className="input" required />
            </Field>
            <Field label="TVA %">
              <input type="number" step="0.1" value={form.tva_pct} onChange={(e) => update('tva_pct', e.target.value)} className="input" />
            </Field>
            <Field label="Statut">
              <select value={form.statut} onChange={(e) => update('statut', e.target.value)} className="input">
                {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABEL[s]}</option>)}
              </select>
            </Field>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Enregistrer
            </button>
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
