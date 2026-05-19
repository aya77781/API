'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { X, Scale, Bell, Calendar, Check, Eye, MessageSquare } from 'lucide-react'
import DceComparatifDetail from '@/components/economiste/DceComparatifDetail'
import { createClient } from '@/lib/supabase/client'
import {
  fetchEchangesByLot, addEchange, retenirST,
  type ProjetEco,
} from '@/hooks/useEconomisteProject'
import {
  fetchDevisByLot, addDevis, scoreDevis, fetchSTActifs,
  type DevisAvecST,
} from '@/hooks/useDevis'
import { Abbr } from '@/components/shared/Abbr'
import { formatCurrency } from '@/lib/utils'
import type { Lot, EchangeST, SousTraitant } from '@/types/database'

type PublicLot = { id: string; nom: string; ordre: number; nb_offres: number }

export default function ComparatifST({
  projet,
  userId,
  restrictedAccesIds,
  showConsultations = true,
}: {
  projet: ProjetEco
  userId: string
  /** Si fourni, filtre la liste des ST a ces acces uniquement (utilise dans le contexte negociation) */
  restrictedAccesIds?: string[] | null
  /** Masquer la section "Consultations en cours" (utile dans le contexte negociation) */
  showConsultations?: boolean
}) {
  const [publicLots, setPublicLots] = useState<PublicLot[]>([])
  const [loadingLots, setLoadingLots] = useState(true)
  const [selectedLotId, setSelectedLotId] = useState<string>('')

  useEffect(() => {
    const supabase = createClient()
    async function loadLots() {
      const { data: lotsData } = await supabase
        .from('lots')
        .select('id, nom, ordre')
        .eq('projet_id', projet.id)
        .order('ordre', { ascending: true })
      const lots = (lotsData ?? []) as Array<{ id: string; nom: string; ordre: number }>

      const { data: accesData } = await supabase
        .from('dce_acces_st')
        .select('lot_id, statut')
        .eq('projet_id', projet.id)
        .in('statut', ['soumis', 'retenu', 'refuse'])
      const cnt = new Map<string, number>()
      ;(accesData ?? []).forEach((a: any) => {
        cnt.set(a.lot_id, (cnt.get(a.lot_id) ?? 0) + 1)
      })

      const enriched = lots.map((l) => ({ ...l, nb_offres: cnt.get(l.id) ?? 0 }))
      setPublicLots(enriched)
      setSelectedLotId((prev) => prev || enriched[0]?.id || '')
      setLoadingLots(false)
    }
    loadLots()
  }, [projet.id])

  if (loadingLots) {
    return <div className="text-sm text-gray-400 py-10 text-center">Chargement…</div>
  }

  if (publicLots.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <Scale className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700">Aucun lot disponible</p>
        <p className="text-xs text-gray-400 mt-1">Ajoutez des lots au projet pour démarrer le comparatif.</p>
      </div>
    )
  }

  const selectedPublicLot = publicLots.find((l) => l.id === selectedLotId) ?? publicLots[0]
  const appLot = projet.lots.find((l) => l.id === selectedPublicLot.id)

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium mr-1">Lot :</span>
          {publicLots.map((l) => {
            const isActive = l.id === selectedPublicLot.id
            return (
              <button
                key={l.id}
                onClick={() => setSelectedLotId(l.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                }`}
              >
                <span className="font-mono text-[10px] opacity-70">L{String(l.ordre + 1).padStart(2, '0')}</span>
                {l.nom}
                {l.nb_offres > 0 && (
                  <span
                    className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-700'
                    }`}
                    title={`${l.nb_offres} offre(s) reçue(s)`}
                  >
                    {l.nb_offres}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {appLot ? (
        <ComparatifLot
          key={appLot.id}
          lot={appLot}
          projet={projet}
          userId={userId}
          restrictedAccesIds={restrictedAccesIds}
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-semibold text-gray-400">
                LOT {String(selectedPublicLot.ordre + 1).padStart(2, '0')}
              </span>
              <span className="text-sm font-medium text-gray-900">{selectedPublicLot.nom}</span>
              {selectedPublicLot.nb_offres > 0 && (
                <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-full font-medium">
                  {selectedPublicLot.nb_offres} offre{selectedPublicLot.nb_offres > 1 ? 's' : ''} reçue{selectedPublicLot.nb_offres > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <div className="px-5 pb-5 pt-4">
            <DceComparatifDetail
              lotId={selectedPublicLot.id}
              projetId={projet.id}
              projetNom={projet.nom}
              projetReference={projet.reference}
              lotNom={selectedPublicLot.nom}
              restrictedAccesIds={restrictedAccesIds}
            />
          </div>
        </div>
      )}

      {showConsultations && (
        <ConsultationsSection
          key={`cons-${selectedPublicLot.id}`}
          lotId={selectedPublicLot.id}
          projetId={projet.id}
        />
      )}
    </div>
  )
}

// ─── Section Consultations en cours (CO + Eco) ───────────────────────────────

type ConsultationRow = {
  id: string
  st_nom: string | null
  st_societe: string | null
  st_email: string | null
  statut: string
  date_limite: string | null
  created_at: string
  ouvert_le: string | null
  soumis_le: string | null
  derniere_relance_le: string | null
  nb_relances: number
  type_acces: 'externe' | 'interne'
  code_acces: string | null
  decline_motif: string | null
  decline_le: string | null
}

function ConsultationsSection({ lotId, projetId }: { lotId: string; projetId: string }) {
  const [rows, setRows] = useState<ConsultationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [relancingId, setRelancingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('dce_acces_st')
      .select('id, st_nom, st_societe, st_email, statut, date_limite, created_at, ouvert_le, soumis_le, derniere_relance_le, nb_relances, type_acces, code_acces, decline_motif, decline_le')
      .eq('lot_id', lotId)
      .order('created_at', { ascending: true })
    setRows((data ?? []) as ConsultationRow[])
    setLoading(false)
  }, [lotId])

  useEffect(() => { refresh() }, [refresh])

  async function relancer(row: ConsultationRow) {
    setRelancingId(row.id)
    const supabase = createClient()
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('dce_acces_st' as never)
      .update({ derniere_relance_le: now, nb_relances: (row.nb_relances ?? 0) + 1 } as never)
      .eq('id', row.id)
    if (!error) {
      await supabase.schema('app').from('echanges_st').insert({
        projet_id: projetId,
        lot_id: null,
        st_id: null,
        type: 'relance',
        contenu: `Relance envoyée à ${row.st_societe || row.st_nom || row.st_email || 'ST'}`,
        decision: 'en_attente',
        motif_decision: null,
      })
      const name = row.st_societe || row.st_nom || row.st_email || 'ST'
      setToast(`Relance enregistrée pour ${name}`)
      await refresh()
      setTimeout(() => setToast(null), 3500)
    } else {
      setToast(`Erreur relance : ${error.message}`)
      setTimeout(() => setToast(null), 4000)
    }
    setRelancingId(null)
  }

  function fmtDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  function fmtDateTime(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Chargement des consultations…</div>
  if (rows.length === 0) return null

  const statutMeta: Record<string, { label: string; cls: string }> = {
    envoye:     { label: 'Envoyé',         cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    ouvert:     { label: 'Ouvert',         cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    en_cours:   { label: 'En cours',       cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    soumis:     { label: 'Soumis',         cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    retenu:     { label: 'Retenu',         cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    refuse:     { label: 'Refusé',         cls: 'bg-red-50 text-red-700 border-red-200' },
    decline_st: { label: 'Décliné par ST', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-500" />
          <h4 className="text-sm font-semibold text-gray-900">Consultations en cours</h4>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 font-bold">{rows.length}</span>
        </div>
        {toast && (
          <span className="text-xs text-emerald-700 inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" /> {toast}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/60">
            <tr className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-2">Sous-traitant</th>
              <th className="px-4 py-2 w-32">Date consult.</th>
              <th className="px-4 py-2 w-32">Ouvert le</th>
              <th className="px-4 py-2 w-28">Date limite</th>
              <th className="px-4 py-2 w-24">Statut</th>
              <th className="px-4 py-2 w-40">Dernière relance</th>
              <th className="px-4 py-2 w-32 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const meta = statutMeta[r.statut] ?? { label: r.statut, cls: 'bg-gray-100 text-gray-600 border-gray-200' }
              const canRelance = ['envoye', 'ouvert', 'en_cours'].includes(r.statut)
              const name = r.st_societe || r.st_nom || r.st_email || (r.code_acces ? `Code ${r.code_acces}` : '—')
              return (
                <Fragment key={r.id}>
                <tr className="border-t border-gray-100">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-900">{name}</div>
                    {r.st_email && <div className="text-[11px] text-gray-400 truncate max-w-[220px]">{r.st_email}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">
                    <div className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      {fmtDate(r.created_at)}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">
                    {r.ouvert_le ? <div className="inline-flex items-center gap-1"><Eye className="w-3 h-3 text-gray-400" /> {fmtDate(r.ouvert_le)}</div> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{fmtDate(r.date_limite)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${meta.cls}`}>{meta.label}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">
                    {r.derniere_relance_le ? (
                      <div className="inline-flex items-center gap-1.5">
                        <Bell className="w-3 h-3 text-amber-500" />
                        <span>{fmtDateTime(r.derniere_relance_le)}</span>
                        {r.nb_relances > 1 && <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">×{r.nb_relances}</span>}
                      </div>
                    ) : <span className="text-gray-300">Jamais</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canRelance ? (
                      <button
                        onClick={() => relancer(r)}
                        disabled={relancingId === r.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:opacity-50"
                      >
                        <Bell className="w-3 h-3" />
                        {relancingId === r.id ? '…' : 'Relancer'}
                      </button>
                    ) : r.statut === 'decline_st' ? (
                      <span className="text-xs text-rose-700" title={r.decline_motif ?? undefined}>
                        Décliné {fmtDate(r.decline_le)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">
                        {r.statut === 'soumis' ? `Soumis ${fmtDate(r.soumis_le)}` : '—'}
                      </span>
                    )}
                  </td>
                </tr>
                {r.statut === 'decline_st' && r.decline_motif && (
                  <tr className="border-t border-rose-50 bg-rose-50/40">
                    <td colSpan={7} className="px-4 py-2 text-xs text-rose-800">
                      <span className="font-semibold mr-2">Motif décliné :</span>
                      <span className="whitespace-pre-wrap">{r.decline_motif}</span>
                    </td>
                  </tr>
                )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ComparatifLot({
  lot, projet, userId, restrictedAccesIds,
}: {
  lot: Lot
  projet: ProjetEco
  userId: string
  restrictedAccesIds?: string[] | null
}) {
  const [devis,       setDevis]       = useState<DevisAvecST[]>([])
  const [echanges,    setEchanges]    = useState<EchangeST[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showAdd,     setShowAdd]     = useState(false)
  const [showEchange, setShowEchange] = useState(false)
  const [sts,         setSts]         = useState<SousTraitant[]>([])

  const [stId,           setStId]           = useState('')
  const [montant,        setMontant]        = useState('')
  const [delai,          setDelai]          = useState('')
  const [noteEco,        setNoteEco]        = useState('')
  const [savingDevis,    setSavingDevis]    = useState(false)

  const [typeEchange, setTypeEchange] = useState<'clarification' | 'variante' | 'relance' | 'autre'>('clarification')
  const [contenu,     setContenu]     = useState('')
  const [savingEch,   setSavingEch]   = useState(false)

  const [retMot,     setRetMot]     = useState('')
  const [retStId,    setRetStId]    = useState('')
  const [showRetenir,setShowRetenir]= useState(false)
  const [retaining,  setRetaining]  = useState(false)

  useEffect(() => {
    Promise.all([
      fetchDevisByLot(lot.id),
      fetchEchangesByLot(lot.id),
      fetchSTActifs(),
    ]).then(([d, e, s]) => {
      setDevis(d)
      setEchanges(e)
      setSts(s)
      setLoading(false)
    })
  }, [lot.id])

  async function handleAddDevis() {
    if (!stId || !montant) return
    setSavingDevis(true)
    await addDevis({
      projet_id: projet.id, lot_id: lot.id, st_id: stId || null,
      montant_ht: parseFloat(montant),
      delai_semaines: delai ? parseFloat(delai) : null,
      statut: 'recu',
      score_ia: null, note_eco: noteEco || null, devis_url: null,
    })
    const refreshed = await fetchDevisByLot(lot.id)
    setDevis(refreshed)
    setStId(''); setMontant(''); setDelai(''); setNoteEco('')
    setShowAdd(false)
    setSavingDevis(false)
  }

  async function handleAddEchange() {
    if (!contenu.trim()) return
    setSavingEch(true)
    await addEchange({ projet_id: projet.id, lot_id: lot.id, st_id: null, type: typeEchange, contenu, decision: 'en_attente', motif_decision: null })
    const e = await fetchEchangesByLot(lot.id)
    setEchanges(e)
    setContenu('')
    setShowEchange(false)
    setSavingEch(false)
  }

  async function handleRetenir() {
    if (!retStId || !retMot) return
    setRetaining(true)
    await retenirST(projet.id, lot.id, retStId, retMot, projet.co_id)
    const d = await fetchDevisByLot(lot.id)
    setDevis(d)
    setShowRetenir(false)
    setRetMot('')
    setRetaining(false)
  }

  if (loading) return <LocalSpinner />

  const retenu = devis.find((d) => d.statut === 'retenu')

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-semibold text-gray-400">LOT {String(lot.numero).padStart(2, '0')}</span>
          <span className="text-sm font-medium text-gray-900">{lot.corps_etat}</span>
          {retenu && (
            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
              <Abbr k="ST" /> retenu : {retenu.sous_traitant?.raison_sociale ?? '—'}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(!showAdd)} className="text-xs px-2.5 py-1 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
            + Devis
          </button>
          {devis.length > 0 && !retenu && (
            <button onClick={() => setShowRetenir(true)} className="text-xs px-2.5 py-1 bg-gray-900 text-white rounded-lg hover:bg-gray-800">
              Retenir un <Abbr k="ST" />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        {devis.length === 0 ? (
          <p className="px-5 py-6 text-xs text-gray-400 text-center">Aucun devis reçu pour ce lot.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {([
                  'Sous-traitant',
                  <>Montant <Abbr k="HT" /></>,
                  'Délai (sem)',
                  'Score IA',
                  'Note éco',
                  'Statut',
                ] as React.ReactNode[]).map((h, i) => (
                  <th key={i} className="px-4 py-2 text-left text-xs font-medium text-gray-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devis.map((d) => {
                const score   = scoreDevis(devis, d)
                const isWin   = d.statut === 'retenu'
                const isDce   = d.source === 'dce'
                const name    = d.st_nom_display ?? d.sous_traitant?.raison_sociale ?? '—'
                return (
                  <tr key={d.id} className={`border-b border-gray-50 last:border-0 ${isWin ? 'bg-emerald-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{name}</span>
                        {isDce && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded whitespace-nowrap"
                            title="Offre déposée via l'espace DCE"
                          >
                            <Abbr k="DCE" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold">{d.montant_ht ? formatCurrency(d.montant_ht) : '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{d.delai_semaines ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        score >= 70 ? 'bg-emerald-100 text-emerald-700' :
                        score >= 40 ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{score}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{d.note_eco ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isWin ? 'bg-emerald-100 text-emerald-700' :
                        d.statut === 'refuse' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{d.statut}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="px-5 pb-5">
        <DceComparatifDetail
          lotId={lot.id}
          projetId={projet.id}
          projetNom={projet.nom}
          projetReference={projet.reference}
          lotNom={lot.corps_etat}
          restrictedAccesIds={restrictedAccesIds}
        />
      </div>

      {showAdd && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
          <p className="text-xs font-semibold text-gray-600 mb-3">Ajouter un devis</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Sous-traitant</label>
              <select value={stId} onChange={(e) => setStId(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none">
                <option value="">— Choisir —</option>
                {sts.map((s) => <option key={s.id} value={s.id}>{s.raison_sociale}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Montant <Abbr k="HT" /> (€)</label>
              <input type="number" value={montant} onChange={(e) => setMontant(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Délai (semaines)</label>
              <input type="number" value={delai} onChange={(e) => setDelai(e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Note éco</label>
              <input type="text" value={noteEco} onChange={(e) => setNoteEco(e.target.value)} placeholder="Observation…" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleAddDevis} disabled={savingDevis || !stId || !montant} className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 disabled:opacity-40">
              {savingDevis ? '…' : 'Ajouter'}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800">Annuler</button>
          </div>
        </div>
      )}

      <div className="border-t border-gray-100 px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Échanges <Abbr k="ST" /></p>
          <button onClick={() => setShowEchange(!showEchange)} className="text-xs text-gray-400 hover:text-gray-700">+ Ajouter</button>
        </div>
        {echanges.length === 0 && !showEchange && (
          <p className="text-xs text-gray-300">Aucun échange enregistré.</p>
        )}
        <div className="space-y-2">
          {echanges.map((e) => (
            <div key={e.id} className="flex items-start gap-3 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-gray-700">{e.type}</span>
                <span className="text-gray-400 ml-2">{new Date(e.created_at).toLocaleDateString('fr-FR')}</span>
                <p className="text-gray-600 mt-0.5">{e.contenu}</p>
                {e.decision !== 'en_attente' && (
                  <span className={`mt-1 inline-block px-1.5 py-0.5 rounded text-xs ${e.decision === 'accepte' ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                    {e.decision} {e.motif_decision ? `— ${e.motif_decision}` : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        {showEchange && (
          <div className="mt-3 space-y-2">
            <select value={typeEchange} onChange={(e) => setTypeEchange(e.target.value as any)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none">
              {(['clarification', 'variante', 'relance', 'autre'] as const).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} rows={2} placeholder="Contenu de l'échange…" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none resize-none" />
            <div className="flex gap-2">
              <button onClick={handleAddEchange} disabled={savingEch || !contenu.trim()} className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg disabled:opacity-40">
                {savingEch ? '…' : 'Enregistrer'}
              </button>
              <button onClick={() => setShowEchange(false)} className="text-xs text-gray-500">Annuler</button>
            </div>
          </div>
        )}
      </div>

      {showRetenir && (
        <LocalModal title={<>Retenir un <Abbr k="ST" /></>} onClose={() => setShowRetenir(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sous-traitant retenu *</label>
              <select value={retStId} onChange={(e) => setRetStId(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
                <option value="">— Choisir parmi les devis reçus —</option>
                {devis.filter((d) => d.sous_traitant).map((d) => (
                  <option key={d.id} value={d.st_id ?? ''}>
                    {d.sous_traitant?.raison_sociale} — {d.montant_ht ? formatCurrency(d.montant_ht) : '?'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Motif de sélection *</label>
              <textarea value={retMot} onChange={(e) => setRetMot(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none resize-none" placeholder="Ex : Meilleur rapport qualité/prix, délai respecté…" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleRetenir} disabled={retaining || !retStId || !retMot} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-40">
                {retaining ? '…' : 'Confirmer'}
              </button>
              <button onClick={() => setShowRetenir(false)} className="px-4 py-2 text-sm text-gray-500">Annuler</button>
            </div>
          </div>
        </LocalModal>
      )}
    </div>
  )
}

function LocalSpinner({ full }: { full?: boolean }) {
  return (
    <div className={`flex items-center justify-center ${full ? 'h-64' : 'h-32'}`}>
      <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
    </div>
  )
}

function LocalModal({ title, onClose, children }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
