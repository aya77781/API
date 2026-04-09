'use client'

import { useEffect, useState } from 'react'
import { Plus, Loader2, X, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Fournisseur = {
  id: string
  nom: string
  type: string | null
  siret: string | null
  contact_nom: string | null
  contact_email: string | null
}

export default function TransversePage() {
  const supabase = createClient()
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('fournisseurs')
      .select('id,nom,type,siret,contact_nom,contact_email')
      .eq('type', 'prestataire')
      .order('nom')
    setFournisseurs((data ?? []) as Fournisseur[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <TopBar title="Transverse" subtitle="Achats internes — fournisseurs et prestataires" />
      <div className="p-6">
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">Achats internes</h2>
              <span className="text-xs text-gray-400">{fournisseurs.length}</span>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
            >
              <Plus className="w-4 h-4" /> Ajouter fournisseur
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-4">Études comparatives et mise en concurrence des fournisseurs</p>

          {loading ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <Loader2 className="w-5 h-5 text-gray-400 mx-auto animate-spin" />
            </div>
          ) : fournisseurs.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <Building2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Aucun fournisseur prestataire</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-left text-xs font-medium text-gray-500">
                    <th className="px-4 py-3">Nom</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">SIRET</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {fournisseurs.map(f => (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{f.nom}</td>
                      <td className="px-4 py-3 text-gray-600">{f.contact_nom ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{f.contact_email ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{f.siret ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <FournisseurModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function FournisseurModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [nom, setNom] = useState('')
  const [siret, setSiret] = useState('')
  const [contactNom, setContactNom] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    if (!nom.trim()) { setError('Nom requis'); return }
    setSaving(true)
    const { error: err } = await supabase.from('fournisseurs').insert({
      nom: nom.trim(),
      type: 'prestataire',
      siret: siret.trim() || null,
      contact_nom: contactNom.trim() || null,
      contact_email: contactEmail.trim() || null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Ajouter un fournisseur</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Nom"><input value={nom} onChange={e => setNom(e.target.value)} className="rht-input" /></Field>
          <Field label="SIRET"><input value={siret} onChange={e => setSiret(e.target.value)} className="rht-input" /></Field>
          <Field label="Nom contact"><input value={contactNom} onChange={e => setContactNom(e.target.value)} className="rht-input" /></Field>
          <Field label="Email contact"><input value={contactEmail} onChange={e => setContactEmail(e.target.value)} className="rht-input" /></Field>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Enregistrer
            </button>
          </div>
        </div>
      </div>
      <style jsx global>{`
        .rht-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          border: 1px solid rgb(229 231 235);
          border-radius: 0.5rem;
          background: white;
        }
        .rht-input:focus {
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
