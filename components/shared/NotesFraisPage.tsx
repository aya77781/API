'use client'

import { useEffect, useState } from 'react'
import { Plus, Receipt, X, Loader2, Trash2, ScanLine, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

const WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_COMPTA
  ?? 'https://apiprojet.app.n8n.cloud/webhook/api-renovation-compta-ocr'

// Parse souple de la reponse n8n (cherche les champs probables)
function pickField(obj: any, keys: string[]): any {
  if (!obj || typeof obj !== 'object') return undefined
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k]
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (v && typeof v === 'object') {
      const found = pickField(v, keys)
      if (found != null) return found
    }
  }
  return undefined
}

function extractNdfFromOcr(raw: any): {
  libelle?: string; montant_ttc?: string; tva_pct?: string;
  date_depense?: string; categorie?: string;
} {
  const data = Array.isArray(raw) ? raw[0] : raw
  if (!data) return {}
  const libelle  = pickField(data, ['libelle', 'description', 'fournisseur', 'merchant', 'vendor', 'commercant'])
  const ttc      = pickField(data, ['montant_ttc', 'total_ttc', 'total', 'amount', 'montant', 'totalAmount'])
  const tva      = pickField(data, ['tva_pct', 'tva', 'vat', 'taux_tva', 'tvaRate'])
  const date     = pickField(data, ['date_depense', 'date_facture', 'date', 'invoice_date'])
  const cat      = pickField(data, ['categorie', 'category', 'type'])
  let dateIso: string | undefined
  if (date) {
    const d = new Date(date)
    if (!isNaN(d.getTime())) dateIso = d.toISOString().slice(0, 10)
    else if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) dateIso = date.slice(0, 10)
  }
  return {
    libelle:      libelle ? String(libelle) : undefined,
    montant_ttc:  ttc != null ? String(ttc).replace(',', '.').replace(/[^0-9.]/g, '') : undefined,
    tva_pct:      tva != null ? String(tva).replace(',', '.').replace(/[^0-9.]/g, '') : undefined,
    date_depense: dateIso,
    categorie:    cat ? String(cat).toLowerCase() : undefined,
  }
}

type NoteFrais = {
  id: string
  user_id: string
  libelle: string
  categorie: string
  montant_ttc: number
  tva_pct: number
  date_depense: string
  projet_id: string | null
  justificatif_url: string | null
  commentaire: string | null
  statut: 'soumise' | 'validee' | 'refusee' | 'remboursee'
  motif_refus: string | null
}
type Projet = { id: string; nom: string }

const CATEGORIES = [
  'repas', 'deplacement', 'hebergement', 'carburant', 'peage',
  'parking', 'fourniture', 'telephone', 'autre',
]

const STATUTS = ['soumise', 'validee', 'refusee', 'remboursee'] as const

const STATUT_BADGE: Record<string, string> = {
  soumise:    'bg-amber-50 text-amber-700 border border-amber-200',
  validee:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
  refusee:    'bg-red-50 text-red-700 border border-red-200',
  remboursee: 'bg-blue-50 text-blue-700 border border-blue-200',
}
const STATUT_LABEL: Record<string, string> = {
  soumise: 'En attente RH',
  validee: 'Validée',
  refusee: 'Refusée',
  remboursee: 'Remboursée',
}

export function NotesFraisPage() {
  const supabase = createClient()
  const [notes, setNotes] = useState<NoteFrais[]>([])
  const [projets, setProjets] = useState<Projet[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [prefill, setPrefill] = useState<any>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [n, p] = await Promise.all([
      supabase.from('notes_frais').select('*')
        .eq('user_id', user.id)
        .order('date_depense', { ascending: false }),
      supabase.from('projets').select('id,nom').order('nom'),
    ])
    setNotes((n.data ?? []) as NoteFrais[])
    setProjets((p.data ?? []) as Projet[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = filterStatut === 'all'
    ? notes
    : notes.filter(d => d.statut === filterStatut)

  const totalEnCours = notes
    .filter(n => n.statut === 'soumise')
    .reduce((s, n) => s + Number(n.montant_ttc), 0)
  const totalValide = notes
    .filter(n => n.statut === 'validee' || n.statut === 'remboursee')
    .reduce((s, n) => s + Number(n.montant_ttc), 0)

  async function handleScan(file: File) {
    setScanning(true)
    setScanError(null)
    try {
      // 1. Upload du justificatif vers Storage
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const path = `ndf/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('comptabilite')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) throw new Error('Upload échoué : ' + upErr.message)
      const { data: urlData } = supabase.storage.from('comptabilite').getPublicUrl(path)
      const justificatif_url = urlData.publicUrl

      // 2. Appel webhook OCR n8n
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type_piece', 'NDF')
      formData.append('mode_paiement', 'CB')
      formData.append('lien_fichier', justificatif_url)

      const res = await fetch(WEBHOOK_URL, { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`Webhook OCR a renvoyé ${res.status}`)

      // 3. Tente de parser la réponse JSON pour préremplir
      let extracted: any = {}
      try {
        const json = await res.json()
        extracted = extractNdfFromOcr(json)
      } catch {
        // Pas de JSON exploitable, on ouvre le form vide
      }

      setPrefill({ ...extracted, justificatif_url })
      setShowForm(true)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err))
    } finally {
      setScanning(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette note de frais ?')) return
    await supabase.from('notes_frais').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <TopBar
        title="Notes de frais"
        subtitle="Saisissez vos dépenses professionnelles à rembourser"
      />
      <div className="p-6 space-y-6">
        {/* KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Kpi label="En attente de validation" value={totalEnCours} count={notes.filter(n => n.statut === 'soumise').length} color="amber" />
          <Kpi label="Validées / Remboursées" value={totalValide} count={notes.filter(n => n.statut === 'validee' || n.statut === 'remboursee').length} color="emerald" />
          <Kpi label="Total saisi" value={notes.reduce((s, n) => s + Number(n.montant_ttc), 0)} count={notes.length} color="gray" />
        </div>

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
            <span className="text-xs text-gray-400">{filtered.length} note{filtered.length > 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${scanning ? 'bg-gray-200 text-gray-500 cursor-wait' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
              {scanning ? 'Analyse en cours...' : 'Scanner un justificatif'}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                disabled={scanning}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleScan(f)
                  e.target.value = ''
                }}
              />
            </label>
            <button
              onClick={() => { setPrefill(null); setShowForm(true) }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" /> Saisie manuelle
            </button>
          </div>
        </div>

        {scanError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
            {scanError}
          </div>
        )}
        {/* Liste */}
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Loader2 className="w-6 h-6 text-gray-400 mx-auto animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Receipt className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Aucune note de frais</p>
            <p className="text-xs text-gray-400 mt-1">Cliquez sur « Nouvelle note de frais » pour commencer la saisie.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-3">Justif.</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Libellé</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3">Projet</th>
                  <th className="px-4 py-3 text-right">Montant TTC</th>
                  <th className="px-4 py-3 text-right">Statut</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(n => {
                  const isPdf = n.justificatif_url?.toLowerCase().endsWith('.pdf')
                  return (
                  <tr key={n.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {n.justificatif_url ? (
                        isPdf ? (
                          <a
                            href={n.justificatif_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center w-12 h-12 bg-red-50 border border-red-200 rounded text-[10px] font-bold text-red-600 hover:bg-red-100"
                          >
                            PDF
                          </a>
                        ) : (
                          <button
                            onClick={() => setLightbox(n.justificatif_url!)}
                            className="block w-12 h-12 rounded border border-gray-200 overflow-hidden hover:border-gray-400 transition"
                            title="Voir le justificatif"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={n.justificatif_url} alt="justif" className="w-full h-full object-cover" />
                          </button>
                        )
                      ) : (
                        <span className="inline-flex items-center justify-center w-12 h-12 bg-gray-50 border border-dashed border-gray-200 rounded text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{new Date(n.date_depense).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {n.libelle}
                      {n.statut === 'refusee' && n.motif_refus && (
                        <p className="text-xs text-red-600 mt-0.5">Refus : {n.motif_refus}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{n.categorie}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {n.projet_id ? (projets.find(p => p.id === n.projet_id)?.nom ?? '—') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {Number(n.montant_ttc).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUT_BADGE[n.statut]}`}>
                        {STATUT_LABEL[n.statut]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {n.statut === 'soumise' && (
                        <button
                          onClick={() => handleDelete(n.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {showForm && (
        <NoteFraisForm
          projets={projets}
          prefill={prefill}
          onClose={() => { setShowForm(false); setPrefill(null) }}
          onSaved={() => { setShowForm(false); setPrefill(null); load() }}
        />
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="justificatif" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, count, color }: { label: string; value: number; count: number; color: string }) {
  const map: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    gray: 'bg-gray-50 text-gray-700',
  }
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">
        {value.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
      </p>
      <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded ${map[color]}`}>{count} note{count > 1 ? 's' : ''}</span>
    </div>
  )
}

function NoteFraisForm({
  projets, prefill, onClose, onSaved,
}: {
  projets: Projet[]
  prefill?: any
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const validCat = (c?: string) =>
    c && CATEGORIES.includes(c) ? c : 'repas'
  const [form, setForm] = useState({
    libelle:      prefill?.libelle ?? '',
    categorie:    validCat(prefill?.categorie),
    montant_ttc:  prefill?.montant_ttc ?? '',
    tva_pct:      prefill?.tva_pct ?? '20',
    date_depense: prefill?.date_depense ?? new Date().toISOString().slice(0, 10),
    projet_nom:   '',
    commentaire:  '',
  })
  const justificatif_url: string | null = prefill?.justificatif_url ?? null

  function update<K extends keyof typeof form>(key: K, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.libelle.trim())   { setError('Le libellé est requis.'); return }
    if (!form.montant_ttc || isNaN(Number(form.montant_ttc))) { setError('Montant invalide.'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Non authentifié'); setSaving(false); return }

    const nomProjet = form.projet_nom.trim()
    const projet_id = nomProjet
      ? projets.find(p => p.nom.toLowerCase() === nomProjet.toLowerCase())?.id ?? null
      : null

    const { error: err } = await supabase.from('notes_frais').insert({
      user_id:          user.id,
      libelle:          form.libelle.trim(),
      categorie:        form.categorie,
      montant_ttc:      Number(form.montant_ttc),
      tva_pct:          Number(form.tva_pct),
      date_depense:     form.date_depense,
      projet_id,
      commentaire:      form.commentaire.trim() || null,
      justificatif_url,
      statut:           'soumise',
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            {prefill ? 'Vérifier la note de frais scannée' : 'Nouvelle note de frais'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {justificatif_url && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700 flex items-center gap-2">
              <Upload className="w-3.5 h-3.5" />
              Justificatif scanné — vérifiez les champs extraits avant de soumettre.
              <a href={justificatif_url} target="_blank" rel="noreferrer" className="ml-auto underline">Voir</a>
            </div>
          )}
          <Field label="Libellé">
            <input
              value={form.libelle}
              onChange={(e) => update('libelle', e.target.value)}
              className="ndf-input"
              placeholder="Repas client, taxi gare..."
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Catégorie">
              <select value={form.categorie} onChange={(e) => update('categorie', e.target.value)} className="ndf-input">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Date dépense">
              <input type="date" value={form.date_depense} onChange={(e) => update('date_depense', e.target.value)} className="ndf-input" required />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Montant TTC (€)">
              <input type="number" step="0.01" value={form.montant_ttc} onChange={(e) => update('montant_ttc', e.target.value)} className="ndf-input" required />
            </Field>
            <Field label="TVA %">
              <input type="number" step="0.1" value={form.tva_pct} onChange={(e) => update('tva_pct', e.target.value)} className="ndf-input" />
            </Field>
          </div>

          <Field label="Projet (optionnel)">
            <input
              list="ndf-projets-list"
              value={form.projet_nom}
              onChange={(e) => update('projet_nom', e.target.value)}
              placeholder="Si imputable à un projet"
              className="ndf-input"
              autoComplete="off"
            />
            <datalist id="ndf-projets-list">
              {projets.map(p => <option key={p.id} value={p.nom} />)}
            </datalist>
          </Field>

          <Field label="Commentaire (optionnel)">
            <textarea
              value={form.commentaire}
              onChange={(e) => update('commentaire', e.target.value)}
              className="ndf-input"
              rows={2}
            />
          </Field>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Soumettre à la RH
            </button>
          </div>
        </form>
      </div>
      <style jsx global>{`
        .ndf-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          border: 1px solid rgb(229 231 235);
          border-radius: 0.5rem;
          background: white;
        }
        .ndf-input:focus {
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
