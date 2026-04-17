'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { useUser } from '@/hooks/useUser'
import {
  Plus, X, ChevronRight, Upload, FileText, Check,
  Calendar, User, Layers, Download, AlertTriangle,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Projet = { id: string; nom: string; statut: string }
type Lot    = { id: string; projet_id: string; corps_etat: string; numero: number }
type Utilisateur = { id: string; prenom: string; nom: string; role: string }

type CR = {
  id: string; projet_id: string; co_id: string; titre: string
  contenu: string; date_visite: string; lots_impactes: string[]
  statut: string; created_at: string
}

type PlanExe = {
  id: string; projet_id: string; lot_id: string; indice: string
  fichier_url: string | null; fichier_nom: string | null
  statut: 'en_cours' | 'valide' | 'archive'
  cr_source_id: string | null; notes: string | null
  created_by: string | null; created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INDICES = ['A','B','C','D','E','F','G','H','I','J']

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChantierPage() {
  const supabase = useMemo(() => createClient(), [])
  const { user } = useUser()

  const [projets, setProjets]       = useState<Projet[]>([])
  const [lots, setLots]             = useState<Lot[]>([])
  const [users, setUsers]           = useState<Utilisateur[]>([])
  const [crs, setCrs]               = useState<CR[]>([])
  const [plans, setPlans]           = useState<PlanExe[]>([])
  const [loading, setLoading]       = useState(true)

  // Selections
  const [selProjetId, setSelProjetId] = useState('')
  const [selLotId, setSelLotId]       = useState('')

  // Modal nouvel indice
  const [showModal, setShowModal]   = useState(false)
  const [modalLotId, setModalLotId] = useState('')
  const [modalFile, setModalFile]   = useState<File | null>(null)
  const [modalCrId, setModalCrId]   = useState('')
  const [modalNotes, setModalNotes] = useState('')
  const [modalSaving, setModalSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Notes edition
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesValue, setNotesValue]     = useState('')

  // ── Load initial ──
  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: u }] = await Promise.all([
        supabase.schema('app').from('projets').select('id, nom, statut').order('nom'),
        supabase.schema('app').from('utilisateurs').select('id, prenom, nom, role').eq('actif', true),
      ])
      setProjets((p ?? []) as Projet[])
      setUsers((u ?? []) as Utilisateur[])
      if (p && p.length > 0) setSelProjetId(p[0].id)
      setLoading(false)
    }
    load()
  }, [supabase])

  // ── Load projet-specific data ──
  useEffect(() => {
    if (!selProjetId) { setLots([]); setCrs([]); setPlans([]); return }
    async function loadProjet() {
      const [{ data: l }, { data: c }, { data: pe }] = await Promise.all([
        supabase.schema('app').from('lots').select('id, projet_id, corps_etat, numero').eq('projet_id', selProjetId).order('numero'),
        supabase.schema('app').from('cr_chantier').select('*').eq('projet_id', selProjetId).eq('statut', 'publie').order('date_visite', { ascending: false }),
        supabase.schema('app').from('plans_exe').select('*').eq('projet_id', selProjetId).order('created_at', { ascending: false }),
      ])
      setLots((l ?? []) as Lot[])
      setCrs((c ?? []) as CR[])
      setPlans((pe ?? []) as PlanExe[])
      setSelLotId('')
    }
    loadProjet()
  }, [selProjetId, supabase])

  async function refresh() {
    if (!selProjetId) return
    const [{ data: c }, { data: pe }] = await Promise.all([
      supabase.schema('app').from('cr_chantier').select('*').eq('projet_id', selProjetId).eq('statut', 'publie').order('date_visite', { ascending: false }),
      supabase.schema('app').from('plans_exe').select('*').eq('projet_id', selProjetId).order('created_at', { ascending: false }),
    ])
    setCrs((c ?? []) as CR[])
    setPlans((pe ?? []) as PlanExe[])
  }

  // ── Helpers ──
  function findUser(id: string | null) { return id ? users.find(u => u.id === id) : null }
  function findLot(id: string) { return lots.find(l => l.id === id) }
  function findCr(id: string | null) { return id ? crs.find(c => c.id === id) : null }
  function getFileUrl(path: string) { return supabase.storage.from('projets').getPublicUrl(path).data.publicUrl }

  function plansForLot(lotId: string) { return plans.filter(p => p.lot_id === lotId).sort((a,b) => INDICES.indexOf(a.indice) - INDICES.indexOf(b.indice)) }
  function currentPlan(lotId: string) { return plans.find(p => p.lot_id === lotId && p.statut === 'en_cours') }
  function nextIndice(lotId: string): string {
    const existing = plansForLot(lotId)
    if (existing.length === 0) return 'A'
    const last = existing[existing.length - 1]
    const idx = INDICES.indexOf(last.indice)
    return INDICES[idx + 1] ?? String.fromCharCode(last.indice.charCodeAt(0) + 1)
  }

  // Combien de lots impactes par un CR n'ont pas encore de plan mis a jour apres ce CR
  function crPendingCount(cr: CR): number {
    return (cr.lots_impactes ?? []).filter(lotId => {
      const lotPlans = plansForLot(lotId)
      return !lotPlans.some(p => p.cr_source_id === cr.id)
    }).length
  }

  // ── Valider un plan ──
  async function validerPlan(plan: PlanExe) {
    await supabase.schema('app').from('plans_exe').update({ statut: 'valide' }).eq('id', plan.id)
    // Notifier le CO
    const proj = projets.find(p => p.id === plan.projet_id)
    const lot = findLot(plan.lot_id)
    if (proj) {
      // Trouver le CO du projet
      const { data: projFull } = await supabase.schema('app').from('projets').select('co_id').eq('id', proj.id).single()
      if (projFull?.co_id) {
        await supabase.schema('app').from('alertes').insert([{
          utilisateur_id: projFull.co_id,
          type: 'plan_mis_a_jour',
          titre: `Plan EXE ${lot?.corps_etat ?? ''} — Indice ${plan.indice} valide`,
          message: `La dessinatrice a valide le plan. Projet : ${proj.nom}`,
          priorite: 'normal', lue: false,
        }])
      }
    }
    await refresh()
  }

  // ── Sauvegarder notes ──
  async function saveNotes(planId: string) {
    await supabase.schema('app').from('plans_exe').update({ notes: notesValue }).eq('id', planId)
    setEditingNotes(null)
    await refresh()
  }

  // ── Creer nouvel indice ──
  async function creerIndice() {
    if (!modalLotId || !selProjetId) return
    setModalSaving(true)

    let fichier_url: string | null = null
    let fichier_nom: string | null = null

    if (modalFile) {
      const path = `plans/exe/${Date.now()}_${modalFile.name}`
      const { error } = await supabase.storage.from('projets').upload(path, modalFile, { upsert: true })
      if (!error) { fichier_url = path; fichier_nom = modalFile.name }
    }

    // Archiver l'ancien indice en_cours
    const ancien = currentPlan(modalLotId)
    if (ancien) {
      await supabase.schema('app').from('plans_exe').update({ statut: 'archive' }).eq('id', ancien.id)
    }

    const newIndice = nextIndice(modalLotId)

    // Trouver l'utilisateur actuel
    let createdBy: string | null = null
    if (user?.email) {
      const { data: util } = await supabase.schema('app').from('utilisateurs').select('id').eq('email', user.email).single()
      if (util) createdBy = util.id
    }

    // INSERT nouveau plan
    await supabase.schema('app').from('plans_exe').insert([{
      projet_id: selProjetId, lot_id: modalLotId, indice: newIndice,
      fichier_url, fichier_nom, statut: 'en_cours',
      cr_source_id: modalCrId || null, notes: modalNotes || null,
      created_by: createdBy,
    }])

    // Notifications
    const proj = projets.find(p => p.id === selProjetId)
    const lot = findLot(modalLotId)

    if (proj) {
      // Notifier le CO
      const { data: projFull } = await supabase.schema('app').from('projets').select('co_id, economiste_id').eq('id', proj.id).single()
      if (projFull?.co_id) {
        await supabase.schema('app').from('alertes').insert([{
          utilisateur_id: projFull.co_id,
          type: 'plan_mis_a_jour',
          titre: `Plan EXE ${lot?.corps_etat ?? ''} mis a jour — Indice ${newIndice}`,
          message: `Projet : ${proj.nom}`,
          priorite: 'normal', lue: false,
        }])
      }

      // Notifier l'economiste si chiffrage_lignes reference l'ancien plan
      if (ancien && projFull?.economiste_id) {
        const { data: lignes } = await supabase.from('chiffrage_lignes')
          .select('id').eq('plan_source_id', ancien.id).limit(1)
        if (lignes && lignes.length > 0) {
          await supabase.schema('app').from('alertes').insert([{
            utilisateur_id: projFull.economiste_id,
            type: 'plan_mis_a_jour',
            titre: `Plan EXE ${lot?.corps_etat ?? ''} mis a jour (${ancien.indice} → ${newIndice})`,
            message: `Vos metres sont peut-etre a reviser. Projet : ${proj.nom}`,
            priorite: 'high', lue: false,
          }])
        }
      }
    }

    setModalSaving(false)
    setShowModal(false)
    setModalFile(null); setModalCrId(''); setModalNotes(''); setModalLotId('')
    await refresh()
  }

  // ── Ouvrir modal depuis un CR (preselectionner lots) ──
  function openFromCr(cr: CR) {
    const pending = (cr.lots_impactes ?? []).filter(lotId => {
      const lotPlans = plansForLot(lotId)
      return !lotPlans.some(p => p.cr_source_id === cr.id)
    })
    if (pending.length > 0) {
      setModalLotId(pending[0])
      setModalCrId(cr.id)
      setModalNotes('')
      setModalFile(null)
      setShowModal(true)
    }
  }

  // ── Derived ──
  const filteredLots = lots.filter(l => l.projet_id === selProjetId)
  const selLotPlans = selLotId ? plansForLot(selLotId) : []
  const selLotCurrent = selLotId ? currentPlan(selLotId) : null
  const selLot = selLotId ? findLot(selLotId) : null

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Chantier" subtitle="Plans d'execution et comptes-rendus" />
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Chantier" subtitle="Plans d'execution EXE et comptes-rendus de chantier" />

      {/* Selecteur projet global */}
      <div className="mx-6 mt-4">
        <select value={selProjetId} onChange={e => setSelProjetId(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 w-72">
          <option value="">Choisir un projet...</option>
          {projets.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
      </div>

      {selProjetId ? (
        <div className="px-6 pt-4 pb-8 flex gap-6">
          {/* ════════════ COLONNE GAUCHE — Feed CR ════════════ */}
          <div className="w-[420px] flex-shrink-0 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-gray-700">Comptes-rendus de chantier</h3>

            {crs.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Aucun CR publie pour ce projet</p>
                <p className="text-xs text-gray-300 mt-1">Le CO deposera les CR apres chaque visite</p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-240px)]">
                {crs.map(cr => {
                  const co = findUser(cr.co_id)
                  const pending = crPendingCount(cr)
                  const allDone = pending === 0 && (cr.lots_impactes ?? []).length > 0

                  return (
                    <div key={cr.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      {/* Header */}
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{cr.titre}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                              {co && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" /> {co.prenom} {co.nom}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {new Date(cr.date_visite).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                          </div>
                          {allDone ? (
                            <span className="text-xs px-2 py-1 rounded-full font-medium bg-[#E6F1FB] text-[#185FA5]">A jour</span>
                          ) : pending > 0 ? (
                            <span className="text-xs px-2 py-1 rounded-full font-medium bg-[#FAEEDA] text-[#854F0B]">{pending} plan{pending > 1 ? 's' : ''} a mettre a jour</span>
                          ) : null}
                        </div>
                      </div>

                      {/* Contenu */}
                      <div className="px-4 py-3">
                        <p className="text-sm text-gray-700 whitespace-pre-line">{cr.contenu}</p>
                      </div>

                      {/* Lots impactes */}
                      {(cr.lots_impactes ?? []).length > 0 && (
                        <div className="px-4 pb-3">
                          <p className="text-xs text-gray-400 mb-1.5">Lots impactes</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(cr.lots_impactes ?? []).map(lotId => {
                              const lot = findLot(lotId)
                              if (!lot) return null
                              const hasUpdatedPlan = plansForLot(lotId).some(p => p.cr_source_id === cr.id)
                              return (
                                <span key={lotId} className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                                  hasUpdatedPlan ? 'bg-[#E6F1FB] text-[#185FA5]' : 'bg-[#FAEEDA] text-[#854F0B]'
                                }`}>
                                  {lot.corps_etat}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Footer */}
                      {pending > 0 && (
                        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                          <button onClick={() => openFromCr(cr)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700">
                            <Plus className="w-3 h-3" /> Mettre a jour les plans
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ════════════ COLONNE DROITE — Plans EXE ════════════ */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Plans d'execution</h3>
            </div>

            {/* Selecteur lot */}
            {filteredLots.length > 0 ? (
              <div className="flex gap-1.5 flex-wrap">
                {filteredLots.map(l => {
                  const isActive = l.id === selLotId
                  const cur = currentPlan(l.id)
                  return (
                    <button key={l.id} onClick={() => setSelLotId(l.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${
                        isActive ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                      }`}>
                      <Layers className="w-3 h-3" />
                      {l.corps_etat}
                      {cur && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>{cur.indice}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <Layers className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Aucun lot pour ce projet</p>
              </div>
            )}

            {/* Vue lot selectionne */}
            {selLot && (
              <div className="space-y-4">
                {/* En-tete lot */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-semibold text-gray-400">LOT {String(selLot.numero).padStart(2, '0')}</span>
                      <span className="text-sm font-semibold text-gray-900">{selLot.corps_etat}</span>
                      {selLotCurrent && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#E6F1FB] text-[#185FA5]">
                          Indice {selLotCurrent.indice} en cours
                        </span>
                      )}
                    </div>
                    <button onClick={() => { setModalLotId(selLotId); setModalCrId(''); setModalNotes(''); setModalFile(null); setShowModal(true) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700">
                      <Plus className="w-3 h-3" /> Creer indice {nextIndice(selLotId)}
                    </button>
                  </div>

                  {/* Timeline indices */}
                  {selLotPlans.length > 0 && (
                    <div className="flex items-center gap-0 mt-4 pt-4 border-t border-gray-100">
                      {selLotPlans.map((p, i) => {
                        const isArchive  = p.statut === 'archive'
                        const isValide   = p.statut === 'valide'
                        const isEnCours  = p.statut === 'en_cours'
                        return (
                          <div key={p.id} className="flex items-center">
                            <button
                              onClick={() => { if (p.fichier_url) window.open(getFileUrl(p.fichier_url), '_blank') }}
                              title={`Indice ${p.indice} — ${p.statut}${p.fichier_nom ? ` — ${p.fichier_nom}` : ''}`}
                              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                                isEnCours ? 'border-[#185FA5] bg-[#E6F1FB] text-[#185FA5]' :
                                isValide  ? 'border-green-400 bg-green-50 text-green-700' :
                                'border-gray-200 bg-gray-50 text-gray-400'
                              } ${p.fichier_url ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                            >
                              {p.indice}
                            </button>
                            {i < selLotPlans.length - 1 && (
                              <div className="w-6 h-0.5 bg-gray-200" />
                            )}
                          </div>
                        )
                      })}
                      {/* Prochain indice pointille */}
                      <div className="flex items-center">
                        <div className="w-6 h-0.5 bg-gray-200" />
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 border-dashed border-gray-300 text-gray-300">
                          {nextIndice(selLotId)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Indice actif */}
                {selLotCurrent ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Indice {selLotCurrent.indice}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(selLotCurrent.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        selLotCurrent.statut === 'en_cours' ? 'bg-[#E6F1FB] text-[#185FA5]' : 'bg-green-100 text-green-700'
                      }`}>{selLotCurrent.statut}</span>
                    </div>

                    {/* Fichier */}
                    {selLotCurrent.fichier_url && selLotCurrent.fichier_nom && (
                      <a href={getFileUrl(selLotCurrent.fichier_url)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                        <FileText className="w-5 h-5 text-[#185FA5] flex-shrink-0" />
                        <span className="text-sm text-gray-700 flex-1 truncate">{selLotCurrent.fichier_nom}</span>
                        <Download className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </a>
                    )}

                    {/* CR source */}
                    {selLotCurrent.cr_source_id && (() => {
                      const cr = findCr(selLotCurrent.cr_source_id)
                      return cr ? (
                        <div className="flex items-center gap-2 p-3 bg-[#E6F1FB] border border-[#185FA5]/20 rounded-lg">
                          <FileText className="w-4 h-4 text-[#185FA5] flex-shrink-0" />
                          <p className="text-xs text-[#185FA5]">
                            Base sur : <span className="font-semibold">{cr.titre}</span> — {new Date(cr.date_visite).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      ) : null
                    })()}

                    {/* Notes */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-gray-500 font-medium">Notes</p>
                        {editingNotes !== selLotCurrent.id && (
                          <button onClick={() => { setEditingNotes(selLotCurrent.id); setNotesValue(selLotCurrent.notes || '') }}
                            className="text-xs text-gray-400 hover:text-gray-700">Modifier</button>
                        )}
                      </div>
                      {editingNotes === selLotCurrent.id ? (
                        <div className="space-y-2">
                          <textarea value={notesValue} onChange={e => setNotesValue(e.target.value)} rows={3}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                            placeholder="Notes sur les modifications..." />
                          <div className="flex gap-2">
                            <button onClick={() => saveNotes(selLotCurrent.id)}
                              className="px-3 py-1 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700">Sauvegarder</button>
                            <button onClick={() => setEditingNotes(null)}
                              className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Annuler</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 whitespace-pre-line">{selLotCurrent.notes || <span className="text-gray-300 italic">Aucune note</span>}</p>
                      )}
                    </div>

                    {/* Action valider */}
                    {selLotCurrent.statut === 'en_cours' && (
                      <button onClick={() => validerPlan(selLotCurrent)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                        <Check className="w-4 h-4" /> Valider ce plan
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">Aucun plan EXE pour ce lot</p>
                    <button onClick={() => { setModalLotId(selLotId); setModalCrId(''); setModalNotes(''); setModalFile(null); setShowModal(true) }}
                      className="mt-3 text-xs text-gray-600 underline hover:text-gray-900">Creer le premier indice</button>
                  </div>
                )}

                {/* Historique indices archives */}
                {selLotPlans.filter(p => p.statut !== 'en_cours').length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Historique des indices</h4>
                    <div className="space-y-2">
                      {selLotPlans.filter(p => p.statut !== 'en_cours').map(p => {
                        const cr = findCr(p.cr_source_id)
                        return (
                          <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                                p.statut === 'valide' ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-400'
                              }`}>{p.indice}</span>
                              <div>
                                <p className="text-sm text-gray-700">Indice {p.indice} — <span className="text-xs text-gray-400">{p.statut}</span></p>
                                {cr && <p className="text-xs text-gray-400 mt-0.5">CR : {cr.titre}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString('fr-FR')}</span>
                              {p.fichier_url && (
                                <a href={getFileUrl(p.fichier_url)} target="_blank" rel="noopener noreferrer"
                                  className="p-1.5 text-gray-400 hover:text-[#185FA5] rounded transition-colors">
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!selLotId && filteredLots.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 h-64 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Selectionnez un lot</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="px-6 pt-8">
          <div className="bg-white rounded-xl border border-gray-200 h-64 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Selectionnez un projet pour commencer</p>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ MODAL — Nouvel indice ════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Creer indice {nextIndice(modalLotId)}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {findLot(modalLotId)?.corps_etat ?? 'Lot'} — {projets.find(p => p.id === selProjetId)?.nom}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* Lot (si pas preselectionne) */}
              {!modalLotId && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Lot</label>
                  <select value={modalLotId} onChange={e => setModalLotId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                    <option value="">Choisir un lot...</option>
                    {filteredLots.map(l => <option key={l.id} value={l.id}>{l.corps_etat}</option>)}
                  </select>
                </div>
              )}

              {/* Upload fichier */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Fichier plan</label>
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg"
                  onChange={e => { setModalFile(e.target.files?.[0] ?? null); e.target.value = '' }} />
                {modalFile ? (
                  <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{modalFile.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{(modalFile.size / 1024).toFixed(0)} Ko</span>
                    </div>
                    <button onClick={() => setModalFile(null)} className="text-gray-400 hover:text-red-500 ml-2"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 w-full border border-dashed border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-colors justify-center">
                    <Upload className="w-4 h-4" /> Joindre un plan (PDF, DWG, image...)
                  </button>
                )}
              </div>

              {/* CR source */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">CR source</label>
                <select value={modalCrId} onChange={e => setModalCrId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">Quel CR a declenche cette mise a jour ?</option>
                  {crs.map(cr => (
                    <option key={cr.id} value={cr.id}>
                      {cr.titre} — {new Date(cr.date_visite).toLocaleDateString('fr-FR')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Modifications apportees</label>
                <textarea value={modalNotes} onChange={e => setModalNotes(e.target.value)} rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                  placeholder="Decrire les modifications par rapport a l'indice precedent..." />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              <button onClick={creerIndice} disabled={!modalLotId || modalSaving}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 disabled:opacity-40">
                {modalSaving ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                Creer indice {modalLotId ? nextIndice(modalLotId) : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
