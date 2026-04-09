'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Upload, Loader2, FileSpreadsheet, FileText, Edit3,
  CheckCircle2, X, Trash2, AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Ecriture = {
  id: string
  journal: string | null
  date_ecriture: string | null
  client: string | null
  fournisseur: string | null
  libelle: string | null
  numero: string | null
  montant_ht: number | null
  montant_tva: number | null
  montant_ttc: number | null
  chrono: string | null
  type_piece: string | null
  mode_paiement: string | null
  traite_le: string | null
  lien_fichier: string | null
  statut: string
  created_at: string
}

const TYPE_PIECE_OPTIONS = [
  { value: 'NDF',   label: 'NDF — Note de frais' },
  { value: 'ACHAT', label: 'ACHAT — Facture achat' },
  { value: 'VTE',   label: 'VTE — Facture vente' },
  { value: 'BQE',   label: 'BQE — Écriture bancaire' },
]
const MODE_PAIEMENT_OPTIONS = [
  { value: 'VIR',   label: 'VIR — Virement' },
  { value: 'CB',    label: 'CB — Carte bancaire' },
  { value: 'ESP',   label: 'ESP — Espèces' },
  { value: 'CHQ',   label: 'CHQ — Chèque' },
  { value: 'PRELE', label: 'PRELE — Prélèvement' },
]

const WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_COMPTA
  ?? 'https://apiprojet.app.n8n.cloud/webhook/api-renovation-compta-ocr'

function fmt(n: number | null) {
  if (n == null) return '—'
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR')
}
function fmtDateTime(d: string | null) {
  if (!d) return '—'
  const date = new Date(d)
  return `${date.toLocaleDateString('fr-FR')} ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

export default function ComptabilitePage() {
  const supabase = createClient()
  const [ecritures, setEcritures] = useState<Ecriture[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState<Ecriture | null>(null)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Form state
  const [file, setFile] = useState<File | null>(null)
  const [typePiece, setTypePiece] = useState('NDF')
  const [modePaiement, setModePaiement] = useState('VIR')
  const [dragOver, setDragOver] = useState(false)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Totaux calcules : VTE = revenus (+), autres = depenses (-)
  const totalVente = ecritures
    .filter(e => (e.journal ?? e.type_piece) === 'VTE')
    .reduce((s, e) => s + Number(e.montant_ttc ?? 0), 0)
  const totalDepense = ecritures
    .filter(e => (e.journal ?? e.type_piece) !== 'VTE')
    .reduce((s, e) => s + Number(e.montant_ttc ?? 0), 0)
  const totalNet = totalVente - totalDepense

  async function load() {
    const { data } = await supabase
      .from('ecritures_comptables')
      .select('*')
      .order('created_at', { ascending: false })
    setEcritures((data ?? []) as Ecriture[])
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  // Realtime subscription : recharge quand n8n insert/update
  useEffect(() => {
    const channel = supabase
      .channel('ecritures_comptables_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ecritures_comptables' }, () => {
        load()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  // Demarre un polling de 3s pendant 30s max apres soumission
  function startPolling() {
    if (pollingRef.current) clearInterval(pollingRef.current)
    let elapsed = 0
    pollingRef.current = setInterval(() => {
      load()
      elapsed += 3
      if (elapsed >= 30 && pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }, 3000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      setBanner({ type: 'error', msg: 'Veuillez sélectionner un fichier.' })
      return
    }
    setSubmitting(true)
    setBanner(null)

    try {
      // 1. Upload du fichier vers Supabase Storage en premier
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('comptabilite')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) {
        throw new Error('Upload Supabase Storage echoue : ' + upErr.message)
      }
      const { data: urlData } = supabase.storage.from('comptabilite').getPublicUrl(path)
      const lien_fichier = urlData.publicUrl

      // 2. Envoi au webhook n8n (avec URL Storage en plus)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type_piece', typePiece)
      formData.append('mode_paiement', modePaiement)
      formData.append('lien_fichier', lien_fichier)

      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Le webhook a renvoyé ${res.status}. ${text}`)
      }

      // 3. Fallback : si n8n a cree une nouvelle ligne sans lien_fichier dans les 30 dernieres
      // secondes (= probablement la notre), on lui ajoute l'URL.
      const since = new Date(Date.now() - 30_000).toISOString()
      await supabase
        .from('ecritures_comptables')
        .update({ lien_fichier })
        .is('lien_fichier', null)
        .gte('created_at', since)

      // Reset form
      setFile(null)
      setTypePiece('NDF')
      setModePaiement('VIR')
      setBanner({ type: 'success', msg: 'Facture traitée avec succès. Mise à jour du tableau...' })

      // Refresh immediat + polling pendant 30s
      load()
      startPolling()

      // Auto-hide success banner apres 5s
      setTimeout(() => setBanner(null), 5000)
    } catch (err) {
      setBanner({
        type: 'error',
        msg: 'Erreur lors de l\'envoi : ' + (err instanceof Error ? err.message : String(err)),
      })
    } finally {
      setSubmitting(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) setFile(f)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette écriture ?')) return
    await supabase.from('ecritures_comptables').delete().eq('id', id)
    load()
  }

  // Export CSV
  function exportCSV() {
    const headers = ['Journal', 'Date', 'Client', 'Fournisseur', 'Libelle', 'Numero', 'HT', 'TVA', 'TTC', 'CHRONO', 'Paiement', 'Traite le', 'Statut']
    const rows = ecritures.map(e => [
      e.journal ?? e.type_piece ?? '',
      e.date_ecriture ?? '',
      e.client ?? '',
      e.fournisseur ?? '',
      (e.libelle ?? '').replace(/"/g, '""'),
      e.numero ?? '',
      e.montant_ht ?? '',
      e.montant_tva ?? '',
      e.montant_ttc ?? '',
      e.chrono ?? '',
      e.mode_paiement ?? '',
      e.traite_le ?? '',
      e.statut,
    ])
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${c}"`).join(';'))
      .join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    downloadBlob(blob, `ecritures_${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function exportExcel() {
    const headers = ['Journal', 'Date', 'Client', 'Fournisseur', 'Libelle', 'Numero', 'HT', 'TVA', 'TTC', 'CHRONO', 'Paiement', 'Traite le', 'Statut']
    const rowsHtml = ecritures.map(e => `
      <tr>
        <td>${escapeHtml(e.journal ?? e.type_piece)}</td>
        <td>${e.date_ecriture ?? ''}</td>
        <td>${escapeHtml(e.client)}</td>
        <td>${escapeHtml(e.fournisseur)}</td>
        <td>${escapeHtml(e.libelle)}</td>
        <td>${escapeHtml(e.numero)}</td>
        <td>${e.montant_ht ?? ''}</td>
        <td>${e.montant_tva ?? ''}</td>
        <td>${e.montant_ttc ?? ''}</td>
        <td>${escapeHtml(e.chrono)}</td>
        <td>${e.mode_paiement ?? ''}</td>
        <td>${e.traite_le ?? ''}</td>
        <td>${e.statut}</td>
      </tr>
    `).join('')
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8" /></head>
      <body><table border="1"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table></body>
      </html>`
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
    downloadBlob(blob, `ecritures_${new Date().toISOString().slice(0, 10)}.xls`)
  }

  return (
    <div>
      <TopBar title="Comptabilité" subtitle="Saisie et suivi des écritures comptables" />
      <div className="p-6 space-y-6">

        {/* Banner status */}
        {banner && (
          <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {banner.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            <p className="text-sm flex-1">{banner.msg}</p>
            <button onClick={() => setBanner(null)} className="text-current opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── FORMULAIRE ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Nouvelle écriture</h2>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Upload zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragOver ? 'border-gray-900 bg-gray-50' : 'border-gray-300 bg-gray-50/50 hover:border-gray-400'
              }`}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-6 h-6 text-emerald-500" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} Ko</p>
                  </div>
                  <button type="button" onClick={() => setFile(null)} className="text-gray-300 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <FileText className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Déposer la facture ici ou cliquer pour parcourir</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG</p>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Type de pièce">
                <select
                  value={typePiece}
                  onChange={(e) => setTypePiece(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 bg-white"
                >
                  {TYPE_PIECE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Mode de paiement">
                <select
                  value={modePaiement}
                  onChange={(e) => setModePaiement(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 bg-white"
                >
                  {MODE_PAIEMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>

            <button
              type="submit"
              disabled={submitting || !file}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Soumettre
                </>
              )}
            </button>
          </form>
        </div>

        {/* ── EXPORTS ── */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-400">{ecritures.length} écriture{ecritures.length > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              disabled={ecritures.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              <FileText className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              onClick={exportExcel}
              disabled={ecritures.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
            </button>
          </div>
        </div>

        {/* ── TABLEAU ── */}
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Loader2 className="w-6 h-6 text-gray-400 mx-auto animate-spin" />
          </div>
        ) : ecritures.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Aucune écriture</p>
            <p className="text-xs text-gray-400 mt-1">Soumettez une facture via le formulaire ci-dessus.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-left text-xs font-semibold text-gray-700">
                    <th className="px-3 py-3">Journal</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Client</th>
                    <th className="px-3 py-3">Fournisseur</th>
                    <th className="px-3 py-3">Libellé</th>
                    <th className="px-3 py-3">Numéro</th>
                    <th className="px-3 py-3 text-right">HT</th>
                    <th className="px-3 py-3 text-right">TVA</th>
                    <th className="px-3 py-3 text-right">TTC</th>
                    <th className="px-3 py-3">CHRONO</th>
                    <th className="px-3 py-3">Paiement</th>
                    <th className="px-3 py-3">Traité le</th>
                    <th className="px-3 py-3 text-center" style={{ width: '80px' }}>Facture</th>
                    <th className="px-3 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ecritures.map(e => {
                    const isVente = (e.journal ?? e.type_piece) === 'VTE'
                    const ttcColor = e.montant_ttc == null
                      ? 'text-gray-900'
                      : isVente
                        ? 'text-emerald-600'
                        : 'text-red-500'
                    return (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-gray-700">{e.journal ?? e.type_piece ?? <Pending />}</td>
                      <td className="px-3 py-2.5 text-gray-600">{fmtDate(e.date_ecriture)}</td>
                      <td className="px-3 py-2.5 text-gray-600">{e.client ?? <Pending />}</td>
                      <td className="px-3 py-2.5 text-gray-600">{e.fournisseur ?? <Pending />}</td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-[200px] truncate">{e.libelle ?? <Pending />}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{e.numero ?? <Pending />}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{fmt(e.montant_ht)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{fmt(e.montant_tva)}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold ${ttcColor}`}>
                        {e.montant_ttc != null && (isVente ? '+ ' : '- ')}{fmt(e.montant_ttc)}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{e.chrono ?? <Pending />}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          {e.mode_paiement ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{fmtDateTime(e.traite_le)}</td>
                      <td className="px-3 py-2.5 text-center" style={{ width: '80px' }}>
                        <FactureCell url={e.lien_fichier} onPreview={setLightboxUrl} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditing(e)}
                            title="Éditer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 text-gray-600 rounded hover:bg-gray-50"
                          >
                            <Edit3 className="w-3 h-3" /> Éditer
                          </button>
                          <button
                            onClick={() => handleDelete(e.id)}
                            title="Supprimer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 text-red-500 rounded hover:bg-red-50 hover:border-red-200"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Barre totaux toujours visible */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            <div className="px-5 py-3">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Ventes (VTE)</p>
              <p className="text-lg font-bold text-emerald-600 mt-0.5">+ {fmt(totalVente)}</p>
            </div>
            <div className="px-5 py-3">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Dépenses (NDF / ACHAT / BQE)</p>
              <p className="text-lg font-bold text-red-500 mt-0.5">- {fmt(totalDepense)}</p>
            </div>
            <div className={`px-5 py-3 ${totalNet >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Solde net TTC</p>
              <p className={`text-2xl font-bold mt-0.5 ${totalNet >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {totalNet >= 0 ? '+ ' : '- '}{fmt(Math.abs(totalNet))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <EditModal
          ecriture={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}

      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  )
}

/* ── Cellule Facture (PDF / image / vide) ── */

function FactureCell({ url, onPreview }: { url: string | null; onPreview: (u: string) => void }) {
  if (!url) return <span className="text-gray-300">—</span>

  const lower = url.toLowerCase().split('?')[0]
  const isPdf = lower.endsWith('.pdf')
  const isImage = /\.(jpg|jpeg|png|webp)$/.test(lower)

  if (isPdf) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 text-gray-700 rounded hover:bg-gray-50"
        title="Voir le PDF"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          <rect x="2" y="1" width="8" height="11" rx="1" />
          <path d="M5 4h4M5 6.5h4M5 9h2" />
          <path d="M8 1v3h3" fill="none" />
        </svg>
        Voir PDF
      </a>
    )
  }

  if (isImage) {
    return (
      <button
        type="button"
        onClick={() => onPreview(url)}
        className="relative group inline-block w-10 h-10 rounded overflow-hidden border border-gray-200"
        title="Voir l'image"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Facture" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.4" strokeLinecap="round">
            <circle cx="7" cy="7" r="4" />
            <path d="M11 11l2.5 2.5" />
            <path d="M7 5v4M5 7h4" />
          </svg>
        </div>
      </button>
    )
  }

  // Type inconnu : fallback lien generique
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 text-gray-700 rounded hover:bg-gray-50"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <rect x="2" y="1" width="8" height="11" rx="1" />
        <path d="M8 1v3h3" fill="none" />
      </svg>
      Voir
    </a>
  )
}

/* ── Lightbox modal ── */

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  // Fermeture sur Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:opacity-80"
        aria-label="Fermer"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Aperçu facture"
        onClick={(e) => e.stopPropagation()}
        className="rounded-lg shadow-2xl"
        style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px' }}
      />
    </div>
  )
}

/* ── Sub-components ── */

function Pending() {
  return <span className="text-[10px] text-amber-500 font-medium uppercase tracking-wide">En attente</span>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}

function escapeHtml(s: string | null): string {
  if (!s) return ''
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] ?? c))
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/* ── Edit modal ── */

function EditModal({ ecriture, onClose, onSaved }: {
  ecriture: Ecriture
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [form, setForm] = useState({
    journal:       ecriture.journal ?? '',
    date_ecriture: ecriture.date_ecriture ?? '',
    client:        ecriture.client ?? '',
    fournisseur:   ecriture.fournisseur ?? '',
    libelle:       ecriture.libelle ?? '',
    numero:        ecriture.numero ?? '',
    montant_ht:    ecriture.montant_ht?.toString() ?? '',
    montant_tva:   ecriture.montant_tva?.toString() ?? '',
    montant_ttc:   ecriture.montant_ttc?.toString() ?? '',
    chrono:        ecriture.chrono ?? '',
  })
  const [saving, setSaving] = useState(false)

  function update<K extends keyof typeof form>(key: K, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('ecritures_comptables').update({
      journal:       form.journal || null,
      date_ecriture: form.date_ecriture || null,
      client:        form.client || null,
      fournisseur:   form.fournisseur || null,
      libelle:       form.libelle || null,
      numero:        form.numero || null,
      montant_ht:    form.montant_ht ? Number(form.montant_ht) : null,
      montant_tva:   form.montant_tva ? Number(form.montant_tva) : null,
      montant_ttc:   form.montant_ttc ? Number(form.montant_ttc) : null,
      chrono:        form.chrono || null,
    }).eq('id', ecriture.id)
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Éditer l&apos;écriture</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Journal">
              <input value={form.journal} onChange={(e) => update('journal', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Date">
              <input type="date" value={form.date_ecriture} onChange={(e) => update('date_ecriture', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Client">
              <input value={form.client} onChange={(e) => update('client', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Fournisseur">
              <input value={form.fournisseur} onChange={(e) => update('fournisseur', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Numéro">
              <input value={form.numero} onChange={(e) => update('numero', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="CHRONO">
              <input value={form.chrono} onChange={(e) => update('chrono', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
          </div>
          <Field label="Libellé">
            <textarea value={form.libelle} onChange={(e) => update('libelle', e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Montant HT (€)">
              <input type="number" step="0.01" value={form.montant_ht} onChange={(e) => update('montant_ht', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Montant TVA (€)">
              <input type="number" step="0.01" value={form.montant_tva} onChange={(e) => update('montant_tva', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
            <Field label="Montant TTC (€)">
              <input type="number" step="0.01" value={form.montant_ttc} onChange={(e) => update('montant_ttc', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </Field>
          </div>
        </div>
        <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
