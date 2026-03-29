'use client'

import { useState, useCallback } from 'react'
import {
  Plus, Trash2, ToggleLeft, ToggleRight, X, Eye, EyeOff, Pencil, Layers, ChevronDown, ChevronRight,
} from 'lucide-react'

export type CategorieUser = 'interne' | 'st' | 'controle' | 'client'

export interface UserRow {
  id: string
  email: string
  nom: string
  prenom: string
  role: string
  actif: boolean
  categorie: CategorieUser
  created_at: string
}

export interface LotRow {
  id: string
  numero: number
  corps_etat: string
  statut: string
  st_retenu_id: string | null
}

export interface ProjetAvecLots {
  id: string
  nom: string
  reference: string | null
  statut: string
  lots: LotRow[]
}

const CATEGORIES: { key: CategorieUser; label: string; color: string }[] = [
  { key: 'interne',  label: 'Équipe interne',    color: 'blue' },
  { key: 'st',       label: 'Sous-traitants',     color: 'amber' },
  { key: 'controle', label: 'Contrôle',           color: 'purple' },
  { key: 'client',   label: 'Clients',            color: 'emerald' },
]

const ROLES_INTERNE = [
  { value: 'co',               label: 'Chargé d\'opérations' },
  { value: 'gerant',           label: 'Gérant' },
  { value: 'commercial',       label: 'Commercial' },
  { value: 'economiste',       label: 'Économiste' },
  { value: 'dessinatrice',     label: 'Dessinatrice' },
  { value: 'assistant_travaux',label: 'Assistant travaux' },
  { value: 'comptable',        label: 'Comptable' },
  { value: 'rh',               label: 'RH' },
  { value: 'cho',              label: 'CHO' },
  { value: 'admin',            label: 'Administrateur' },
]

const ROLE_LABEL: Record<string, string> = {
  admin:             'Administrateur',
  co:                'Chargé d\'opérations',
  gerant:            'Gérant',
  commercial:        'Commercial',
  economiste:        'Économiste',
  dessinatrice:      'Dessinatrice',
  assistant_travaux: 'Assistant travaux',
  comptable:         'Comptable',
  rh:                'RH',
  cho:               'CHO',
  st:                'Sous-traitant',
  controle:          'Contrôle',
  client:            'Client',
}

const COLOR_MAP = {
  blue:    { tab: 'bg-blue-600 text-white',   badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  amber:   { tab: 'bg-amber-500 text-white',  badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  purple:  { tab: 'bg-purple-600 text-white', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  emerald: { tab: 'bg-emerald-600 text-white',badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

const STATUT_LOT_LABEL: Record<string, string> = {
  en_attente:  'En attente',
  consultation:'Consultation',
  negociation: 'Négociation',
  retenu:      'Retenu',
  en_cours:    'En cours',
  termine:     'Terminé',
}

interface FormData {
  prenom: string; nom: string; email: string; password: string; role: string; categorie: CategorieUser
}

const EMPTY_FORM: FormData = { prenom: '', nom: '', email: '', password: '', role: '', categorie: 'interne' }

export default function UsersClient({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers)
  const [activeTab, setActiveTab] = useState<CategorieUser>('interne')
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null)

  // Lots assignment modal state
  const [lotsModal, setLotsModal]         = useState<UserRow | null>(null)
  const [projets, setProjets]             = useState<ProjetAvecLots[]>([])
  const [lotsLoading, setLotsLoading]     = useState(false)
  const [lotsError, setLotsError]         = useState('')
  const [savingLot, setSavingLot]         = useState<string | null>(null)
  const [expandedProjets, setExpandedProjets] = useState<Set<string>>(new Set())

  const filtered = users.filter(u => u.categorie === activeTab)

  function openCreate() {
    setForm({ ...EMPTY_FORM, categorie: activeTab, role: activeTab !== 'interne' ? activeTab : '' })
    setEditUser(null)
    setError('')
    setShowModal(true)
  }

  function openEdit(user: UserRow) {
    setForm({ prenom: user.prenom, nom: user.nom, email: user.email, password: '', role: user.role, categorie: user.categorie })
    setEditUser(user)
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    setError('')
    if (!form.prenom || !form.nom || !form.email || !form.role) {
      setError('Tous les champs sont obligatoires.')
      return
    }
    if (!editUser && !form.password) {
      setError('Le mot de passe est obligatoire.')
      return
    }
    setLoading(true)

    try {
      if (editUser) {
        const res = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editUser.id, prenom: form.prenom, nom: form.nom, role: form.role, categorie: form.categorie }),
        })
        if (!res.ok) {
          const d = await res.json()
          setError(d.error ?? 'Erreur lors de la modification')
          return
        }
        setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, prenom: form.prenom, nom: form.nom, role: form.role, categorie: form.categorie } : u))
        setShowModal(false)
      } else {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        let d: any = {}
        try { d = await res.json() } catch { d = { error: `Réponse invalide du serveur (HTTP ${res.status})` } }
        if (!res.ok) {
          setError(d.error ?? 'Erreur lors de la création')
          return
        }
        const newUser: UserRow = {
          id: d.id, email: form.email, nom: form.nom, prenom: form.prenom,
          role: form.role, actif: true, categorie: form.categorie, created_at: new Date().toISOString(),
        }
        setUsers(prev => [...prev, newUser])
        setShowModal(false)
        // Si c'est un ST, ouvrir directement la modale d'attribution de lots
        if (form.categorie === 'st') {
          setActiveTab('st')
          openLotsModal(newUser)
        }
      }
    } catch (e: any) {
      setError(`Erreur réseau : ${e?.message ?? e}`)
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg: string, type: 'error' | 'success' = 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function toggleActif(user: UserRow) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, actif: !user.actif }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, actif: !u.actif } : u))
    } else {
      const d = await res.json()
      showToast(d.error ?? 'Erreur lors de la mise à jour')
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== id))
      setDeleteConfirm(null)
      showToast('Compte supprimé', 'success')
    } else {
      const d = await res.json()
      setDeleteConfirm(null)
      showToast(d.error ?? 'Erreur lors de la suppression')
    }
  }

  // --- Lots modal ---

  const openLotsModal = useCallback(async (user: UserRow) => {
    setLotsModal(user)
    setLotsError('')
    setLotsLoading(true)
    setExpandedProjets(new Set())
    try {
      const res = await fetch('/api/admin/lots')
      if (!res.ok) {
        const d = await res.json()
        setLotsError(d.error ?? 'Erreur lors du chargement des lots')
        return
      }
      const data: ProjetAvecLots[] = await res.json()
      // Expand projets that have lots assigned to this ST
      const withLots = data.filter(p => p.lots && p.lots.length > 0)
      const alreadyAssigned = withLots.filter(p => p.lots.some(l => l.st_retenu_id === user.id))
      setExpandedProjets(new Set(alreadyAssigned.map(p => p.id)))
      setProjets(withLots)
    } catch (e: any) {
      setLotsError(`Erreur réseau : ${e?.message ?? e}`)
    } finally {
      setLotsLoading(false)
    }
  }, [])

  async function toggleLot(lot: LotRow) {
    if (!lotsModal) return
    setSavingLot(lot.id)
    const newStId = lot.st_retenu_id === lotsModal.id ? null : lotsModal.id
    try {
      const res = await fetch('/api/admin/lots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lot_id: lot.id, st_id: newStId }),
      })
      if (!res.ok) {
        const d = await res.json()
        showToast(d.error ?? 'Erreur lors de la mise à jour du lot')
        return
      }
      setProjets(prev => prev.map(p => ({
        ...p,
        lots: p.lots.map(l => l.id === lot.id ? { ...l, st_retenu_id: newStId } : l),
      })))
    } catch (e: any) {
      showToast(`Erreur réseau : ${e?.message ?? e}`)
    } finally {
      setSavingLot(null)
    }
  }

  function toggleExpandProjet(projetId: string) {
    setExpandedProjets(prev => {
      const next = new Set(prev)
      if (next.has(projetId)) next.delete(projetId)
      else next.add(projetId)
      return next
    })
  }

  function lotsCountForST(projetId: string) {
    const p = projets.find(pr => pr.id === projetId)
    if (!p || !lotsModal) return 0
    return p.lots.filter(l => l.st_retenu_id === lotsModal.id).length
  }

  const catConfig = CATEGORIES.find(c => c.key === activeTab)!
  const colorCls = COLOR_MAP[catConfig.color as keyof typeof COLOR_MAP]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Gestion des comptes</h1>
          <p className="text-sm text-gray-400 mt-0.5">{users.length} comptes au total</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ajouter un compte
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => {
          const count = users.filter(u => u.categorie === cat.key).length
          const cls = COLOR_MAP[cat.color as keyof typeof COLOR_MAP]
          const isActive = activeTab === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => setActiveTab(cat.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? cls.tab : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {cat.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              }`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-gray-500">Aucun compte dans cette catégorie</p>
            <button onClick={openCreate} className="mt-3 text-sm text-gray-400 hover:text-gray-700 underline underline-offset-2">
              Créer le premier
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Nom</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Rôle</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Statut</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Créé le</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${colorCls.badge} border`}>
                        {user.prenom[0]}{user.nom[0]}
                      </div>
                      <span className="font-medium text-gray-900">{user.prenom} {user.nom}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium border ${colorCls.badge}`}>
                      {ROLE_LABEL[user.role] ?? user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActif(user)}
                      className="flex items-center gap-1.5 text-xs font-medium"
                    >
                      {user.actif ? (
                        <>
                          <ToggleRight className="w-4 h-4 text-emerald-500" />
                          <span className="text-emerald-600">Actif</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-400">Inactif</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(user.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {user.categorie === 'st' && (
                        <button
                          onClick={() => openLotsModal(user)}
                          className="p-1.5 rounded-md text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                          title="Attribuer des lots"
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(user)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        title="Modifier"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(user.id)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal créer/modifier */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {editUser ? 'Modifier le compte' : 'Nouveau compte'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Catégorie */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Catégorie</label>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIES.map(cat => {
                    const cls = COLOR_MAP[cat.color as keyof typeof COLOR_MAP]
                    const isSelected = form.categorie === cat.key
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setForm(f => ({
                          ...f,
                          categorie: cat.key,
                          role: cat.key !== 'interne' ? cat.key : '',
                        }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          isSelected ? cls.tab + ' border-transparent' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {cat.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {form.categorie === 'st' && !editUser && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                  Après la création du compte, vous pourrez attribuer des lots à ce sous-traitant.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Prénom</label>
                  <input
                    value={form.prenom}
                    onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="Marie"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Nom</label>
                  <input
                    value={form.nom}
                    onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="Dupont"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  disabled={!!editUser}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
                  placeholder="marie@example.com"
                />
              </div>

              {!editUser && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      placeholder="Min. 6 caractères"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {form.categorie === 'interne' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Rôle</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                  >
                    <option value="">Sélectionner un rôle</option>
                    {ROLES_INTERNE.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {loading
                  ? 'Enregistrement…'
                  : editUser
                    ? 'Mettre à jour'
                    : form.categorie === 'st'
                      ? 'Créer et attribuer des lots'
                      : 'Créer le compte'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal attribution des lots */}
      {lotsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col" style={{ maxHeight: '85vh' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Attribuer des lots</h2>
                <p className="text-xs text-gray-400 mt-0.5">{lotsModal.prenom} {lotsModal.nom}</p>
              </div>
              <button onClick={() => setLotsModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {lotsLoading ? (
                <div className="py-12 text-center text-sm text-gray-400">Chargement des projets…</div>
              ) : lotsError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">{lotsError}</div>
              ) : projets.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">Aucun projet avec des lots disponibles.</div>
              ) : (
                <div className="space-y-2">
                  {projets.map(projet => {
                    const isExpanded = expandedProjets.has(projet.id)
                    const assignedCount = lotsCountForST(projet.id)
                    return (
                      <div key={projet.id} className="border border-gray-200 rounded-xl overflow-hidden">
                        {/* Projet header */}
                        <button
                          onClick={() => toggleExpandProjet(projet.id)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            }
                            <span className="font-medium text-sm text-gray-900 truncate">{projet.nom}</span>
                            {projet.reference && (
                              <span className="text-xs text-gray-400 flex-shrink-0">({projet.reference})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {assignedCount > 0 && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                {assignedCount} lot{assignedCount > 1 ? 's' : ''} attribué{assignedCount > 1 ? 's' : ''}
                              </span>
                            )}
                            <span className="text-xs text-gray-400">{projet.lots.length} lot{projet.lots.length > 1 ? 's' : ''}</span>
                          </div>
                        </button>

                        {/* Lots list */}
                        {isExpanded && (
                          <div className="divide-y divide-gray-50">
                            {projet.lots.map(lot => {
                              const isAssignedToThis = lot.st_retenu_id === lotsModal.id
                              const isAssignedToOther = lot.st_retenu_id && lot.st_retenu_id !== lotsModal.id
                              const isSaving = savingLot === lot.id
                              return (
                                <div key={lot.id} className="flex items-center gap-3 px-4 py-2.5">
                                  <input
                                    type="checkbox"
                                    checked={isAssignedToThis}
                                    disabled={isSaving || !!isAssignedToOther}
                                    onChange={() => toggleLot(lot)}
                                    className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400 cursor-pointer disabled:cursor-not-allowed"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium text-gray-800">
                                      Lot {lot.numero} — {lot.corps_etat}
                                    </span>
                                    {isAssignedToOther && (
                                      <span className="ml-2 text-xs text-gray-400">(déjà attribué)</span>
                                    )}
                                  </div>
                                  <span className={`text-xs px-2 py-0.5 rounded-md border flex-shrink-0 ${
                                    lot.statut === 'retenu' || lot.statut === 'en_cours'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : lot.statut === 'termine'
                                        ? 'bg-gray-100 text-gray-500 border-gray-200'
                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                  }`}>
                                    {STATUT_LOT_LABEL[lot.statut] ?? lot.statut}
                                  </span>
                                  {isSaving && (
                                    <span className="text-xs text-gray-400">…</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
              <p className="text-xs text-gray-400">
                Les modifications sont enregistrées immédiatement.
              </p>
              <button
                onClick={() => setLotsModal(null)}
                className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Confirm suppression */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Supprimer ce compte ?</h3>
            <p className="text-sm text-gray-500 mb-6">Cette action est irréversible. L&apos;utilisateur perdra tout accès.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
