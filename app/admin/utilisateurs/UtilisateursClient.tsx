'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Pencil, UserX, Trash2, X, CheckCircle2, XCircle } from 'lucide-react'

export interface UserRow {
  id: string
  email: string
  nom: string
  prenom: string
  role: string
  actif: boolean
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  admin:             'Administrateur',
  co:                "Chargé d'opérations",
  gerant:            'Gérant',
  commercial:        'Commercial',
  economiste:        'Économiste',
  dessinatrice:      'Dessinatrice',
  assistant_travaux: 'Assistant travaux',
  comptable:         'Comptable',
  rh:                'RH',
  cho:               'CHO',
}

const ROLES = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))

interface EditForm {
  prenom: string
  nom: string
  role: string
  actif: boolean
}

export default function UtilisateursClient({ initialUsers }: { initialUsers: UserRow[] }) {
  const supabase = createClient()

  const [users, setUsers]             = useState<UserRow[]>(initialUsers)
  const [search, setSearch]           = useState('')
  const [filterRole, setFilterRole]   = useState('')
  const [filterActif, setFilterActif] = useState<'all' | 'actif' | 'inactif'>('all')

  const [editUser, setEditUser]       = useState<UserRow | null>(null)
  const [editForm, setEditForm]       = useState<EditForm>({ prenom: '', nom: '', role: '', actif: true })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError]     = useState('')

  const [deleteTarget, setDeleteTarget]   = useState<UserRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function notify(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const filtered = useMemo(() => users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !q || `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(q)
    const matchRole   = !filterRole || u.role === filterRole
    const matchActif  = filterActif === 'all' || (filterActif === 'actif' ? u.actif : !u.actif)
    return matchSearch && matchRole && matchActif
  }), [users, search, filterRole, filterActif])

  // ── Modifier ────────────────────────────────────────────────────────────────
  function openEdit(u: UserRow) {
    setEditUser(u)
    setEditForm({ prenom: u.prenom, nom: u.nom, role: u.role, actif: u.actif })
    setEditError('')
  }

  async function handleEdit() {
    if (!editUser) return
    if (!editForm.prenom.trim() || !editForm.nom.trim()) {
      setEditError('Prénom et nom sont requis.')
      return
    }
    setEditLoading(true)
    const { error } = await supabase
      .schema('app')
      .from('utilisateurs')
      .update({ prenom: editForm.prenom, nom: editForm.nom, role: editForm.role, actif: editForm.actif })
      .eq('id', editUser.id)
    setEditLoading(false)

    if (error) {
      setEditError(error.message)
      return
    }
    setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...editForm } : u))
    setEditUser(null)
    notify('Utilisateur mis à jour')
  }

  // ── Désactiver ──────────────────────────────────────────────────────────────
  async function handleDesactiver(u: UserRow) {
    const { error } = await supabase
      .schema('app')
      .from('utilisateurs')
      .update({ actif: false })
      .eq('id', u.id)

    if (error) {
      notify(error.message, false)
      return
    }
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, actif: false } : x))
    notify(`${u.prenom} ${u.nom} désactivé`)
  }

  // ── Supprimer ───────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    const { error } = await supabase
      .schema('app')
      .from('utilisateurs')
      .delete()
      .eq('id', deleteTarget.id)
    setDeleteLoading(false)

    if (error) {
      setDeleteTarget(null)
      notify(error.message, false)
      return
    }
    setUsers(prev => prev.filter(u => u.id !== deleteTarget.id))
    setDeleteTarget(null)
    notify('Compte supprimé')
  }

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Utilisateurs</h1>
        <p className="text-sm text-gray-400 mt-0.5">{users.length} comptes enregistrés</p>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un utilisateur…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="">Tous les rôles</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {(['all', 'actif', 'inactif'] as const).map(v => (
            <button
              key={v}
              onClick={() => setFilterActif(v)}
              className={`px-3 py-2 font-medium transition-colors ${
                filterActif === v ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {v === 'all' ? 'Tous' : v === 'actif' ? 'Actifs' : 'Inactifs'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">Aucun utilisateur trouvé</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Nom / Prénom</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Rôle</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-left px-4 py-3">Créé le</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
                        {u.prenom?.[0]?.toUpperCase()}{u.nom?.[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{u.prenom} {u.nom}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.actif ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Actif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
                        <XCircle className="w-3.5 h-3.5" /> Inactif
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(u.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        <Pencil className="w-3 h-3" /> Modifier
                      </button>
                      {u.actif && (
                        <button
                          onClick={() => handleDesactiver(u)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-md hover:bg-amber-100 transition-colors"
                        >
                          <UserX className="w-3 h-3" /> Désactiver
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(u)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Modal Modifier */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Modifier l&apos;utilisateur</h2>
              <button onClick={() => setEditUser(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {editError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{editError}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Prénom</label>
                  <input
                    value={editForm.prenom}
                    onChange={e => setEditForm(f => ({ ...f, prenom: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Nom</label>
                  <input
                    value={editForm.nom}
                    onChange={e => setEditForm(f => ({ ...f, nom: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Rôle</label>
                <select
                  value={editForm.role}
                  onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Statut</label>
                <div className="flex gap-2">
                  {([true, false] as const).map(v => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, actif: v }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        editForm.actif === v
                          ? v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-700 text-white border-gray-700'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {v ? 'Actif' : 'Inactif'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setEditUser(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Annuler
              </button>
              <button
                onClick={handleEdit}
                disabled={editLoading}
                className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {editLoading ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Supprimer */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Supprimer ce compte ?</h3>
            <p className="text-sm font-medium text-gray-700 mb-0.5">{deleteTarget.prenom} {deleteTarget.nom}</p>
            <p className="text-xs text-gray-400 mb-2">{deleteTarget.email}</p>
            <p className="text-xs text-red-500 mb-6">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteLoading ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
          toast.ok ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
