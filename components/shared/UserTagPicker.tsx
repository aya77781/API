'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, Users, Building2, UserCircle, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  {
    key: 'interne',
    label: 'API',
    icon: Users,
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    roles: ['co', 'commercial', 'economiste', 'dessinatrice', 'comptable',
            'gerant', 'admin', 'rh', 'cho', 'assistant_travaux'],
  },
  {
    key: 'st',
    label: 'Sous-traitants',
    icon: Building2,
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    roles: ['st'],
  },
  {
    key: 'client',
    label: 'Client',
    icon: UserCircle,
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    roles: ['client', 'controle'],
  },
]

const ROLE_LABELS: Record<string, string> = {
  co: 'CO', commercial: 'Commercial', economiste: 'Economiste',
  dessinatrice: 'Dessin', comptable: 'Compta', gerant: 'Gerant',
  admin: 'Admin', rh: 'RH', cho: 'CHO', assistant_travaux: 'AT',
  st: 'ST', controle: 'Controle', client: 'Client',
}

export interface TaggedUser {
  id: string
  prenom: string
  nom: string
  role: string
}

interface UserTagPickerProps {
  selected: TaggedUser[]
  onChange: (users: TaggedUser[]) => void
  excludeUserId?: string | null
  placeholder?: string
  compact?: boolean
}

export function UserTagPicker(props: UserTagPickerProps) {
  const { selected, onChange, excludeUserId, placeholder } = props
  const supabase = useRef(createClient()).current
  const containerRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [allUsers, setAllUsers] = useState<TaggedUser[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!category) return
    setLoading(true)
    const cat = CATEGORIES.find(c => c.key === category)
    if (!cat) return
    supabase.schema('app').from('utilisateurs')
      .select('id, prenom, nom, role')
      .in('role', cat.roles)
      .eq('actif', true)
      .order('prenom')
      .then(({ data }) => {
        setAllUsers((data ?? []) as TaggedUser[])
        setLoading(false)
      })
  }, [category, supabase])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCategory(null)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const selectedIds = new Set(selected.map(u => u.id))

  const filtered = allUsers
    .filter(u => excludeUserId ? u.id !== excludeUserId : true)
    .filter(u => !selectedIds.has(u.id))
    .filter(u => {
      if (!search) return true
      return (u.prenom + ' ' + u.nom).toLowerCase().includes(search.toLowerCase())
    })

  function addUser(u: TaggedUser) {
    onChange([...selected, u])
  }

  function addAll() {
    onChange([...selected, ...filtered])
  }

  function removeUser(id: string) {
    onChange(selected.filter(u => u.id !== id))
  }

  function renderSelectedTags() {
    if (selected.length === 0) return null
    return (
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selected.map(u => {
          const cat = CATEGORIES.find(c => c.roles.includes(u.role))
          return (
            <span key={u.id} className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border',
              cat?.color ?? 'bg-gray-50 text-gray-700 border-gray-200',
            )}>
              {u.prenom} {u.nom}
              <button onClick={() => removeUser(u.id)} className="ml-0.5 hover:opacity-70">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )
        })}
      </div>
    )
  }

  function renderCategoryPicker() {
    return (
      <div className="p-2 space-y-1">
        <p className="px-2 py-1 text-[10px] font-medium text-gray-400 uppercase tracking-wide">Choisir une categorie</p>
        {CATEGORIES.map(cat => {
          const Icon = cat.icon
          return (
            <button key={cat.key} onClick={() => setCategory(cat.key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-gray-50 text-left transition-colors">
              <div className={cn('w-7 h-7 rounded-md flex items-center justify-center', cat.color)}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-medium text-gray-900">{cat.label}</span>
            </button>
          )
        })}
      </div>
    )
  }

  function renderUserList() {
    return (
      <div>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
          <button onClick={() => { setCategory(null); setSearch('') }}
            className="text-xs text-gray-400 hover:text-gray-700">
            &#8592; Retour
          </button>
          <span className="text-xs font-medium text-gray-900">
            {CATEGORIES.find(c => c.key === category)?.label}
          </span>
        </div>
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-gray-50 rounded-md px-2 py-1.5">
            <Search className="w-3 h-3 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="flex-1 bg-transparent text-xs text-gray-900 placeholder-gray-400 outline-none" autoFocus />
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto">
          {loading && (
            <p className="px-3 py-4 text-xs text-gray-400 text-center">Chargement...</p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="px-3 py-4 text-xs text-gray-400 text-center">Aucun utilisateur</p>
          )}
          {!loading && filtered.length > 1 && (
            <button onClick={addAll}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left border-b border-gray-100">
              <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center text-[9px] font-semibold text-white flex-shrink-0">
                All
              </div>
              <span className="text-xs font-medium text-gray-900">Selectionner tout ({filtered.length})</span>
            </button>
          )}
          {!loading && filtered.slice(0, 15).map(u => (
            <button key={u.id} onClick={() => { addUser(u); setSearch('') }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left">
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-semibold text-gray-600 flex-shrink-0">
                {u.prenom[0]}{u.nom[0]}
              </div>
              <span className="text-xs text-gray-700 flex-1">{u.prenom} {u.nom}</span>
              <span className="text-[9px] text-gray-400 uppercase">{ROLE_LABELS[u.role] ?? u.role}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      {renderSelectedTags()}
      <button onClick={() => setOpen(!open)} type="button" title={placeholder ?? 'Taguer quelqu\'un'}
        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
        <UserPlus className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 left-0 w-72 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {!category ? renderCategoryPicker() : renderUserList()}
        </div>
      )}
    </div>
  )
}
