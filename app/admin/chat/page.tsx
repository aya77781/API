'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, Archive, Users, FolderOpen, X } from 'lucide-react'
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

  // Form state
  const [nom, setNom] = useState('')
  const [type, setType] = useState<'projet' | 'libre'>('libre')
  const [projetId, setProjetId] = useState('')
  const [description, setDescription] = useState('')
  const [searchUser, setSearchUser] = useState('')
  const [membres, setMembres] = useState<MembreChip[]>([])
  const [allUsers, setAllUsers] = useState<UserItem[]>([])
  const [allProjets, setAllProjets] = useState<{ id: string; nom: string; reference: string | null }[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadGroupes = useCallback(async () => {
    const data = await chat.fetchTousGroupes()
    setGroupes(data)
    setLoading(false)
  }, [])

  useEffect(() => { loadGroupes() }, [loadGroupes])

  async function openModal() {
    const [users, projets] = await Promise.all([chat.fetchAllUsers(), chat.fetchAllProjets()])
    setAllUsers(users)
    setAllProjets(projets)
    setModalOpen(true)
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

  async function handleCreate() {
    if (!nom.trim()) { setError('Le nom du groupe est obligatoire'); return }
    if (!user) return
    setCreating(true)
    const { error: err } = await chat.createGroupe(
      nom.trim(), type, type === 'projet' ? projetId || null : null,
      description.trim() || null, user.id,
      membres.map(m => ({ userId: m.id, estAdmin: m.estAdmin }))
    )
    setCreating(false)
    if (err) { setError(err); return }
    setModalOpen(false)
    resetForm()
    loadGroupes()
  }

  async function handleArchiver(groupeId: string) {
    await chat.archiverGroupe(groupeId)
    setGroupes(prev => prev.map(g => g.id === groupeId ? { ...g, actif: false } : g))
  }

  const filteredUsers = allUsers.filter(u =>
    !membres.find(m => m.id === u.id) &&
    `${u.prenom} ${u.nom} ${u.role}`.toLowerCase().includes(searchUser.toLowerCase())
  ).slice(0, 6)

  return (
    <div>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Groupes de chat</h1>
          <p className="text-xs text-gray-400">{groupes.length} groupe{groupes.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openModal}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium">
          <Plus className="w-3.5 h-3.5" />
          Nouveau groupe
        </button>
      </header>

      <div className="p-6">
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
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-50 overflow-hidden">
            {groupes.map(g => (
              <div key={g.id} className="flex items-center gap-4 px-5 py-4">
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
                {g.actif && (
                  <button onClick={() => handleArchiver(g.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <Archive className="w-3.5 h-3.5" />
                    Archiver
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal nouveau groupe */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => { setModalOpen(false); resetForm() }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Nouveau groupe</h2>
              <button onClick={() => { setModalOpen(false); resetForm() }} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
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
              <button onClick={handleCreate} disabled={creating}
                className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50">
                {creating ? 'Création...' : `Créer le groupe${membres.length > 0 ? ` · ${membres.length} membre${membres.length > 1 ? 's' : ''}` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
