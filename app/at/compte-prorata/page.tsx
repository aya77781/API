'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Plus, X, Upload, FileText, Download, Trash2, Check,
  Landmark, Users, Receipt, AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { Abbr } from '@/components/shared/Abbr'
import { cn } from '@/lib/utils'

/* ── Types ── */

interface ProjetOpt { id: string; nom: string; reference: string | null }

interface DIC {
  id: string
  projet_id: string
  date_depense: string
  libelle: string
  montant_ht: number
  tva_pct: number | null
  montant_ttc: number | null
  justificatif_url: string | null
  created_at: string
}

interface Paiement {
  id: string
  projet_id: string
  st_id: string | null
  montant_du: number | null
  montant_paye: number | null
  statut: 'non_paye' | 'partiel' | 'paye'
  date_paiement: string | null
}

interface Lot {
  id: string
  numero: number
  corps_etat: string
  budget_final: number | null
  budget_prevu: number | null
  st_retenu_id: string | null
}

interface ST {
  id: string
  nom: string
  corps_etat: string | null
}

/* ── Constantes ── */

const LIBELLES_COURANTS = [
  'Eau (compteur provisoire)',
  'Electricite (branchement provisoire)',
  'Nettoyage parties communes',
  'Bennes a gravats',
  'Protection sols',
  'Autre',
]

const STATUT_PAIEMENT_STYLE: Record<string, string> = {
  non_paye: 'bg-[#FCEBEB] text-[#A32D2D]',
  partiel: 'bg-[#FAEEDA] text-[#854F0B]',
  paye: 'bg-[#EAF3DE] text-[#3B6D11]',
}

const STATUT_PAIEMENT_LABEL: Record<string, string> = {
  non_paye: 'Non paye',
  partiel: 'Partiel',
  paye: 'Paye',
}

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10'

/* ── Page ── */

export default function ComptePr1orataPage() {
  const supabase = useMemo(() => createClient(), [])
  const [projets, setProjets] = useState<ProjetOpt[]>([])
  const [projetId, setProjetId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [dics, setDics] = useState<DIC[]>([])
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [sts, setSts] = useState<ST[]>([])
  const [showModal, setShowModal] = useState(false)

  // Charger les projets
  useEffect(() => {
    supabase.schema('app').from('projets').select('id, nom, reference').order('nom')
      .then(({ data }) => {
        const list = (data ?? []) as ProjetOpt[]
        setProjets(list)
        if (list.length && !projetId) setProjetId(list[0].id)
      })
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Charger les donnees du projet selectionne
  const loadProjet = useCallback(async () => {
    if (!projetId) return
    setLoading(true)
    const [dicRes, paiementsRes, lotsRes] = await Promise.all([
      supabase.schema('app').from('compte_prorata_dic').select('*').eq('projet_id', projetId).order('date_depense', { ascending: false }),
      supabase.schema('app').from('compte_prorata_paiements').select('*').eq('projet_id', projetId),
      supabase.schema('app').from('lots').select('id, numero, corps_etat, budget_final, budget_prevu, st_retenu_id').eq('projet_id', projetId).not('st_retenu_id', 'is', null),
    ])

    const lotsData = (lotsRes.data ?? []) as Lot[]
    setLots(lotsData)
    setDics((dicRes.data ?? []) as DIC[])
    setPaiements((paiementsRes.data ?? []) as Paiement[])

    const stIds = lotsData.map(l => l.st_retenu_id).filter(Boolean) as string[]
    if (stIds.length) {
      const { data: stData } = await supabase.schema('app').from('at_sous_traitants').select('id, nom, corps_etat').in('id', stIds)
      setSts((stData ?? []) as ST[])
    } else {
      setSts([])
    }
    setLoading(false)
  }, [projetId, supabase])

  useEffect(() => { loadProjet() }, [loadProjet])

  // Calculs
  const totalDicHt = dics.reduce((s, d) => s + (Number(d.montant_ht) || 0), 0)
  const totalDicTtc = dics.reduce((s, d) => s + (Number(d.montant_ttc) || (Number(d.montant_ht) * (1 + (Number(d.tva_pct) || 20) / 100))), 0)
  const totalMarches = lots.reduce((s, l) => s + (Number(l.budget_final) || Number(l.budget_prevu) || 0), 0)

  // Solde = total verse par ST - total DIC
  const totalVerseParSt = paiements.reduce((s, p) => s + (Number(p.montant_paye) || 0), 0)
  const solde = totalVerseParSt - totalDicTtc

  // Quote-part par ST
  const quoteParts = lots.map(lot => {
    const st = sts.find(s => s.id === lot.st_retenu_id)
    const budgetLot = Number(lot.budget_final) || Number(lot.budget_prevu) || 0
    const pct = totalMarches > 0 ? (budgetLot / totalMarches) * 100 : 0
    const quotePart = totalMarches > 0 ? (budgetLot / totalMarches) * totalDicTtc : 0
    const paiement = paiements.find(p => p.st_id === lot.st_retenu_id)
    const paye = Number(paiement?.montant_paye) || 0
    const reste = Math.max(0, quotePart - paye)
    let statut: 'non_paye' | 'partiel' | 'paye' = 'non_paye'
    if (paye >= quotePart && quotePart > 0) statut = 'paye'
    else if (paye > 0) statut = 'partiel'
    return { lot, st, budgetLot, pct, quotePart, paiement, paye, reste, statut }
  })

  const projetActuel = projets.find(p => p.id === projetId)

  async function createDic(dic: { date_depense: string; libelle: string; montant_ht: number; tva_pct: number; justificatif_url: string | null }) {
    const ttc = dic.montant_ht * (1 + dic.tva_pct / 100)
    const { data } = await supabase.schema('app').from('compte_prorata_dic').insert({
      projet_id: projetId,
      date_depense: dic.date_depense,
      libelle: dic.libelle,
      montant_ht: dic.montant_ht,
      tva_pct: dic.tva_pct,
      montant_ttc: ttc,
      justificatif_url: dic.justificatif_url,
    }).select().single()
    if (data) setDics(prev => [data as DIC, ...prev])
  }

  async function deleteDic(id: string) {
    if (!confirm('Supprimer cette DIC ?')) return
    await supabase.schema('app').from('compte_prorata_dic').delete().eq('id', id)
    setDics(prev => prev.filter(d => d.id !== id))
  }

  async function marquerPaye(stId: string, quotePart: number) {
    const existing = paiements.find(p => p.st_id === stId)
    if (existing) {
      const { data } = await supabase.schema('app').from('compte_prorata_paiements').update({
        montant_paye: quotePart,
        montant_du: quotePart,
        statut: 'paye',
        date_paiement: new Date().toISOString().split('T')[0],
      }).eq('id', existing.id).select().single()
      if (data) setPaiements(prev => prev.map(p => p.id === existing.id ? (data as Paiement) : p))
    } else {
      const { data } = await supabase.schema('app').from('compte_prorata_paiements').insert({
        projet_id: projetId,
        st_id: stId,
        montant_du: quotePart,
        montant_paye: quotePart,
        statut: 'paye',
        date_paiement: new Date().toISOString().split('T')[0],
      }).select().single()
      if (data) setPaiements(prev => [...prev, data as Paiement])
    }
  }

  return (
    <div>
      <TopBar title="Compte prorata" subtitle={<>Gestion des Depenses d&apos;Interet Commun (<Abbr k="DIC" />) et repartition par <Abbr k="ST" /></>} />

      <div className="p-6 space-y-6">
        {/* Header : retour + selecteur projet */}
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/at/admin-financiere"
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <select value={projetId} onChange={e => setProjetId(e.target.value)} className={cn(inputClass, 'max-w-md')}>
            {projets.map(p => (
              <option key={p.id} value={p.id}>
                {p.reference ? `${p.reference} -- ` : ''}{p.nom}
              </option>
            ))}
          </select>
        </div>

        {!projetId ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Landmark className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Selectionnez un projet</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* En-tete du compte */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <InfoCard label="Solde du compte" value={`${solde.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`}
                sub={solde >= 0 ? 'Excedent' : 'Deficit'} bg="#EAF3DE" color="#3B6D11"
                icon={<Landmark className="w-4 h-4" />} highlight={solde < 0} />
              <InfoCard label={<>Total <Abbr k="DIC" /> engagees</>} value={`${totalDicTtc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`}
                sub={`${dics.length} depense${dics.length > 1 ? 's' : ''}`} bg="#FAEEDA" color="#854F0B"
                icon={<Receipt className="w-4 h-4" />} />
              <InfoCard label={<><Abbr k="ST" /> contribuant</>} value={String(lots.length)}
                sub="Sur ce projet" bg="#E6F1FB" color="#185FA5"
                icon={<Users className="w-4 h-4" />} />
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-5 flex items-center justify-center">
                <button onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
                  <Plus className="w-4 h-4" /> Nouvelle depense <Abbr k="DIC" />
                </button>
              </div>
            </div>

            {/* Tableau des DIC */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-card">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Depenses d&apos;Interet Commun (<Abbr k="DIC" />)</h2>
                <span className="text-xs text-gray-400">Total <Abbr k="HT" /> : {totalDicHt.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
              </div>
              {dics.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Receipt className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Aucune depense enregistree</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-2.5 w-28">Date</th>
                        <th className="px-4 py-2.5">Libelle</th>
                        <th className="px-4 py-2.5 w-28 text-right">Montant <Abbr k="HT" /></th>
                        <th className="px-4 py-2.5 w-16"><Abbr k="TVA" /></th>
                        <th className="px-4 py-2.5 w-28 text-right"><Abbr k="TTC" /></th>
                        <th className="px-4 py-2.5 w-24">Justificatif</th>
                        <th className="px-4 py-2.5 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {dics.map(d => (
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                            {new Date(d.date_depense).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-gray-700">{d.libelle}</td>
                          <td className="px-4 py-2.5 text-sm text-gray-700 text-right">
                            {Number(d.montant_ht).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{d.tva_pct ?? 20}%</td>
                          <td className="px-4 py-2.5 text-sm font-medium text-gray-900 text-right">
                            {Number(d.montant_ttc ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </td>
                          <td className="px-4 py-2.5">
                            {d.justificatif_url ? (
                              <a href={d.justificatif_url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900">
                                <Download className="w-3.5 h-3.5" /> Voir
                              </a>
                            ) : <span className="text-xs text-gray-300">--</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button onClick={() => deleteDic(d.id)} className="text-gray-300 hover:text-red-500">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Tableau de repartition */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-card">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Repartition par <Abbr k="ST" /></h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Quote-part = (montant marche <Abbr k="ST" /> / total marches) × total <Abbr k="DIC" />
                </p>
              </div>
              {quoteParts.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Aucun <Abbr k="ST" /> attribue pour ce projet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-2.5"><Abbr k="ST" /></th>
                        <th className="px-4 py-2.5 w-32 text-right">Montant marche</th>
                        <th className="px-4 py-2.5 w-20 text-right">% total</th>
                        <th className="px-4 py-2.5 w-32 text-right">Quote-part <Abbr k="DIC" /></th>
                        <th className="px-4 py-2.5 w-28 text-right">Paye</th>
                        <th className="px-4 py-2.5 w-28 text-right">Reste du</th>
                        <th className="px-4 py-2.5 w-28">Statut</th>
                        <th className="px-4 py-2.5 w-28 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {quoteParts.map((q, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <p className="text-sm font-medium text-gray-900">{q.st?.nom ?? `Lot ${q.lot.numero}`}</p>
                            <p className="text-xs text-gray-400">{q.lot.corps_etat}</p>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500 text-right">
                            {q.budgetLot.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500 text-right">
                            {q.pct.toFixed(1)}%
                          </td>
                          <td className="px-4 py-2.5 text-sm font-medium text-gray-900 text-right">
                            {q.quotePart.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500 text-right">
                            {q.paye.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </td>
                          <td className="px-4 py-2.5 text-xs text-red-600 text-right">
                            {q.reste.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={cn('inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full', STATUT_PAIEMENT_STYLE[q.statut])}>
                              {STATUT_PAIEMENT_LABEL[q.statut]}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {q.statut !== 'paye' && q.st && (
                              <button onClick={() => marquerPaye(q.st!.id, q.quotePart)}
                                className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md hover:bg-emerald-100 transition-colors">
                                Marquer paye
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Note prorata pour facturation ST */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-blue-900">Verification avant bon a payer</p>
                <p className="text-xs text-blue-700 mt-1">
                  Dans Admin Financiere, les factures des <Abbr k="ST" /> dont la quote-part prorata n&apos;est pas reglee sont bloquees.
                  Ce <Abbr k="ST" /> doit d&apos;abord regler sa quote-part au compte prorata avant tout paiement.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {showModal && projetId && (
        <NewDicModal
          projetId={projetId}
          onClose={() => setShowModal(false)}
          onCreated={(dic) => { createDic(dic); setShowModal(false) }}
        />
      )}
    </div>
  )
}

/* ── InfoCard ── */

function InfoCard({ label, value, sub, bg, color, icon, highlight }: {
  label: React.ReactNode; value: string; sub: React.ReactNode; bg: string; color: string; icon: React.ReactNode; highlight?: boolean
}) {
  return (
    <div className={cn('bg-white rounded-lg border shadow-card p-5', highlight ? 'border-red-300' : 'border-gray-200')}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="mt-1.5 text-xl font-semibold text-gray-900 truncate">{value}</p>
          <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
        </div>
        <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: bg, color }}>
          {icon}
        </div>
      </div>
    </div>
  )
}

/* ── Modal nouvelle DIC ── */

function NewDicModal({ projetId, onClose, onCreated }: {
  projetId: string
  onClose: () => void
  onCreated: (dic: { date_depense: string; libelle: string; montant_ht: number; tva_pct: number; justificatif_url: string | null }) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [dateDepense, setDateDepense] = useState(new Date().toISOString().split('T')[0])
  const [libelleChoisi, setLibelleChoisi] = useState(LIBELLES_COURANTS[0])
  const [libelleAutre, setLibelleAutre] = useState('')
  const [montantHt, setMontantHt] = useState('')
  const [tvaPct, setTvaPct] = useState('20')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleCreate() {
    const libelle = libelleChoisi === 'Autre' ? libelleAutre.trim() : libelleChoisi
    const ht = parseFloat(montantHt)
    const tva = parseFloat(tvaPct)
    if (!libelle || isNaN(ht) || ht <= 0) return

    setUploading(true)
    let url: string | null = null
    if (file) {
      const path = `${projetId}/${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('prorata-justificatifs').upload(path, file, { upsert: true })
      if (!error) {
        const { data } = supabase.storage.from('prorata-justificatifs').getPublicUrl(path)
        url = data.publicUrl
      }
    }
    onCreated({ date_depense: dateDepense, libelle, montant_ht: ht, tva_pct: tva, justificatif_url: url })
    setUploading(false)
  }

  const montantTtc = montantHt && tvaPct ? parseFloat(montantHt) * (1 + parseFloat(tvaPct) / 100) : 0

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Nouvelle depense <Abbr k="DIC" /></h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="px-5 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Date</label>
              <input type="date" value={dateDepense} onChange={e => setDateDepense(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Libelle</label>
              <select value={libelleChoisi} onChange={e => setLibelleChoisi(e.target.value)} className={inputClass}>
                {LIBELLES_COURANTS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              {libelleChoisi === 'Autre' && (
                <input type="text" value={libelleAutre} onChange={e => setLibelleAutre(e.target.value)}
                  placeholder="Precisez le libelle" className={cn(inputClass, 'mt-2')} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-700">Montant <Abbr k="HT" /></label>
                <input type="number" min={0} step="0.01" value={montantHt} onChange={e => setMontantHt(e.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-700"><Abbr k="TVA" /></label>
                <select value={tvaPct} onChange={e => setTvaPct(e.target.value)} className={inputClass}>
                  <option value="20">20%</option>
                  <option value="10">10%</option>
                </select>
              </div>
            </div>
            {montantTtc > 0 && (
              <p className="text-xs text-gray-500"><Abbr k="TTC" /> : <span className="font-semibold text-gray-900">{montantTtc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span></p>
            )}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-700">Justificatif</label>
              {file ? (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700 flex-1 truncate">{file.name}</span>
                  <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <>
                  <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]) }} />
                  <button onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 border border-dashed border-gray-300 rounded-lg px-4 py-2 w-full justify-center hover:border-gray-400 hover:bg-gray-50">
                    <Upload className="w-4 h-4" /> Uploader facture
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="px-5 py-4 border-t border-gray-100">
            <button onClick={handleCreate} disabled={uploading || !montantHt}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
              {uploading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              Enregistrer la <Abbr k="DIC" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
