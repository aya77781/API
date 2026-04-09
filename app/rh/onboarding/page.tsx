'use client'

import { useEffect, useState } from 'react'
import { Loader2, UserCheck, Check, Plus, Pencil, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Employe = {
  id: string
  nom: string
  prenom: string
  poste: string | null
  date_entree: string | null
}
type Item = {
  id: string
  employe_id: string
  label: string
  done: boolean
  ordre: number
}

const CHECKLIST_BASE = [
  'Bureau et matériel préparés',
  'Accès logiciels créés (SharePoint, Teams, ArchiCAD)',
  'Inscription Mutuelle effectuée',
  'Inscription CIBTP effectuée',
  'RUP mis à jour',
  'Livret d\'accueil remis',
  'Présentation équipe faite',
]

function defaultChecklist(poste: string | null) {
  const items = [...CHECKLIST_BASE]
  if (poste && /\bco\b/i.test(poste)) {
    items.splice(5, 0, 'Carte BTP commandée')
  }
  return items
}

export default function OnboardingPage() {
  const supabase = createClient()
  const [employes, setEmployes] = useState<Employe[]>([])
  const [itemsByEmp, setItemsByEmp] = useState<Record<string, Item[]>>({})
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const trois = new Date()
    trois.setMonth(trois.getMonth() - 3)
    const { data: emps } = await supabase
      .from('employes')
      .select('id,nom,prenom,poste,date_entree')
      .eq('actif', true)
      .gte('date_entree', trois.toISOString().slice(0, 10))
      .order('date_entree', { ascending: false })
    const employesList = (emps ?? []) as Employe[]
    setEmployes(employesList)

    if (employesList.length === 0) { setLoading(false); return }

    const { data: items } = await supabase
      .from('onboarding_items')
      .select('*')
      .in('employe_id', employesList.map(e => e.id))
      .order('ordre')
    const grouped: Record<string, Item[]> = {}
    for (const it of (items ?? []) as Item[]) {
      (grouped[it.employe_id] ??= []).push(it)
    }

    // Auto-seed des employés sans items (1ère ouverture)
    for (const emp of employesList) {
      if (!grouped[emp.id] || grouped[emp.id].length === 0) {
        const defaults = defaultChecklist(emp.poste)
        const rows = defaults.map((label, i) => ({
          employe_id: emp.id, label, done: false, ordre: i,
        }))
        const { data: inserted } = await supabase.from('onboarding_items').insert(rows).select()
        grouped[emp.id] = (inserted ?? []) as Item[]
      }
    }
    setItemsByEmp(grouped)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleDone(item: Item) {
    const newDone = !item.done
    setItemsByEmp(prev => ({
      ...prev,
      [item.employe_id]: prev[item.employe_id].map(i => i.id === item.id ? { ...i, done: newDone } : i),
    }))
    await supabase.from('onboarding_items').update({ done: newDone }).eq('id', item.id)
  }

  async function addItem(empId: string, label: string) {
    const list = itemsByEmp[empId] ?? []
    const ordre = list.length ? Math.max(...list.map(i => i.ordre)) + 1 : 0
    const { data } = await supabase
      .from('onboarding_items')
      .insert({ employe_id: empId, label, done: false, ordre })
      .select()
      .single()
    if (data) {
      setItemsByEmp(prev => ({ ...prev, [empId]: [...(prev[empId] ?? []), data as Item] }))
    }
  }

  async function updateItem(item: Item, label: string) {
    setItemsByEmp(prev => ({
      ...prev,
      [item.employe_id]: prev[item.employe_id].map(i => i.id === item.id ? { ...i, label } : i),
    }))
    await supabase.from('onboarding_items').update({ label }).eq('id', item.id)
  }

  async function deleteItem(item: Item) {
    setItemsByEmp(prev => ({
      ...prev,
      [item.employe_id]: prev[item.employe_id].filter(i => i.id !== item.id),
    }))
    await supabase.from('onboarding_items').delete().eq('id', item.id)
  }

  return (
    <div>
      <TopBar title="Onboarding" subtitle="Installation logistique, administratif, carte BTP, accompagnement" />
      <div className="p-6">
        {loading ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <Loader2 className="w-6 h-6 text-gray-400 mx-auto animate-spin" />
          </div>
        ) : employes.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <UserCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Aucun nouvel arrivant dans les 3 derniers mois</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {employes.map(emp => {
              const items = itemsByEmp[emp.id] ?? []
              const done = items.filter(i => i.done).length
              return (
                <EmployeCard
                  key={emp.id}
                  emp={emp}
                  items={items}
                  done={done}
                  onToggle={toggleDone}
                  onAdd={(label) => addItem(emp.id, label)}
                  onUpdate={updateItem}
                  onDelete={deleteItem}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function EmployeCard({
  emp, items, done, onToggle, onAdd, onUpdate, onDelete,
}: {
  emp: Employe
  items: Item[]
  done: number
  onToggle: (i: Item) => void
  onAdd: (label: string) => void
  onUpdate: (i: Item, label: string) => void
  onDelete: (i: Item) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')

  function startEdit(i: Item) {
    setEditingId(i.id)
    setEditLabel(i.label)
  }
  function commitEdit(i: Item) {
    if (editLabel.trim() && editLabel.trim() !== i.label) {
      onUpdate(i, editLabel.trim())
    }
    setEditingId(null)
  }
  function commitAdd() {
    if (newLabel.trim()) onAdd(newLabel.trim())
    setNewLabel('')
    setAdding(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{emp.prenom} {emp.nom}</h3>
          <p className="text-xs text-gray-500">{emp.poste ?? '—'}</p>
          <p className="text-xs text-gray-400 mt-1">
            Entrée le {emp.date_entree ? new Date(emp.date_entree).toLocaleDateString('fr-FR') : '—'}
          </p>
        </div>
        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded font-medium">
          {done}/{items.length}
        </span>
      </div>
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.id} className="group flex items-center gap-2 text-sm hover:bg-gray-50 px-2 py-1 rounded">
            <button
              onClick={() => onToggle(item)}
              className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}
            >
              {item.done && <Check className="w-3 h-3 text-white" />}
            </button>
            {editingId === item.id ? (
              <input
                autoFocus
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                onBlur={() => commitEdit(item)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit(item)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="flex-1 text-sm border border-gray-300 rounded px-2 py-0.5 outline-none focus:border-gray-900"
              />
            ) : (
              <>
                <span
                  onDoubleClick={() => startEdit(item)}
                  className={`flex-1 cursor-pointer ${item.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}
                  title="Double-clic pour modifier"
                >
                  {item.label}
                </span>
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition">
                  <button
                    onClick={() => startEdit(item)}
                    className="p-1 text-gray-400 hover:text-gray-700"
                    title="Modifier"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDelete(item)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {adding ? (
          <div className="flex items-center gap-2 px-2 py-1">
            <span className="w-4 h-4 border border-gray-300 rounded flex-shrink-0" />
            <input
              autoFocus
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onBlur={commitAdd}
              onKeyDown={e => {
                if (e.key === 'Enter') commitAdd()
                if (e.key === 'Escape') { setNewLabel(''); setAdding(false) }
              }}
              placeholder="Nouvel item..."
              className="flex-1 text-sm border border-gray-300 rounded px-2 py-0.5 outline-none focus:border-gray-900"
            />
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 w-full text-left text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-50 px-2 py-1.5 rounded transition mt-1"
          >
            <Plus className="w-3 h-3" /> Ajouter un item
          </button>
        )}
      </div>
    </div>
  )
}
