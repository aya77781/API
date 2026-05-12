'use client'

import { useState } from 'react'
import { X, Loader2, ScanLine, Sparkles, FileText, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { scanInvoice } from '@/lib/compta/ocr'

const CATEGORIES = [
  'sous_traitant', 'materiau', 'location_materiel', 'bureau',
  'logiciel', 'deplacement', 'loyer', 'assurance', 'abonnement', 'autre',
]
const STATUTS = ['en_attente', 'attente_validation_co', 'valide', 'paye']
const STATUT_LABEL: Record<string, string> = {
  en_attente: 'En attente',
  attente_validation_co: 'À valider CO',
  valide: 'Validée',
  paye: 'Payée',
}

type Fournisseur = { id: string; nom: string }

type Props = {
  projetId: string
  projetNom: string
  fournisseurs: Fournisseur[]
  onClose: () => void
  onSaved: () => void
}

export function DepenseModal({ projetId, projetNom, fournisseurs, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    libelle: '',
    fournisseur_nom: '',
    categorie: 'materiau',
    montant_ht: '',
    tva_pct: '20',
    date_facture: new Date().toISOString().slice(0, 10),
    statut: 'en_attente',
  })
  const [justificatif, setJustificatif] = useState<File | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scannedUrl, setScannedUrl] = useState<string | null>(null)

  function update<K extends keyof typeof form>(key: K, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleScan(file: File) {
    setScanning(true)
    setScanError(null)
    try {
      const ext = await scanInvoice(file, { folder: `depenses/${projetId}`, type_piece: 'ACHAT' })
      setForm(f => ({
        ...f,
        libelle:         ext.libelle ?? f.libelle,
        fournisseur_nom: ext.fournisseur ?? f.fournisseur_nom,
        montant_ht:      ext.montant_ht ?? f.montant_ht,
        tva_pct:         ext.tva_pct ?? f.tva_pct,
        date_facture:    ext.date_facture ?? f.date_facture,
        categorie:       ext.categorie && CATEGORIES.includes(ext.categorie) ? ext.categorie : f.categorie,
      }))
      setScannedUrl(ext.justificatif_url ?? null)
      setJustificatif(null)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err))
    } finally {
      setScanning(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.libelle.trim()) { setError('Le libellé est requis.'); return }
    if (!form.fournisseur_nom.trim()) { setError('Le fournisseur est requis.'); return }
    if (!form.montant_ht || isNaN(Number(form.montant_ht))) { setError('Montant invalide.'); return }
    setSaving(true)

    // Résolution fournisseur : existant ou création
    let fournisseur_id: string | null = null
    const nom = form.fournisseur_nom.trim()
    const existing = fournisseurs.find(f => f.nom.toLowerCase() === nom.toLowerCase())
    if (existing) {
      fournisseur_id = existing.id
    } else {
      const typeFournisseur = form.categorie === 'sous_traitant' ? 'sous_traitant' : 'fournisseur'
      const { data: newF, error: errF } = await (supabase.from('fournisseurs') as unknown as {
        insert: (p: unknown) => { select: (s: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> } }
      }).insert({ nom, actif: true, type: typeFournisseur }).select('id').single()
      if (errF) { setError('Erreur création fournisseur : ' + errF.message); setSaving(false); return }
      fournisseur_id = newF?.id ?? null
    }

    let justificatif_url: string | null = scannedUrl
    if (justificatif) {
      const ts = Date.now()
      const safeName = justificatif.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `depenses/${projetId}/${ts}_${safeName}`
      const { error: eUp } = await supabase.storage
        .from('factures')
        .upload(path, justificatif, { upsert: false, contentType: justificatif.type || 'application/octet-stream' })
      if (eUp) { setError('Erreur upload justificatif : ' + eUp.message); setSaving(false); return }
      const { data: pub } = supabase.storage.from('factures').getPublicUrl(path)
      justificatif_url = pub.publicUrl
    }

    const { error: err } = await (supabase.from('depenses') as unknown as {
      insert: (p: unknown) => Promise<{ error: { message: string } | null }>
    }).insert({
      projet_id: projetId,
      libelle: form.libelle.trim(),
      fournisseur_id,
      categorie: form.categorie,
      montant_ht: Number(form.montant_ht),
      tva_pct: Number(form.tva_pct),
      date_facture: form.date_facture,
      statut: form.statut,
      justificatif_url,
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
            <h2 className="text-base font-semibold text-gray-900">Nouvelle dépense</h2>
            <p className="text-xs text-gray-500 mt-0.5">Projet : <span className="font-medium text-gray-700">{projetNom}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Scan auto */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-emerald-900">Scanner une facture pour pré-remplir</p>
              <p className="text-[10px] text-emerald-700">PDF ou image — l'IA extrait fournisseur, montants et dates automatiquement</p>
            </div>
            <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors flex-shrink-0 ${scanning ? 'bg-gray-200 text-gray-500 cursor-wait' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
              {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
              {scanning ? 'Analyse...' : 'Scanner'}
              <input
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                disabled={scanning}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleScan(f)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          {scanError && (
            <p className="text-xs text-red-600">{scanError}</p>
          )}
          {scannedUrl && !scanError && (
            <JustifPreview url={scannedUrl} />
          )}

          <Field label="Libellé">
            <input value={form.libelle} onChange={(e) => update('libelle', e.target.value)} className="input" placeholder="Facture matériaux Leroy Merlin" required />
          </Field>

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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Catégorie">
              <select value={form.categorie} onChange={(e) => update('categorie', e.target.value)} className="input">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
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

          <Field label="Justificatif (PDF, image — optionnel)">
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setJustificatif(e.target.files?.[0] ?? null)}
              className="w-full text-xs text-gray-600"
            />
            {justificatif && <p className="mt-1 text-xs text-gray-500 truncate">{justificatif.name}</p>}
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

function JustifPreview({ url }: { url: string }) {
  const isPdf = url.toLowerCase().endsWith('.pdf')
  return (
    <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-medium text-emerald-800">Justificatif scanné</p>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900"
        >
          <ExternalLink className="w-3 h-3" /> Ouvrir
        </a>
      </div>
      {isPdf ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-3 py-2 bg-white border border-emerald-100 rounded-md hover:bg-emerald-50 transition-colors"
        >
          <FileText className="w-5 h-5 text-emerald-700" />
          <span className="text-xs text-gray-700 truncate flex-1">Voir le PDF</span>
        </a>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Justificatif"
          className="w-full max-h-48 object-contain rounded-md bg-white border border-emerald-100"
        />
      )}
    </div>
  )
}
