'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { cn } from '@/lib/utils'
import {
  Search, X, Upload, Trash2, FileText, Eye,
  FolderOpen, Plus, Check, Pencil, ArrowUp, ArrowDown,
  Library, PencilRuler, Calculator, Building2, Calendar,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'

// ─── Types ──────────────────────────────────────────────────────────────────

type Projet = {
  id: string
  nom: string
  reference: string | null
  type_chantier: string | null
  surface_m2: number | null
  adresse: string | null
  statut: string | null
  date_debut: string | null
  date_livraison: string | null
  client_nom: string | null
}

type Plan = {
  id: string
  projet_nom: string
  phase: string
  type_plan: string
  indice: string
  lot: string | null
  statut: string
  description: string | null
  fichier_path: string | null
  fichier_nom: string | null
  created_at: string
}

type CorpsEtat = {
  id: string
  nom: string
  ordre: number
  actif: boolean
  count: number
}

type Ouvrage = {
  id: string
  corps_etat_id: string
  nom: string
  description: string
  unite: string
  prix_ref: number | null
  actif: boolean
}

const UNITES = ['u', 'ml', 'm2', 'm3', 'kg', 'h', 'jour', 'forfait'] as const

const PHASES = [
  { value: 'conception',   label: 'Conception' },
  { value: 'lancement',    label: 'Lancement' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'chantier',     label: 'Chantier' },
  { value: 'cloture',      label: 'Cloture' },
]

const PHASE_COLOR: Record<string, string> = {
  conception:   'bg-amber-100 text-amber-700',
  lancement:    'bg-blue-100 text-blue-700',
  consultation: 'bg-purple-100 text-purple-700',
  chantier:     'bg-orange-100 text-orange-700',
  cloture:      'bg-green-100 text-green-700',
}

const PHASE_LABEL: Record<string, string> = Object.fromEntries(PHASES.map(p => [p.value, p.label]))

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AdminBibliothequePage() {
  const [tab, setTab] = useState<'dessin' | 'economiste'>('dessin')

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar
        title="Bibliotheque"
        subtitle="Alimenter les bibliotheques Dessin et Economiste avec des inspirations et references"
      />

      {/* Tabs */}
      <div className="mx-6 mt-4 flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('dessin')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
            tab === 'dessin'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          )}
        >
          <PencilRuler className="w-4 h-4" />
          Dessin / BIM
        </button>
        <button
          onClick={() => setTab('economiste')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
            tab === 'economiste'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          )}
        >
          <Calculator className="w-4 h-4" />
          Economiste
        </button>
      </div>

      {tab === 'dessin' ? <DessinTab /> : <EconomisteTab />}
    </div>
  )
}

// ─── Tab Dessin ─────────────────────────────────────────────────────────────

function DessinTab() {
  const supabase = useMemo(() => createClient(), [])
  const fileRef = useRef<HTMLInputElement>(null)

  const [projets, setProjets]   = useState<Projet[]>([])
  const [plans, setPlans]       = useState<Plan[]>([])
  const [loading, setLoading]   = useState(true)
  const [selProjet, setSelProjet] = useState<Projet | null>(null)
  const [search, setSearch]     = useState('')

  // Modal ajout plan
  const [showAdd, setShowAdd]   = useState(false)
  const [addPhase, setAddPhase] = useState('conception')
  const [addType, setAddType]   = useState('')
  const [addIndice, setAddIndice] = useState('A')
  const [addLot, setAddLot]     = useState('')
  const [addDesc, setAddDesc]   = useState('')
  const [addFile, setAddFile]   = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [{ data: projData }, { data: plansData }] = await Promise.all([
      supabase.schema('app').from('projets')
        .select('id, nom, reference, type_chantier, surface_m2, adresse, statut, date_debut, date_livraison, client_nom')
        .order('date_livraison', { ascending: false, nullsFirst: false }),
      supabase.schema('app').from('dessin_plans')
        .select('*')
        .order('created_at', { ascending: false }),
    ])
    setProjets((projData ?? []) as Projet[])
    setPlans((plansData ?? []) as Plan[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { refresh() }, [refresh])

  // Plans par projet (match par nom)
  const plansByProjet = useMemo(() => {
    const map = new Map<string, Plan[]>()
    plans.forEach(p => {
      const key = p.projet_nom.toLowerCase()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    })
    return map
  }, [plans])

  // Projets filtres
  const filteredProjets = useMemo(() => {
    if (!search.trim()) return projets
    const q = search.toLowerCase()
    return projets.filter(p =>
      p.nom.toLowerCase().includes(q) ||
      p.reference?.toLowerCase().includes(q) ||
      p.client_nom?.toLowerCase().includes(q) ||
      p.adresse?.toLowerCase().includes(q),
    )
  }, [projets, search])

  // Plans du projet selectionne
  const plansProjet = useMemo(() => {
    if (!selProjet) return []
    return plansByProjet.get(selProjet.nom.toLowerCase()) ?? []
  }, [selProjet, plansByProjet])

  async function handleUpload() {
    if (!selProjet || !addType.trim() || !addFile) return
    setUploading(true)
    try {
      const ts = Date.now()
      const safe = addFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `bibliotheque/dessin/${selProjet.id}/${ts}_${safe}`

      const { error: upErr } = await supabase.storage.from('projets').upload(storagePath, addFile, { upsert: false })
      if (upErr) { console.error(upErr); setUploading(false); return }

      const { data: inserted } = await supabase.schema('app').from('dessin_plans')
        .insert({
          projet_nom: selProjet.nom,
          phase: addPhase,
          type_plan: addType.trim(),
          indice: addIndice.trim() || 'A',
          lot: addLot.trim() || null,
          statut: 'valide',
          description: addDesc.trim() || null,
          fichier_path: storagePath,
          fichier_nom: addFile.name,
        })
        .select()
        .single()

      if (inserted) setPlans(prev => [inserted as Plan, ...prev])

      setShowAdd(false)
      setAddPhase('conception'); setAddType(''); setAddIndice('A')
      setAddLot(''); setAddDesc(''); setAddFile(null)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(plan: Plan) {
    if (plan.fichier_path) await supabase.storage.from('projets').remove([plan.fichier_path])
    await supabase.schema('app').from('dessin_plans').delete().eq('id', plan.id)
    setPlans(prev => prev.filter(p => p.id !== plan.id))
  }

  async function openFile(path: string) {
    const { data } = await supabase.storage.from('projets').createSignedUrl(path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="px-6 pt-4 pb-8 flex gap-4">
      {/* Liste projets */}
      <div className="w-96 flex-shrink-0 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un projet..."
            className="w-full pl-10 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300 bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500 pt-1">
          {filteredProjets.length} projet{filteredProjets.length !== 1 ? 's' : ''}
        </p>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-12">Chargement...</p>
        ) : filteredProjets.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aucun projet</p>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
            {filteredProjets.map(proj => {
              const pCount = plansByProjet.get(proj.nom.toLowerCase())?.length ?? 0
              return (
                <button
                  key={proj.id}
                  onClick={() => setSelProjet(proj)}
                  className={cn(
                    'w-full text-left p-3 rounded-xl border transition-all',
                    selProjet?.id === proj.id
                      ? 'border-gray-900 bg-gray-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{proj.nom}</p>
                      {proj.reference && <p className="text-xs text-gray-400 mt-0.5">{proj.reference}</p>}
                      {proj.type_chantier && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full mt-1.5">
                          <Building2 className="w-3 h-3" /> {proj.type_chantier}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-900 flex-shrink-0">
                      {pCount} plan{pCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail projet + plans */}
      <div className="flex-1 flex flex-col gap-4">
        {selProjet ? (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selProjet.nom}</h3>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {selProjet.reference && <span className="text-sm text-gray-500">{selProjet.reference}</span>}
                    {selProjet.client_nom && <span className="text-sm text-gray-500">Client : {selProjet.client_nom}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setShowAdd(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Deposer un plan
                </button>
              </div>
            </div>

            {plansProjet.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 h-64 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">Aucun plan pour ce projet</p>
                  <p className="text-xs mt-1">Ajoutez des plans d'inspiration accessibles a la dessinatrice</p>
                </div>
              </div>
            ) : (
              (() => {
                const byPhase = new Map<string, Plan[]>()
                plansProjet.forEach(p => {
                  if (!byPhase.has(p.phase)) byPhase.set(p.phase, [])
                  byPhase.get(p.phase)!.push(p)
                })
                const phaseOrder = ['conception', 'lancement', 'consultation', 'chantier', 'cloture']
                const sorted = [...byPhase.entries()].sort((a, b) => phaseOrder.indexOf(a[0]) - phaseOrder.indexOf(b[0]))

                return sorted.map(([phase, list]) => (
                  <div key={phase} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PHASE_COLOR[phase] ?? 'bg-gray-100 text-gray-500')}>
                        {PHASE_LABEL[phase] ?? phase}
                      </span>
                      <span className="text-xs text-gray-400">{list.length} plan{list.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {list.map(plan => (
                        <div key={plan.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/50">
                          <div className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                            plan.fichier_path ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400',
                          )}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-gray-900">{plan.type_plan}</p>
                              <span className="text-xs text-gray-400">Indice {plan.indice}</span>
                              {plan.lot && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{plan.lot}</span>}
                              <span className={cn(
                                'text-xs px-1.5 py-0.5 rounded',
                                plan.statut === 'valide' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500',
                              )}>
                                {plan.statut}
                              </span>
                            </div>
                            {plan.description && <p className="text-xs text-gray-400 truncate mt-0.5">{plan.description}</p>}
                            <p className="text-xs text-gray-400 mt-0.5 inline-flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(plan.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {plan.fichier_path && (
                              <button
                                onClick={() => openFile(plan.fichier_path!)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Voir
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(plan)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()
            )}
          </>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 h-80 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <Library className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Selectionnez un projet</p>
              <p className="text-xs mt-1">pour ajouter des plans d'inspiration a la bibliotheque de la dessinatrice</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal ajout plan */}
      {showAdd && selProjet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Deposer un plan d'inspiration</h3>
                <p className="text-xs text-gray-400 mt-0.5">Projet : {selProjet.nom}</p>
              </div>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phase *</label>
                  <select
                    value={addPhase}
                    onChange={e => setAddPhase(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Indice</label>
                  <input
                    type="text"
                    value={addIndice}
                    onChange={e => setAddIndice(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type de plan *</label>
                <input
                  type="text"
                  value={addType}
                  onChange={e => setAddType(e.target.value)}
                  placeholder="Ex: Plan masse, Coupe AA, Facade nord..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Lot</label>
                <input
                  type="text"
                  value={addLot}
                  onChange={e => setAddLot(e.target.value)}
                  placeholder="Optionnel — Ex: Gros oeuvre, Menuiseries..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={addDesc}
                  onChange={e => setAddDesc(e.target.value)}
                  rows={2}
                  placeholder="Remarques, contexte..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fichier *</label>
                <input
                  ref={fileRef}
                  type="file"
                  onChange={e => setAddFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-6 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  {addFile ? addFile.name : 'Cliquer pour choisir un fichier'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Annuler
              </button>
              <button
                onClick={handleUpload}
                disabled={!addType.trim() || !addFile || uploading}
                className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? 'Envoi...' : 'Deposer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab Economiste ─────────────────────────────────────────────────────────

function EconomisteTab() {
  const supabase = useMemo(() => createClient(), [])
  const [corps, setCorps] = useState<CorpsEtat[]>([])
  const [ouvrages, setOuvrages] = useState<Ouvrage[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [loadingC, setLoadingC] = useState(true)
  const [loadingO, setLoadingO] = useState(false)
  const [search, setSearch] = useState('')

  const [addingCorps, setAddingCorps] = useState(false)
  const [newCorpsNom, setNewCorpsNom] = useState('')
  const [editCorpsId, setEditCorpsId] = useState<string | null>(null)
  const [editCorpsNom, setEditCorpsNom] = useState('')

  const [showAddOuvrage, setShowAddOuvrage] = useState(false)
  const [ouvrNom, setOuvrNom] = useState('')
  const [ouvrDesc, setOuvrDesc] = useState('')
  const [ouvrUnite, setOuvrUnite] = useState('u')
  const [ouvrPrix, setOuvrPrix] = useState('')
  const [savingOuvr, setSavingOuvr] = useState(false)

  const refreshCorps = useCallback(async () => {
    setLoadingC(true)
    const [{ data: cData }, { data: counts }] = await Promise.all([
      supabase.from('biblio_corps_etat').select('*').eq('actif', true).is('projet_id', null).order('ordre'),
      supabase.from('biblio_ouvrages').select('corps_etat_id').eq('actif', true),
    ])
    const countMap = new Map<string, number>()
    ;((counts ?? []) as { corps_etat_id: string }[]).forEach(r => {
      countMap.set(r.corps_etat_id, (countMap.get(r.corps_etat_id) ?? 0) + 1)
    })
    const rows = ((cData ?? []) as { id: string; nom: string; ordre: number; actif: boolean }[]).map(c => ({
      ...c,
      count: countMap.get(c.id) ?? 0,
    }))
    setCorps(rows)
    setSelectedId(prev => rows.some(r => r.id === prev) ? prev : (rows[0]?.id || ''))
    setLoadingC(false)
  }, [supabase])

  useEffect(() => { refreshCorps() }, [refreshCorps])

  useEffect(() => {
    if (!selectedId) { setOuvrages([]); return }
    let cancelled = false
    setLoadingO(true)
    supabase
      .from('biblio_ouvrages')
      .select('*')
      .eq('corps_etat_id', selectedId)
      .eq('actif', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setOuvrages((data ?? []) as Ouvrage[])
        setLoadingO(false)
      })
    return () => { cancelled = true }
  }, [selectedId, supabase])

  async function addCorps() {
    if (!newCorpsNom.trim()) return
    const maxOrdre = corps.reduce((m, c) => Math.max(m, c.ordre), 0)
    await supabase.from('biblio_corps_etat').insert({ nom: newCorpsNom.trim(), ordre: maxOrdre + 1 } as never)
    setNewCorpsNom(''); setAddingCorps(false)
    refreshCorps()
  }

  async function saveCorpsNom() {
    if (!editCorpsId || !editCorpsNom.trim()) { setEditCorpsId(null); return }
    await supabase.from('biblio_corps_etat').update({ nom: editCorpsNom.trim() } as never).eq('id', editCorpsId)
    setEditCorpsId(null)
    refreshCorps()
  }

  async function archiveCorps(id: string) {
    await supabase.from('biblio_corps_etat').update({ actif: false } as never).eq('id', id)
    if (selectedId === id) setSelectedId('')
    refreshCorps()
  }

  async function moveCorps(id: string, dir: -1 | 1) {
    const idx = corps.findIndex(c => c.id === id)
    if (idx < 0) return
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= corps.length) return
    const a = corps[idx], b = corps[swapIdx]
    await Promise.all([
      supabase.from('biblio_corps_etat').update({ ordre: b.ordre } as never).eq('id', a.id),
      supabase.from('biblio_corps_etat').update({ ordre: a.ordre } as never).eq('id', b.id),
    ])
    refreshCorps()
  }

  async function addOuvrage() {
    if (!ouvrNom.trim() || !selectedId) return
    setSavingOuvr(true)
    await supabase.from('biblio_ouvrages').insert({
      corps_etat_id: selectedId,
      nom: ouvrNom.trim(),
      description: ouvrDesc.trim(),
      unite: ouvrUnite,
      prix_ref: ouvrPrix ? parseFloat(ouvrPrix) : 0,
    } as never)
    setSavingOuvr(false)
    setShowAddOuvrage(false)
    setOuvrNom(''); setOuvrDesc(''); setOuvrUnite('u'); setOuvrPrix('')
    const { data } = await supabase.from('biblio_ouvrages').select('*')
      .eq('corps_etat_id', selectedId).eq('actif', true).order('created_at', { ascending: false })
    setOuvrages((data ?? []) as Ouvrage[])
    refreshCorps()
  }

  async function updateOuvrage(id: string, patch: Partial<Ouvrage>) {
    await supabase.from('biblio_ouvrages').update(patch as never).eq('id', id)
    setOuvrages(prev => prev.map(o => (o.id === id ? { ...o, ...patch } : o)))
  }

  async function archiveOuvrage(id: string) {
    await supabase.from('biblio_ouvrages').update({ actif: false } as never).eq('id', id)
    setOuvrages(prev => prev.filter(o => o.id !== id))
    refreshCorps()
  }

  const filtered = ouvrages.filter(o => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return o.nom.toLowerCase().includes(q) || o.description.toLowerCase().includes(q)
  })

  const selectedCorps = corps.find(c => c.id === selectedId)

  return (
    <div className="p-6">
      <div className="flex items-stretch gap-4 min-h-[600px]">
        {/* Corps d'etat */}
        <aside className="w-[260px] flex-shrink-0 bg-gray-50 border border-gray-200 rounded-lg flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Corps d'etat</h3>
            <p className="text-xs text-gray-400 mt-0.5">{corps.length} corps actifs</p>
          </div>

          <ul className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {loadingC && <li className="text-xs text-gray-400 text-center py-6">Chargement...</li>}
            {corps.map(c => {
              const isActive = c.id === selectedId
              const isEditing = editCorpsId === c.id
              return (
                <li key={c.id} className="group">
                  {isEditing ? (
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <input
                        type="text"
                        value={editCorpsNom}
                        onChange={e => setEditCorpsNom(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveCorpsNom(); if (e.key === 'Escape') setEditCorpsId(null) }}
                        className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none"
                        autoFocus
                      />
                      <button onClick={saveCorpsNom} className="text-blue-600"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditCorpsId(null)} className="text-gray-400"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        'w-full px-3 py-2 rounded-md text-left transition-colors flex items-center gap-2',
                        isActive ? 'bg-blue-50 border-l-[3px] border-[#185FA5] pl-[9px]' : 'hover:bg-white border-l-[3px] border-transparent pl-[9px]',
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{c.nom}</div>
                        <div className="text-[11px] text-gray-400">{c.count} ouvrage{c.count !== 1 ? 's' : ''}</div>
                      </div>
                      <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                        <button onClick={e => { e.stopPropagation(); moveCorps(c.id, -1) }} className="p-0.5 text-gray-400 hover:text-gray-700"><ArrowUp className="w-3 h-3" /></button>
                        <button onClick={e => { e.stopPropagation(); moveCorps(c.id, 1) }} className="p-0.5 text-gray-400 hover:text-gray-700"><ArrowDown className="w-3 h-3" /></button>
                        <button onClick={e => { e.stopPropagation(); setEditCorpsId(c.id); setEditCorpsNom(c.nom) }} className="p-0.5 text-gray-400 hover:text-gray-700"><Pencil className="w-3 h-3" /></button>
                        <button onClick={e => { e.stopPropagation(); archiveCorps(c.id) }} className="p-0.5 text-gray-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </button>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="p-2 border-t border-gray-200">
            {addingCorps ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newCorpsNom}
                  onChange={e => setNewCorpsNom(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addCorps(); if (e.key === 'Escape') setAddingCorps(false) }}
                  placeholder="Nom du corps d'etat"
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <button onClick={addCorps} className="text-blue-600 p-1"><Check className="w-4 h-4" /></button>
                <button onClick={() => setAddingCorps(false)} className="text-gray-400 p-1"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <button
                onClick={() => setAddingCorps(true)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 border border-dashed border-gray-300 rounded-md hover:border-gray-500 hover:text-gray-900"
              >
                <Plus className="w-3.5 h-3.5" /> Nouveau corps d'etat
              </button>
            )}
          </div>
        </aside>

        {/* Ouvrages */}
        <section className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg flex flex-col">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {selectedCorps?.nom ?? 'Selectionnez un corps d\'etat'}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">{filtered.length} ouvrage{filtered.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md w-48 focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={() => setShowAddOuvrage(true)}
                disabled={!selectedId}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" /> Nouvel ouvrage
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loadingO ? (
              <p className="text-sm text-gray-400 text-center py-10">Chargement...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Aucun ouvrage</p>
                <p className="text-xs text-gray-400 mt-1">Ajoutez des ouvrages de reference — ils seront disponibles pour l'economiste dans chaque lot.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(o => (
                  <OuvrageCard
                    key={o.id}
                    ouvrage={o}
                    onUpdate={patch => updateOuvrage(o.id, patch)}
                    onArchive={() => archiveOuvrage(o.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {showAddOuvrage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Nouvel ouvrage</h3>
              <button onClick={() => setShowAddOuvrage(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nom *</label>
                <input
                  type="text"
                  value={ouvrNom}
                  onChange={e => setOuvrNom(e.target.value)}
                  placeholder="ex: Luminaire type pave led 600x600"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description technique</label>
                <textarea
                  rows={3}
                  value={ouvrDesc}
                  onChange={e => setOuvrDesc(e.target.value)}
                  placeholder="Caracteristiques, normes, marque de reference..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 resize-y"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Unite</label>
                  <select
                    value={ouvrUnite}
                    onChange={e => setOuvrUnite(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none"
                  >
                    {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Prix ref. HT</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ouvrPrix}
                    onChange={e => setOuvrPrix(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowAddOuvrage(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              <button
                onClick={addOuvrage}
                disabled={savingOuvr || !ouvrNom.trim()}
                className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:bg-gray-300"
              >
                {savingOuvr ? 'Creation...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Carte Ouvrage ──────────────────────────────────────────────────────────

function OuvrageCard({
  ouvrage, onUpdate, onArchive,
}: {
  ouvrage: Ouvrage
  onUpdate: (patch: Partial<Ouvrage>) => void
  onArchive: () => void
}) {
  const [nom, setNom] = useState(ouvrage.nom)
  const [desc, setDesc] = useState(ouvrage.description)
  const [unite, setUnite] = useState(ouvrage.unite)
  const [prix, setPrix] = useState(String(ouvrage.prix_ref ?? ''))
  const debounce = useRef<NodeJS.Timeout | null>(null)

  function save(patch: Partial<Ouvrage>) {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => { onUpdate(patch) }, 800)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-3 hover:bg-gray-50/50 transition-colors group">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <input
            type="text"
            value={nom}
            onChange={e => { setNom(e.target.value); save({ nom: e.target.value }) }}
            className="w-full text-sm font-medium text-gray-900 bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none px-0 py-0.5"
          />
          <textarea
            value={desc}
            onChange={e => { setDesc(e.target.value); save({ description: e.target.value }) }}
            placeholder="Description technique..."
            rows={1}
            className="w-full text-xs text-gray-500 bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none px-0 py-0.5 resize-none"
          />
          <div className="flex items-center gap-3">
            <select
              value={unite}
              onChange={e => { setUnite(e.target.value); onUpdate({ unite: e.target.value }) }}
              className="text-xs text-gray-600 bg-transparent border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none"
            >
              {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <input
                type="number"
                step="0.01"
                value={prix}
                onChange={e => { setPrix(e.target.value); save({ prix_ref: parseFloat(e.target.value) || 0 }) }}
                className="w-20 px-1.5 py-0.5 text-right tabular-nums bg-transparent border border-gray-200 rounded focus:outline-none focus:border-blue-400"
              />
              <span className="text-gray-400">EUR HT</span>
            </div>
          </div>
        </div>
        <button
          onClick={onArchive}
          className="hidden group-hover:flex items-center p-1.5 text-gray-400 hover:text-red-600 rounded"
          title="Supprimer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
