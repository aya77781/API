'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { fetchProjectEco, type ProjetEco } from '@/hooks/useEconomisteProject'
import ComparatifST from '@/components/shared/ComparatifST'
import { Abbr } from '@/components/shared/Abbr'
import { formatCurrency, cn } from '@/lib/utils'
import { MessageCircle, Banknote, Scale, Plus, Trash2, Check, X, Loader2, ListChecks } from 'lucide-react'

type SubTab = 'technique' | 'financiere' | 'comparatif'

type PublicLot = { id: string; nom: string; ordre: number }
type AccesST = {
  id: string
  lot_id: string
  st_nom: string | null
  st_societe: string | null
  st_email: string | null
  statut: string
}

type NegoLigne = {
  ligne_id: string
  designation: string
  quantite: number
  unite: string | null
  prix_unitaire_initial: number
  prix_unitaire_propose: number
  quantite_proposee?: number | null
  unite_proposee?: string | null
  detail_propose?: string | null
}

type Nego = {
  id: string
  projet_id: string
  lot_id: string
  acces_id: string | null
  type: 'technique' | 'financiere'
  contenu: string
  montant_initial: number | null
  montant_negocie: number | null
  statut: 'en_cours' | 'accepte' | 'refuse'
  motif: string | null
  auteur_id: string | null
  created_at: string
  updated_at: string
  lignes_data?: NegoLigne[]
  reponse_st?: string | null
  reponse_st_decision?: string | null
  reponse_st_le?: string | null
}

export default function NegociationPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const stParam = searchParams.get('st')
  const { user, profil } = useUser()
  const [projet, setProjet] = useState<ProjetEco | null>(null)
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState<SubTab>('technique')
  const [negoAccesIds, setNegoAccesIds] = useState<string[]>([])

  useEffect(() => {
    fetchProjectEco(id).then((p) => {
      setProjet(p)
      setLoading(false)
    })
  }, [id])

  // Acces_ids des ST avec lesquels on a une nego (pour filtrer le comparatif)
  useEffect(() => {
    if (!projet || subTab !== 'comparatif') return
    const supabase = createClient()
    supabase
      .schema('app')
      .from('negociations_st')
      .select('acces_id')
      .eq('projet_id', projet.id)
      .not('acces_id', 'is', null)
      .then(({ data }) => {
        const ids = new Set<string>()
        ;(data ?? []).forEach((r: { acces_id: string | null }) => {
          if (r.acces_id) ids.add(r.acces_id)
        })
        setNegoAccesIds(Array.from(ids))
      })
  }, [projet, subTab])

  if (loading || !projet) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Sous-onglets */}
      <div className="bg-white border border-gray-200 rounded-xl p-1.5 flex gap-1">
        {([
          { v: 'technique'  as const, l: 'Négociation technique',  icon: MessageCircle, desc: 'Clarifications, ajustements, variantes' },
          { v: 'financiere' as const, l: 'Négociation financière', icon: Banknote,      desc: 'Ajustement des montants HT' },
          { v: 'comparatif' as const, l: 'Comparatif des ST',      icon: Scale,         desc: 'Synthèse offres reçues' },
        ]).map((opt) => {
          const Icon = opt.icon
          const active = subTab === opt.v
          return (
            <button
              key={opt.v}
              onClick={() => setSubTab(opt.v)}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-lg text-left transition-colors',
                active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50',
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span className="text-sm font-semibold">{opt.l}</span>
              </div>
              <p className={cn('text-[10px] mt-0.5', active ? 'text-gray-300' : 'text-gray-400')}>{opt.desc}</p>
            </button>
          )
        })}
      </div>

      {subTab === 'comparatif' ? (
        negoAccesIds.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
            <Scale className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Aucune négociation en cours</p>
            <p className="text-xs text-gray-400 mt-1">
              Démarrez une négociation technique ou financière pour voir apparaître ici le comparatif des ST concernés.
            </p>
          </div>
        ) : (
          <ComparatifST
            projet={projet}
            userId={user?.id ?? ''}
            restrictedAccesIds={negoAccesIds}
            showConsultations={false}
          />
        )
      ) : (
        <NegoSection
          type={subTab}
          projet={projet}
          auteurId={profil?.id ?? null}
          presetAccesId={stParam}
        />
      )}
    </div>
  )
}

// ─── Section Negociation (technique ou financiere) ─────────────────────────

function NegoSection({
  type, projet, auteurId, presetAccesId,
}: {
  type: 'technique' | 'financiere'
  projet: ProjetEco
  auteurId: string | null
  presetAccesId?: string | null
}) {
  const supabase = useMemo(() => createClient(), [])
  const [lots, setLots] = useState<PublicLot[]>([])
  const [selectedLotId, setSelectedLotId] = useState<string>('')
  const [acces, setAcces] = useState<AccesST[]>([])
  const [negos, setNegos] = useState<Nego[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [presetUsed, setPresetUsed] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: lotsData } = await supabase
        .from('lots')
        .select('id, nom, ordre')
        .eq('projet_id', projet.id)
        .order('ordre', { ascending: true })
      const ls = (lotsData ?? []) as PublicLot[]
      setLots(ls)
      // Si on a un acces_id preset, on cherche son lot pour le selectionner
      if (presetAccesId && !presetUsed) {
        const { data: acc } = await supabase
          .from('dce_acces_st')
          .select('lot_id')
          .eq('id', presetAccesId)
          .maybeSingle()
        const presetLotId = (acc as { lot_id: string } | null)?.lot_id
        setSelectedLotId(presetLotId || ls[0]?.id || '')
      } else {
        setSelectedLotId((prev) => prev || ls[0]?.id || '')
      }
      setLoading(false)
    }
    load()
  }, [projet.id, supabase, presetAccesId, presetUsed])

  // Ouvre auto la modale avec le ST pre-selectionne quand acces est charge
  useEffect(() => {
    if (presetAccesId && !presetUsed && acces.length > 0 && acces.some((a) => a.id === presetAccesId)) {
      setShowAdd(true)
      setPresetUsed(true)
    }
  }, [acces, presetAccesId, presetUsed])

  useEffect(() => {
    if (!selectedLotId) return
    async function loadLotData() {
      const [{ data: ac }, { data: n }] = await Promise.all([
        supabase
          .from('dce_acces_st')
          .select('id, lot_id, st_nom, st_societe, st_email, statut')
          .eq('lot_id', selectedLotId)
          .order('created_at'),
        supabase
          .schema('app')
          .from('negociations_st')
          .select('*')
          .eq('projet_id', projet.id)
          .eq('lot_id', selectedLotId)
          .eq('type', type)
          .order('created_at', { ascending: false }),
      ])
      setAcces((ac ?? []) as AccesST[])
      setNegos((n ?? []) as Nego[])
    }
    loadLotData()
  }, [selectedLotId, type, projet.id, supabase])

  async function refresh() {
    const { data: n } = await supabase
      .schema('app')
      .from('negociations_st')
      .select('*')
      .eq('projet_id', projet.id)
      .eq('lot_id', selectedLotId)
      .eq('type', type)
      .order('created_at', { ascending: false })
    setNegos((n ?? []) as Nego[])
  }

  async function changerStatut(nego: Nego, statut: Nego['statut']) {
    await supabase
      .schema('app')
      .from('negociations_st' as never)
      .update({ statut, updated_at: new Date().toISOString() } as never)
      .eq('id', nego.id)
    await refresh()
  }

  async function supprimer(nego: Nego) {
    if (!confirm('Supprimer cette négociation ?')) return
    await supabase.schema('app').from('negociations_st' as never).delete().eq('id', nego.id)
    await refresh()
  }

  if (loading) return <div className="text-sm text-gray-400 text-center py-10">Chargement…</div>
  if (lots.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-sm text-gray-500">
        Aucun lot disponible
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtres lot */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 font-medium mr-1">Lot :</span>
        {lots.map((l) => {
          const isActive = l.id === selectedLotId
          const nbNego = negos.filter((n) => n.lot_id === l.id).length
          return (
            <button
              key={l.id}
              onClick={() => setSelectedLotId(l.id)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5',
                isActive
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400',
              )}
            >
              <span className="font-mono text-[10px] opacity-70">L{String(l.ordre + 1).padStart(2, '0')}</span>
              {l.nom}
              {nbNego > 0 && (
                <span className={cn(
                  'ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                  isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700',
                )}>
                  {nbNego}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Liste + bouton ajout */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            {type === 'technique' ? 'Négociations techniques' : 'Négociations financières'} ({negos.length})
          </h3>
          <button
            onClick={() => setShowAdd(true)}
            disabled={!selectedLotId || acces.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
            title={acces.length === 0 ? 'Aucun ST invité pour ce lot' : 'Ajouter une négociation'}
          >
            <Plus className="w-3.5 h-3.5" /> Nouvelle négociation
          </button>
        </div>

        {negos.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Aucune négociation {type === 'technique' ? 'technique' : 'financière'} pour ce lot.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {negos.map((n) => {
              const acc = acces.find((a) => a.id === n.acces_id)
              const stName = acc?.st_societe || acc?.st_nom || acc?.st_email || '— ST non précisé —'
              return (
                <li key={n.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{stName}</span>
                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider',
                        n.statut === 'accepte' ? 'bg-emerald-100 text-emerald-700' :
                        n.statut === 'refuse' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700',
                      )}>
                        {n.statut === 'accepte' ? 'Acceptée' : n.statut === 'refuse' ? 'Refusée' : 'En cours'}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {new Date(n.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {n.statut !== 'accepte' && (
                        <button onClick={() => changerStatut(n, 'accepte')}
                          className="px-2 py-1 text-xs text-emerald-700 border border-emerald-200 bg-emerald-50 rounded hover:bg-emerald-100">
                          Accepter
                        </button>
                      )}
                      {n.statut !== 'refuse' && (
                        <button onClick={() => changerStatut(n, 'refuse')}
                          className="px-2 py-1 text-xs text-red-700 border border-red-200 bg-red-50 rounded hover:bg-red-100">
                          Refuser
                        </button>
                      )}
                      {n.statut !== 'en_cours' && (
                        <button onClick={() => changerStatut(n, 'en_cours')}
                          className="px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50">
                          Rouvrir
                        </button>
                      )}
                      <button onClick={() => supprimer(n)}
                        className="p-1 text-gray-400 hover:text-red-500" title="Supprimer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{n.contenu}</p>
                  {type === 'financiere' && (n.montant_initial != null || n.montant_negocie != null) && (
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      {n.montant_initial != null && (
                        <span className="text-gray-500">
                          Initial : <span className="font-semibold text-gray-700 tabular-nums">{formatCurrency(Number(n.montant_initial))}</span> <Abbr k="HT" />
                        </span>
                      )}
                      {n.montant_negocie != null && (
                        <span className="text-emerald-700">
                          Négocié : <span className="font-bold tabular-nums">{formatCurrency(Number(n.montant_negocie))}</span> <Abbr k="HT" />
                        </span>
                      )}
                      {n.montant_initial != null && n.montant_negocie != null && Number(n.montant_initial) > 0 && (
                        <span className="text-xs px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium">
                          {(((Number(n.montant_negocie) - Number(n.montant_initial)) / Number(n.montant_initial)) * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )}
                  {n.lignes_data && n.lignes_data.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-md overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                            <th className="px-2 py-1.5">Ouvrage</th>
                            <th className="px-2 py-1.5 text-right">Qté init.</th>
                            {n.type === 'financiere' ? (
                              <>
                                <th className="px-2 py-1.5 text-right">PU initial</th>
                                <th className="px-2 py-1.5 text-right">PU proposé</th>
                              </>
                            ) : (
                              <>
                                <th className="px-2 py-1.5 text-right">Qté demandée</th>
                                <th className="px-2 py-1.5">Unité dem.</th>
                                <th className="px-2 py-1.5">Détail demandé</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {n.lignes_data.map((l) => (
                            <tr key={l.ligne_id} className="border-t border-gray-100">
                              <td className="px-2 py-1.5 text-gray-700">{l.designation}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{l.quantite} {l.unite ?? ''}</td>
                              {n.type === 'financiere' ? (
                                <>
                                  <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{formatCurrency(l.prix_unitaire_initial)}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums text-amber-800 font-semibold">{formatCurrency(l.prix_unitaire_propose)}</td>
                                </>
                              ) : (
                                <>
                                  <td className="px-2 py-1.5 text-right tabular-nums">
                                    {l.quantite_proposee != null ? <span className="text-blue-800 font-semibold">{l.quantite_proposee}</span> : <span className="text-gray-300">—</span>}
                                  </td>
                                  <td className="px-2 py-1.5">
                                    {l.unite_proposee ? <span className="text-blue-800 font-semibold">{l.unite_proposee}</span> : <span className="text-gray-300">—</span>}
                                  </td>
                                  <td className="px-2 py-1.5 text-blue-900">
                                    {l.detail_propose ?? <span className="text-gray-300">—</span>}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {n.reponse_st_decision && (
                    <div className={cn(
                      'mt-2 p-2.5 rounded-md text-xs border',
                      n.reponse_st_decision === 'accepte' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                      n.reponse_st_decision === 'refuse' ? 'bg-red-50 border-red-200 text-red-700' :
                      'bg-blue-50 border-blue-200 text-blue-800',
                    )}>
                      <p className="font-semibold mb-0.5">
                        Réponse du ST :{' '}
                        {n.reponse_st_decision === 'accepte' ? 'Accepté' :
                         n.reponse_st_decision === 'refuse' ? 'Refusé' :
                         'Contre-proposition'}
                        {n.reponse_st_le && <span className="font-normal text-[11px] ml-2">({new Date(n.reponse_st_le).toLocaleDateString('fr-FR')})</span>}
                      </p>
                      {n.reponse_st && <p className="whitespace-pre-wrap mt-1">{n.reponse_st}</p>}
                    </div>
                  )}
                  {n.motif && (
                    <p className="mt-2 text-xs text-gray-500">
                      <span className="font-semibold">Motif :</span> {n.motif}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {showAdd && (
        <NewNegoModal
          type={type}
          projetId={projet.id}
          lotId={selectedLotId}
          acces={acces}
          defaultAccesId={presetAccesId ?? null}
          auteurId={auteurId}
          onClose={() => setShowAdd(false)}
          onSaved={async () => { setShowAdd(false); await refresh() }}
        />
      )}
    </div>
  )
}

// ─── Modale nouvelle nego ───────────────────────────────────────────────────

type StOffreLigne = {
  chiffrage_ligne_id: string
  designation: string
  quantite: number
  unite: string | null
  prix_unitaire: number
  total_ht: number
}

type SelectedLigne = {
  ligne_id: string
  designation: string
  quantite: number
  unite: string | null
  prix_unitaire_initial: number
  // Financière
  prix_unitaire_propose: string
  // Technique
  quantite_proposee: string
  unite_proposee: string
  detail_propose: string
}

const UNITES_TECH = ['', 'u', 'ml', 'm2', 'm3', 'kg', 'h', 'jour', 'forfait', 'ens', 'ft']

function NewNegoModal({
  type, projetId, lotId, acces, defaultAccesId, auteurId, onClose, onSaved,
}: {
  type: 'technique' | 'financiere'
  projetId: string
  lotId: string
  acces: AccesST[]
  defaultAccesId?: string | null
  auteurId: string | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const supabase = useMemo(() => createClient(), [])
  const [accesId, setAccesId] = useState<string>(
    (defaultAccesId && acces.some((a) => a.id === defaultAccesId)) ? defaultAccesId : (acces[0]?.id ?? ''),
  )
  const [contenu, setContenu] = useState('')
  const [montantInitial, setMontantInitial] = useState('')
  const [montantNegocie, setMontantNegocie] = useState('')
  const [motif, setMotif] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ouvrages soumis par le ST (pour negociation financiere ciblee)
  const [stLignes, setStLignes] = useState<StOffreLigne[]>([])
  const [loadingLignes, setLoadingLignes] = useState(false)
  const [selectedLignes, setSelectedLignes] = useState<Record<string, SelectedLigne>>({})

  useEffect(() => {
    if (!accesId) {
      setStLignes([])
      setSelectedLignes({})
      return
    }
    async function loadLignes() {
      setLoadingLignes(true)
      const { data } = await supabase
        .from('dce_offres_st')
        .select('chiffrage_ligne_id, designation, quantite, unite, prix_unitaire, total_ht, chiffrage_lignes:chiffrage_ligne_id(designation, unite, quantite)')
        .eq('acces_id', accesId)
        .not('chiffrage_ligne_id', 'is', null)
      const rows = (data ?? []) as Array<{
        chiffrage_ligne_id: string | null
        designation: string | null
        quantite: number | null
        unite: string | null
        prix_unitaire: number | null
        total_ht: number | null
        chiffrage_lignes?: { designation?: string | null; unite?: string | null; quantite?: number | null } | null
      }>
      const cleaned: StOffreLigne[] = rows
        .filter((r) => r.chiffrage_ligne_id && Number(r.prix_unitaire ?? 0) > 0)
        .map((r) => ({
          chiffrage_ligne_id: r.chiffrage_ligne_id as string,
          designation: r.chiffrage_lignes?.designation || r.designation || '—',
          quantite: Number(r.chiffrage_lignes?.quantite ?? r.quantite ?? 0),
          unite: r.chiffrage_lignes?.unite ?? r.unite ?? null,
          prix_unitaire: Number(r.prix_unitaire) || 0,
          total_ht: Number(r.total_ht) || 0,
        }))
      setStLignes(cleaned)
      setLoadingLignes(false)
    }
    loadLignes()
  }, [accesId, type, supabase])

  function toggleLigne(l: StOffreLigne) {
    setSelectedLignes((prev) => {
      const next = { ...prev }
      if (next[l.chiffrage_ligne_id]) {
        delete next[l.chiffrage_ligne_id]
      } else {
        next[l.chiffrage_ligne_id] = {
          ligne_id: l.chiffrage_ligne_id,
          designation: l.designation,
          quantite: l.quantite,
          unite: l.unite,
          prix_unitaire_initial: l.prix_unitaire,
          prix_unitaire_propose: '',
          quantite_proposee: '',
          unite_proposee: '',
          detail_propose: '',
        }
      }
      return next
    })
  }

  function updateLigneField(ligneId: string, patch: Partial<SelectedLigne>) {
    setSelectedLignes((prev) => ({
      ...prev,
      [ligneId]: { ...prev[ligneId], ...patch },
    }))
  }

  // Calcul auto des totaux quand des lignes sont selectionnees (mode financiere)
  const computedTotals = useMemo(() => {
    const arr = Object.values(selectedLignes)
    if (arr.length === 0) return { initial: 0, propose: 0 }
    const initial = arr.reduce((s, l) => s + l.prix_unitaire_initial * (l.quantite || 0), 0)
    const propose = arr.reduce((s, l) => s + (Number(l.prix_unitaire_propose.replace(',', '.')) || 0) * (l.quantite || 0), 0)
    return { initial, propose }
  }, [selectedLignes])

  async function save() {
    setError(null)
    if (!contenu.trim()) { setError('Contenu requis'); return }
    setSaving(true)

    const selectedArr = Object.values(selectedLignes)
    const lignesPayload = selectedArr.map((l) => ({
      ligne_id: l.ligne_id,
      designation: l.designation,
      quantite: l.quantite,
      unite: l.unite,
      prix_unitaire_initial: l.prix_unitaire_initial,
      prix_unitaire_propose: Number(l.prix_unitaire_propose.replace(',', '.')) || 0,
      // Technique : modifications proposees
      quantite_proposee: l.quantite_proposee ? Number(l.quantite_proposee.replace(',', '.')) : null,
      unite_proposee: l.unite_proposee || null,
      detail_propose: l.detail_propose.trim() || null,
    }))

    // Si lignes selectionnees, montant_initial / montant_negocie sont calcules auto
    const finalMontantInitial = type === 'financiere'
      ? (selectedArr.length > 0 ? computedTotals.initial : (montantInitial ? Number(montantInitial.replace(',', '.')) : null))
      : null
    const finalMontantNegocie = type === 'financiere'
      ? (selectedArr.length > 0 ? computedTotals.propose : (montantNegocie ? Number(montantNegocie.replace(',', '.')) : null))
      : null

    const { error } = await supabase.schema('app').from('negociations_st' as never).insert([{
      projet_id: projetId,
      lot_id: lotId,
      acces_id: accesId || null,
      type,
      contenu: contenu.trim(),
      montant_initial: finalMontantInitial,
      montant_negocie: finalMontantNegocie,
      motif: motif.trim() || null,
      auteur_id: auteurId,
      statut: 'en_cours',
      lignes_data: lignesPayload,
    }] as never)
    setSaving(false)
    if (error) { setError(error.message); return }
    await onSaved()
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-base font-semibold text-gray-900">
            Nouvelle négociation {type === 'technique' ? 'technique' : 'financière'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Sous-traitant *</label>
            <select value={accesId} onChange={(e) => setAccesId(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">— Choisir —</option>
              {acces.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.st_societe || a.st_nom || a.st_email || a.id} ({a.statut})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              {type === 'technique' ? 'Demande / point technique' : 'Demande / point financier'} *
            </label>
            <textarea
              rows={4}
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              placeholder={type === 'technique'
                ? "Ex: Demande d'utiliser un materiau alternatif equivalent..."
                : "Ex: Demande de remise de 5% sur le montant global..."}
              className={`${inputCls} resize-none`}
            />
          </div>

          {type === 'technique' && (
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5">
                <ListChecks className="w-3.5 h-3.5" /> Ouvrages à modifier (quantité / unité / détail)
              </label>
              {!accesId ? (
                <p className="text-xs text-gray-400 italic">Sélectionnez d&apos;abord un sous-traitant.</p>
              ) : loadingLignes ? (
                <p className="text-xs text-gray-400">Chargement de l&apos;offre du ST…</p>
              ) : stLignes.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Aucun ouvrage chiffré par ce ST.</p>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                    {stLignes.map((l) => {
                      const sel = selectedLignes[l.chiffrage_ligne_id]
                      const isSel = !!sel
                      const qProp = sel ? Number(sel.quantite_proposee.replace(',', '.')) || 0 : 0
                      const qDiff = isSel && qProp > 0 && l.quantite > 0
                        ? ((qProp - l.quantite) / l.quantite) * 100
                        : null
                      return (
                        <div key={l.chiffrage_ligne_id}
                          className={cn(
                            'px-3 py-2',
                            isSel ? 'bg-blue-50/60' : 'hover:bg-gray-50',
                          )}>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={() => toggleLigne(l)}
                              className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 truncate">{l.designation}</p>
                              <p className="text-[11px] text-gray-500 tabular-nums">
                                Initial : <span className="font-semibold text-gray-700">{l.quantite}</span> {l.unite ?? ''}
                              </p>
                            </div>
                          </div>
                          {isSel && (
                            <div className="mt-2 ml-6 grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Nouvelle quantité</label>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={sel.quantite_proposee}
                                    onChange={(e) => updateLigneField(l.chiffrage_ligne_id, { quantite_proposee: e.target.value })}
                                    placeholder={String(l.quantite)}
                                    className="flex-1 px-2 py-1 border border-blue-200 bg-white rounded-md text-xs tabular-nums focus:outline-none focus:border-blue-500"
                                  />
                                  {qDiff != null && (
                                    <span className={cn(
                                      'text-[10px] px-1.5 py-0.5 rounded font-semibold tabular-nums whitespace-nowrap',
                                      qDiff < 0 ? 'bg-emerald-100 text-emerald-700' : qDiff > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600',
                                    )}>
                                      {qDiff > 0 ? '+' : ''}{qDiff.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Nouvelle unité</label>
                                <select
                                  value={sel.unite_proposee}
                                  onChange={(e) => updateLigneField(l.chiffrage_ligne_id, { unite_proposee: e.target.value })}
                                  className="w-full px-1.5 py-1 border border-blue-200 bg-white rounded-md text-xs focus:outline-none focus:border-blue-500"
                                >
                                  <option value="">(inchangée)</option>
                                  {UNITES_TECH.filter(Boolean).map((u) => <option key={u} value={u}>{u}</option>)}
                                </select>
                              </div>
                              <div className="col-span-2">
                                <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Détail / précision technique</label>
                                <input
                                  type="text"
                                  value={sel.detail_propose}
                                  onChange={(e) => updateLigneField(l.chiffrage_ligne_id, { detail_propose: e.target.value })}
                                  placeholder="Ex: Préciser la marque / matériau alternatif demandé…"
                                  className="w-full px-2 py-1 border border-blue-200 bg-white rounded-md text-xs focus:outline-none focus:border-blue-500"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {Object.keys(selectedLignes).length > 0 && (
                    <div className="bg-gray-50 px-3 py-2 border-t border-gray-200 text-xs text-gray-500">
                      {Object.keys(selectedLignes).length} ouvrage(s) sélectionné(s)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {type === 'financiere' && (
            <>
              {/* Ouvrages soumis par le ST */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5">
                  <ListChecks className="w-3.5 h-3.5" /> Ouvrages à négocier (basés sur l'offre du ST)
                </label>
                {!accesId ? (
                  <p className="text-xs text-gray-400 italic">Sélectionnez d&apos;abord un sous-traitant.</p>
                ) : loadingLignes ? (
                  <p className="text-xs text-gray-400">Chargement de l&apos;offre du ST…</p>
                ) : stLignes.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Aucun ouvrage chiffré par ce ST.</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                      {stLignes.map((l) => {
                        const sel = selectedLignes[l.chiffrage_ligne_id]
                        const isSel = !!sel
                        const newPu = sel ? Number(sel.prix_unitaire_propose.replace(',', '.')) || 0 : 0
                        const diff = isSel && newPu > 0 && l.prix_unitaire > 0
                          ? ((newPu - l.prix_unitaire) / l.prix_unitaire) * 100
                          : null
                        return (
                          <div key={l.chiffrage_ligne_id}
                            className={cn(
                              'px-3 py-2 flex items-center gap-2',
                              isSel ? 'bg-amber-50/60' : 'hover:bg-gray-50',
                            )}>
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={() => toggleLigne(l)}
                              className="w-3.5 h-3.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 truncate">{l.designation}</p>
                              <p className="text-[11px] text-gray-500 tabular-nums">
                                {l.quantite} {l.unite ?? ''} · PU ST :
                                <span className="font-semibold text-gray-700 ml-1">{formatCurrency(l.prix_unitaire)}</span>
                                {' · '}Total <span className="font-semibold text-gray-700">{formatCurrency(l.total_ht)}</span>
                              </p>
                            </div>
                            {isSel && (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <div className="relative">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={sel.prix_unitaire_propose}
                                    onChange={(e) => updateProposedPrice(l.chiffrage_ligne_id, e.target.value)}
                                    placeholder="Nouveau PU"
                                    className="w-28 pl-2 pr-7 py-1 border border-amber-300 bg-white rounded-md text-xs tabular-nums focus:outline-none focus:border-amber-500"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">€</span>
                                </div>
                                {diff != null && (
                                  <span className={cn(
                                    'text-[10px] px-1.5 py-0.5 rounded font-semibold tabular-nums whitespace-nowrap',
                                    diff < 0 ? 'bg-emerald-100 text-emerald-700' : diff > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600',
                                  )}>
                                    {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {Object.keys(selectedLignes).length > 0 && (
                      <div className="bg-gray-50 px-3 py-2 border-t border-gray-200 text-xs flex justify-between items-center">
                        <span className="text-gray-500">{Object.keys(selectedLignes).length} ouvrage(s) sélectionné(s)</span>
                        <div className="flex gap-3 tabular-nums">
                          <span className="text-gray-500">Total initial : <span className="font-semibold text-gray-800">{formatCurrency(computedTotals.initial)}</span></span>
                          <span className="text-amber-700">Total proposé : <span className="font-bold">{formatCurrency(computedTotals.propose)}</span></span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Montants manuels — visibles uniquement si aucune ligne sélectionnée */}
              {Object.keys(selectedLignes).length === 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Montant initial <Abbr k="HT" /></label>
                    <input type="number" step="0.01" value={montantInitial}
                      onChange={(e) => setMontantInitial(e.target.value)}
                      placeholder="0.00"
                      className={`${inputCls} tabular-nums`} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Montant négocié <Abbr k="HT" /></label>
                    <input type="number" step="0.01" value={montantNegocie}
                      onChange={(e) => setMontantNegocie(e.target.value)}
                      placeholder="0.00"
                      className={`${inputCls} tabular-nums`} />
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Motif / décision (optionnel)</label>
            <input type="text" value={motif} onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex: Validation gérant nécessaire, contre-proposition envoyée…"
              className={inputCls} />
          </div>

          {error && <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
          <button onClick={save} disabled={saving || !contenu.trim()}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
