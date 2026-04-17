'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileText, Download, Calendar, AlertCircle, Check, ArrowLeft,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { formatCurrency } from '@/lib/utils'

/* ─── Types ────────────────────────────────────────────────────────────── */

type AccesRow = {
  id: string
  lot_id: string
  projet_id: string
  type_acces: 'externe' | 'interne'
  user_id: string | null
  statut: 'envoye' | 'ouvert' | 'en_cours' | 'soumis' | 'retenu' | 'refuse'
  date_limite: string | null
  st_nom: string | null
  st_societe: string | null
  ouvert_le: string | null
  soumis_le: string | null
}

type LotRow = {
  id: string
  nom: string
  projet_id: string
  cctp_url: string | null
  cctp_nom_fichier: string | null
  plans_urls: { nom: string; url: string }[] | null
  planning_debut: string | null
  planning_fin: string | null
  planning_notes: string | null
}

type Ligne = {
  id: string
  designation: string | null
  detail: string | null
  quantite: number | null
  unite: string | null
  ordre: number
}

type OffreExistante = {
  chiffrage_ligne_id: string | null
  prix_unitaire: number | null
  notes_st: string | null
}

function uniteLabel(u: string | null): string {
  if (!u) return ''
  if (u === 'm2') return 'm²'
  if (u === 'm3') return 'm³'
  return u
}

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function DceInternePage() {
  const params = useParams()
  const router = useRouter()
  const lotId = params.lot_id as string
  const accesId = params.acces_id as string
  const supabase = useMemo(() => createClient(), [])
  const { user, loading: userLoading } = useUser()

  const [acces, setAcces] = useState<AccesRow | null>(null)
  const [lot, setLot] = useState<LotRow | null>(null)
  const [projetNom, setProjetNom] = useState<string>('')
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  /* ── Chargement ───────────────────────────────── */

  useEffect(() => {
    if (userLoading) return
    if (!user) { router.push('/login'); return }

    let cancelled = false
    async function load() {
      const { data: accesData, error: accesErr } = await supabase
        .from('dce_acces_st')
        .select('id, lot_id, projet_id, type_acces, user_id, statut, date_limite, st_nom, st_societe, ouvert_le, soumis_le')
        .eq('id', accesId)
        .maybeSingle()

      if (cancelled) return
      if (accesErr || !accesData) { setNotFound(true); setLoading(false); return }
      const a = accesData as AccesRow

      // Acces autorise seulement si l'utilisateur connecte = user_id de l'invitation interne.
      if (a.type_acces !== 'interne' || a.user_id !== user!.id) {
        setForbidden(true); setLoading(false); return
      }
      if (a.lot_id !== lotId) { setNotFound(true); setLoading(false); return }

      const [{ data: lotData }, { data: projData }, { data: lignesData }, { data: offresData }] = await Promise.all([
        supabase
          .from('lots')
          .select('id, nom, projet_id, cctp_url, cctp_nom_fichier, plans_urls, planning_debut, planning_fin, planning_notes')
          .eq('id', a.lot_id)
          .single(),
        supabase
          .schema('app')
          .from('projets')
          .select('nom')
          .eq('id', a.projet_id)
          .maybeSingle(),
        supabase
          .from('chiffrage_lignes')
          .select('id, designation, detail, quantite, unite, ordre')
          .eq('lot_id', a.lot_id)
          .order('ordre', { ascending: true }),
        supabase
          .from('dce_offres_st')
          .select('chiffrage_ligne_id, prix_unitaire, notes_st')
          .eq('acces_id', a.id),
      ])

      if (cancelled) return

      setAcces(a)
      setLot(lotData ? (lotData as unknown as LotRow) : null)
      setProjetNom(((projData as { nom: string } | null)?.nom) ?? '')
      setLignes((lignesData ?? []) as Ligne[])

      const offres = (offresData ?? []) as unknown as OffreExistante[]
      const initialPrices: Record<string, string> = {}
      offres.forEach((o) => {
        if (o.chiffrage_ligne_id) initialPrices[o.chiffrage_ligne_id] = String(o.prix_unitaire ?? '')
      })
      setPrices(initialPrices)
      const firstNote = offres.find((o) => !!o.notes_st)
      if (firstNote?.notes_st) setNotes(firstNote.notes_st)

      if (['soumis', 'retenu', 'refuse'].includes(a.statut)) {
        setSubmitted(true)
      } else if (a.statut === 'envoye') {
        await supabase
          .from('dce_acces_st')
          .update({ statut: 'ouvert', ouvert_le: new Date().toISOString() } as never)
          .eq('id', a.id)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [user, userLoading, accesId, lotId, router, supabase])

  /* ── Totaux ───────────────────────────────── */

  function parseNum(s: string): number {
    if (!s) return 0
    const n = parseFloat(s.replace(',', '.'))
    return isNaN(n) ? 0 : n
  }

  const total = useMemo(() => {
    return lignes.reduce((s, l) => s + parseNum(prices[l.id] ?? '') * (Number(l.quantite) || 0), 0)
  }, [prices, lignes])

  /* ── Soumission ───────────────────────────────── */

  async function handleSubmit() {
    if (!acces) return
    const filled = lignes.filter((l) => parseNum(prices[l.id] ?? '') > 0)
    if (filled.length === 0) {
      setErrorMsg('Veuillez renseigner au moins un prix avant de soumettre.')
      return
    }
    if (!confirm('Confirmer la soumission de votre offre ? Vous ne pourrez plus la modifier.')) return
    setSubmitting(true)
    setErrorMsg(null)

    await supabase.from('dce_offres_st').delete().eq('acces_id', acces.id)

    const montantTotal = total
    const rows = lignes.map((l) => {
      const pu = parseNum(prices[l.id] ?? '')
      const q = Number(l.quantite) || 0
      return {
        acces_id: acces.id,
        lot_id: acces.lot_id,
        projet_id: acces.projet_id,
        chiffrage_ligne_id: l.id,
        designation: l.designation ?? '',
        quantite: q,
        unite: l.unite,
        prix_unitaire: pu,
        total_ht: pu * q,
        montant_total_ht: montantTotal,
        notes_st: notes.trim() || null,
      }
    })
    const { error: insErr } = await supabase.from('dce_offres_st').insert(rows as never)
    if (insErr) {
      setSubmitting(false)
      setErrorMsg(`Erreur insertion offre : ${insErr.message}`)
      return
    }

    const { error: updErr } = await supabase
      .from('dce_acces_st')
      .update({ statut: 'soumis', soumis_le: new Date().toISOString() } as never)
      .eq('id', acces.id)
    if (updErr) {
      setSubmitting(false)
      setErrorMsg(`Erreur maj statut : ${updErr.message}`)
      return
    }

    setSubmitting(false)
    setSubmitted(true)
  }

  /* ── Rendu ───────────────────────────────── */

  if (userLoading || loading) {
    return <div className="p-10 text-sm text-gray-400 text-center">Chargement…</div>
  }
  if (forbidden) {
    return (
      <div className="p-10 max-w-md mx-auto text-center">
        <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <h1 className="text-base font-semibold text-gray-900 mb-1">Accès refusé</h1>
        <p className="text-sm text-gray-500">Cette invitation n'est pas liée à votre compte.</p>
        <Link href="/st/dashboard" className="inline-block mt-4 text-sm text-gray-700 underline">Retour au dashboard</Link>
      </div>
    )
  }
  if (notFound || !acces || !lot) {
    return (
      <div className="p-10 max-w-md mx-auto text-center">
        <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <h1 className="text-base font-semibold text-gray-900 mb-1">Invitation introuvable</h1>
        <p className="text-sm text-gray-500">Le dossier de consultation n'existe pas ou a été supprimé.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <Link
          href="/st/dashboard"
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Tableau de bord
        </Link>
        {acces.date_limite && (
          <div className="text-right">
            <p className="text-xs text-gray-500">Date limite de remise</p>
            <p className="text-sm font-semibold text-gray-900">
              {new Date(acces.date_limite).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        )}
      </div>

      {submitted && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 flex items-start gap-3">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Votre offre a été transmise.</p>
            <p className="text-xs mt-1 text-green-700">Merci pour votre participation. L'économiste reviendra vers vous.</p>
          </div>
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="text-xs text-gray-500 uppercase tracking-wider">Projet</div>
        <h2 className="text-lg font-semibold text-gray-900 mt-1">{projetNom}</h2>
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 uppercase tracking-wider">Lot consulté</div>
        <p className="text-base font-medium text-gray-900 mt-1">{lot.nom}</p>
        <p className="mt-3 text-xs text-gray-500">
          Invitation interne <span className="text-[#185FA5] font-medium">(accès via votre compte)</span>
        </p>
      </section>

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
            Télécharger le CCTP
            {lot.cctp_nom_fichier && <span className="text-xs text-gray-300">({lot.cctp_nom_fichier})</span>}
          </a>
        ) : (
          <p className="text-xs text-gray-400">Aucun CCTP fourni</p>
        )}
      </section>

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

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{errorMsg}</div>
      )}

      {submitted ? (
        <div className="bg-white border border-gray-200 rounded-lg p-5 text-center text-sm text-gray-500">
          Vous avez déjà soumis votre offre. Merci pour votre participation.
        </div>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={submitting || lignes.length === 0}
          className="w-full md:w-auto md:min-w-[260px] md:mx-auto block px-8 py-3 text-sm font-semibold text-white bg-gray-900 rounded-md hover:bg-black disabled:bg-gray-300"
        >
          {submitting ? 'Envoi en cours…' : 'Soumettre mon offre'}
        </button>
      )}
    </div>
  )
}
