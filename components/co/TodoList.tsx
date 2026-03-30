'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Calendar, Trash2, X, Check } from 'lucide-react'
import { useTaches, type Tache, type TacheStatut } from '@/hooks/useTaches'
import { useUser } from '@/hooks/useUser'
import { cn } from '@/lib/utils'

const STATUT_CONFIG: Record<string, { label: string; activeClass: string; badgeClass: string }> = {
  a_faire: {
    label: 'À faire',
    activeClass: 'bg-gray-900 text-white border-gray-900',
    badgeClass: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  },
  en_cours: {
    label: 'En cours',
    activeClass: 'bg-blue-600 text-white border-blue-600',
    badgeClass: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  },
  fait: {
    label: 'Fait',
    activeClass: 'bg-emerald-600 text-white border-emerald-600',
    badgeClass: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
  },
}

const STATUT_CYCLE: Record<string, TacheStatut> = {
  a_faire: 'en_cours',
  en_cours: 'fait',
  en_attente: 'fait',
  fait: 'a_faire',
}

const FILTERS = [
  { value: 'all', label: 'Toutes' },
  { value: 'a_faire', label: 'À faire' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'fait', label: 'Fait' },
]

interface FormState {
  titre: string
  date_echeance: string
  statut: TacheStatut
  partage_avec: string[]
}

const DEFAULT_FORM: FormState = {
  titre: '',
  date_echeance: '',
  statut: 'a_faire',
  partage_avec: [],
}

export function TodoList() {
  const { user, profil } = useUser()
  const { fetchMesTaches, createTache, updateStatut, deleteTache, fetchAllUsers } = useTaches()

  const [todos, setTodos] = useState<Tache[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | TacheStatut>('all')
  const [showModal, setShowModal] = useState(false)
  const [allUsers, setAllUsers] = useState<{ id: string; prenom: string; nom: string; role: string }[]>([])
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  const fetchTodos = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const all = await fetchMesTaches(user.id, 'co')
    setTodos(all.filter(t => t.creee_par === user.id))
    setLoading(false)
  }, [user, fetchMesTaches])

  useEffect(() => {
    fetchTodos()
  }, [fetchTodos])

  useEffect(() => {
    if (!showModal || !user) return
    fetchAllUsers().then(users => {
      setAllUsers(users.filter(u => u.id !== user.id))
    })
  }, [showModal, user, fetchAllUsers])

  const filtered = filter === 'all' ? todos : todos.filter(t => t.statut === filter)

  function countByStatut(s: string) {
    return todos.filter(t => t.statut === s).length
  }

  async function handleCreate() {
    if (!form.titre.trim() || !user || !profil) return
    setSaving(true)
    await createTache(
      {
        titre: form.titre.trim(),
        description: null,
        projet_id: null,
        urgence: 'normal',
        statut: form.statut,
        date_echeance: form.date_echeance || null,
        date_rappel: null,
        tags_utilisateurs: form.partage_avec,
        tags_roles: [],
        tag_tous: false,
        assignee_a: null,
      },
      user.id,
      `${profil.prenom} ${profil.nom}`,
      form.partage_avec,
    )
    setForm(DEFAULT_FORM)
    setShowModal(false)
    setSaving(false)
    fetchTodos()
  }

  async function handleStatusChange(id: string, current: TacheStatut) {
    const next = STATUT_CYCLE[current] ?? 'a_faire'
    await updateStatut(id, next)
    setTodos(prev => prev.map(t => t.id === id ? { ...t, statut: next } : t))
  }

  async function handleDelete(id: string) {
    await deleteTache(id)
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  function dueDateClass(date: string | null) {
    if (!date) return ''
    const diff = new Date(date).getTime() - Date.now()
    const days = diff / (1000 * 60 * 60 * 24)
    if (days < 0) return 'text-red-600 bg-red-50 border-red-100'
    if (days < 2) return 'text-orange-600 bg-orange-50 border-orange-100'
    return 'text-gray-500 bg-gray-50 border-gray-100'
  }

  function toggleUser(id: string) {
    setForm(f => ({
      ...f,
      partage_avec: f.partage_avec.includes(id)
        ? f.partage_avec.filter(uid => uid !== id)
        : [...f.partage_avec, id],
    }))
  }

  return (
    <div>
      {/* Filtres + bouton */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value as typeof filter)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                filter === f.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-900',
              )}
            >
              {f.label}
              {f.value !== 'all' && (
                <span className={cn('ml-1.5 text-xs', filter === f.value ? 'opacity-60' : 'text-gray-400')}>
                  {countByStatut(f.value)}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvelle tâche
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Check className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">
            {filter === 'all' ? 'Aucune tâche' : `Aucune tâche "${STATUT_CONFIG[filter]?.label ?? filter}"`}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {filter === 'all' ? 'Créez votre première tâche pour commencer' : 'Modifiez un filtre pour voir d\'autres tâches'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(todo => {
            const cfg = STATUT_CONFIG[todo.statut] ?? STATUT_CONFIG['a_faire']
            const dateClass = dueDateClass(todo.date_echeance)

            return (
              <div
                key={todo.id}
                className={cn(
                  'group bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-4 hover:border-gray-300 transition-colors',
                  todo.statut === 'fait' && 'opacity-55',
                )}
              >
                {/* Bouton cocher */}
                <button
                  onClick={() => handleStatusChange(todo.id, todo.statut)}
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors',
                    todo.statut === 'fait'
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-gray-300 hover:border-emerald-400',
                  )}
                  title="Changer le statut"
                >
                  {todo.statut === 'fait' && <Check className="w-3 h-3 text-white" />}
                </button>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium text-gray-900 truncate',
                    todo.statut === 'fait' && 'line-through text-gray-400',
                  )}>
                    {todo.titre}
                  </p>
                  {(todo.date_echeance || (todo.destinataires && todo.destinataires.length > 0)) && (
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {todo.date_echeance && (
                        <span className={cn('flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border', dateClass)}>
                          <Calendar className="w-3 h-3" />
                          {new Date(todo.date_echeance).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                      {todo.destinataires && todo.destinataires.length > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">Partagé avec</span>
                          {todo.destinataires.map(d => (
                            <span key={d.id} className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                              {d.prenom} {d.nom}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Badge statut cliquable */}
                <button
                  onClick={() => handleStatusChange(todo.id, todo.statut)}
                  className={cn('px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex-shrink-0', cfg.badgeClass)}
                  title="Changer le statut"
                >
                  {cfg.label}
                </button>

                {/* Supprimer */}
                <button
                  onClick={() => handleDelete(todo.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nouvelle tâche */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Nouvelle tâche</h2>
              <button
                onClick={() => { setShowModal(false); setForm(DEFAULT_FORM) }}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Titre */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Titre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.titre}
                  onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                  placeholder="Ex: Préparer le rapport de chantier"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  autoFocus
                />
              </div>

              {/* Statut */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Statut par défaut
                </label>
                <div className="flex gap-2">
                  {(['a_faire', 'en_cours', 'fait'] as TacheStatut[]).map(s => {
                    const c = STATUT_CONFIG[s]
                    return (
                      <button
                        key={s}
                        onClick={() => setForm(f => ({ ...f, statut: s }))}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                          form.statut === s ? c.activeClass : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                        )}
                      >
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Date limite */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Date limite
                </label>
                <input
                  type="date"
                  value={form.date_echeance}
                  onChange={e => setForm(f => ({ ...f, date_echeance: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              {/* Partager avec */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Partager avec
                </label>
                {allUsers.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">Chargement des utilisateurs...</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-50">
                    {allUsers.map(u => (
                      <label
                        key={u.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.partage_avec.includes(u.id)}
                          onChange={() => toggleUser(u.id)}
                          className="rounded border-gray-300 text-gray-900"
                        />
                        <span className="flex-1 text-sm text-gray-700">
                          {u.prenom} {u.nom}
                        </span>
                        <span className="text-xs text-gray-400 uppercase tracking-wide">{u.role}</span>
                      </label>
                    ))}
                  </div>
                )}
                {form.partage_avec.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    {form.partage_avec.length} personne{form.partage_avec.length > 1 ? 's' : ''} sélectionnée{form.partage_avec.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 pb-5">
              <button
                onClick={() => { setShowModal(false); setForm(DEFAULT_FORM) }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.titre.trim() || saving}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
