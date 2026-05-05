'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import {
  Search, X, FileText, Download, Eye, ChevronRight,
  Building2, Ruler, Calendar, FolderOpen, Filter, Layers,
  Upload, Plus, Loader2, Trash2, BookOpen, Tag,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'

// ─── Types ────────────────────────────────────────────────────────────────────

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

type ProjetAvecPlans = Projet & { plans: Plan[] }

type Exemple = {
  id: string
  titre: string
  description: string | null
  type_chantier: string | null
  type_plan: string | null
  surface_m2: number | null
  tags: string[] | null
  fichier_path: string
  fichier_nom: string | null
  uploaded_by: string | null
  created_at: string
}

const EXEMPLE_TYPES_PLAN = ['APS','APD','PC','AT','DCE','EXE','DOE','avenant','autre']

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_COLOR: Record<string, string> = {
  conception:   'bg-amber-100 text-amber-700',
  lancement:    'bg-blue-100 text-blue-700',
  consultation: 'bg-purple-100 text-purple-700',
  chantier:     'bg-orange-100 text-orange-700',
  cloture:      'bg-green-100 text-green-700',
}

const PHASE_LABEL: Record<string, string> = {
  conception:   'Conception',
  lancement:    'Lancement',
  consultation: 'Consultation',
  chantier:     'Chantier',
  cloture:      'Cloture',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BibliothequePage() {
  const supabase = useMemo(() => createClient(), [])
  const { profil } = useUser()

  const [tab, setTab] = useState<'projets' | 'exemples'>('projets')

  const [projets, setProjets]       = useState<ProjetAvecPlans[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterType, setFilterType] = useState('tous')
  const [filterPhase, setFilterPhase] = useState('tous')
  const [selProjet, setSelProjet]   = useState<ProjetAvecPlans | null>(null)
  const [selPlan, setSelPlan]       = useState<Plan | null>(null)

  // Exemples
  const [exemples, setExemples] = useState<Exemple[]>([])
  const [loadingEx, setLoadingEx] = useState(false)
  const [exSearch, setExSearch] = useState('')
  const [exFilterType, setExFilterType] = useState('tous')
  const [exFilterChantier, setExFilterChantier] = useState('tous')
  const [showUpload, setShowUpload] = useState(false)

  async function fetchExemples() {
    setLoadingEx(true)
    const { data } = await supabase.schema('app').from('bibliotheque_plans')
      .select('*').order('created_at', { ascending: false })
    setExemples((data ?? []) as Exemple[])
    setLoadingEx(false)
  }

  useEffect(() => { if (tab === 'exemples') fetchExemples() }, [tab])

  // ── Fetch projets + plans valides ──
  useEffect(() => {
    async function load() {
      setLoading(true)

      const [{ data: projData }, { data: plansData }] = await Promise.all([
        supabase.schema('app').from('projets')
          .select('id, nom, reference, type_chantier, surface_m2, adresse, statut, date_debut, date_livraison, client_nom')
          .order('date_livraison', { ascending: false, nullsFirst: false }),
        supabase.schema('app').from('dessin_plans')
          .select('*')
          .in('statut', ['valide', 'archive'])
          .order('created_at', { ascending: false }),
      ])

      const plans = (plansData ?? []) as Plan[]
      const projetsRaw = (projData ?? []) as Projet[]

      // Grouper les plans par projet_nom
      const plansByProjet = new Map<string, Plan[]>()
      plans.forEach(p => {
        const key = p.projet_nom.toLowerCase()
        if (!plansByProjet.has(key)) plansByProjet.set(key, [])
        plansByProjet.get(key)!.push(p)
      })

      // Associer plans aux projets
      const result: ProjetAvecPlans[] = projetsRaw
        .map(proj => ({
          ...proj,
          plans: plansByProjet.get(proj.nom.toLowerCase()) ?? [],
        }))
        .filter(p => p.plans.length > 0)

      setProjets(result)
      setLoading(false)
    }
    load()
  }, [supabase])

  // ── Types de chantier disponibles ──
  const typesChantier = useMemo(() => {
    const set = new Set<string>()
    projets.forEach(p => { if (p.type_chantier) set.add(p.type_chantier) })
    return [...set].sort()
  }, [projets])

  // ── Filtrage ──
  const filtered = useMemo(() => {
    return projets.filter(p => {
      if (filterType !== 'tous' && p.type_chantier !== filterType) return false
      if (filterPhase !== 'tous' && !p.plans.some(pl => pl.phase === filterPhase)) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const match = p.nom.toLowerCase().includes(q) ||
          (p.reference?.toLowerCase().includes(q)) ||
          (p.client_nom?.toLowerCase().includes(q)) ||
          (p.adresse?.toLowerCase().includes(q)) ||
          (p.type_chantier?.toLowerCase().includes(q)) ||
          p.plans.some(pl => pl.lot?.toLowerCase().includes(q) || pl.type_plan.toLowerCase().includes(q))
        if (!match) return false
      }
      return true
    })
  }, [projets, filterType, filterPhase, search])

  // Plans filtres par phase si filtre actif
  function getPlansForDisplay(proj: ProjetAvecPlans) {
    if (filterPhase === 'tous') return proj.plans
    return proj.plans.filter(pl => pl.phase === filterPhase)
  }

  function getFileUrl(path: string) {
    const { data } = supabase.storage.from('projets').getPublicUrl(path)
    return data.publicUrl
  }

  // Stats
  const totalPlans = projets.reduce((acc, p) => acc + p.plans.length, 0)
  const totalFichiers = projets.reduce((acc, p) => acc + p.plans.filter(pl => pl.fichier_path).length, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Bibliotheque" subtitle="Historique des projets realises et exemples d'inspiration" />

      {/* Tabs */}
      <div className="mx-6 mt-4 bg-white border border-gray-200 rounded-xl p-1 inline-flex gap-1">
        <button onClick={() => setTab('projets')}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            tab === 'projets' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}>
          <FolderOpen className="w-3.5 h-3.5 inline mr-1.5" />
          Projets realises
        </button>
        <button onClick={() => setTab('exemples')}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            tab === 'exemples' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}>
          <BookOpen className="w-3.5 h-3.5 inline mr-1.5" />
          Exemples
          {exemples.length > 0 && <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded-full">{exemples.length}</span>}
        </button>
      </div>

      {tab === 'exemples' && (
        <ExemplesPanel
          exemples={exemples}
          loading={loadingEx}
          search={exSearch}
          setSearch={setExSearch}
          filterType={exFilterType}
          setFilterType={setExFilterType}
          filterChantier={exFilterChantier}
          setFilterChantier={setExFilterChantier}
          onUploadClick={() => setShowUpload(true)}
          onDelete={async (id, fichierPath) => {
            await supabase.schema('app').from('bibliotheque_plans').delete().eq('id', id)
            if (fichierPath) await supabase.storage.from('projets').remove([fichierPath])
            fetchExemples()
          }}
          getFileUrl={(p: string) => supabase.storage.from('projets').getPublicUrl(p).data.publicUrl}
        />
      )}

      {showUpload && (
        <UploadExempleModal
          onClose={() => setShowUpload(false)}
          onSaved={() => { setShowUpload(false); fetchExemples() }}
          uploaderId={profil?.id ?? null}
        />
      )}

      {tab === 'projets' && (
      <>

      {/* Stats */}
      <div className="mx-6 mt-4 grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Projets avec plans</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{projets.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Plans references</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalPlans}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Fichiers telechargeables</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalFichiers}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="mx-6 mt-4 bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Recherche */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un projet, client, adresse, lot..."
              className="w-full pl-10 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtre type chantier */}
          <div className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="tous">Tous les types</option>
              {typesChantier.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Filtre phase */}
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-gray-400" />
            <select
              value={filterPhase}
              onChange={e => setFilterPhase(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="tous">Toutes les phases</option>
              {Object.entries(PHASE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {(filterType !== 'tous' || filterPhase !== 'tous' || search) && (
            <button
              onClick={() => { setFilterType('tous'); setFilterPhase('tous'); setSearch('') }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Reinitialiser
            </button>
          )}
        </div>
      </div>

      <div className="px-6 pt-4 pb-8 flex gap-4">
        {/* ── Liste projets ── */}
        <div className="w-96 flex-shrink-0 flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-gray-700">{filtered.length} projet{filtered.length !== 1 ? 's' : ''}</h3>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400 text-center py-12">Chargement...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Aucun projet avec des plans</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-320px)]">
              {filtered.map(proj => {
                const displayPlans = getPlansForDisplay(proj)
                const phases = [...new Set(proj.plans.map(p => p.phase))]
                const fichiers = proj.plans.filter(p => p.fichier_path).length
                return (
                  <button
                    key={proj.id}
                    onClick={() => { setSelProjet(proj); setSelPlan(null) }}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selProjet?.id === proj.id
                        ? 'border-gray-900 bg-gray-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{proj.nom}</p>
                        {proj.reference && (
                          <p className="text-xs text-gray-400 mt-0.5">{proj.reference}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {proj.type_chantier && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                              <Building2 className="w-3 h-3" /> {proj.type_chantier}
                            </span>
                          )}
                          {proj.surface_m2 && (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                              <Ruler className="w-3 h-3" /> {proj.surface_m2} m2
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-xs font-medium text-gray-900">{displayPlans.length} plan{displayPlans.length !== 1 ? 's' : ''}</span>
                        {fichiers > 0 && (
                          <span className="text-xs text-gray-400">{fichiers} fichier{fichiers !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>

                    {/* Phases badges */}
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {phases.map(ph => (
                        <span key={ph} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PHASE_COLOR[ph] ?? 'bg-gray-100 text-gray-500'}`}>
                          {PHASE_LABEL[ph] ?? ph}
                        </span>
                      ))}
                    </div>

                    {proj.client_nom && (
                      <p className="text-xs text-gray-400 mt-1.5 truncate">Client : {proj.client_nom}</p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Detail projet + plans ── */}
        <div className="flex-1 flex flex-col gap-4">
          {selProjet ? (
            <>
              {/* En-tete projet */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selProjet.nom}</h3>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {selProjet.reference && (
                        <span className="text-sm text-gray-500">{selProjet.reference}</span>
                      )}
                      {selProjet.type_chantier && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                          <Building2 className="w-3 h-3" /> {selProjet.type_chantier}
                        </span>
                      )}
                      {selProjet.surface_m2 && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <Ruler className="w-3 h-3" /> {selProjet.surface_m2} m2
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => { setSelProjet(null); setSelPlan(null) }} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-400">Client</p>
                    <p className="text-sm text-gray-700 mt-0.5">{selProjet.client_nom || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Adresse</p>
                    <p className="text-sm text-gray-700 mt-0.5 truncate">{selProjet.adresse || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Periode</p>
                    <p className="text-sm text-gray-700 mt-0.5">
                      {selProjet.date_debut
                        ? new Date(selProjet.date_debut).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
                        : '—'}
                      {selProjet.date_livraison && (
                        <> — {new Date(selProjet.date_livraison).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Plans groupes par phase */}
              {(() => {
                const displayPlans = getPlansForDisplay(selProjet)
                const byPhase = new Map<string, Plan[]>()
                displayPlans.forEach(p => {
                  if (!byPhase.has(p.phase)) byPhase.set(p.phase, [])
                  byPhase.get(p.phase)!.push(p)
                })
                const phaseOrder = ['conception', 'lancement', 'consultation', 'chantier', 'cloture']
                const sortedPhases = [...byPhase.entries()].sort(
                  (a, b) => phaseOrder.indexOf(a[0]) - phaseOrder.indexOf(b[0])
                )

                return sortedPhases.map(([phase, plans]) => (
                  <div key={phase} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PHASE_COLOR[phase] ?? 'bg-gray-100 text-gray-500'}`}>
                        {PHASE_LABEL[phase] ?? phase}
                      </span>
                      <span className="text-xs text-gray-400">{plans.length} plan{plans.length !== 1 ? 's' : ''}</span>
                    </div>

                    <div className="divide-y divide-gray-50">
                      {plans.map(plan => (
                        <div
                          key={plan.id}
                          onClick={() => setSelPlan(selPlan?.id === plan.id ? null : plan)}
                          className={`px-5 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
                            selPlan?.id === plan.id ? 'bg-gray-50' : 'hover:bg-gray-50/50'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            plan.fichier_path ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'
                          }`}>
                            <FileText className="w-4 h-4" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900">{plan.type_plan}</p>
                              <span className="text-xs text-gray-400">Indice {plan.indice}</span>
                              {plan.lot && (
                                <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{plan.lot}</span>
                              )}
                            </div>
                            {plan.description && (
                              <p className="text-xs text-gray-400 truncate mt-0.5">{plan.description}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {plan.fichier_path && plan.fichier_nom && (
                              <a
                                href={getFileUrl(plan.fichier_path)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Voir
                              </a>
                            )}
                            <span className="text-xs text-gray-400">
                              {new Date(plan.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()}

              {/* Detail plan selectionne */}
              {selPlan && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {selPlan.type_plan} — Indice {selPlan.indice}
                      {selPlan.lot && <span className="text-gray-400 font-normal"> · {selPlan.lot}</span>}
                    </h4>
                    <button onClick={() => setSelPlan(null)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {selPlan.description && (
                    <p className="text-sm text-gray-600">{selPlan.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${PHASE_COLOR[selPlan.phase] ?? 'bg-gray-100 text-gray-500'}`}>
                      {PHASE_LABEL[selPlan.phase] ?? selPlan.phase}
                    </span>
                    <span>
                      <Calendar className="w-3 h-3 inline mr-1" />
                      {new Date(selPlan.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                  </div>

                  {selPlan.fichier_path && selPlan.fichier_nom && (
                    <a
                      href={getFileUrl(selPlan.fichier_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-blue-700 truncate">{selPlan.fichier_nom}</p>
                        <p className="text-xs text-blue-500">Cliquer pour ouvrir / telecharger</p>
                      </div>
                      <Download className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    </a>
                  )}

                  {!selPlan.fichier_path && (
                    <p className="text-xs text-gray-400 italic p-3 bg-gray-50 rounded-lg">Aucun fichier attache a ce plan</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 h-80 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Selectionnez un projet</p>
                <p className="text-xs mt-1">pour explorer les plans et s'en inspirer</p>
              </div>
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  )
}

// ─── Panneau Exemples ─────────────────────────────────────────────────────────

function ExemplesPanel({
  exemples, loading, search, setSearch, filterType, setFilterType, filterChantier, setFilterChantier,
  onUploadClick, onDelete, getFileUrl,
}: {
  exemples: Exemple[]
  loading: boolean
  search: string; setSearch: (v: string) => void
  filterType: string; setFilterType: (v: string) => void
  filterChantier: string; setFilterChantier: (v: string) => void
  onUploadClick: () => void
  onDelete: (id: string, fichierPath: string) => Promise<void>
  getFileUrl: (path: string) => string
}) {
  const typesChantier = [...new Set(exemples.map(e => e.type_chantier).filter(Boolean) as string[])].sort()

  const filtered = exemples.filter(e => {
    if (filterType !== 'tous' && (e.type_plan ?? 'autre') !== filterType) return false
    if (filterChantier !== 'tous' && e.type_chantier !== filterChantier) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const m = e.titre.toLowerCase().includes(q) ||
        (e.description?.toLowerCase().includes(q)) ||
        (e.tags ?? []).some(t => t.toLowerCase().includes(q)) ||
        (e.type_chantier?.toLowerCase().includes(q))
      if (!m) return false
    }
    return true
  })

  return (
    <div className="px-6 pt-4 pb-8 space-y-4">
      {/* Filtres + upload */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par titre, tag, type..."
            className="w-full pl-10 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
          <option value="tous">Tous les types</option>
          {EXEMPLE_TYPES_PLAN.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterChantier} onChange={e => setFilterChantier(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
          <option value="tous">Tous les chantiers</option>
          {typesChantier.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={onUploadClick}
          className="ml-auto inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700">
          <Plus className="w-3.5 h-3.5" /> Ajouter un exemple
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-12">Chargement...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{exemples.length === 0 ? "Aucun exemple pour le moment" : "Aucun resultat"}</p>
          <p className="text-xs text-gray-400 mt-1">{exemples.length === 0 ? 'Clique sur « Ajouter un exemple » pour deposer un plan d\'inspiration.' : 'Essayez un autre filtre.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(e => (
            <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 text-xs font-bold rounded bg-gray-900 text-white flex-shrink-0">{e.type_plan ?? 'autre'}</span>
                  {e.type_chantier && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full truncate">{e.type_chantier}</span>}
                </div>
                <button onClick={() => onDelete(e.id, e.fichier_path)} title="Supprimer"
                  className="text-gray-300 hover:text-red-500 flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2">{e.titre}</p>
              {e.description && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{e.description}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-400 mt-auto pt-2">
                {e.surface_m2 && <span><Ruler className="w-3 h-3 inline mr-0.5" />{e.surface_m2} m2</span>}
                <span><Calendar className="w-3 h-3 inline mr-0.5" />{new Date(e.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
              {e.tags && e.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {e.tags.slice(0, 4).map(t => (
                    <span key={t} className="text-xs px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded inline-flex items-center gap-0.5">
                      <Tag className="w-2.5 h-2.5" />{t}
                    </span>
                  ))}
                  {e.tags.length > 4 && <span className="text-xs text-gray-400">+{e.tags.length - 4}</span>}
                </div>
              )}
              <a href={getFileUrl(e.fichier_path)} target="_blank" rel="noopener noreferrer"
                className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors text-sm">
                <FileText className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <span className="text-blue-700 truncate flex-1">{e.fichier_nom ?? 'Ouvrir'}</span>
                <Download className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Modale upload exemple ────────────────────────────────────────────────────

function UploadExempleModal({ onClose, onSaved, uploaderId }: {
  onClose: () => void
  onSaved: () => void
  uploaderId: string | null
}) {
  const supabase = useMemo(() => createClient(), [])
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [typeChantier, setTypeChantier] = useState('')
  const [typePlan, setTypePlan] = useState('APS')
  const [surface, setSurface] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function envoyer() {
    setError(null)
    if (!titre.trim()) { setError('Titre requis'); return }
    if (!file) { setError('Joindre un fichier'); return }
    setSaving(true)
    try {
      const path = `bibliotheque/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from('projets').upload(path, file, { upsert: true })
      if (upErr) throw upErr

      const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
      const { error: insErr } = await supabase.schema('app').from('bibliotheque_plans').insert([{
        titre: titre.trim(),
        description: description.trim() || null,
        type_chantier: typeChantier.trim() || null,
        type_plan: typePlan || null,
        surface_m2: surface ? Number(surface) : null,
        tags: tags.length ? tags : null,
        fichier_path: path,
        fichier_nom: file.name,
        uploaded_by: uploaderId,
      }])
      if (insErr) throw insErr
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    }
    setSaving(false)
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Ajouter un exemple a la bibliotheque</h3>
            <p className="text-xs text-gray-500 mt-0.5">Plan d&apos;inspiration reutilisable sur d&apos;autres projets</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Titre *</label>
            <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ex: Loft 130 m2 verrieres atelier" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Notes utiles, contexte, points cles..." className={`${inputCls} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Type de plan</label>
              <select value={typePlan} onChange={e => setTypePlan(e.target.value)} className={`${inputCls} bg-white`}>
                {EXEMPLE_TYPES_PLAN.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Type de chantier</label>
              <input value={typeChantier} onChange={e => setTypeChantier(e.target.value)}
                placeholder="Ex: Renovation, Tertiaire..." className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Surface (m2)</label>
              <input type="number" value={surface} onChange={e => setSurface(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tags (separes par virgule)</label>
              <input value={tagsRaw} onChange={e => setTagsRaw(e.target.value)}
                placeholder="cuisine ouverte, beton cire, parquet" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fichier *</label>
            {file ? (
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 truncate">{file.name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{(file.size / 1024).toFixed(0)} Ko</span>
                </div>
                <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <label className="flex items-center gap-2 w-full border border-dashed border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-50 justify-center cursor-pointer">
                <Upload className="w-4 h-4" /> Selectionner (PDF, DWG, image...)
                <input type="file" className="hidden" accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg"
                  onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>
          {error && <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
          <button onClick={envoyer} disabled={saving || !titre.trim() || !file}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Ajouter l&apos;exemple
          </button>
        </div>
      </div>
    </div>
  )
}
