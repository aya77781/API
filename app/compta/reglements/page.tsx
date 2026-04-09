'use client'

import { useEffect, useMemo, useState } from 'react'
import { CreditCard, Plus, Loader2, X, CheckCircle2, Send, Play, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Campagne = {
  id: string
  nom: string
  date_creation: string
  date_prevue: string | null
  statut: string
  montant_total: number
  notes: string | null
}

type Depense = {
  id: string
  libelle: string
  montant_ht: number
  fournisseur_id: string | null
  projet_id: string | null
  date_facture: string | null
  statut: string
}

type Fournisseur = { id: string; nom: string }
type Projet = { id: string; nom: string }

const STATUT_LABEL: Record<string, string> = {
  brouillon: 'Brouillon',
  soumise: 'Soumise',
  validee: 'Validée',
  executee: 'Exécutée',
}
const STATUT_BADGE: Record<string, string> = {
  brouillon: 'bg-gray-100 text-gray-600 border border-gray-200',
  soumise:   'bg-amber-50 text-amber-700 border border-amber-200',
  validee:   'bg-blue-50 text-blue-700 border border-blue-200',
  executee:  'bg-emerald-50 text-emerald-700 border border-emerald-200',
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}

export default function ReglementsPage() {
  const supabase = createClient()
  const [campagnes, setCampagnes] = useState<Campagne[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<Campagne | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('campagnes_virement').select('*').order('date_creation', { ascending: false })
    setCampagnes((data ?? []) as Campagne[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <TopBar title="Règlements" subtitle="Campagnes de virement" />
      <div className="p-6 space-y-6">

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-400">{campagnes.length} campagne{campagnes.length > 1 ? 's' : ''}</span>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Nouvelle campagne
          </button>
        </div>

        {/* Liste des campagnes */}
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Loader2 className="w-6 h-6 text-gray-400 mx-auto animate-spin" />
          </div>
        ) : campagnes.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Aucune campagne</p>
            <p className="text-xs text-gray-400 mt-1">Cliquez sur « Nouvelle campagne » pour grouper des dépenses validées.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Date prévue</th>
                  <th className="px-4 py-3 text-right">Montant total</th>
                  <th className="px-4 py-3 text-right">Statut</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campagnes.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(c)}>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.nom}</td>
                    <td className="px-4 py-3 text-gray-600">{c.date_prevue ? new Date(c.date_prevue).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(Number(c.montant_total))}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUT_BADGE[c.statut]}`}>
                        {STATUT_LABEL[c.statut] ?? c.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-gray-300 inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CampagneForm
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load() }}
        />
      )}

      {selected && (
        <CampagneDetail
          campagne={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { setSelected(null); load() }}
        />
      )}
    </div>
  )
}

/* ── Form création campagne ── */

function CampagneForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [nom, setNom] = useState('')
  const [datePrevue, setDatePrevue] = useState(new Date().toISOString().slice(0, 10))
  const [depenses, setDepenses] = useState<Depense[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [projets, setProjets] = useState<Projet[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('depenses').select('*').eq('statut', 'valide').order('date_facture'),
      supabase.from('fournisseurs').select('id,nom'),
      supabase.from('projets').select('id,nom'),
    ]).then(([d, f, p]) => {
      const list = (d.data ?? []) as Depense[]
      setDepenses(list)
      setFournisseurs((f.data ?? []) as Fournisseur[])
      setProjets((p.data ?? []) as Projet[])
      // Sélectionne tout par défaut
      setSelected(new Set(list.map(x => x.id)))
      setLoading(false)
    })
  }, []) // eslint-disable-line

  const fournisseurNom = (id: string | null) => fournisseurs.find(f => f.id === id)?.nom ?? '—'
  const projetNom = (id: string | null) => id ? (projets.find(p => p.id === id)?.nom ?? '—') : '—'

  const total = useMemo(
    () => depenses.filter(d => selected.has(d.id)).reduce((s, d) => s + Number(d.montant_ht), 0),
    [depenses, selected]
  )

  function toggle(id: string) {
    setSelected(s => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    if (!nom.trim()) return
    if (selected.size === 0) return
    setSaving(true)

    // 1. Créer la campagne
    const { data: camp, error: errC } = await supabase
      .from('campagnes_virement')
      .insert({
        nom: nom.trim(),
        date_prevue: datePrevue,
        statut: 'soumise',
        montant_total: total,
      })
      .select()
      .single()

    if (errC || !camp) {
      setSaving(false)
      return
    }

    // 2. Lier les dépenses et passer leur statut à 'en_campagne'
    const ids = Array.from(selected)
    await Promise.all([
      supabase.from('campagne_depenses').insert(
        ids.map(depense_id => ({ campagne_id: camp.id, depense_id, incluse: true }))
      ),
      supabase.from('depenses').update({ statut: 'en_campagne' }).in('id', ids),
    ])

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Nouvelle campagne de virement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nom de la campagne">
              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Campagne 1 - Avril 2026"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </Field>
            <Field label="Date de virement prévue">
              <input
                type="date"
                value={datePrevue}
                onChange={(e) => setDatePrevue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Dépenses éligibles ({depenses.length})
              </p>
              <p className="text-xs text-gray-500">{selected.size} sélectionnée{selected.size > 1 ? 's' : ''}</p>
            </div>

            {loading ? (
              <div className="p-8 text-center"><Loader2 className="w-5 h-5 text-gray-400 mx-auto animate-spin" /></div>
            ) : depenses.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">Aucune dépense au statut « Validée »</div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                    <tr className="text-left text-xs font-medium text-gray-500">
                      <th className="px-3 py-2 w-8"></th>
                      <th className="px-3 py-2">Libellé</th>
                      <th className="px-3 py-2">Fournisseur</th>
                      <th className="px-3 py-2">Projet</th>
                      <th className="px-3 py-2 text-right">Montant HT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {depenses.map(d => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(d.id)}
                            onChange={() => toggle(d.id)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900">{d.libelle}</td>
                        <td className="px-3 py-2 text-gray-600">{fournisseurNom(d.fournisseur_id)}</td>
                        <td className="px-3 py-2 text-gray-600 text-xs">{projetNom(d.projet_id)}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">{fmt(Number(d.montant_ht))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-gray-900 text-white rounded-lg p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">Total de la campagne</span>
            <span className="text-2xl font-bold">{fmt(total)}</span>
          </div>
        </div>

        <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !nom.trim() || selected.size === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Soumettre au gérant
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Détail campagne ── */

function CampagneDetail({ campagne, onClose, onChanged }: {
  campagne: Campagne
  onClose: () => void
  onChanged: () => void
}) {
  const supabase = createClient()
  const [depenses, setDepenses] = useState<Depense[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: links } = await supabase
        .from('campagne_depenses')
        .select('depense_id')
        .eq('campagne_id', campagne.id)
      const ids = (links ?? []).map(l => l.depense_id)
      if (ids.length === 0) {
        setLoading(false)
        return
      }
      const { data: deps } = await supabase.from('depenses').select('*').in('id', ids)
      setDepenses((deps ?? []) as Depense[])
      setLoading(false)
    }
    load()
  }, [campagne.id]) // eslint-disable-line

  async function executerCampagne() {
    if (!confirm('Confirmer l\'exécution ? Toutes les dépenses passeront en « payé ».')) return
    setExecuting(true)
    const today = new Date().toISOString().slice(0, 10)
    const ids = depenses.map(d => d.id)
    await Promise.all([
      supabase.from('campagnes_virement').update({ statut: 'executee' }).eq('id', campagne.id),
      supabase.from('depenses').update({ statut: 'paye', date_paiement: today }).in('id', ids),
    ])
    setExecuting(false)
    onChanged()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{campagne.nom}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {campagne.date_prevue && `Prévue le ${new Date(campagne.date_prevue).toLocaleDateString('fr-FR')}`} ·
              <span className={`ml-2 inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUT_BADGE[campagne.statut]}`}>
                {STATUT_LABEL[campagne.statut]}
              </span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <Loader2 className="w-6 h-6 text-gray-400 mx-auto animate-spin" />
          ) : (
            <>
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                {depenses.length} dépense{depenses.length > 1 ? 's' : ''}
              </p>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr className="text-left text-xs font-medium text-gray-500">
                      <th className="px-3 py-2">Libellé</th>
                      <th className="px-3 py-2 text-right">Montant HT</th>
                      <th className="px-3 py-2 text-right">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {depenses.map(d => (
                      <tr key={d.id}>
                        <td className="px-3 py-2 font-medium text-gray-900">{d.libelle}</td>
                        <td className="px-3 py-2 text-right text-gray-900">{fmt(Number(d.montant_ht))}</td>
                        <td className="px-3 py-2 text-right text-xs text-gray-500">{d.statut}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-900 text-white rounded-lg p-4 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">Montant total</span>
                <span className="text-2xl font-bold">{fmt(Number(campagne.montant_total))}</span>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {campagne.statut === 'soumise' && 'En attente de validation gérant'}
            {campagne.statut === 'validee' && 'Prêt à être exécuté'}
            {campagne.statut === 'executee' && 'Campagne terminée'}
          </span>

          {campagne.statut === 'validee' && (
            <button
              onClick={executerCampagne}
              disabled={executing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Marquer exécutée
            </button>
          )}
          {campagne.statut === 'executee' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="w-4 h-4" /> Virements exécutés
            </span>
          )}
        </div>
      </div>
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
