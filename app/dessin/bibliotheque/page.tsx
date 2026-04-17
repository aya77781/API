'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import {
  Search, X, FileText, Download, Eye, ChevronRight,
  Building2, Ruler, Calendar, FolderOpen, Filter, Layers,
} from 'lucide-react'

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

  const [projets, setProjets]       = useState<ProjetAvecPlans[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterType, setFilterType] = useState('tous')
  const [filterPhase, setFilterPhase] = useState('tous')
  const [selProjet, setSelProjet]   = useState<ProjetAvecPlans | null>(null)
  const [selPlan, setSelPlan]       = useState<Plan | null>(null)

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
      <TopBar title="Bibliotheque" subtitle="Historique des projets realises — plans d'inspiration accessibles en 1 clic" />

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
    </div>
  )
}
