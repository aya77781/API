'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Plus, Search, X, Calendar, Upload } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useTaches, type Tache, type TacheStatut, type TacheUrgence, type CreateTacheData } from '@/hooks/useTaches'
import { DocumentUploadModal } from '@/components/shared/DocumentUploadModal'

// ── Constants ──

const STATUTS: { key: TacheStatut; label: string }[] = [
  { key: 'a_faire',    label: 'A faire' },
  { key: 'en_cours',   label: 'En cours' },
  { key: 'en_attente', label: 'En attente' },
  { key: 'fait',       label: 'Fait' },
]

const URGENCE_CONFIG: Record<TacheUrgence, { label: string; cls: string }> = {
  faible:   { label: 'Faible',   cls: 'bg-blue-100 text-blue-700' },
  normal:   { label: 'Normal',   cls: 'bg-gray-100 text-gray-600' },
  urgent:   { label: 'Urgent',   cls: 'bg-orange-100 text-orange-700' },
  critique: { label: 'Critique', cls: 'bg-red-100 text-red-700' },
}

const INTERNAL_ROLES = ['co', 'commercial', 'economiste', 'dessinatrice', 'assistant_travaux', 'comptable', 'rh', 'cho', 'gerant', 'admin']

const ROLE_LABELS: Record<string, string> = {
  co: 'CO', commercial: 'Commercial', economiste: 'Economiste',
  dessinatrice: 'Dessin', assistant_travaux: 'AT', comptable: 'Comptable',
  rh: 'RH', cho: 'CHO', gerant: 'Gerant', admin: 'Admin',
  st: 'ST', client: 'Client', controle: 'Bureau de controle',
}

// ── Date helpers ──

function dateColor(dateStr: string | null): string {
  if (!dateStr) return 'text-gray-400'
  const now = new Date()
  const d = new Date(dateStr)
  const diff = d.getTime() - now.getTime()
  if (diff < 0) return 'text-red-600'
  if (diff < 48 * 3600 * 1000) return 'text-orange-500'
  return 'text-emerald-600'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// ── Avatar stack ──
function AvatarStack({ destinataires, max = 3 }: { destinataires: { id: string; prenom: string; nom: string }[]; max?: number }) {
  if (!destinataires.length) return null
  const shown = destinataires.slice(0, max)
  const extra = destinataires.length - max
  return (
    <div className="flex items-center">
      {shown.map((u, i) => (
        <div key={u.id}
          style={{ zIndex: shown.length - i, marginLeft: i === 0 ? 0 : -6 }}
          className="relative w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-semibold text-gray-600"
          title={`${u.prenom} ${u.nom}`}
        >
          {u.prenom[0]}{u.nom[0]}
        </div>
      ))}
      {extra > 0 && (
        <div style={{ marginLeft: -6 }}
          className="relative w-6 h-6 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-xs font-semibold text-gray-500">
          +{extra}
        </div>
      )}
    </div>
  )
}

// ── Tache Card ──
function TacheCard({ tache, index, onClick }: { tache: Tache; index: number; onClick: () => void }) {
  const urgence = URGENCE_CONFIG[tache.urgence]
  return (
    <Draggable draggableId={tache.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`bg-white border border-gray-200 rounded-xl p-3.5 cursor-pointer transition-shadow ${
            snapshot.isDragging ? 'shadow-lg ring-2 ring-gray-900/10' : 'hover:shadow-sm'
          }`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${urgence.cls}`}>
              {urgence.label}
            </span>
            {tache.projet && (
              <span className="text-xs text-gray-400 truncate max-w-[7rem]" title={tache.projet.nom}>
                {tache.projet.reference ?? tache.projet.nom}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">{tache.titre}</p>
          {tache.description && (
            <p className="text-xs text-gray-400 line-clamp-2 mb-2.5">{tache.description}</p>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-gray-50">
            <AvatarStack destinataires={tache.destinataires ?? []} />
            {tache.date_echeance && (
              <span className={`flex items-center gap-1 text-xs font-medium ${dateColor(tache.date_echeance)}`}>
                <Calendar className="w-3 h-3" />
                {formatDate(tache.date_echeance)}
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  )
}

// ── Column ──
function KanbanColumn({ statut, label, taches, onCardClick }: {
  statut: TacheStatut; label: string; taches: Tache[]; onCardClick: (t: Tache) => void
}) {
  return (
    <div className="flex-1 min-w-[260px] flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{label}</h3>
        <span className="text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
          {taches.length}
        </span>
      </div>
      <Droppable droppableId={statut}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 rounded-xl p-2.5 space-y-2 min-h-[120px] transition-colors ${
              snapshot.isDraggingOver ? 'bg-gray-200/60' : 'bg-gray-100/60'
            }`}
          >
            {taches.map((t, i) => (
              <TacheCard key={t.id} tache={t} index={i} onClick={() => onCardClick(t)} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}

// ── Modal ──

interface ModalProps {
  mode: 'create' | 'edit'
  tache?: Tache | null
  allUsers: { id: string; prenom: string; nom: string; role: string }[]
  allProjets: { id: string; nom: string; reference: string | null }[]
  onClose: () => void
  onSave: (data: CreateTacheData, destinatairesIds: string[]) => Promise<void>
  saving: boolean
}

function TacheModal({ mode, tache, allUsers, allProjets, onClose, onSave, saving }: ModalProps) {
  const [titre, setTitre] = useState(tache?.titre ?? '')
  const [description, setDescription] = useState(tache?.description ?? '')
  const [projetId, setProjetId] = useState(tache?.projet_id ?? '')
  const [urgence, setUrgence] = useState<TacheUrgence>(tache?.urgence ?? 'normal')
  const [statut, setStatut] = useState<TacheStatut>(tache?.statut ?? 'a_faire')
  const [dateEcheance, setDateEcheance] = useState(tache?.date_echeance?.slice(0, 10) ?? '')
  const [dateRappel, setDateRappel] = useState(tache?.date_rappel?.slice(0, 16) ?? '')
  const [searchUser, setSearchUser] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<{ id: string; prenom: string; nom: string; role: string }[]>([])
  const [tagRoles, setTagRoles] = useState<string[]>(tache?.tags_roles ?? [])
  const [tagTous, setTagTous] = useState(tache?.tag_tous ?? false)
  const [assigneeA, setAssigneeA] = useState(tache?.assignee_a ?? '')
  const [error, setError] = useState('')

  useEffect(() => {
    if (tache?.tags_utilisateurs?.length && allUsers.length) {
      const users = tache.tags_utilisateurs
        .map(id => allUsers.find(u => u.id === id))
        .filter(Boolean) as typeof allUsers
      setSelectedUsers(users)
    }
  }, [tache, allUsers])

  const filteredUsers = allUsers.filter(u =>
    !selectedUsers.find(s => s.id === u.id) &&
    `${u.prenom} ${u.nom} ${u.role}`.toLowerCase().includes(searchUser.toLowerCase())
  ).slice(0, 6)

  function addUser(u: typeof allUsers[0]) {
    setSelectedUsers(prev => [...prev, u])
    setSearchUser('')
    setTagTous(false)
  }

  function removeUser(id: string) {
    setSelectedUsers(prev => prev.filter(u => u.id !== id))
  }

  function addPole(roles: string[], poleKey?: string) {
    const toAdd = allUsers.filter(u => roles.includes(u.role) && !selectedUsers.find(s => s.id === u.id))
    setSelectedUsers(prev => [...prev, ...toAdd])
    if (poleKey) setTagRoles(prev => prev.includes(poleKey) ? prev : [...prev, poleKey])
    setTagTous(false)
  }

  function setToutLeMonde() {
    setTagTous(true)
    setSelectedUsers([])
    setTagRoles([])
  }

  async function handleSubmit() {
    if (!titre.trim()) { setError('Le titre est obligatoire'); return }
    const data: CreateTacheData = {
      titre: titre.trim(),
      description: description.trim() || null,
      projet_id: projetId || null,
      urgence,
      statut,
      date_echeance: dateEcheance || null,
      date_rappel: dateRappel || null,
      tags_utilisateurs: selectedUsers.map(u => u.id),
      tags_roles: tagRoles,
      tag_tous: tagTous,
      assignee_a: assigneeA || null,
    }
    await onSave(data, selectedUsers.map(u => u.id))
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {mode === 'create' ? 'Nouvelle tache' : 'Modifier la tache'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Titre */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Titre *</label>
            <input value={titre} onChange={e => setTitre(e.target.value)} className={inputCls} placeholder="Titre de la tache" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Description <span className="font-normal text-gray-400">optionnel</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              className={`${inputCls} resize-none`} rows={3} placeholder="Details de la tache..." />
          </div>

          {/* Projet + Urgence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Projet lie</label>
              <select value={projetId} onChange={e => setProjetId(e.target.value)} className={inputCls}>
                <option value="">Aucun projet</option>
                {allProjets.map(p => (
                  <option key={p.id} value={p.id}>{p.nom}{p.reference ? ` - ${p.reference}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Urgence</label>
              <select value={urgence} onChange={e => setUrgence(e.target.value as TacheUrgence)} className={inputCls}>
                <option value="faible">Faible</option>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="critique">Critique</option>
              </select>
            </div>
          </div>

          {/* Statut (edit only) */}
          {mode === 'edit' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Statut</label>
              <select value={statut} onChange={e => setStatut(e.target.value as TacheStatut)} className={inputCls}>
                {STATUTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Echeance</label>
              <input type="date" value={dateEcheance} onChange={e => setDateEcheance(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Rappel <span className="font-normal text-gray-400">optionnel</span></label>
              <input type="datetime-local" value={dateRappel} onChange={e => setDateRappel(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Assigner a */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Assigner a</label>

            {/* Raccourcis poles */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              <button type="button" onClick={() => addPole(INTERNAL_ROLES, 'interne')}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-colors font-medium">
                Equipe interne
              </button>
              <button type="button" onClick={() => addPole(['st'], 'st')}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-colors font-medium">
                ST
              </button>
              <button type="button" onClick={() => addPole(['client'], 'client')}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-colors font-medium">
                Client
              </button>
              <button type="button" onClick={() => addPole(['controle'], 'controle')}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-colors font-medium">
                Bureau de controle
              </button>
              <button type="button" onClick={setToutLeMonde}
                className={`px-2.5 py-1 text-xs border rounded-lg transition-colors font-medium ${
                  tagTous ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-900 hover:text-white hover:border-gray-900'
                }`}>
                Tout le monde
              </button>
            </div>

            {/* Chips utilisateurs selectionnes */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-lg text-xs">
                    <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600">
                      {u.prenom[0]}
                    </div>
                    <span className="font-medium text-gray-800">{u.prenom} {u.nom}</span>
                    <span className="text-gray-400">{ROLE_LABELS[u.role] ?? u.role}</span>
                    <button onClick={() => removeUser(u.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tagTous && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-gray-100 rounded-lg">
                <span className="text-xs font-medium text-gray-700">Tout le monde</span>
                <button onClick={() => setTagTous(false)} className="text-gray-400 hover:text-red-500 ml-auto">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Recherche utilisateur */}
            {!tagTous && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input value={searchUser} onChange={e => setSearchUser(e.target.value)}
                  placeholder="Rechercher par nom ou role..."
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            )}

            {searchUser && filteredUsers.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden">
                {filteredUsers.map(u => (
                  <button key={u.id} type="button" onClick={() => addUser(u)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors">
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                      {u.prenom[0]}{u.nom[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{u.prenom} {u.nom}</p>
                      <p className="text-xs text-gray-400">{ROLE_LABELS[u.role] ?? u.role}</p>
                    </div>
                    <Plus className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Assigne a (single user) */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Responsable principal</label>
            <select value={assigneeA} onChange={e => setAssigneeA(e.target.value)} className={inputCls}>
              <option value="">Aucun</option>
              {allUsers.map(u => (
                <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({ROLE_LABELS[u.role] ?? u.role})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100">
          <button onClick={handleSubmit} disabled={saving}
            className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {saving ? (mode === 'create' ? 'Creation...' : 'Enregistrement...') : (mode === 'create' ? 'Creer la tache' : 'Enregistrer')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main TachesPage ──

interface TachesPageProps {
  roleBase: string
}

export function TachesPage({ roleBase }: TachesPageProps) {
  const { user, profil } = useUser()
  const tachesHook = useTaches()
  const pathname = usePathname()

  const [taches, setTaches] = useState<Tache[]>([])
  const [loading, setLoading] = useState(true)
  const [allUsers, setAllUsers] = useState<{ id: string; prenom: string; nom: string; role: string }[]>([])
  const [allProjets, setAllProjets] = useState<{ id: string; nom: string; reference: string | null }[]>([])

  // Filters
  const [filterVue, setFilterVue] = useState<'toutes' | 'creees' | 'assignees'>('toutes')
  const [filterUrgence, setFilterUrgence] = useState('')
  const [filterProjet, setFilterProjet] = useState('')
  const [search, setSearch] = useState('')

  // Modal tache
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTache, setEditingTache] = useState<Tache | null>(null)
  const [saving, setSaving] = useState(false)

  // Modal depot document
  const [uploadOpen, setUploadOpen] = useState(false)
  const pathParts = pathname.split('/')
  const projetIdFromUrl = pathParts[2] === 'projets' && pathParts[3] ? pathParts[3] : undefined

  const load = useCallback(async () => {
    if (!user || !profil) return
    const data = await tachesHook.fetchMesTaches(user.id, profil.role)
    setTaches(data)
    setLoading(false)
  }, [user, profil])

  useEffect(() => {
    load()
    tachesHook.fetchAllUsers().then(setAllUsers)
    tachesHook.fetchAllProjets().then(setAllProjets)
  }, [load])

  // ── Drag & Drop ──
  async function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const { draggableId, destination } = result
    const newStatut = destination.droppableId as TacheStatut
    const tache = taches.find(t => t.id === draggableId)
    if (!tache || tache.statut === newStatut) return

    setTaches(prev => prev.map(t => t.id === draggableId ? { ...t, statut: newStatut } : t))
    await tachesHook.updateStatut(draggableId, newStatut)
  }

  // ── Filtering ──
  const filtered = taches.filter(t => {
    if (!user) return false
    if (filterVue === 'creees' && t.creee_par !== user.id) return false
    if (filterVue === 'assignees' && t.assignee_a !== user.id && !t.tags_utilisateurs.includes(user.id)) return false
    if (filterUrgence && t.urgence !== filterUrgence) return false
    if (filterProjet && t.projet_id !== filterProjet) return false
    if (search && !t.titre.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function getTachesForStatut(statut: TacheStatut) {
    return filtered.filter(t => t.statut === statut)
  }

  // ── Save ──
  async function handleSave(data: CreateTacheData, destinatairesIds: string[]) {
    if (!user || !profil) return
    setSaving(true)
    if (editingTache) {
      await tachesHook.updateTache(editingTache.id, data)
    } else {
      const createurNom = `${profil.prenom} ${profil.nom}`
      await tachesHook.createTache(data, user.id, createurNom, destinatairesIds)
    }
    setSaving(false)
    setModalOpen(false)
    setEditingTache(null)
    load()
  }

  const selectCls = 'text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900'

  // Suppress unused variable warning for roleBase
  void roleBase

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Mes taches</h1>
          <p className="text-xs text-gray-400">{filtered.filter(t => t.statut !== 'fait').length} en cours</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Deposer
          </button>
          <button
            onClick={() => { setEditingTache(null); setModalOpen(true) }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouvelle tache
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex flex-wrap items-center gap-3 flex-shrink-0">
        {/* Vue */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {([['toutes', 'Toutes'], ['creees', 'Creees par moi'], ['assignees', 'Assignees a moi']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilterVue(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filterVue === v ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}>
              {l}
            </button>
          ))}
        </div>

        <select value={filterUrgence} onChange={e => setFilterUrgence(e.target.value)} className={selectCls}>
          <option value="">Toutes urgences</option>
          <option value="critique">Critique</option>
          <option value="urgent">Urgent</option>
          <option value="normal">Normal</option>
          <option value="faible">Faible</option>
        </select>

        <select value={filterProjet} onChange={e => setFilterProjet(e.target.value)} className={selectCls}>
          <option value="">Tous les projets</option>
          {allProjets.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white w-44" />
        </div>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-6">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 h-full min-w-max">
              {STATUTS.map(s => (
                <KanbanColumn
                  key={s.key}
                  statut={s.key}
                  label={s.label}
                  taches={getTachesForStatut(s.key)}
                  onCardClick={t => { setEditingTache(t); setModalOpen(true) }}
                />
              ))}
            </div>
          </DragDropContext>
        </div>
      )}

      {/* Modal tache */}
      {modalOpen && (
        <TacheModal
          mode={editingTache ? 'edit' : 'create'}
          tache={editingTache}
          allUsers={allUsers}
          allProjets={allProjets}
          onClose={() => { setModalOpen(false); setEditingTache(null) }}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {/* Modal depot document */}
      <DocumentUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => setUploadOpen(false)}
        projetId={projetIdFromUrl}
      />
    </div>
  )
}
