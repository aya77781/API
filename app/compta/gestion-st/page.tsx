'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Clock, CheckCircle2, AlertTriangle, Plus, X, Loader2,
  Shield, Unlock, Lock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Depense = {
  id: string
  libelle: string
  montant_ht: number
  fournisseur_id: string | null
  projet_id: string | null
  date_facture: string | null
  statut: string
  categorie: string
}

type Caution = {
  id: string
  fournisseur_id: string
  projet_id: string
  montant: number
  banque_emettrice: string
  reference_acte: string | null
  date_emission: string
  date_echeance: string
  statut: string
  date_liberation: string | null
  notes: string | null
}

type Fournisseur = { id: string; nom: string }
type Projet = { id: string; nom: string }

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}
function daysBetween(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}
function ageInDays(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

export default function GestionSTPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'factures' | 'cautions'>('factures')
  const [factureTab, setFactureTab] = useState<'attente_co' | 'bon_a_payer'>('attente_co')
  const [depenses, setDepenses] = useState<Depense[]>([])
  const [cautions, setCautions] = useState<Caution[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [projets, setProjets] = useState<Projet[]>([])
  const [loading, setLoading] = useState(true)
  const [showCautionForm, setShowCautionForm] = useState(false)

  async function load() {
    setLoading(true)
    const [d, c, f, p] = await Promise.all([
      supabase.from('depenses').select('*')
        .in('statut', ['attente_validation_co', 'valide'])
        .order('date_facture', { ascending: true, nullsFirst: false }),
      supabase.from('cautions').select('*').order('date_echeance'),
      supabase.from('fournisseurs').select('id,nom'),
      supabase.from('projets').select('id,nom'),
    ])
    setDepenses((d.data ?? []) as Depense[])
    setCautions((c.data ?? []) as Caution[])
    setFournisseurs((f.data ?? []) as Fournisseur[])
    setProjets((p.data ?? []) as Projet[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const fournisseurNom = (id: string | null) => fournisseurs.find(f => f.id === id)?.nom ?? '—'
  const projetNom = (id: string | null) => id ? (projets.find(p => p.id === id)?.nom ?? '—') : '—'

  const facturesAttente = useMemo(
    () => depenses.filter(d => d.statut === 'attente_validation_co'),
    [depenses]
  )
  const facturesBonAPayer = useMemo(
    () => depenses.filter(d => d.statut === 'valide'),
    [depenses]
  )

  async function libererCaution(id: string) {
    if (!confirm('Libérer cette caution ?')) return
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('cautions').update({
      statut: 'liberee',
      date_liberation: today,
    }).eq('id', id)
    load()
  }

  return (
    <div>
      <TopBar title="Gestion ST" subtitle="Factures sous-traitants et registre des cautions" />
      <div className="p-6 space-y-6">

        {/* Tabs principaux */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('factures')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'factures' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Factures ST ({facturesAttente.length + facturesBonAPayer.length})
          </button>
          <button
            onClick={() => setTab('cautions')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'cautions' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Cautions ({cautions.filter(c => c.statut === 'active').length})
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Loader2 className="w-6 h-6 text-gray-400 mx-auto animate-spin" />
          </div>
        ) : tab === 'factures' ? (
          <div className="space-y-4">
            {/* Sub-tabs factures */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFactureTab('attente_co')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  factureTab === 'attente_co'
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                En attente CO ({facturesAttente.length})
              </button>
              <button
                onClick={() => setFactureTab('bon_a_payer')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  factureTab === 'bon_a_payer'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                Bon à payer ({facturesBonAPayer.length})
              </button>
            </div>

            {factureTab === 'attente_co' && (
              <FactureTable
                factures={facturesAttente}
                fournisseurNom={fournisseurNom}
                projetNom={projetNom}
                showAlert
                emptyText="Aucune facture en attente de validation CO"
              />
            )}
            {factureTab === 'bon_a_payer' && (
              <FactureTable
                factures={facturesBonAPayer}
                fournisseurNom={fournisseurNom}
                projetNom={projetNom}
                emptyText="Aucune facture validée prête pour campagne"
              />
            )}
          </div>
        ) : (
          // Cautions
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{cautions.length} caution{cautions.length > 1 ? 's' : ''}</span>
              <button
                onClick={() => setShowCautionForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
              >
                <Plus className="w-4 h-4" /> Nouvelle caution
              </button>
            </div>

            {cautions.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <Shield className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Aucune caution enregistrée</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr className="text-left text-xs font-medium text-gray-500">
                      <th className="px-4 py-3">Fournisseur</th>
                      <th className="px-4 py-3">Projet</th>
                      <th className="px-4 py-3">Banque</th>
                      <th className="px-4 py-3 text-right">Montant</th>
                      <th className="px-4 py-3">Émission</th>
                      <th className="px-4 py-3">Échéance</th>
                      <th className="px-4 py-3 text-right">Jours restants</th>
                      <th className="px-4 py-3 text-right">Statut</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {cautions.map(c => {
                      const days = daysBetween(c.date_echeance)
                      const isActive = c.statut === 'active'
                      const colorClass = !isActive ? 'text-gray-400'
                        : days < 0 ? 'text-red-600 font-bold'
                        : days < 30 ? 'text-red-500 font-semibold'
                        : days < 90 ? 'text-amber-600 font-medium'
                        : 'text-emerald-600'

                      return (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{fournisseurNom(c.fournisseur_id)}</td>
                          <td className="px-4 py-3 text-gray-600">{projetNom(c.projet_id)}</td>
                          <td className="px-4 py-3 text-gray-600">{c.banque_emettrice}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(Number(c.montant))}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.date_emission).toLocaleDateString('fr-FR')}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.date_echeance).toLocaleDateString('fr-FR')}</td>
                          <td className={`px-4 py-3 text-right text-xs ${colorClass}`}>
                            {!isActive ? '—' : days < 0 ? `Dépassée (${Math.abs(days)}j)` : `${days}j`}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <CautionStatutBadge statut={c.statut} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            {c.statut === 'active' && (
                              <button
                                onClick={() => libererCaution(c.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 text-gray-600 rounded hover:bg-gray-50"
                              >
                                <Unlock className="w-3 h-3" /> Libérer
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {showCautionForm && (
        <CautionForm
          fournisseurs={fournisseurs}
          projets={projets}
          onClose={() => setShowCautionForm(false)}
          onSaved={() => { setShowCautionForm(false); load() }}
        />
      )}
    </div>
  )
}

/* ── Tableau factures ── */

function FactureTable({
  factures, fournisseurNom, projetNom, showAlert, emptyText,
}: {
  factures: Depense[]
  fournisseurNom: (id: string | null) => string
  projetNom: (id: string | null) => string
  showAlert?: boolean
  emptyText: string
}) {
  if (factures.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr className="text-left text-xs font-medium text-gray-500">
            <th className="px-4 py-3">Fournisseur</th>
            <th className="px-4 py-3">Projet</th>
            <th className="px-4 py-3">Libellé</th>
            <th className="px-4 py-3">Date facture</th>
            <th className="px-4 py-3 text-right">Âge</th>
            <th className="px-4 py-3 text-right">Montant HT</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {factures.map(d => {
            const age = d.date_facture ? ageInDays(d.date_facture) : 0
            const isOld = showAlert && age > 7
            return (
              <tr key={d.id} className={`hover:bg-gray-50 ${isOld ? 'bg-amber-50/40' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-900">{fournisseurNom(d.fournisseur_id)}</td>
                <td className="px-4 py-3 text-gray-600">{projetNom(d.projet_id)}</td>
                <td className="px-4 py-3 text-gray-700">{d.libelle}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {d.date_facture ? new Date(d.date_facture).toLocaleDateString('fr-FR') : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {isOld ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                      <AlertTriangle className="w-3 h-3" /> {age}j
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">{age}j</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(Number(d.montant_ht))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── Badge statut caution ── */

function CautionStatutBadge({ statut }: { statut: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:   { label: 'Active',   cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    liberee:  { label: 'Libérée',  cls: 'bg-gray-100 text-gray-600 border border-gray-200' },
    appellee: { label: 'Appelée',  cls: 'bg-red-50 text-red-700 border border-red-200' },
  }
  const m = map[statut] ?? map.liberee
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${m.cls}`}>{m.label}</span>
}

/* ── Form nouvelle caution ── */

function CautionForm({ fournisseurs, projets, onClose, onSaved }: {
  fournisseurs: Fournisseur[]
  projets: Projet[]
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    fournisseur_id: '',
    projet_id: '',
    montant: '',
    banque_emettrice: '',
    reference_acte: '',
    date_emission: new Date().toISOString().slice(0, 10),
    date_echeance: '',
    notes: '',
  })

  function update<K extends keyof typeof form>(key: K, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.fournisseur_id || !form.projet_id || !form.montant || !form.banque_emettrice || !form.date_echeance) {
      setError('Tous les champs marqués sont requis.')
      return
    }
    setSaving(true)
    const { error: err } = await supabase.from('cautions').insert({
      fournisseur_id: form.fournisseur_id,
      projet_id: form.projet_id,
      montant: Number(form.montant),
      banque_emettrice: form.banque_emettrice,
      reference_acte: form.reference_acte || null,
      date_emission: form.date_emission,
      date_echeance: form.date_echeance,
      statut: 'active',
      notes: form.notes || null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Nouvelle caution</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fournisseur *">
              <select value={form.fournisseur_id} onChange={(e) => update('fournisseur_id', e.target.value)} className="input" required>
                <option value="">— Sélectionner —</option>
                {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
              </select>
            </Field>
            <Field label="Projet *">
              <select value={form.projet_id} onChange={(e) => update('projet_id', e.target.value)} className="input" required>
                <option value="">— Sélectionner —</option>
                {projets.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Banque émettrice *">
              <input value={form.banque_emettrice} onChange={(e) => update('banque_emettrice', e.target.value)} className="input" required />
            </Field>
            <Field label="Référence acte">
              <input value={form.reference_acte} onChange={(e) => update('reference_acte', e.target.value)} className="input" />
            </Field>
          </div>
          <Field label="Montant (€) *">
            <input type="number" step="0.01" value={form.montant} onChange={(e) => update('montant', e.target.value)} className="input" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date d'émission *">
              <input type="date" value={form.date_emission} onChange={(e) => update('date_emission', e.target.value)} className="input" required />
            </Field>
            <Field label="Date d'échéance *">
              <input type="date" value={form.date_echeance} onChange={(e) => update('date_echeance', e.target.value)} className="input" required />
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={2} className="input resize-none" />
          </Field>

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
