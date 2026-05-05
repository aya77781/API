'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { useUser } from '@/hooks/useUser'
import {
  Plus, X, Send, MessageSquare, AlertTriangle, HelpCircle, MessageCircle,
  CheckCircle2, Clock, Filter, FolderOpen, User as UserIcon, Loader2,
  Search, Trash2, FileText, Upload,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Projet = { id: string; nom: string; reference: string | null; statut: string }
type Utilisateur = { id: string; prenom: string; nom: string; role: string }

type RemarqueType = 'question' | 'remarque' | 'alerte'
type RemarqueStatut = 'ouverte' | 'en_cours' | 'resolue' | 'archivee'
type Priorite = 'low' | 'normal' | 'high'

type Remarque = {
  id: string
  projet_id: string
  type: RemarqueType
  priorite: Priorite
  titre: string
  contenu: string
  auteur_id: string | null
  destinataires: string[] | null
  statut: RemarqueStatut
  fichiers_joints: string[] | null
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
  updated_at: string
}

type Reponse = {
  id: string
  remarque_id: string
  auteur_id: string | null
  contenu: string
  fichiers_joints: string[] | null
  created_at: string
}

const TYPE_META: Record<RemarqueType, { label: string; icon: typeof MessageCircle; color: string }> = {
  question: { label: 'Question',  icon: HelpCircle,    color: 'bg-blue-100 text-blue-700 border-blue-200' },
  remarque: { label: 'Remarque',  icon: MessageCircle, color: 'bg-violet-100 text-violet-700 border-violet-200' },
  alerte:   { label: 'Alerte',    icon: AlertTriangle, color: 'bg-red-100 text-red-700 border-red-200' },
}

const STATUT_META: Record<RemarqueStatut, { label: string; color: string }> = {
  ouverte:   { label: 'Ouverte',   color: 'bg-amber-100 text-amber-700' },
  en_cours:  { label: 'En cours',  color: 'bg-blue-100 text-blue-700' },
  resolue:   { label: 'Resolue',   color: 'bg-green-100 text-green-700' },
  archivee:  { label: 'Archivee',  color: 'bg-gray-100 text-gray-500' },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChantierPage() {
  const supabase = useMemo(() => createClient(), [])
  const { user, profil } = useUser()

  const [projets, setProjets]       = useState<Projet[]>([])
  const [users, setUsers]           = useState<Utilisateur[]>([])
  const [remarques, setRemarques]   = useState<Remarque[]>([])
  const [loading, setLoading]       = useState(true)

  const [filterProjetId, setFilterProjetId] = useState<string>('tous')
  const [filterStatut, setFilterStatut]     = useState<string>('actives')
  const [filterType, setFilterType]         = useState<string>('tous')
  const [search, setSearch]                 = useState('')

  const [selRemarque, setSelRemarque] = useState<Remarque | null>(null)
  const [reponses, setReponses]       = useState<Reponse[]>([])
  const [loadingReponses, setLoadingReponses] = useState(false)
  const [newReponse, setNewReponse]   = useState('')
  const [sendingReponse, setSendingReponse] = useState(false)
  const reponsesEndRef = useRef<HTMLDivElement>(null)

  const [showNewModal, setShowNewModal] = useState(false)

  // ── Load ──
  async function refresh() {
    const [{ data: pData }, { data: uData }, { data: rData }] = await Promise.all([
      supabase.schema('app').from('projets').select('id, nom, reference, statut').order('nom'),
      supabase.schema('app').from('utilisateurs').select('id, prenom, nom, role').eq('actif', true).order('prenom'),
      supabase.schema('app').from('chantier_remarques').select('*').order('created_at', { ascending: false }),
    ])
    setProjets((pData ?? []) as Projet[])
    setUsers((uData ?? []) as Utilisateur[])
    setRemarques((rData ?? []) as Remarque[])
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  // ── Reponses au clic sur une remarque ──
  async function fetchReponses(remarqueId: string) {
    setLoadingReponses(true)
    const { data } = await supabase.schema('app').from('chantier_remarque_reponses')
      .select('*').eq('remarque_id', remarqueId).order('created_at', { ascending: true })
    setReponses((data ?? []) as Reponse[])
    setLoadingReponses(false)
    setTimeout(() => reponsesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }
  useEffect(() => {
    if (selRemarque) fetchReponses(selRemarque.id)
    else setReponses([])
    setNewReponse('')
  }, [selRemarque?.id])

  async function envoyerReponse() {
    if (!selRemarque || !newReponse.trim() || !profil) return
    setSendingReponse(true)
    await supabase.schema('app').from('chantier_remarque_reponses').insert([{
      remarque_id: selRemarque.id,
      auteur_id: profil.id,
      contenu: newReponse.trim(),
    }])
    // Si la remarque etait ouverte et qu'on y repond, passer en 'en_cours'
    if (selRemarque.statut === 'ouverte') {
      await supabase.schema('app').from('chantier_remarques')
        .update({ statut: 'en_cours' }).eq('id', selRemarque.id)
      setSelRemarque({ ...selRemarque, statut: 'en_cours' })
      refresh()
    }
    setNewReponse('')
    await fetchReponses(selRemarque.id)
    setSendingReponse(false)
  }

  async function changerStatut(statut: RemarqueStatut) {
    if (!selRemarque) return
    const patch: Record<string, unknown> = { statut }
    if (statut === 'resolue') {
      patch.resolved_at = new Date().toISOString()
      patch.resolved_by = profil?.id ?? null
    } else {
      patch.resolved_at = null
      patch.resolved_by = null
    }
    await supabase.schema('app').from('chantier_remarques')
      .update(patch).eq('id', selRemarque.id)
    setSelRemarque({ ...selRemarque, statut, resolved_at: statut === 'resolue' ? new Date().toISOString() : null })
    refresh()
  }

  async function supprimerRemarque() {
    if (!selRemarque) return
    if (!confirm('Supprimer cette remarque et toutes ses reponses ?')) return
    await supabase.schema('app').from('chantier_remarques').delete().eq('id', selRemarque.id)
    setSelRemarque(null)
    refresh()
  }

  function findUser(id: string | null) {
    if (!id) return null
    return users.find(u => u.id === id) ?? null
  }

  // ── Filtering ──
  const filtered = useMemo(() => {
    return remarques.filter(r => {
      if (filterProjetId !== 'tous' && r.projet_id !== filterProjetId) return false
      if (filterType !== 'tous' && r.type !== filterType) return false
      if (filterStatut === 'actives' && (r.statut === 'resolue' || r.statut === 'archivee')) return false
      if (filterStatut === 'resolues' && r.statut !== 'resolue') return false
      if (filterStatut === 'archivees' && r.statut !== 'archivee') return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const m = r.titre.toLowerCase().includes(q) || r.contenu.toLowerCase().includes(q)
        if (!m) return false
      }
      return true
    })
  }, [remarques, filterProjetId, filterStatut, filterType, search])

  const compteurs = useMemo(() => {
    const me = profil?.id
    const mesQuestions = remarques.filter(r => r.auteur_id === me && r.statut !== 'resolue' && r.statut !== 'archivee').length
    const taggees = remarques.filter(r => me && (r.destinataires ?? []).includes(me) && r.statut !== 'resolue').length
    const ouvertes = remarques.filter(r => r.statut === 'ouverte').length
    const alertes  = remarques.filter(r => r.type === 'alerte' && r.statut !== 'resolue' && r.statut !== 'archivee').length
    return { mesQuestions, taggees, ouvertes, alertes }
  }, [remarques, profil?.id])

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Chantier" subtitle="Remarques et questions d'equipe" />

      {/* KPI */}
      <div className="mx-6 mt-4 grid grid-cols-4 gap-3">
        <Kpi label="Tagguee pour moi" value={compteurs.taggees} color="violet" icon={<UserIcon className="w-4 h-4" />} />
        <Kpi label="Mes questions ouvertes" value={compteurs.mesQuestions} color="blue" icon={<HelpCircle className="w-4 h-4" />} />
        <Kpi label="Ouvertes (equipe)" value={compteurs.ouvertes} color="amber" icon={<Clock className="w-4 h-4" />} />
        <Kpi label="Alertes" value={compteurs.alertes} color="red" icon={<AlertTriangle className="w-4 h-4" />} />
      </div>

      {/* Filtres */}
      <div className="mx-6 mt-4 bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher dans les remarques..."
            className="w-full pl-9 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select value={filterProjetId} onChange={e => setFilterProjetId(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
          <option value="tous">Tous les projets</option>
          {projets.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>

        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
          <option value="tous">Tous types</option>
          <option value="question">Questions</option>
          <option value="remarque">Remarques</option>
          <option value="alerte">Alertes</option>
        </select>

        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {[
            { v: 'actives',    l: 'Actives' },
            { v: 'resolues',   l: 'Resolues' },
            { v: 'archivees',  l: 'Archivees' },
            { v: 'tous',       l: 'Tous' },
          ].map(opt => (
            <button key={opt.v} onClick={() => setFilterStatut(opt.v)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filterStatut === opt.v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {opt.l}
            </button>
          ))}
        </div>

        <button onClick={() => setShowNewModal(true)}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700">
          <Plus className="w-3.5 h-3.5" /> Nouvelle remarque
        </button>
      </div>

      <div className="px-6 pt-4 pb-8 flex gap-4">
        {/* Liste */}
        <div className="w-96 flex-shrink-0 flex flex-col gap-2 max-h-[calc(100vh-280px)] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Chargement...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Aucune remarque</p>
              <p className="text-xs text-gray-400 mt-1">Clique sur « Nouvelle remarque » pour en creer une.</p>
            </div>
          ) : (
            filtered.map(r => {
              const projet = projets.find(p => p.id === r.projet_id)
              const auteur = findUser(r.auteur_id)
              const isSel = selRemarque?.id === r.id
              const meta = TYPE_META[r.type]
              const Icon = meta.icon
              const statMeta = STATUT_META[r.statut]
              return (
                <button key={r.id} onClick={() => setSelRemarque(r)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    isSel ? 'border-gray-900 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${meta.color} inline-flex items-center gap-1 flex-shrink-0`}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                      {r.priorite === 'high' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium flex-shrink-0">
                          Urgent
                        </span>
                      )}
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${statMeta.color} flex-shrink-0`}>{statMeta.label}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate">{r.titre}</p>
                  {r.contenu && <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{r.contenu}</p>}
                  <div className="flex items-center justify-between gap-2 mt-1.5 text-xs">
                    <span className="text-gray-500 truncate">{projet?.nom ?? '—'}</span>
                    <span className="text-gray-400 flex-shrink-0">
                      {auteur ? `${auteur.prenom} ${auteur.nom}` : '—'} · {new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Detail / Thread */}
        <div className="flex-1 min-w-0">
          {selRemarque ? (
            <RemarqueThread
              remarque={selRemarque}
              reponses={reponses}
              loadingReponses={loadingReponses}
              newReponse={newReponse}
              setNewReponse={setNewReponse}
              sendingReponse={sendingReponse}
              onEnvoyer={envoyerReponse}
              onChangerStatut={changerStatut}
              onSupprimer={supprimerRemarque}
              projets={projets}
              users={users}
              meId={profil?.id ?? null}
              reponsesEndRef={reponsesEndRef}
              findUser={findUser}
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 h-80 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Selectionnez une remarque</p>
                <p className="text-xs mt-1">pour voir le fil et y repondre</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showNewModal && (
        <NouvelleRemarqueModal
          projets={projets}
          users={users}
          meId={profil?.id ?? null}
          defaultProjetId={filterProjetId !== 'tous' ? filterProjetId : ''}
          onClose={() => setShowNewModal(false)}
          onSaved={() => { setShowNewModal(false); refresh() }}
        />
      )}
    </div>
  )
}

// ─── KPI ──────────────────────────────────────────────────────────────────────

function Kpi({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    violet: 'bg-violet-50 text-violet-600',
    blue:   'bg-blue-50 text-blue-600',
    amber:  'bg-amber-50 text-amber-600',
    red:    'bg-red-50 text-red-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={`w-9 h-9 rounded-lg ${colorMap[color]} flex items-center justify-center mb-2`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

// ─── Thread de discussion ─────────────────────────────────────────────────────

function RemarqueThread({
  remarque, reponses, loadingReponses, newReponse, setNewReponse, sendingReponse,
  onEnvoyer, onChangerStatut, onSupprimer, projets, users, meId, reponsesEndRef, findUser,
}: {
  remarque: Remarque
  reponses: Reponse[]
  loadingReponses: boolean
  newReponse: string
  setNewReponse: (v: string) => void
  sendingReponse: boolean
  onEnvoyer: () => void
  onChangerStatut: (s: RemarqueStatut) => void
  onSupprimer: () => void
  projets: Projet[]
  users: Utilisateur[]
  meId: string | null
  reponsesEndRef: React.RefObject<HTMLDivElement>
  findUser: (id: string | null) => Utilisateur | null
}) {
  const projet = projets.find(p => p.id === remarque.projet_id)
  const auteur = findUser(remarque.auteur_id)
  const meta = TYPE_META[remarque.type]
  const Icon = meta.icon
  const statMeta = STATUT_META[remarque.statut]
  const destinataires = (remarque.destinataires ?? []).map(id => findUser(id)).filter(Boolean) as Utilisateur[]
  const isAuteur = remarque.auteur_id === meId

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-280px)]">
      {/* Header */}
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded border ${meta.color} inline-flex items-center gap-1`}>
              <Icon className="w-3 h-3" /> {meta.label}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${statMeta.color}`}>{statMeta.label}</span>
            {remarque.priorite === 'high' && (
              <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-600 font-medium">Urgent</span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {remarque.statut !== 'resolue' && (
              <button onClick={() => onChangerStatut('resolue')}
                className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Marquer resolue
              </button>
            )}
            {remarque.statut === 'resolue' && (
              <button onClick={() => onChangerStatut('en_cours')}
                className="px-2.5 py-1 text-xs border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">
                Reouvrir
              </button>
            )}
            {remarque.statut !== 'archivee' && (
              <button onClick={() => onChangerStatut('archivee')}
                className="px-2.5 py-1 text-xs border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                Archiver
              </button>
            )}
            {isAuteur && (
              <button onClick={onSupprimer}
                className="p-1 text-gray-400 hover:text-red-500" title="Supprimer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <h2 className="text-lg font-semibold text-gray-900">{remarque.titre}</h2>
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
          <FolderOpen className="w-3 h-3" />
          <span className="font-medium">{projet?.nom ?? '—'}</span>
          {projet?.reference && <span className="text-gray-400">({projet.reference})</span>}
          <span>·</span>
          <span>{auteur ? `${auteur.prenom} ${auteur.nom}` : '—'}</span>
          <span>·</span>
          <span>{new Date(remarque.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        {remarque.contenu && (
          <p className="text-sm text-gray-700 whitespace-pre-wrap mt-3">{remarque.contenu}</p>
        )}

        {destinataires.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">Tag :</span>
            {destinataires.map(u => (
              <span key={u.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full">
                @{u.prenom} {u.nom}
              </span>
            ))}
          </div>
        )}

        {remarque.fichiers_joints && remarque.fichiers_joints.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {remarque.fichiers_joints.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100">
                <FileText className="w-3 h-3 text-gray-400" />
                {url.split('/').pop() ?? `Fichier ${i + 1}`}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Reponses */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50">
        {loadingReponses ? (
          <p className="text-sm text-gray-400 text-center py-4">Chargement...</p>
        ) : reponses.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6 italic">Pas encore de reponse — sois le premier a repondre.</p>
        ) : (
          reponses.map(r => {
            const u = findUser(r.auteur_id)
            const isMe = r.auteur_id === meId
            return (
              <div key={r.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  isMe ? 'bg-gray-900 text-white' : 'bg-violet-100 text-violet-700'
                }`}>
                  {u ? `${u.prenom[0]}${u.nom[0]}`.toUpperCase() : '?'}
                </div>
                <div className={`max-w-[75%] ${isMe ? 'items-end' : ''} flex flex-col`}>
                  <div className={`px-3 py-2 rounded-2xl ${
                    isMe ? 'bg-gray-900 text-white rounded-tr-sm' : 'bg-white border border-gray-200 rounded-tl-sm'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{r.contenu}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 px-1">
                    {u ? `${u.prenom} ${u.nom}` : '—'} · {new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={reponsesEndRef} />
      </div>

      {/* Saisie */}
      {remarque.statut !== 'archivee' && (
        <div className="border-t border-gray-200 p-3 bg-white">
          <div className="flex gap-2">
            <textarea
              value={newReponse}
              onChange={e => setNewReponse(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onEnvoyer() } }}
              placeholder="Ecrire une reponse... (Cmd/Ctrl + Entree)"
              rows={2}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none placeholder-gray-300"
            />
            <button
              onClick={onEnvoyer}
              disabled={!newReponse.trim() || sendingReponse}
              className="px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 self-end"
            >
              {sendingReponse ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Modale nouvelle remarque ────────────────────────────────────────────────

function NouvelleRemarqueModal({
  projets, users, meId, defaultProjetId, onClose, onSaved,
}: {
  projets: Projet[]
  users: Utilisateur[]
  meId: string | null
  defaultProjetId: string
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [type, setType] = useState<RemarqueType>('remarque')
  const [priorite, setPriorite] = useState<Priorite>('normal')
  const [projetId, setProjetId] = useState(defaultProjetId)
  const [titre, setTitre] = useState('')
  const [contenu, setContenu] = useState('')
  const [destinataires, setDestinataires] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleDest(id: string) {
    setDestinataires(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function envoyer() {
    setError(null)
    if (!titre.trim()) { setError('Titre requis'); return }
    if (!projetId) { setError('Choisir un projet'); return }
    setSaving(true)
    try {
      const fichiersJoints: string[] = []
      for (const f of files) {
        const path = `chantier-remarques/${projetId}/${Date.now()}_${f.name}`
        const { error: upErr } = await supabase.storage.from('projets').upload(path, f, { upsert: true })
        if (!upErr) {
          const { data } = supabase.storage.from('projets').getPublicUrl(path)
          fichiersJoints.push(data.publicUrl)
        }
      }
      const { error: insErr } = await supabase.schema('app').from('chantier_remarques').insert([{
        projet_id: projetId,
        type, priorite,
        titre: titre.trim(),
        contenu: contenu.trim(),
        auteur_id: meId,
        destinataires: destinataires.length ? destinataires : null,
        fichiers_joints: fichiersJoints.length ? fichiersJoints : null,
        statut: 'ouverte',
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
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-base font-semibold text-gray-900">Nouvelle remarque / question</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-3">
          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['question', 'remarque', 'alerte'] as RemarqueType[]).map(t => {
                const m = TYPE_META[t]
                const Icon = m.icon
                const sel = type === t
                return (
                  <button key={t} onClick={() => setType(t)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
                      sel ? `${m.color} font-semibold` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}>
                    <Icon className="w-3.5 h-3.5" /> {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Projet */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Projet *</label>
            <select value={projetId} onChange={e => setProjetId(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Choisir un projet...</option>
              {projets.map(p => <option key={p.id} value={p.id}>{p.nom}{p.reference ? ` (${p.reference})` : ''}</option>)}
            </select>
          </div>

          {/* Titre */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Titre *</label>
            <input value={titre} onChange={e => setTitre(e.target.value)}
              placeholder="Ex: Cote manquante sur le plan EXE indice C" className={inputCls} />
          </div>

          {/* Contenu */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Detail</label>
            <textarea rows={4} value={contenu} onChange={e => setContenu(e.target.value)}
              placeholder="Decris la question / remarque en detail..." className={`${inputCls} resize-none`} />
          </div>

          {/* Priorite */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Priorite</label>
            <div className="flex gap-2">
              {(['low', 'normal', 'high'] as Priorite[]).map(p => (
                <button key={p} onClick={() => setPriorite(p)}
                  className={`flex-1 px-3 py-1.5 text-sm rounded-lg border ${
                    priorite === p
                      ? p === 'high' ? 'bg-red-100 text-red-700 border-red-200 font-semibold'
                      : p === 'normal' ? 'bg-gray-900 text-white border-gray-900 font-semibold'
                      : 'bg-gray-100 text-gray-700 border-gray-200 font-semibold'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}>
                  {p === 'low' ? 'Basse' : p === 'normal' ? 'Normale' : 'Urgent'}
                </button>
              ))}
            </div>
          </div>

          {/* Tag membres equipe */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tagger des membres ({destinataires.length})</label>
            <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
              {users.map(u => (
                <label key={u.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={destinataires.includes(u.id)} onChange={() => toggleDest(u.id)} className="accent-gray-900" />
                  <span className="text-sm text-gray-700">{u.prenom} {u.nom}</span>
                  <span className="text-xs text-gray-400">{u.role}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Fichiers */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fichiers joints</label>
            <label className="flex items-center justify-center gap-2 w-full border border-dashed border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-50 cursor-pointer">
              <Upload className="w-4 h-4" /> Ajouter des fichiers
              <input type="file" multiple className="hidden"
                onChange={e => { if (e.target.files) setFiles(Array.from(e.target.files)) }} />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                    <FileText className="w-3 h-3" /> {f.name} <span className="text-gray-400">({(f.size / 1024).toFixed(0)} Ko)</span>
                    <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="ml-auto text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
          <button onClick={envoyer} disabled={saving || !titre.trim() || !projetId}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Publier
          </button>
        </div>
      </div>
    </div>
  )
}
