'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, Archive, Users, FolderOpen, X, Pencil, RotateCcw } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useChat, type ChatGroupe } from '@/hooks/useChat'

const POLE_ROLES = [
  { label: 'CO', roles: ['co'] },
  { label: 'Commercial', roles: ['commercial'] },
  { label: 'Éco', roles: ['economiste'] },
  { label: 'Dessin', roles: ['dessinatrice'] },
  { label: 'Comptable', roles: ['comptable'] },
  { label: 'Direction', roles: ['gerant', 'admin'] },
]

const ROLE_LABELS: Record<string, string> = {
  co: 'CO', commercial: 'Commercial', economiste: 'Économiste', dessinatrice: 'Dessin',
  comptable: 'Comptable', gerant: 'Gérant', admin: 'Admin', rh: 'RH', cho: 'CHO',
  assistant_travaux: 'AT', st: 'ST',
}

interface UserItem { id: string; prenom: string; nom: string; role: string }
interface MembreChip extends UserItem { estAdmin: boolean }

export default function AdminChatPage() {
  const { user } = useUser()
  const chat = useChat()

  const [groupes, setGroupes] = useState<(ChatGroupe & { membres_count: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [nom, setNom] = useState('')
  const [type, setType] = useState<'projet' | 'libre'>('libre')
  const [projetId, setProjetId] = useState('')
  const [description, setDescription] = useState('')
  const [searchUser, setSearchUser] = useState('')
  const [membres, setMembres] = useState<MembreChip[]>([])
  const [allUsers, setAllUsers] = useState<UserItem[]>([])
  const [allProjets, setAllProjets] = useState<{ id: string; nom: string; reference: string | null }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadGroupes = useCallback(async () => {
    const data = await chat.fetchTousGroupes()
    setGroupes(data)
    setLoading(false)
  }, [])

  useEffect(() => { loadGroupes() }, [loadGroupes])

  async function openCreateModal() {
    const [users, projets] = await Promise.all([chat.fetchAllUsers(), chat.fetchAllProjets()])
    setAllUsers(users)
    setAllProjets(projets)
    setModalMode('create')
    setEditingId(null)
    resetForm()
    setModalOpen(true)
  }

  async function openEditModal(g: ChatGroupe & { membres_count: number }) {
    const [users, projets, currentMembres] = await Promise.all([
      chat.fetchAllUsers(),
      chat.fetchAllProjets(),
      chat.fetchGroupeMembers(g.id),
    ])
    setAllUsers(users)
    setAllProjets(projets)

    // Pre-fill form
    setNom(g.nom)
    setType(g.type)
    setProjetId(g.projet_id ?? '')
    setDescription(g.description ?? '')
    setMembres(currentMembres.map(m => ({
      id: m.utilisateur_id,
      prenom: m.utilisateur?.prenom ?? '',
      nom: m.utilisateur?.nom ?? '',
      role: m.utilisateur?.role ?? '',
      estAdmin: m.est_admin,
    })))
    setSearchUser('')
    setError(null)
    setModalMode('edit')
    setEditingId(g.id)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    resetForm()
  }

  function resetForm() {
    setNom(''); setType('libre'); setProjetId(''); setDescription('')
    setSearchUser(''); setMembres([]); setError(null)
  }

  function addUser(u: UserItem) {
    if (!membres.find(m => m.id === u.id)) setMembres(prev => [...prev, { ...u, estAdmin: false }])
    setSearchUser('')
  }

  function addPole(roles: string[]) {
    const toAdd = allUsers.filter(u => roles.includes(u.role) && !membres.find(m => m.id === u.id))
    setMembres(prev => [...prev, ...toAdd.map(u => ({ ...u, estAdmin: false }))])
  }

  async function handleSave() {
    if (!nom.trim()) { setError('Le nom du groupe est obligatoire'); return }
    if (!user) return
    setSaving(true)

    if (modalMode === 'edit' && editingId) {
      const { error: err } = await chat.updateGroupe(
        editingId, nom.trim(), type,
        type === 'projet' ? projetId || null : null,
        description.trim() || null
      )
      if (err) { setError(err); setSaving(false); return }
      await chat.syncGroupeMembres(
        editingId,
        membres.map(m => ({ userId: m.id, estAdmin: m.estAdmin })),
        nom.trim()
      )
    } else {
      const { error: err } = await chat.createGroupe(
        nom.trim(), type, type === 'projet' ? projetId || null : null,
        description.trim() || null, user.id,
        membres.map(m => ({ userId: m.id, estAdmin: m.estAdmin }))
      )
      if (err) { setError(err); setSaving(false); return }
    }

    setSaving(false)
    closeModal()
    loadGroupes()
  }

  async function handleArchiver(groupeId: string) {
    await chat.archiverGroupe(groupeId)
    setGroupes(prev => prev.map(g => g.id === groupeId ? { ...g, actif: false } : g))
  }

  async function handleRestaurer(groupeId: string) {
    await chat.restaurerGroupe(groupeId)
    setGroupes(prev => prev.map(g => g.id === groupeId ? { ...g, actif: true } : g))
  }

  const filteredUsers = allUsers.filter(u =>
    !membres.find(m => m.id === u.id) &&
    `${u.prenom} ${u.nom} ${u.role}`.toLowerCase().includes(searchUser.toLowerCase())
  ).slice(0, 6)

  const actifs   = groupes.filter(g => g.actif)
  const archives = groupes.filter(g => !g.actif)

  return (
    <div>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Groupes de chat</h1>
          <p className="text-xs text-gray-400">
            {actifs.length} actif{actifs.length !== 1 ? 's' : ''}
            {archives.length > 0 ? ` · ${archives.length} archivé${archives.length !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <button onClick={openCreateModal}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium">
          <Plus className="w-3.5 h-3.5" />
          Nouveau groupe
        </button>
      </header>

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
          </div>
        ) : groupes.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-14 text-center">
            <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Aucun groupe créé</p>
          </div>
        ) : (
          <>
            {/* Groupes actifs */}
            {actifs.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-50 overflow-hidden">
                {actifs.map(g => (
                  <GroupRow key={g.id} g={g}
                    onEdit={() => openEditModal(g)}
                    onArchive={() => handleArchiver(g.id)}
                    onRestore={null}
                  />
                ))}
              </div>
            )}

            {/* Groupes archivés */}
            {archives.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Archivés</p>
                <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-50 overflow-hidden opacity-70">
                  {archives.map(g => (
                    <GroupRow key={g.id} g={g}
                      onEdit={() => openEditModal(g)}
                      onArchive={null}
                      onRestore={() => handleRestaurer(g.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal créer / modifier */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {modalMode === 'edit' ? 'Modifier le groupe' : 'Nouveau groupe'}
              </h2>
              <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Nom */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Nom du groupe *</label>
                <input value={nom} onChange={e => setNom(e.target.value)}
                  placeholder="Ex: Équipe projet Les Lilas"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>

              {/* Type */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Type</label>
                <div className="flex gap-2">
                  {(['libre', 'projet'] as const).map(t => (
                    <button key={t} onClick={() => setType(t)}
                      className={`flex-1 py-2 text-sm rounded-lg border transition-colors font-medium ${
                        type === t ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}>
                      {t === 'libre' ? 'Groupe libre' : 'Groupe projet'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Projet lié */}
              {type === 'projet' && (
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Projet lié</label>
                  <select value={projetId} onChange={e => setProjetId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                    <option value="">Sélectionner un projet</option>
                    {allProjets.map(p => <option key={p.id} value={p.id}>{p.nom}{p.reference ? ` — ${p.reference}` : ''}</option>)}
                  </select>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Description <span className="font-normal text-gray-400">optionnel</span></label>
                <input value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Courte description du groupe"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>

              {/* Membres */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Membres</label>

                {/* Pôles raccourcis */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {POLE_ROLES.map(p => (
                    <button key={p.label} onClick={() => addPole(p.roles)}
                      className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-colors font-medium">
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Chips membres sélectionnés */}
                {membres.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {membres.map(m => (
                      <div key={m.id} className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-lg text-xs">
                        <span className="font-medium text-gray-800">{m.prenom} {m.nom}</span>
                        <button onClick={() =>
                          setMembres(prev => prev.map(x => x.id === m.id ? { ...x, estAdmin: !x.estAdmin } : x))}
                          className={`px-1 rounded text-xs font-medium transition-colors ${m.estAdmin ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'}`}
                          title="Toggler admin">
                          Admin
                        </button>
                        <button onClick={() => setMembres(prev => prev.filter(x => x.id !== m.id))}
                          className="text-gray-400 hover:text-red-500 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input value={searchUser} onChange={e => setSearchUser(e.target.value)}
                    placeholder="Rechercher par nom ou rôle..."
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>

                {searchUser && filteredUsers.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden">
                    {filteredUsers.map(u => (
                      <button key={u.id} onClick={() => addUser(u)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors">
                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                          {`${u.prenom[0]}${u.nom[0]}`.toUpperCase()}
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

              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            </div>

            <div className="px-6 py-4 border-t border-gray-100">
              <button onClick={handleSave} disabled={saving}
                className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50">
                {saving
                  ? (modalMode === 'edit' ? 'Enregistrement...' : 'Création...')
                  : modalMode === 'edit'
                    ? 'Enregistrer les modifications'
                    : `Créer le groupe${membres.length > 0 ? ` · ${membres.length} membre${membres.length > 1 ? 's' : ''}` : ''}`
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GroupRow({
  g, onEdit, onArchive, onRestore,
}: {
  g: ChatGroupe & { membres_count: number }
  onEdit: () => void
  onArchive: (() => void) | null
  onRestore: (() => void) | null
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
        {g.nom.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900">{g.nom}</p>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${g.type === 'projet' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
            {g.type === 'projet' ? 'Projet' : 'Libre'}
          </span>
          {!g.actif && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">Archivé</span>}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{g.membres_count} membre{g.membres_count !== 1 ? 's' : ''}</span>
          {g.projet?.nom && <span className="flex items-center gap-1"><FolderOpen className="w-3 h-3" />{g.projet.nom}</span>}
          {g.description && <span>{g.description}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onEdit}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <Pencil className="w-3.5 h-3.5" />
          Modifier
        </button>
        {onArchive && (
          <button onClick={onArchive}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Archive className="w-3.5 h-3.5" />
            Archiver
          </button>
        )}
        {onRestore && (
          <button onClick={onRestore}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurer
          </button>
        )}
      </div>
    </div>
  )
}
