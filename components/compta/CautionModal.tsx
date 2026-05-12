'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type SousTraitant = { id: string; raison_sociale: string }

type Props = {
  projetId: string
  projetNom: string
  sousTraitants: SousTraitant[]
  onClose: () => void
  onSaved: () => void
}

export function CautionModal({ projetId, projetNom, sousTraitants, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    sous_traitant_id: '',
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

  /**
   * Trouve ou crée la ligne dans `fournisseurs` correspondant au sous-traitant.
   * Nécessaire car `cautions.fournisseur_id` référence la table `fournisseurs`.
   */
  async function resolveFournisseurId(stRaisonSociale: string): Promise<string | null> {
    const { data: existing } = await supabase
      .from('fournisseurs')
      .select('id')
      .ilike('nom', stRaisonSociale)
      .limit(1)
      .maybeSingle()
    if (existing) return (existing as { id: string }).id

    const { data: created, error: errF } = await (supabase.from('fournisseurs') as unknown as {
      insert: (p: unknown) => { select: (s: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> } }
    }).insert({ nom: stRaisonSociale, actif: true, type: 'sous_traitant' }).select('id').single()
    if (errF) {
      setError('Erreur création fournisseur lié : ' + errF.message)
      return null
    }
    return created?.id ?? null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.sous_traitant_id) { setError('Sélectionnez un sous-traitant.'); return }
    if (!form.banque_emettrice.trim()) { setError('La banque émettrice est requise.'); return }
    if (!form.montant || isNaN(Number(form.montant))) { setError('Montant invalide.'); return }
    if (!form.date_echeance) { setError("La date d'échéance est requise."); return }

    const st = sousTraitants.find(s => s.id === form.sous_traitant_id)
    if (!st) { setError('Sous-traitant introuvable.'); return }

    setSaving(true)
    const fournisseur_id = await resolveFournisseurId(st.raison_sociale)
    if (!fournisseur_id) { setSaving(false); return }

    const { error: err } = await (supabase.from('cautions') as unknown as {
      insert: (p: unknown) => Promise<{ error: { message: string } | null }>
    }).insert({
      projet_id: projetId,
      fournisseur_id,
      montant: Number(form.montant),
      banque_emettrice: form.banque_emettrice.trim(),
      reference_acte: form.reference_acte.trim() || null,
      date_emission: form.date_emission,
      date_echeance: form.date_echeance,
      statut: 'active',
      notes: form.notes.trim() || null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Nouvelle caution sous-traitant</h2>
            <p className="text-xs text-gray-500 mt-0.5">Projet : <span className="font-medium text-gray-700">{projetNom}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Sous-traitant">
            <select
              value={form.sous_traitant_id}
              onChange={(e) => update('sous_traitant_id', e.target.value)}
              className="input"
              required
            >
              <option value="">— Sélectionner un sous-traitant —</option>
              {sousTraitants.map(s => (
                <option key={s.id} value={s.id}>{s.raison_sociale}</option>
              ))}
            </select>
            {sousTraitants.length === 0 && (
              <p className="mt-1 text-[10px] text-amber-700">
                Aucun sous-traitant actif. Ajoutez-en un depuis l&apos;annuaire ST.
              </p>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Banque émettrice">
              <input value={form.banque_emettrice} onChange={(e) => update('banque_emettrice', e.target.value)} className="input" required />
            </Field>
            <Field label="Référence acte">
              <input value={form.reference_acte} onChange={(e) => update('reference_acte', e.target.value)} className="input" />
            </Field>
          </div>

          <Field label="Montant (€)">
            <input type="number" step="0.01" value={form.montant} onChange={(e) => update('montant', e.target.value)} className="input" required />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date d'émission">
              <input type="date" value={form.date_emission} onChange={(e) => update('date_emission', e.target.value)} className="input" required />
            </Field>
            <Field label="Date d'échéance">
              <input type="date" value={form.date_echeance} onChange={(e) => update('date_echeance', e.target.value)} className="input" required />
            </Field>
          </div>

          <Field label="Notes (optionnel)">
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
