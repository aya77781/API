'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ThumbsUp, ThumbsDown, X, Check, MessageSquare, FileSignature, Trophy, FileText,
  Mail, Phone, Building2, Calendar, Eye, Copy, Info, KeyRound, Link2, UserRound,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, cn } from '@/lib/utils'
import { generateDevisSTPdf, type DevisLigne } from '@/lib/pdf/devisST'
import { Abbr } from '@/components/shared/Abbr'

type Ligne = {
  id: string
  designation: string | null
  detail: string | null
  quantite: number | null
  unite: string | null
  prix_unitaire: number | null
  ordre: number
}

type Acces = {
  id: string
  user_id: string | null
  st_nom: string | null
  st_societe: string | null
  st_email: string | null
  st_telephone: string | null
  statut: 'envoye' | 'ouvert' | 'en_cours' | 'soumis' | 'retenu' | 'refuse'
  soumis_le: string | null
  ouvert_le: string | null
  date_limite: string | null
  token: string | null
  code_acces: string | null
  type_acces: 'externe' | 'interne'
  created_at: string
}

type OffreLigne = {
  acces_id: string
  chiffrage_ligne_id: string | null
  prix_unitaire: number | null
  total_ht: number | null
  montant_total_ht: number | null
  quantite: number | null
  quantite_modifiee: number | null
  unite_modifiee: string | null
  designation_modifiee: string | null
  est_modifie: boolean | null
  commentaire_st: string | null
  notes_st: string | null
}

type AtValidation = {
  dce_acces_id: string
  statut: string
  kbis_ok: boolean
  rib_ok: boolean
  attestation_ca_ok: boolean
  urssaf_ok: boolean
  fiscalite_ok: boolean
  rc_ok: boolean
  decennale_ok: boolean
}

const AT_REQUIRED_FIELDS: Array<keyof AtValidation> = [
  'kbis_ok','rib_ok','urssaf_ok','fiscalite_ok','rc_ok','decennale_ok',
]
function atScore(v: AtValidation | undefined): { done: number; total: number; complet: boolean } {
  if (!v) return { done: 0, total: AT_REQUIRED_FIELDS.length, complet: false }
  const done = AT_REQUIRED_FIELDS.filter(k => Boolean(v[k])).length
  return { done, total: AT_REQUIRED_FIELDS.length, complet: v.statut === 'complet' || done === AT_REQUIRED_FIELDS.length }
}


function uniteLabel(u: string | null): string {
  if (!u) return ''
  if (u === 'm2') return 'm²'
  if (u === 'm3') return 'm³'
  return u
}

export default function DceComparatifDetail({
  lotId,
  projetId,
  projetNom,
  projetReference,
  lotNom,
}: {
  lotId: string
  projetId: string
  projetNom?: string
  projetReference?: string | null
  lotNom?: string
}) {
  const supabase = useMemo(() => createClient(), [])
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [acces, setAcces] = useState<Acces[]>([])
  const [offresByAcces, setOffresByAcces] = useState<Record<string, Map<string, OffreLigne>>>({})
  const [loading, setLoading] = useState(true)
  const [actionModal, setActionModal] = useState<{ acces: Acces; decision: 'accepte' | 'refuse' } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [devisByAcces, setDevisByAcces] = useState<Set<string>>(new Set())
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [infoAcces, setInfoAcces] = useState<Acces | null>(null)
  const [atByAcces, setAtByAcces] = useState<Map<string, AtValidation>>(new Map())

  const refresh = useCallback(async () => {
    setLoading(true)
    const [{ data: lignesData }, { data: accesData }] = await Promise.all([
      supabase
        .from('chiffrage_lignes')
        .select('id, designation, detail, quantite, unite, prix_unitaire, ordre')
        .eq('lot_id', lotId)
        .order('ordre', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('dce_acces_st')
        .select('id, user_id, st_nom, st_societe, st_email, st_telephone, statut, soumis_le, ouvert_le, date_limite, token, code_acces, type_acces, created_at')
        .eq('lot_id', lotId)
        .in('statut', ['soumis', 'retenu', 'refuse']),
    ])

    setLignes((lignesData ?? []) as Ligne[])
    const accesRows = (accesData ?? []) as Acces[]
    setAcces(accesRows)

    if (accesRows.length > 0) {
      const accesIds = accesRows.map((a) => a.id)
      const [offresRes, devisRes, atRes] = await Promise.all([
        supabase
          .from('dce_offres_st')
          .select('acces_id, chiffrage_ligne_id, prix_unitaire, total_ht, montant_total_ht, quantite, quantite_modifiee, unite_modifiee, designation_modifiee, est_modifie, commentaire_st, notes_st')
          .in('acces_id', accesIds),
        supabase
          .from('devis')
          .select('acces_st_id')
          .in('acces_st_id', accesIds),
        supabase
          .schema('app')
          .from('at_sous_traitants')
          .select('dce_acces_id, statut, kbis_ok, rib_ok, attestation_ca_ok, urssaf_ok, fiscalite_ok, rc_ok, decennale_ok')
          .in('dce_acces_id', accesIds),
      ])
      const grouped: Record<string, Map<string, OffreLigne>> = {}
      ;(offresRes.data ?? []).forEach((o: any) => {
        if (!grouped[o.acces_id]) grouped[o.acces_id] = new Map()
        if (o.chiffrage_ligne_id) {
          grouped[o.acces_id].set(o.chiffrage_ligne_id, o as OffreLigne)
        }
      })
      setOffresByAcces(grouped)
      setDevisByAcces(new Set((devisRes.data ?? []).map((d: any) => d.acces_st_id)))
      const atMap = new Map<string, AtValidation>()
      ;(atRes.data ?? []).forEach((row: any) => {
        if (row.dce_acces_id) atMap.set(row.dce_acces_id, row as AtValidation)
      })
      setAtByAcces(atMap)
    } else {
      setOffresByAcces({})
      setDevisByAcces(new Set())
      setAtByAcces(new Map())
    }
    setLoading(false)
  }, [lotId, supabase])

  useEffect(() => {
    refresh()
  }, [refresh])

  // ── Totaux
  const ecoTotal = useMemo(
    () => lignes.reduce((s, l) => s + (Number(l.prix_unitaire) || 0) * (Number(l.quantite) || 0), 0),
    [lignes],
  )
  const stTotals = useMemo(() => {
    const map = new Map<string, number>()
    acces.forEach((a) => {
      const offres = offresByAcces[a.id]
      if (!offres) { map.set(a.id, 0); return }
      let total = 0
      lignes.forEach((l) => {
        const off = offres.get(l.id)
        if (off) total += Number(off.total_ht) || 0
      })
      map.set(a.id, total)
    })
    return map
  }, [acces, offresByAcces, lignes])

  if (loading) return <div className="text-xs text-gray-400 py-6 text-center">Chargement du comparatif…</div>
  if (lignes.length === 0) return <div className="text-xs text-gray-400 py-6 text-center">Aucune ligne de chiffrage pour ce lot</div>
  if (acces.length === 0) return <div className="text-xs text-gray-400 py-6 text-center">Aucune offre <Abbr k="DCE" /> soumise pour ce lot</div>

  return (
    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900">Comparatif détaillé — Économiste vs <Abbr k="ST" /></h4>
        <p className="text-xs text-gray-500 mt-0.5">Prix unitaires <Abbr k="HT" /> ligne par ligne</p>
      </div>

      {toast && (
        <div className="px-4 py-2 bg-green-50 border-b border-green-200 text-green-800 text-xs flex items-center gap-2">
          <Check className="w-3.5 h-3.5" />
          {toast}
          <button onClick={() => setToast(null)} className="ml-auto text-green-600 hover:text-green-800">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500">
              <th className="px-3 py-2 min-w-[180px] sticky left-0 bg-gray-50 z-10">Désignation</th>
              <th className="px-3 py-2 w-16 text-right">Qté</th>
              <th className="px-3 py-2 w-14">Unité</th>
              <th className="px-3 py-2 w-28 text-right bg-blue-50">Éco PU</th>
              <th className="px-3 py-2 w-28 text-right bg-blue-50">Éco Total</th>
              {acces.map((a) => {
                const name = a.st_societe || a.st_nom || a.st_email || (a.code_acces ? `Code ${a.code_acces}` : 'ST')
                const isRetenu = a.statut === 'retenu'
                const isRefuse = a.statut === 'refuse'
                const at = atByAcces.get(a.id)
                const score = atScore(at)
                return (
                  <th
                    key={a.id}
                    colSpan={3}
                    className={cn(
                      'px-3 py-2.5 text-center border-l',
                      isRetenu && 'bg-emerald-600 border-emerald-700 text-white',
                      isRefuse && 'bg-red-50 opacity-75 border-gray-200',
                      !isRetenu && !isRefuse && 'border-gray-200',
                    )}
                  >
                    <button
                      onClick={() => setInfoAcces(a)}
                      className="flex items-center justify-center gap-1.5 w-full hover:underline cursor-pointer"
                      title="Voir les infos du ST"
                    >
                      {isRetenu && <Trophy className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" aria-hidden />}
                      <span
                        className={cn(
                          'font-semibold truncate max-w-[140px]',
                          isRetenu ? 'text-white' : 'text-gray-800',
                        )}
                      >
                        {name}
                      </span>
                      {isRetenu && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-white text-emerald-700 rounded font-bold uppercase tracking-wider">
                          Retenu
                        </span>
                      )}
                      {isRefuse && <span className="text-[9px] px-1 py-0.5 bg-red-100 text-red-700 rounded">Refusé</span>}
                      <Info className={cn('w-3 h-3 flex-shrink-0 opacity-70', isRetenu ? 'text-white' : 'text-gray-500')} />
                    </button>
                    {/* Badge validation AT */}
                    <div className="mt-1 flex justify-center">
                      {!at ? (
                        <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-0.5',
                          isRetenu ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500')}
                          title="Aucune fiche AT pour ce ST">
                          AT : non assigne
                        </span>
                      ) : score.complet ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-0.5 bg-emerald-100 text-emerald-800"
                          title={`Validé par l'Assistante Travaux (${score.done}/${score.total} pieces)`}>
                          <Check className="w-2.5 h-2.5" /> AT validé
                        </span>
                      ) : (
                        <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-0.5',
                          score.done === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}
                          title={`Validation AT en cours : ${score.done}/${score.total} pieces`}>
                          AT : {score.done}/{score.total}
                        </span>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
            <tr className="text-left text-gray-400 text-[10px] uppercase tracking-wider">
              <th className="px-3 py-1 sticky left-0 bg-gray-50" />
              <th className="px-3 py-1" />
              <th className="px-3 py-1" />
              <th className="px-3 py-1 bg-blue-50" />
              <th className="px-3 py-1 bg-blue-50" />
              {acces.map((a) => (
                <Fragment key={`hdr-${a.id}`}>
                  <th className="px-2 py-1 text-right border-l border-gray-200">Qté ST</th>
                  <th className="px-2 py-1 text-right">PU</th>
                  <th className="px-2 py-1 text-right">Total</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const q = Number(l.quantite) || 0
              const ecoPU = Number(l.prix_unitaire) || 0
              const ecoTotal = ecoPU * q
              // Collecte des commentaires ST pour cette ligne
              const lineComments = acces.flatMap((a) => {
                const off = offresByAcces[a.id]?.get(l.id)
                const cmt = (off?.commentaire_st ?? '').trim()
                if (!cmt) return []
                return [{
                  acces: a,
                  commentaire: cmt,
                  isRetenu: a.statut === 'retenu',
                }]
              })
              return (
                <Fragment key={l.id}>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-900 sticky left-0 bg-white z-10">
                    <div className="font-medium truncate max-w-[220px]" title={l.designation ?? ''}>{l.designation}</div>
                    {l.detail && <div className="text-gray-400 text-[10px] truncate max-w-[220px]">{l.detail}</div>}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600 tabular-nums">{q || '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{uniteLabel(l.unite)}</td>
                  <td className="px-3 py-2 text-right text-gray-700 tabular-nums bg-blue-50/40">
                    {ecoPU > 0 ? formatCurrency(ecoPU) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900 tabular-nums font-medium bg-blue-50/40">
                    {ecoTotal > 0 ? formatCurrency(ecoTotal) : '—'}
                  </td>
                  {acces.map((a) => {
                    const off = offresByAcces[a.id]?.get(l.id)
                    const pu = Number(off?.prix_unitaire) || 0
                    const tt = Number(off?.total_ht) || 0
                    const stQ = off?.quantite_modifiee != null
                      ? Number(off.quantite_modifiee)
                      : Number(off?.quantite) || 0
                    const stQDiffers = stQ > 0 && q > 0 && Math.abs(stQ - q) > 0.001
                    const diff = ecoPU > 0 && pu > 0 ? (pu - ecoPU) / ecoPU : 0
                    const isHigher = diff > 0.05
                    const isLower = diff < -0.05
                    const isRetenu = a.statut === 'retenu'
                    const stUnite = off?.unite_modifiee || l.unite
                    const cmt = (off?.commentaire_st ?? '').trim()
                    return (
                      <Fragment key={`row-${a.id}-${l.id}`}>
                        <td
                          className={cn(
                            'px-2 py-2 text-right tabular-nums border-l',
                            isRetenu ? 'bg-emerald-50 border-emerald-200' : 'border-gray-200',
                            stQ === 0 && 'text-gray-300',
                            stQDiffers && !isRetenu && 'text-amber-700 font-medium',
                            isRetenu && 'text-emerald-900',
                          )}
                          title={
                            stQDiffers
                              ? `Quantite modifiee par le ST (${stQ} ${uniteLabel(stUnite)} vs ${q} ${uniteLabel(l.unite)} eco)${cmt ? `\n\nCommentaire : ${cmt}` : ''}`
                              : cmt
                                ? `Commentaire ST : ${cmt}`
                                : undefined
                          }
                        >
                          {stQ > 0 ? (
                            <span className="inline-flex items-center gap-1 justify-end">
                              {stQ}
                              {cmt && <MessageSquare className="w-3 h-3 text-gray-400" aria-label="Commentaire" />}
                            </span>
                          ) : '—'}
                        </td>
                        <td
                          className={cn(
                            'px-2 py-2 text-right tabular-nums',
                            isRetenu ? 'bg-emerald-50' : '',
                            pu === 0 && 'text-gray-300',
                            isHigher && !isRetenu && 'text-red-600',
                            isLower && !isRetenu && 'text-green-700',
                            isRetenu && 'font-medium text-emerald-900',
                          )}
                        >
                          {pu > 0 ? formatCurrency(pu) : '—'}
                        </td>
                        <td
                          className={cn(
                            'px-2 py-2 text-right tabular-nums',
                            isRetenu && 'bg-emerald-50 font-medium text-emerald-900',
                            tt === 0 && 'text-gray-300',
                          )}
                        >
                          {tt > 0 ? formatCurrency(tt) : '—'}
                        </td>
                      </Fragment>
                    )
                  })}
                </tr>
                {/* Sous-ligne : commentaires ST sur cette ligne */}
                {lineComments.length > 0 && (
                  <tr className="bg-amber-50/40 border-t border-amber-100">
                    <td colSpan={5 + acces.length * 3} className="px-3 py-2">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-1.5">
                          {lineComments.map(({ acces: a, commentaire, isRetenu }) => {
                            const name = a.st_societe || a.st_nom || (a.code_acces ? `Code ${a.code_acces}` : 'ST')
                            return (
                              <div key={`cmt-${a.id}-${l.id}`} className="text-xs">
                                <span className={cn(
                                  'font-semibold mr-2',
                                  isRetenu ? 'text-emerald-800' : 'text-amber-800',
                                )}>
                                  {isRetenu && '🏆 '}{name} :
                                </span>
                                <span className="text-gray-700 whitespace-pre-wrap">{commentaire}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
              )
            })}

            {/* Totaux */}
            <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
              <td colSpan={3} className="px-3 py-2.5 text-right text-gray-700 uppercase text-[10px] tracking-wider sticky left-0 bg-gray-100">
                TOTAL LOT <Abbr k="HT" />
              </td>
              <td className="px-3 py-2.5 bg-blue-100/60" />
              <td className="px-3 py-2.5 text-right text-gray-900 tabular-nums bg-blue-100/60">
                {formatCurrency(ecoTotal)}
              </td>
              {acces.map((a) => {
                const t = stTotals.get(a.id) ?? 0
                const diff = ecoTotal > 0 && t > 0 ? (t - ecoTotal) / ecoTotal : 0
                const isHigher = diff > 0
                const pct = ecoTotal > 0 ? (diff * 100).toFixed(1) : '0'
                const isRetenu = a.statut === 'retenu'
                return (
                  <Fragment key={`tot-${a.id}`}>
                    <td
                      className={cn(
                        'px-2 py-2.5 border-l',
                        isRetenu ? 'bg-emerald-200 border-emerald-400' : 'border-gray-200',
                      )}
                    />
                    <td
                      className={cn(
                        'px-2 py-2.5',
                        isRetenu ? 'bg-emerald-200 border-emerald-400' : '',
                      )}
                    />
                    <td
                      className={cn(
                        'px-2 py-2.5 text-right tabular-nums',
                        isRetenu && 'bg-emerald-200 text-emerald-900 font-bold',
                      )}
                    >
                      <div>{formatCurrency(t)}</div>
                      {ecoTotal > 0 && t > 0 && (
                        <div className={cn(
                          'text-[10px] font-normal',
                          isRetenu ? 'text-emerald-800' : isHigher ? 'text-red-600' : 'text-green-700',
                        )}>
                          {isHigher ? '+' : ''}{pct}% vs éco
                        </div>
                      )}
                    </td>
                  </Fragment>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Commentaires & notes ST */}
      {(() => {
        const notesByAcces = new Map<string, string>()
        const lineCommentsByAcces = new Map<string, Array<{ ligneId: string; designation: string; commentaire: string }>>()
        acces.forEach((a) => {
          const offres = offresByAcces[a.id]
          if (!offres) return
          let globalNote: string | null = null
          const lineCmts: Array<{ ligneId: string; designation: string; commentaire: string }> = []
          offres.forEach((off, ligneId) => {
            if (!globalNote && off.notes_st && off.notes_st.trim()) globalNote = off.notes_st.trim()
            const cmt = (off.commentaire_st ?? '').trim()
            if (cmt) {
              const ligne = lignes.find((l) => l.id === ligneId)
              lineCmts.push({
                ligneId,
                designation: ligne?.designation ?? '(ligne supprimee)',
                commentaire: cmt,
              })
            }
          })
          if (globalNote) notesByAcces.set(a.id, globalNote)
          if (lineCmts.length > 0) lineCommentsByAcces.set(a.id, lineCmts)
        })
        const hasAnyComments = notesByAcces.size > 0 || lineCommentsByAcces.size > 0
        if (!hasAnyComments) return null
        return (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
              <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Commentaires & remarques des <Abbr k="ST" />
              </h5>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {acces.map((a) => {
                const note = notesByAcces.get(a.id)
                const lineCmts = lineCommentsByAcces.get(a.id) ?? []
                if (!note && lineCmts.length === 0) return null
                const name = a.st_societe || a.st_nom || (a.code_acces ? `Code ${a.code_acces}` : 'ST')
                const isRetenu = a.statut === 'retenu'
                return (
                  <div
                    key={`cmt-${a.id}`}
                    className={cn(
                      'rounded-md border bg-white p-3 text-xs',
                      isRetenu ? 'border-emerald-300 bg-emerald-50/40' : 'border-gray-200',
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      {isRetenu && <Trophy className="w-3 h-3 text-amber-500" />}
                      <span className="font-semibold text-gray-900 truncate">{name}</span>
                    </div>
                    {note && (
                      <div className="mb-2">
                        <p className="text-[10px] uppercase text-gray-400 tracking-wider mb-0.5">Note generale</p>
                        <p className="text-gray-700 whitespace-pre-wrap leading-snug">{note}</p>
                      </div>
                    )}
                    {lineCmts.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase text-gray-400 tracking-wider mb-0.5">
                          Commentaires par ligne ({lineCmts.length})
                        </p>
                        <ul className="space-y-1">
                          {lineCmts.map((c) => (
                            <li key={c.ligneId} className="text-gray-700">
                              <span className="font-medium text-gray-900">{c.designation}</span>
                              <span className="text-gray-400"> — </span>
                              <span className="whitespace-pre-wrap">{c.commentaire}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Bandeau ST retenus — très visible */}
      {acces.filter((a) => a.statut === 'retenu').map((a) => {
        const name = a.st_societe || a.st_nom || 'ST'
        const hasDevis = devisByAcces.has(a.id)
        const total = stTotals.get(a.id) ?? 0
        const isGenerating = generatingId === a.id
        return (
          <div
            key={`retenu-${a.id}`}
            className="border-t-2 border-emerald-500 bg-emerald-50 px-4 py-3 flex items-center gap-3 flex-wrap"
          >
            <button
              onClick={() => setInfoAcces(a)}
              className="flex items-center gap-2 flex-shrink-0 hover:opacity-80"
              title="Voir les infos du ST"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-amber-300" />
              </div>
              <div className="text-left">
                <p className="text-[11px] text-emerald-700 uppercase tracking-wider font-semibold leading-none"><Abbr k="ST" /> retenu</p>
                <p className="text-sm font-semibold text-emerald-900 mt-0.5 flex items-center gap-1">
                  {name}
                  <Info className="w-3 h-3 text-emerald-700" />
                </p>
              </div>
            </button>
            <div className="text-xs text-emerald-800 border-l border-emerald-300 pl-3">
              Montant <Abbr k="HT" /> retenu :{' '}
              <span className="font-semibold text-emerald-900">{formatCurrency(total)}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {hasDevis ? (
                <span className="flex items-center gap-1.5 text-xs text-emerald-800 bg-white border border-emerald-300 rounded-md px-2.5 py-1.5 font-medium">
                  <FileSignature className="w-3.5 h-3.5" />
                  Devis généré — voir onglet <strong>Devis final</strong>
                </span>
              ) : (
                <button
                  onClick={async () => {
                    setGeneratingId(a.id)
                    try {
                      const offres = offresByAcces[a.id]
                      await generateAndUploadInitial(a, offres, lignes, total)
                      setToast(`Devis généré pour ${name} — voir onglet "Devis final".`)
                      await refresh()
                    } catch (e: any) {
                      setToast(`Échec génération devis : ${e?.message ?? 'erreur'}`)
                    }
                    setGeneratingId(null)
                    setTimeout(() => setToast(null), 5000)
                  }}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 border border-emerald-700 rounded-md hover:bg-emerald-700 disabled:opacity-60"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {isGenerating ? 'Génération…' : 'Générer le devis final'}
                </button>
              )}
            </div>
          </div>
        )
      })}

      {/* Actions par ST (en attente de décision) */}
      {acces.some((a) => a.statut !== 'retenu' && a.statut !== 'refuse') && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex flex-wrap gap-2">
          {acces.map((a) => {
            const name = a.st_societe || a.st_nom || (a.code_acces ? `Code ${a.code_acces}` : 'ST')
            const isFinal = a.statut === 'retenu' || a.statut === 'refuse'
            if (isFinal) return null
            const at = atByAcces.get(a.id)
            const score = atScore(at)
            const atRefuse = (at as unknown as { statut?: string } | undefined)?.statut === 'refuse'
            const atOk = score.complet && !atRefuse
            return (
              <div key={a.id} className="flex items-center gap-1 bg-white border border-gray-200 rounded-md px-2 py-1">
                <button
                  onClick={() => setInfoAcces(a)}
                  className="flex items-center gap-1 text-xs text-gray-800 font-medium mr-1 hover:text-gray-900 hover:underline"
                  title="Voir les infos du ST"
                >
                  {name}
                  <Info className="w-3 h-3 text-gray-400" />
                </button>
                <button
                  onClick={() => atOk && setActionModal({ acces: a, decision: 'accepte' })}
                  disabled={!atOk}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 text-xs rounded',
                    atOk
                      ? 'text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 cursor-pointer'
                      : 'text-gray-400 border border-gray-200 bg-gray-50 cursor-not-allowed'
                  )}
                  title={
                    atRefuse
                      ? 'Impossible : ce ST a ete refuse par l\'Assistante Travaux'
                      : !at
                      ? 'Validation AT requise avant acceptation'
                      : !atOk
                      ? `Validation AT incomplete (${score.done}/${score.total} pieces)`
                      : 'Accepter cette offre'
                  }
                >
                  <ThumbsUp className="w-3 h-3" />
                  Accepter
                  {!atOk && <span className="ml-1 text-[10px] opacity-70">{atRefuse ? 'AT KO' : `AT ${score.done}/${score.total}`}</span>}
                </button>
                <button
                  onClick={() => setActionModal({ acces: a, decision: 'refuse' })}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-red-700 border border-red-200 bg-red-50 rounded hover:bg-red-100"
                  title="Refuser cette offre"
                >
                  <ThumbsDown className="w-3 h-3" />
                  Refuser
                </button>
              </div>
            )
          })}
        </div>
      )}

      {actionModal && (
        <DecisionModal
          projetId={projetId}
          lotId={lotId}
          acces={actionModal.acces}
          decision={actionModal.decision}
          onClose={() => setActionModal(null)}
          onDone={async (msg, decision) => {
            setActionModal(null)
            // Auto-génération du devis PDF si la décision est "accepte".
            if (decision === 'accepte') {
              try {
                const offres = offresByAcces[actionModal.acces.id]
                const total = stTotals.get(actionModal.acces.id) ?? 0
                await generateAndUploadInitial(actionModal.acces, offres, lignes, total)
                setToast(`${msg} — devis généré dans "Devis final".`)
              } catch (e: any) {
                setToast(`${msg} (échec génération devis : ${e?.message ?? 'erreur'})`)
              }
            } else {
              setToast(msg)
            }
            await refresh()
            setTimeout(() => setToast(null), 5000)
          }}
        />
      )}

      {infoAcces && (() => {
        const at = atByAcces.get(infoAcces.id)
        const score = atScore(at)
        const atRefuse = (at as unknown as { statut?: string } | undefined)?.statut === 'refuse'
        const atOk = score.complet && !atRefuse
        const blockedReason = atRefuse
          ? "Ce ST a ete refuse par l'Assistante Travaux."
          : !at
          ? "Aucune validation AT pour ce ST."
          : !atOk
          ? `Validation AT incomplete : ${score.done}/${score.total} pieces validees.`
          : null
        return (
        <STInfoDrawer
          acces={infoAcces}
          total={stTotals.get(infoAcces.id) ?? 0}
          ecoTotal={ecoTotal}
          atBlockedReason={blockedReason}
          onClose={() => setInfoAcces(null)}
          onAccepter={() => { if (atOk) { setInfoAcces(null); setActionModal({ acces: infoAcces, decision: 'accepte' }) } }}
          onRefuser={() => { setInfoAcces(null); setActionModal({ acces: infoAcces, decision: 'refuse' }) }}
          onAnnulerDecision={async () => {
            const a = infoAcces
            const prevStatut = a.statut
            const label = a.st_societe || a.st_nom || 'ce ST'
            const confirmMsg = prevStatut === 'retenu'
              ? `Annuler la sélection de ${label} ?\n\nL'offre repassera au statut "soumis" et le devis associé sera annulé.`
              : `Annuler le refus de ${label} ?\n\nL'offre repassera au statut "soumis".`
            if (!confirm(confirmMsg)) return

            // 1. Remet l'acces au statut "soumis"
            const { error: e1 } = await supabase
              .from('dce_acces_st' as never)
              .update({ statut: 'soumis' } as never)
              .eq('id', a.id)
            if (e1) { setToast(`Erreur : ${e1.message}`); return }

            // 2. Si retenu : annule le devis associé
            if (prevStatut === 'retenu') {
              await supabase
                .from('devis' as never)
                .update({ statut: 'annule' } as never)
                .eq('acces_st_id', a.id)
                .eq('statut', 'brouillon')
              // Retire le ST retenu du lot si on avait lie
              await supabase
                .schema('app')
                .from('lots')
                .update({ st_retenu_id: null } as never)
                .eq('id', lotId)
                .eq('st_retenu_id', a.user_id ?? '')
            }

            setInfoAcces(null)
            setToast(prevStatut === 'retenu'
              ? `Sélection de ${label} annulée — devis mis en "annulé".`
              : `Refus de ${label} annulé.`)
            await refresh()
            setTimeout(() => setToast(null), 4000)
          }}
        />
        )
      })()}
    </div>
  )

  // ── Génération PDF + upload initial (exécuté automatiquement à l'acceptation)
  async function generateAndUploadInitial(
    a: Acces,
    offres: Map<string, OffreLigne> | undefined,
    lignesList: Ligne[],
    total: number,
  ) {
    if (!offres) throw new Error('Aucune offre trouvée')
    const devisLignes: DevisLigne[] = lignesList.map((l) => {
      const off = offres.get(l.id)
      return {
        designation: l.designation ?? '',
        detail: l.detail,
        quantite: Number(l.quantite) || 0,
        unite: l.unite ?? '',
        prix_unitaire: Number(off?.prix_unitaire) || 0,
      }
    })

    const blob = generateDevisSTPdf({
      projet_nom: projetNom ?? 'Projet',
      projet_reference: projetReference ?? null,
      lot_nom: lotNom ?? 'Lot',
      st_societe: a.st_societe,
      st_nom: a.st_nom,
      st_email: a.st_email,
      st_telephone: null,
      lignes: devisLignes,
      total_ht: total,
    })

    const path = `dce-devis/${projetId}/${a.id}/devis-${Date.now()}.pdf`
    const { error: upErr } = await supabase.storage
      .from('documents')
      .upload(path, blob, { contentType: 'application/pdf', upsert: true })
    if (upErr) throw upErr
    const { data: pub } = supabase.storage.from('documents').getPublicUrl(path)

    const { error: insErr } = await supabase.from('st_devis_signatures' as never).upsert({
      acces_id: a.id,
      projet_id: projetId,
      lot_id: lotId,
      montant_ht: total,
      devis_url: pub.publicUrl,
      statut: 'genere',
    } as never, { onConflict: 'acces_id' })
    if (insErr) throw insErr

    // Nouveau modèle : alimente la table `devis` pour l'onglet "Devis final".
    // Snapshot des lignes telles qu'elles ont été remplies par le ST (dce_offres_st).
    const { data: offresRows } = await supabase
      .from('dce_offres_st')
      .select('designation, quantite, unite, prix_unitaire, total_ht')
      .eq('acces_id', a.id)

    const lignesSnapshot = (offresRows ?? []).map((o: any) => ({
      designation: o.designation ?? '',
      quantite: Number(o.quantite) || 0,
      unite: o.unite ?? '',
      prix_unitaire: Number(o.prix_unitaire) || 0,
      total_ht: Number(o.total_ht) || 0,
    }))
    const tvaPct = 10
    const montantTtc = Math.round(total * (1 + tvaPct / 100) * 100) / 100

    const existingRes = await supabase
      .from('devis')
      .select('id, numero')
      .eq('acces_st_id', a.id)
      .maybeSingle()
    const existing = existingRes.data as { id: string; numero: string | null } | null

    let numero: string | null = existing?.numero ?? null
    if (!numero) {
      const { data: num } = await supabase.rpc('next_devis_numero')
      numero = (num as unknown as string) ?? null
    }

    await supabase.from('devis').upsert(
      {
        projet_id: projetId,
        lot_id: lotId,
        acces_st_id: a.id,
        st_nom: a.st_nom ?? '',
        st_societe: a.st_societe,
        st_email: a.st_email,
        montant_ht: total,
        tva_pct: tvaPct,
        montant_ttc: montantTtc,
        lignes: lignesSnapshot,
        statut: 'brouillon',
        numero,
      } as never,
      { onConflict: 'acces_st_id' },
    )
  }
}


// ─── Modal Décision + message ───────────────────────────────────────────────

function DecisionModal({
  projetId,
  lotId,
  acces,
  decision,
  onClose,
  onDone,
}: {
  projetId: string
  lotId: string
  acces: Acces
  decision: 'accepte' | 'refuse'
  onClose: () => void
  onDone: (toast: string, decision: 'accepte' | 'refuse') => Promise<void>
}) {
  const supabase = useMemo(() => createClient(), [])
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://api-1-aj7d.onrender.com'
  // Pour un ST externe accepté : on regénère un mdp même si un compte existe déjà
  // (le ST peut avoir oublié / jamais reçu ses identifiants).
  const needsAccount = decision === 'accepte' && acces.type_acces === 'externe' && !!acces.st_email
  const defaultMsg =
    decision === 'accepte'
      ? `Bonjour,\n\nNous avons le plaisir de vous informer que votre offre pour ce lot a été retenue. Nous reviendrons vers vous pour la suite.\n\nCordialement.`
      : `Bonjour,\n\nNous vous remercions pour votre offre. Après étude comparative, nous avons retenu une autre proposition pour ce lot.\n\nNous restons à votre écoute pour de futures consultations.`
  const [message, setMessage] = useState(defaultMsg)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null)
  const [alreadyLinked, setAlreadyLinked] = useState<{ email: string } | null>(null)
  const [preparing, setPreparing] = useState(false)

  function injectCredsInMessage(email: string, password: string) {
    setMessage((prev) => {
      const block =
        `\n\n— — — — — —\n` +
        `Vos identifiants pour accéder à notre plateforme :\n\n` +
        `  • Adresse : ${APP_URL}\n` +
        `  • Email : ${email}\n` +
        `  • Mot de passe : ${password}\n\n` +
        `Vous pourrez changer votre mot de passe après connexion.`
      return prev.includes('Mot de passe :') ? prev : prev + block
    })
  }

  async function callCreateApi(forceRegenerate = false) {
    setPreparing(true)
    try {
      const r = await fetch('/api/st/create-from-dce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acces_id: acces.id, force_regenerate: forceRegenerate }),
      })
      const res = await r.json()
      setPreparing(false)
      if (res?.error) { setError(`Création compte : ${res.error}`); return }
      if (res?.email && res?.password) {
        setCreds({ email: res.email, password: res.password })
        setAlreadyLinked(null)
        injectCredsInMessage(res.email, res.password)
      } else if (res?.already_linked && res?.email) {
        setAlreadyLinked({ email: res.email })
      }
    } catch (e: any) {
      setPreparing(false)
      setError(`Création compte : ${e?.message ?? 'erreur réseau'}`)
    }
  }

  useEffect(() => {
    if (!needsAccount) return
    callCreateApi(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function confirm() {
    if (!message.trim()) {
      setError('Le message ne peut pas être vide.')
      return
    }
    setSaving(true)
    setError(null)

    const newStatut = decision === 'accepte' ? 'retenu' : 'refuse'
    const name = acces.st_societe || acces.st_nom || 'ST'

    // 1) Maj du statut de l'invitation DCE
    const { error: e1 } = await supabase
      .from('dce_acces_st' as never)
      .update({ statut: newStatut } as never)
      .eq('id', acces.id)
    if (e1) { setError(`Maj statut : ${e1.message}`); setSaving(false); return }

    // Recharge user_id (le compte vient peut-etre d'etre cree par l'API)
    const { data: refreshed } = await supabase
      .from('dce_acces_st')
      .select('user_id')
      .eq('id', acces.id)
      .maybeSingle()
    const linkedUserId = (refreshed as { user_id: string | null } | null)?.user_id ?? acces.user_id

    // 2) Trace de la décision dans app.echanges_st.
    // Les FK lot_id -> app.lots et st_id -> app.sous_traitants ne correspondent
    // pas aux ids DCE (public.lots / app.utilisateurs). On laisse null pour éviter
    // les 409 sur contraintes FK incompatibles.
    await supabase.schema('app').from('echanges_st').insert({
      projet_id: projetId,
      lot_id: null,
      st_id: null,
      type: 'autre',
      contenu: message.trim(),
      decision: decision === 'accepte' ? 'accepte' : 'refuse',
      motif_decision: null,
    })

    // 3) Notification pour l'utilisateur ST (si lié a un compte).
    if (linkedUserId) {
      await supabase.schema('app').from('alertes').insert({
        projet_id: projetId,
        utilisateur_id: linkedUserId,
        type: decision === 'accepte' ? 'offre_acceptee' : 'offre_refusee',
        titre: decision === 'accepte' ? 'Votre offre a été retenue' : 'Offre non retenue',
        message: message.trim(),
        priorite: decision === 'accepte' ? 'high' : 'normal',
      })
    }

    setSaving(false)
    await onDone(
      decision === 'accepte'
        ? `Offre de ${name} acceptée — message envoyé.`
        : `Offre de ${name} refusée — message envoyé.`,
      decision,
    )
  }

  const isAccept = decision === 'accepte'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">
            {isAccept ? 'Accepter l\'offre' : 'Refuser l\'offre'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="text-xs text-gray-500">
            Destinataire :{' '}
            <span className="text-gray-900 font-medium">{acces.st_societe || acces.st_nom || acces.st_email}</span>
            {!acces.user_id && !needsAccount && (
              <span className="ml-2 text-amber-700 text-[11px]">
                (utilisateur non lié à un compte — message transmis par email uniquement)
              </span>
            )}
          </div>

          {/* Compte auto-créé à l'acceptation d'un ST externe */}
          {needsAccount && (
            <div className={cn(
              'rounded-md border px-3 py-2 text-xs flex items-start gap-2',
              preparing
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : creds
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : alreadyLinked
                    ? 'bg-gray-50 border-gray-200 text-gray-700'
                    : 'bg-amber-50 border-amber-200 text-amber-800',
            )}>
              <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                {preparing && 'Préparation du compte ST…'}
                {creds && (
                  <>
                    <p className="font-medium">Compte prêt — {creds.email}</p>
                    <p className="mt-0.5 text-[11px]">
                      Identifiants ajoutés au message ci-dessous. Le ST pourra se connecter sur {APP_URL}.
                    </p>
                  </>
                )}
                {alreadyLinked && !creds && (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-medium text-gray-900">Compte déjà actif — {alreadyLinked.email}</p>
                      <p className="mt-0.5 text-[11px]">
                        Le ST a déjà ses identifiants. Régénérez un nouveau mot de passe pour le ré-inclure dans le message.
                      </p>
                    </div>
                    <button
                      onClick={() => callCreateApi(true)}
                      className="text-xs px-2.5 py-1 bg-gray-900 text-white rounded hover:bg-black flex-shrink-0"
                    >
                      Régénérer le mot de passe
                    </button>
                  </div>
                )}
                {!preparing && !creds && !alreadyLinked && !error && 'Compte ST à préparer…'}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" />
              Message au sous-traitant
            </label>
            <textarea
              rows={10}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 resize-y font-mono"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-2 text-xs">{error}</div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
          <button
            onClick={confirm}
            disabled={saving}
            className={cn(
              'px-4 py-1.5 text-sm font-medium text-white rounded-md disabled:opacity-50 flex items-center gap-1.5',
              isAccept ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700',
            )}
          >
            {isAccept ? <ThumbsUp className="w-3.5 h-3.5" /> : <ThumbsDown className="w-3.5 h-3.5" />}
            {saving ? 'Envoi…' : isAccept ? 'Accepter et notifier' : 'Refuser et notifier'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ─── Drawer Infos ST ─────────────────────────────────────────────────────────

function STInfoDrawer({
  acces,
  total,
  ecoTotal,
  atBlockedReason,
  onClose,
  onAccepter,
  onRefuser,
  onAnnulerDecision,
}: {
  acces: Acces
  total: number
  ecoTotal: number
  atBlockedReason: string | null
  onClose: () => void
  onAccepter: () => void
  onRefuser: () => void
  onAnnulerDecision: () => void | Promise<void>
}) {
  const [copiedKey, setCopiedKey] = useState<'code' | 'link' | 'email' | 'pwd' | null>(null)
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://api-1-aj7d.onrender.com'
  const isInterne = acces.type_acces === 'interne'
  const directLink = acces.token ? `${APP_URL}/dce/${acces.token}` : null
  const [pwd, setPwd] = useState<string | null>(null)
  const [pwdBusy, setPwdBusy] = useState(false)
  const [pwdErr, setPwdErr] = useState<string | null>(null)

  async function regeneratePwd() {
    setPwdBusy(true)
    setPwdErr(null)
    try {
      const r = await fetch('/api/st/create-from-dce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acces_id: acces.id, force_regenerate: true }),
      })
      const res = await r.json()
      if (res?.password) setPwd(res.password)
      else if (res?.error) setPwdErr(res.error)
    } catch (e: any) {
      setPwdErr(e?.message ?? 'erreur réseau')
    }
    setPwdBusy(false)
  }

  function copy(kind: 'code' | 'link' | 'email' | 'pwd', value: string) {
    navigator.clipboard.writeText(value)
    setCopiedKey(kind)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  function fmtDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const diff = ecoTotal > 0 && total > 0 ? (total - ecoTotal) / ecoTotal : 0
  const pct = (diff * 100).toFixed(1)

  const statutStyle: Record<Acces['statut'], string> = {
    envoye:   'bg-blue-50 text-blue-700 border-blue-200',
    ouvert:   'bg-indigo-50 text-indigo-700 border-indigo-200',
    en_cours: 'bg-amber-50 text-amber-700 border-amber-200',
    soumis:   'bg-orange-50 text-orange-700 border-orange-200',
    retenu:   'bg-emerald-50 text-emerald-700 border-emerald-200',
    refuse:   'bg-red-50 text-red-700 border-red-200',
  }

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="ml-auto bg-white shadow-xl w-full max-w-md h-full overflow-y-auto relative"
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              isInterne ? 'bg-[#E6F1FB] text-[#185FA5]' : 'bg-[#F1EFE8] text-[#5F5E5A]',
            )}>
              <UserRound className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Sous-traitant</p>
              <p className="text-[11px] text-gray-500">
                {isInterne ? 'Accès interne' : 'Accès externe'}
                {' · '}
                <span className={cn('inline-block px-1.5 py-0 text-[10px] rounded border font-medium', statutStyle[acces.statut])}>
                  {acces.statut}
                </span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <section>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">Identité</p>
            <div className="space-y-1 text-sm">
              <p className="text-gray-900 font-medium flex items-center gap-2">
                <UserRound className="w-3.5 h-3.5 text-gray-400" />
                {acces.st_nom || <span className="text-gray-400 italic">Non renseigné</span>}
              </p>
              {acces.st_societe && (
                <p className="text-gray-700 flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  {acces.st_societe}
                </p>
              )}
              {acces.st_email && (
                <p className="text-gray-700 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  <a href={`mailto:${acces.st_email}`} className="hover:underline">{acces.st_email}</a>
                </p>
              )}
              {acces.st_telephone && (
                <p className="text-gray-700 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  <a href={`tel:${acces.st_telephone}`} className="hover:underline">{acces.st_telephone}</a>
                </p>
              )}
            </div>
          </section>

          {!isInterne && (
            <section>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">Accès <Abbr k="DCE" /></p>
              <div className="space-y-2">
                {acces.code_acces && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    <KeyRound className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                    <code className="flex-1 text-sm font-mono font-bold text-amber-900 tracking-widest">
                      {acces.code_acces}
                    </code>
                    <button
                      onClick={() => copy('code', acces.code_acces!)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-amber-600 rounded hover:bg-amber-700"
                    >
                      {copiedKey === 'code' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedKey === 'code' ? 'Copié' : 'Copier'}
                    </button>
                  </div>
                )}
                {directLink && (
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                    <Link2 className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                    <code className="flex-1 text-xs text-gray-700 truncate">{directLink}</code>
                    <button
                      onClick={() => copy('link', directLink)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-gray-900 rounded hover:bg-black"
                    >
                      {copiedKey === 'link' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedKey === 'link' ? 'Copié' : 'Copier'}
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Identifiants plateforme : visible si ST retenu + compte lié */}
          {acces.statut === 'retenu' && acces.user_id && !isInterne && (
            <section>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
                Identifiants plateforme
              </p>
              <div className="space-y-2">
                {acces.st_email && (
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                    <Mail className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                    <code className="flex-1 text-xs text-gray-800 truncate">{acces.st_email}</code>
                    <button
                      onClick={() => copy('email', acces.st_email!)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 border border-gray-200 rounded hover:bg-white"
                    >
                      {copiedKey === 'email' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedKey === 'email' ? 'Copié' : 'Copier'}
                    </button>
                  </div>
                )}
                {pwd ? (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                    <code className="flex-1 text-sm font-mono font-bold text-emerald-900 tracking-wider">
                      {pwd}
                    </code>
                    <button
                      onClick={() => copy('pwd', pwd)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-emerald-600 rounded hover:bg-emerald-700"
                    >
                      {copiedKey === 'pwd' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedKey === 'pwd' ? 'Copié' : 'Copier'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={regeneratePwd}
                    disabled={pwdBusy}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:opacity-60"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    {pwdBusy ? 'Génération…' : 'Générer / voir le mot de passe'}
                  </button>
                )}
                {pwdErr && (
                  <p className="text-[11px] text-red-600">{pwdErr}</p>
                )}
                {pwd && (
                  <p className="text-[11px] text-gray-400">
                    Le mot de passe précédent a été remplacé — communiquez le nouveau au <Abbr k="ST" />.
                  </p>
                )}
              </div>
            </section>
          )}

          <section>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">Montant de l&apos;offre</p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total proposé HT</span>
                <span className="tabular-nums font-semibold text-gray-900">{formatCurrency(total)}</span>
              </div>
              {ecoTotal > 0 && total > 0 && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Estimation économiste</span>
                    <span className="tabular-nums text-gray-600">{formatCurrency(ecoTotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-gray-200">
                    <span className="text-gray-500">Écart vs économiste</span>
                    <span className={cn(
                      'tabular-nums font-medium',
                      diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-700' : 'text-gray-600',
                    )}>
                      {diff > 0 ? '+' : ''}{pct}%
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>

          <section>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">Chronologie</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-3 h-3 text-gray-400" />
                Invité le <span className="text-gray-900 ml-1">{fmtDate(acces.created_at)}</span>
              </div>
              {acces.ouvert_le && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Eye className="w-3 h-3 text-gray-400" />
                  Ouvert le <span className="text-gray-900 ml-1">{fmtDate(acces.ouvert_le)}</span>
                </div>
              )}
              {acces.soumis_le && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Check className="w-3 h-3 text-gray-400" />
                  Soumis le <span className="text-gray-900 ml-1">{fmtDate(acces.soumis_le)}</span>
                </div>
              )}
              {acces.date_limite && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  Date limite <span className="text-gray-900 ml-1">
                    {new Date(acces.date_limite).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
          </section>

          {acces.statut !== 'retenu' && acces.statut !== 'refuse' && (
            <section className="pt-3 border-t border-gray-100 space-y-2">
              {atBlockedReason && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
                  <X className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Acceptation bloquee</p>
                    <p className="text-xs text-amber-700 mt-0.5">{atBlockedReason}</p>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={onAccepter}
                  disabled={!!atBlockedReason}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md',
                    atBlockedReason
                      ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                      : 'text-white bg-emerald-600 hover:bg-emerald-700',
                  )}
                  title={atBlockedReason ?? 'Accepter cette offre'}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  Accepter
                </button>
                <button
                  onClick={onRefuser}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  Refuser
                </button>
              </div>
            </section>
          )}

          {(acces.statut === 'retenu' || acces.statut === 'refuse') && (
            <section className="pt-3 border-t border-gray-100">
              <button
                onClick={onAnnulerDecision}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                title={acces.statut === 'retenu'
                  ? 'Annule la sélection — le devis associé sera mis en "annulé"'
                  : 'Annule le refus — le ST repasse en "soumis"'}
              >
                <X className="w-3.5 h-3.5" />
                Annuler cette décision
              </button>
              <p className="text-[11px] text-gray-400 mt-1.5 text-center">
                {acces.statut === 'retenu'
                  ? 'Le ST reviendra en "soumis" et le devis généré sera annulé.'
                  : 'Le ST reviendra en "soumis" et pourra être accepté/refusé à nouveau.'}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
