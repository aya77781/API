'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import {
  Users, Trash2, ShieldCheck, ShieldOff,
  AlertTriangle, X, CheckCircle, Search,
  UserCog, ToggleLeft, ToggleRight, Loader2
} from 'lucide-react'

type User = {
  id: string
  email: string
  nom: string
  prenom: string
  role: string
  actif: boolean
  categorie: string
  created_at: string
}

const ROLES = [
  'admin', 'gerant', 'co', 'commercial', 'economiste',
  'cho', 'rh', 'at', 'compta', 'dessin',
]

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrateur', gerant: 'Gérant', co: 'Chargé d\'Opérations',
  commercial: 'Commercial', economiste: 'Économiste', cho: 'Chief Happiness Officer',
  rh: 'Ressources Humaines', at: 'Assistant de Travaux', compta: 'Comptable',
  dessin: 'Dessinatrice',
}

const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-red-100 text-red-700', gerant: 'bg-purple-100 text-purple-700',
  co: 'bg-blue-100 text-blue-700', commercial: 'bg-green-100 text-green-700',
  economiste: 'bg-amber-100 text-amber-700', cho: 'bg-pink-100 text-pink-700',
  rh: 'bg-indigo-100 text-indigo-700', at: 'bg-orange-100 text-orange-700',
  compta: 'bg-teal-100 text-teal-700', dessin: 'bg-violet-100 text-violet-700',
}

export default function AdminUsersPage() {
  const supabase = createClient()
  const [users, setUsers]         = useState<User[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  /* Delete confirmation modal */
  const [toDelete, setToDelete]   = useState<User | null>(null)
  const [deleting, setDeleting]   = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  /* Edit role inline */
  const [editRole, setEditRole]   = useState<{ id: string; role: string } | null>(null)
  const [saving, setSaving]       = useState(false)

  /* Toast */
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function fetchUsers() {
    setLoading(true); setError(null)
    const res = await fetch('/api/admin/users')
    if (!res.ok) { setError('Accès refusé ou erreur serveur'); setLoading(false); return }
    const data = await res.json()
    setUsers(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  async function toggleActif(user: User) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, actif: !user.actif }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, actif: !u.actif } : u))
      showToast(`${user.prenom} ${user.nom} ${!user.actif ? 'activé' : 'désactivé'}`)
    } else {
      showToast('Erreur lors de la mise à jour', false)
    }
  }

  async function saveRole(id: string, role: string) {
    setSaving(true)
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role }),
    })
    setSaving(false)
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u))
      setEditRole(null)
      showToast('Rôle mis à jour')
    } else {
      showToast('Erreur lors de la mise à jour du rôle', false)
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true); setDeleteError(null)
    const res = await fetch(`/api/admin/users?id=${toDelete.id}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== toDelete.id))
      setToDelete(null)
      showToast(`${toDelete.prenom} ${toDelete.nom} supprimé`)
    } else {
      const data = await res.json()
      setDeleteError(data.error ?? 'Erreur lors de la suppression')
    }
    setDeleting(false)
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return !q || u.nom.toLowerCase().includes(q) || u.prenom.toLowerCase().includes(q)
      || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
  })

  const actifs    = users.filter(u => u.actif).length
  const internes  = users.filter(u => u.categorie === 'interne').length
  const externes  = users.filter(u => u.categorie === 'externe').length

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Gestion des comptes" subtitle="Administrateur — accès complet aux utilisateurs" />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Comptes actifs',   value: actifs,   color: 'bg-green-50 text-green-600' },
            { label: 'Équipe interne',   value: internes, color: 'bg-blue-50 text-blue-600'   },
            { label: 'Équipe externe',   value: externes, color: 'bg-amber-50 text-amber-600'  },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg ${s.color} flex items-center justify-center`}>
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-900 flex-1">Utilisateurs ({users.length})</h2>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 w-56" />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center gap-2 py-12 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              <p className="text-sm">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Aucun utilisateur trouvé</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium">Utilisateur</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Rôle</th>
                  <th className="text-left px-4 py-3 font-medium">Catégorie</th>
                  <th className="text-left px-4 py-3 font-medium">Statut</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(u => {
                  const isMe = u.id === currentUserId
                  return (
                    <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.actif ? 'opacity-50' : ''}`}>
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                            ROLE_COLOR[u.role] ?? 'bg-gray-100 text-gray-600'
                          }`}>
                            {u.prenom?.[0]}{u.nom?.[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {u.prenom} {u.nom}
                              {isMe && <span className="ml-1.5 text-xs text-gray-400 font-normal">(vous)</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                      {/* Email */}
                      <td className="px-4 py-3 text-gray-500">{u.email}</td>
                      {/* Role */}
                      <td className="px-4 py-3">
                        {editRole?.id === u.id ? (
                          <div className="flex items-center gap-2">
                            <select value={editRole.role} onChange={e => setEditRole({ id: u.id, role: e.target.value })}
                              className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900">
                              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
                            </select>
                            <button onClick={() => saveRole(u.id, editRole.role)} disabled={saving}
                              className="p-1 text-green-600 hover:bg-green-50 rounded">
                              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                            </button>
                            <button onClick={() => setEditRole(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setEditRole({ id: u.id, role: u.role })}
                            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium hover:opacity-80 transition-opacity ${
                              ROLE_COLOR[u.role] ?? 'bg-gray-100 text-gray-600'
                            }`}>
                            {ROLE_LABEL[u.role] ?? u.role}
                            <UserCog className="w-3 h-3 ml-0.5" />
                          </button>
                        )}
                      </td>
                      {/* Categorie */}
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.categorie === 'interne' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>{u.categorie}</span>
                      </td>
                      {/* Actif toggle */}
                      <td className="px-4 py-3">
                        <button onClick={() => !isMe && toggleActif(u)} disabled={isMe}
                          title={isMe ? 'Impossible de vous désactiver' : u.actif ? 'Désactiver' : 'Activer'}
                          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                            isMe ? 'cursor-not-allowed opacity-50' : 'hover:opacity-80 cursor-pointer'
                          } ${u.actif ? 'text-green-700' : 'text-gray-400'}`}>
                          {u.actif
                            ? <><ToggleRight className="w-5 h-5 text-green-500" /> Actif</>
                            : <><ToggleLeft className="w-5 h-5 text-gray-400" /> Inactif</>
                          }
                        </button>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => !isMe && setToDelete(u)}
                          disabled={isMe}
                          title={isMe ? 'Impossible de vous supprimer' : 'Supprimer cet utilisateur'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isMe
                              ? 'opacity-30 cursor-not-allowed text-gray-400'
                              : 'text-red-400 hover:text-red-600 hover:bg-red-50'
                          }`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 m-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900">Supprimer cet utilisateur ?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Vous êtes sur le point de supprimer définitivement le compte de{' '}
                  <span className="font-semibold text-gray-800">{toDelete.prenom} {toDelete.nom}</span>{' '}
                  ({toDelete.email}).
                </p>
                <p className="text-sm text-red-600 mt-2 font-medium">
                  Cette action supprime le compte Auth Supabase et toutes ses données. Elle est irréversible.
                </p>
                {deleteError && (
                  <p className="mt-2 text-sm text-red-500 bg-red-50 p-2 rounded-lg">{deleteError}</p>
                )}
              </div>
            </div>
            <div className="mt-5 flex gap-3 justify-end">
              <button onClick={() => { setToDelete(null); setDeleteError(null) }}
                disabled={deleting}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60">
                {deleting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Suppression…</>
                  : <><Trash2 className="w-4 h-4" /> Supprimer définitivement</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
