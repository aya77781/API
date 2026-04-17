'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileText, Download, Calendar, AlertCircle, Check, ArrowLeft, Upload, FileSignature,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { TopBar } from '@/components/co/TopBar'

type DceContext = {
  acces: {
    id: string
    statut: 'envoye' | 'ouvert' | 'en_cours' | 'soumis' | 'retenu' | 'refuse'
    date_limite: string | null
    st_nom: string | null
    st_societe: string | null
  }
  lot: {
    id: string
    nom: string
    cctp_url: string | null
    cctp_nom_fichier: string | null
    plans_urls: { nom: string; url: string }[] | null
    planning_debut: string | null
    planning_fin: string | null
    planning_notes: string | null
  }
  projet_nom: string
  lignes: {
    id: string
    designation: string | null
    detail: string | null
    quantite: number | null
    unite: string | null
    ordre: number
  }[]
  offres_existantes: {
    chiffrage_ligne_id: string
    prix_unitaire: number
    total_ht: number
    notes_st: string | null
  }[]
}

function uniteLabel(u: string | null): string {
  if (!u) return ''
  if (u === 'm2') return 'm²'
  if (u === 'm3') return 'm³'
  return u
}

function parseNum(s: string): number {
  if (!s) return 0
  const n = parseFloat(s.replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export default function StDceInternalPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const supabase = useMemo(() => createClient(), [])

  const [ctx, setCtx] = useState<DceContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [signature, setSignature] = useState<any>(null)
  const [devisNouveauId, setDevisNouveauId] = useState<string | null>(null)
  const [uploadingSig, setUploadingSig] = useState(false)
  const [sigToast, setSigToast] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('get_dce_context' as never, { p_token: token } as never)
      if (error || !data) { setNotFound(true); setLoading(false); return }
      const c = data as DceContext
      if (!c.acces) { setNotFound(true); setLoading(false); return }
      setCtx(c)
      const initialPrices: Record<string, string> = {}
      c.offres_existantes?.forEach((o) => {
        initialPrices[o.chiffrage_ligne_id] = String(o.prix_unitaire ?? '')
      })
      setPrices(initialPrices)
      if (c.offres_existantes?.[0]?.notes_st) setNotes(c.offres_existantes[0].notes_st)
      if (c.acces.statut === 'soumis' || c.acces.statut === 'retenu' || c.acces.statut === 'refuse') {
        setSubmitted(true)
      } else if (c.acces.statut === 'envoye') {
        await supabase.rpc('mark_dce_opened' as never, { p_token: token } as never)
      }

      // Nouveau flow : si un devis existe dans public.devis, on redirige vers /st/devis/[id]
      // ou on affiche un bandeau remplaçant l'ancienne section signature.
      const { data: dev } = await supabase
        .from('devis')
        .select('id')
        .eq('acces_st_id', c.acces.id)
        .maybeSingle()
      setDevisNouveauId((dev as { id: string } | null)?.id ?? null)

      // Ancien flow (fallback) : st_devis_signatures
      const { data: sig } = await supabase
        .from('st_devis_signatures')
        .select('*')
        .eq('acces_id', c.acces.id)
        .maybeSingle()
      setSignature(sig)
      setLoading(false)
    }
    load()
  }, [token, supabase])

  async function reloadSignature(accesId: string) {
    const { data: sig } = await supabase
      .from('st_devis_signatures')
      .select('*')
      .eq('acces_id', accesId)
      .maybeSingle()
    setSignature(sig)
  }

  async function uploadSignedFinal(file: File) {
    if (!ctx || !signature) return
    setUploadingSig(true)
    try {
      const path = `dce-devis/${ctx.acces.id}/signed-final-${Date.now()}.pdf`
      const { error: upErr } = await supabase.storage
        .from('documents')
        .upload(path, file, { contentType: file.type || 'application/pdf', upsert: true })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('documents').getPublicUrl(path)

      const { error: updErr } = await supabase
        .from('st_devis_signatures' as never)
        .update({
          signed_final_url: pub.publicUrl,
          statut: 'finalise',
          signed_st_at: new Date().toISOString(),
        } as never)
        .eq('id', signature.id)
      if (updErr) throw updErr

      // Notifier l'économiste du projet (si connu).
      const { data: projet } = await supabase
        .schema('app')
        .from('projets')
        .select('economiste_id')
        .eq('id', signature.projet_id)
        .maybeSingle()
      const ecoId = (projet as { economiste_id?: string | null } | null)?.economiste_id ?? null
      if (ecoId) {
        await supabase.schema('app').from('alertes').insert({
          projet_id: signature.projet_id,
          utilisateur_id: ecoId,
          type: 'devis_signe_st',
          titre: 'Devis signé par le sous-traitant',
          message: `Le sous-traitant ${ctx.acces.st_societe ?? ctx.acces.st_nom ?? ''} a signé et déposé le devis du lot « ${ctx.lot.nom} ».`,
          priorite: 'high',
        })
      }

      setSigToast('Devis signé déposé — l\'économiste est notifié.')
      await reloadSignature(ctx.acces.id)
    } catch (e: any) {
      setSigToast(`Erreur : ${e?.message ?? 'upload impossible'}`)
    }
    setUploadingSig(false)
    setTimeout(() => setSigToast(null), 5000)
  }

  const total = useMemo(() => {
    if (!ctx) return 0
    return ctx.lignes.reduce((s, l) => s + parseNum(prices[l.id] ?? '') * (Number(l.quantite) || 0), 0)
  }, [prices, ctx])

  async function handleSubmit() {
    if (!ctx) return
    const filledLines = ctx.lignes.filter((l) => parseNum(prices[l.id] ?? '') > 0)
    if (filledLines.length === 0) {
      setErrorMsg('Veuillez renseigner au moins un prix avant de soumettre.')
      return
    }
    if (!confirm('Confirmer la soumission de votre offre ? Vous ne pourrez plus la modifier après.')) return
    setSubmitting(true)
    setErrorMsg(null)
    const payload = ctx.lignes.map((l) => ({
      chiffrage_ligne_id: l.id,
      prix_unitaire: parseNum(prices[l.id] ?? ''),
    }))
    const { error } = await supabase.rpc('submit_dce_offre' as never, {
      p_token: token,
      p_lignes: payload,
      p_notes: notes.trim() || null,
    } as never)
    setSubmitting(false)
    if (error) { setErrorMsg(`Erreur soumission : ${error.message}`); return }
    setSubmitted(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">Chargement…</div>
      </div>
    )
  }

  if (notFound || !ctx) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Invitation introuvable</h1>
          <p className="text-sm text-gray-500 mb-4">Cette consultation n'existe pas ou ne vous est pas adressée.</p>
          <Link href="/st/dashboard" className="text-sm text-blue-600 hover:underline">Retour au dashboard</Link>
        </div>
      </div>
    )
  }

  const { acces, lot, projet_nom, lignes } = ctx

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar
        title="Dossier de consultation"
        subtitle={`${projet_nom} · ${lot.nom}`}
      />

      <div className="p-6 space-y-5 max-w-5xl mx-auto">
        {/* Retour */}
        <Link
          href="/st/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour au dashboard
        </Link>

        {/* Bannière succès */}
        {submitted && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Votre offre a été transmise.</p>
              <p className="text-xs mt-1 text-green-700">Merci pour votre participation. Vous pouvez la retrouver à tout moment depuis votre dashboard.</p>
            </div>
          </div>
        )}

        {/* Info projet */}
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Projet</div>
              <h2 className="text-lg font-semibold text-gray-900 mt-1">{projet_nom}</h2>
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 uppercase tracking-wider">Lot consulté</div>
              <p className="text-base font-medium text-gray-900 mt-1">{lot.nom}</p>
            </div>
            {acces.date_limite && (
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-500">Date limite de remise</p>
                <p className="text-sm font-semibold text-gray-900">
                  {new Date(acces.date_limite).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            )}
          </div>
          {acces.st_nom && (
            <p className="mt-3 text-xs text-gray-500">
              Invitation adressée à <span className="text-gray-900 font-medium">{acces.st_nom}</span>
              {acces.st_societe && <span> · {acces.st_societe}</span>}
            </p>
          )}
        </section>

        {/* CCTP */}
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">CCTP — Cahier des Clauses Techniques</h3>
          {lot.cctp_url ? (
            <a
              href={lot.cctp_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-gray-900 rounded-md hover:bg-black"
            >
              <Download className="w-4 h-4" />
              Télécharger le CCTP {lot.cctp_nom_fichier && <span className="text-xs text-gray-300">({lot.cctp_nom_fichier})</span>}
            </a>
          ) : (
            <p className="text-xs text-gray-400">Aucun CCTP fourni</p>
          )}
        </section>

        {/* Plans */}
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Plans</h3>
          {lot.plans_urls && lot.plans_urls.length > 0 ? (
            <ul className="space-y-1.5">
              {lot.plans_urls.map((p, i) => (
                <li key={i} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                  <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="flex-1 text-sm text-gray-900 truncate">{p.nom}</span>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 border border-gray-200 rounded hover:bg-white"
                  >
                    <Download className="w-3 h-3" />
                    Télécharger
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400">Aucun plan fourni</p>
          )}
        </section>

        {/* Planning */}
        {(lot.planning_debut || lot.planning_fin || lot.planning_notes) && (
          <section className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              Planning prévisionnel
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {lot.planning_debut && (
                <div>
                  <div className="text-xs text-gray-500">Début des travaux</div>
                  <div className="text-gray-900 font-medium">{new Date(lot.planning_debut).toLocaleDateString('fr-FR')}</div>
                </div>
              )}
              {lot.planning_fin && (
                <div>
                  <div className="text-xs text-gray-500">Fin des travaux</div>
                  <div className="text-gray-900 font-medium">{new Date(lot.planning_fin).toLocaleDateString('fr-FR')}</div>
                </div>
              )}
            </div>
            {lot.planning_notes && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-1">Notes</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{lot.planning_notes}</p>
              </div>
            )}
          </section>
        )}

        {/* DPGF */}
        <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Décomposition du Prix Global et Forfaitaire</h3>
            <p className="text-xs text-gray-500 mt-1">Remplissez vos prix unitaires pour chaque poste</p>
          </div>

          {lignes.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">Aucune ligne de chiffrage pour ce lot</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-medium text-gray-500">
                    <th className="px-3 py-2 w-12">N°</th>
                    <th className="px-3 py-2 min-w-[200px]">Désignation</th>
                    <th className="px-3 py-2 min-w-[140px]">Détail</th>
                    <th className="px-3 py-2 w-20">Quantité</th>
                    <th className="px-3 py-2 w-20">Unité</th>
                    <th className="px-3 py-2 w-32">Prix unitaire HT</th>
                    <th className="px-3 py-2 w-32 text-right">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, idx) => {
                    const pu = parseNum(prices[l.id] ?? '')
                    const q = Number(l.quantite) || 0
                    const t = pu * q
                    return (
                      <tr key={l.id} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-400 tabular-nums">{idx + 1}</td>
                        <td className="px-3 py-2 text-gray-900">{l.designation}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{l.detail}</td>
                        <td className="px-3 py-2 text-gray-700 tabular-nums">{q}</td>
                        <td className="px-3 py-2 text-gray-700">{uniteLabel(l.unite)}</td>
                        <td className="px-3 py-2">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={prices[l.id] ?? ''}
                              onChange={(e) => setPrices({ ...prices, [l.id]: e.target.value })}
                              disabled={submitted}
                              placeholder="Votre prix"
                              className="w-full pl-2 pr-6 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 tabular-nums"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">€</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900 tabular-nums font-medium">
                          {pu > 0 && q > 0 ? formatCurrency(t) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                    <td colSpan={6} className="px-3 py-3 text-right text-gray-700 uppercase text-xs tracking-wider">Total lot HT</td>
                    <td className="px-3 py-3 text-right text-gray-900 tabular-nums text-base">{formatCurrency(total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Notes */}
          <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
            <label className="block text-xs text-gray-500 mb-1.5">Notes / Variantes (optionnel)</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitted}
              placeholder="Commentaires, variantes proposées…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 disabled:bg-white disabled:text-gray-500 resize-y"
            />
          </div>
        </section>

        {/* Nouveau flow : si un devis existe dans public.devis, on affiche un bandeau qui redirige. */}
        {acces.statut === 'retenu' && devisNouveauId && (
          <section className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-emerald-900 mb-2 flex items-center gap-2">
              <FileSignature className="w-4 h-4" />
              Votre offre a été retenue — signez le devis
            </h3>
            <p className="text-xs text-emerald-800 mb-3">
              Le devis final a été généré et vous est proposé à la signature.
              Consultez-le, apposez votre signature et téléchargez le PDF signé.
            </p>
            <Link
              href={`/st/devis/${devisNouveauId}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black"
            >
              Accéder au devis à signer →
            </Link>
          </section>
        )}

        {/* Ancien flow (fallback) : uniquement si aucun devis dans la nouvelle table */}
        {acces.statut === 'retenu' && !devisNouveauId && signature && (
          <section className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-gray-500" />
              Signature du devis
            </h3>

            {sigToast && (
              <div className="mb-3 text-xs bg-green-50 border border-green-200 text-green-800 rounded-md p-2">
                {sigToast}
              </div>
            )}

            <div className="space-y-2.5 text-sm">
              {/* Étape 1 : devis initial à consulter */}
              {signature.devis_url && (
                <a
                  href={signature.devis_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  <Download className="w-4 h-4 text-gray-500" />
                  <span className="flex-1">Devis initial (non signé)</span>
                  <span className="text-xs text-gray-400">PDF</span>
                </a>
              )}

              {/* Étape 2 : devis signé par l'éco — ST doit le contre-signer */}
              {signature.signed_eco_url && signature.statut === 'signe_eco' && (
                <>
                  <a
                    href={signature.signed_eco_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 border border-blue-200 bg-blue-50 rounded-md hover:bg-blue-100"
                  >
                    <Download className="w-4 h-4 text-blue-600" />
                    <span className="flex-1 text-blue-800 font-medium">Devis signé par API Rénovation — à contre-signer</span>
                    <span className="text-xs text-blue-500">PDF</span>
                  </a>
                  <div className="pt-1">
                    <label className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-gray-900 rounded-md hover:bg-black cursor-pointer">
                      <Upload className="w-4 h-4" />
                      {uploadingSig ? 'Envoi…' : 'Déposer mon devis signé (PDF)'}
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        disabled={uploadingSig}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) uploadSignedFinal(f)
                          e.target.value = ''
                        }}
                      />
                    </label>
                    <p className="text-[11px] text-gray-500 text-center mt-1.5">
                      Téléchargez le devis, signez-le (main ou numérique), puis déposez le fichier signé.
                    </p>
                  </div>
                </>
              )}

              {/* Étape 3 : finalisé */}
              {signature.statut === 'finalise' && signature.signed_final_url && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-emerald-800">Devis finalisé</p>
                    <p className="text-xs text-emerald-700 mt-0.5">Merci, le devis est double-signé et archivé.</p>
                    <a
                      href={signature.signed_final_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-xs text-emerald-800 underline"
                    >
                      <Download className="w-3 h-3" />
                      Télécharger la version finale
                    </a>
                  </div>
                </div>
              )}

              {/* État : en attente signature éco */}
              {signature.statut === 'genere' && !signature.signed_eco_url && (
                <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md p-3">
                  Le devis est en attente de signature par API Rénovation. Vous recevrez une notification dès qu'il sera prêt à contre-signer.
                </div>
              )}
            </div>
          </section>
        )}

        {/* Erreur */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{errorMsg}</div>
        )}

        {/* Bouton soumettre */}
        {submitted ? (
          <div className="bg-white border border-gray-200 rounded-lg p-5 text-center text-sm text-gray-500">
            Vous avez déjà soumis votre offre. Merci pour votre participation.
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting || lignes.length === 0}
            className="w-full md:w-auto md:min-w-[260px] md:mx-auto block px-8 py-3 text-sm font-semibold text-white bg-gray-900 rounded-md hover:bg-black disabled:bg-gray-300 transition-colors"
          >
            {submitting ? 'Envoi en cours…' : 'Soumettre mon offre'}
          </button>
        )}
      </div>
    </div>
  )
}
