'use client'

import { useEffect, useState } from 'react'
import { Loader2, BadgeEuro, Pencil, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Salaire = {
  id: string
  employe_id: string
  mois: string
  salaire_brut: number
  charges_patronales: number
  net_a_payer: number
  prime: number
  date_paiement: string | null
  statut: 'en_attente' | 'paye'
}
type Employe = { id: string; nom: string; prenom: string; poste: string | null; contrat: string | null; actif: boolean }

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}

export default function PaiePage() {
  return (
    <div>
      <TopBar title="Paie" subtitle="Variables de paie — collecte mensuelle" />
      <div className="p-6">
        <PaieSection />
      </div>
    </div>
  )
}

function PaieSection() {
  const supabase = createClient()
  const [mois, setMois] = useState<string>(currentMonth())
  const [employes, setEmployes] = useState<Employe[]>([])
  const [salaires, setSalaires] = useState<Salaire[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null) // employe_id en cours d'édition

  async function load() {
    setLoading(true)
    const [emps, sals] = await Promise.all([
      supabase.from('employes').select('id,nom,prenom,poste,contrat,actif').eq('actif', true).order('nom'),
      supabase.from('salaires').select('*').like('mois', `${mois}%`),
    ])
    setEmployes((emps.data ?? []) as Employe[])
    setSalaires((sals.data ?? []) as Salaire[])
    setLoading(false)
  }
  useEffect(() => { load() }, [mois])

  const salaireOf = (empId: string) => salaires.find(s => s.employe_id === empId)

  // Crée ou met à jour une ligne salaire
  async function upsertSalaire(empId: string, patch: Partial<Salaire>) {
    const existing = salaireOf(empId)
    if (existing) {
      await supabase.from('salaires').update(patch).eq('id', existing.id)
    } else {
      await supabase.from('salaires').insert({
        employe_id: empId,
        mois: `${mois}-01`,
        salaire_brut: 0,
        charges_patronales: 0,
        net_a_payer: 0,
        prime: 0,
        statut: 'en_attente',
        ...patch,
      })
    }
    load()
  }

  async function toggleStatut(empId: string) {
    const existing = salaireOf(empId)
    if (!existing) return
    const newStatut = existing.statut === 'paye' ? 'en_attente' : 'paye'
    await supabase.from('salaires').update({
      statut: newStatut,
      date_paiement: newStatut === 'paye' ? new Date().toISOString().slice(0, 10) : null,
    }).eq('id', existing.id)
    load()
  }

  async function toutMarquerPaye() {
    const today = new Date().toISOString().slice(0, 10)
    await supabase
      .from('salaires')
      .update({ statut: 'paye', date_paiement: today })
      .like('mois', `${mois}%`)
      .eq('statut', 'en_attente')
    load()
  }

  async function updateContrat(empId: string, contrat: string) {
    await supabase.from('employes').update({ contrat }).eq('id', empId)
    setEmployes(emps => emps.map(e => e.id === empId ? { ...e, contrat } : e))
  }

  const totalSalaire = salaires.reduce((s, x) => s + Number(x.salaire_brut ?? 0), 0)
  const totalPrime   = salaires.reduce((s, x) => s + Number(x.prime ?? 0), 0)
  const totalNet     = salaires.reduce((s, x) => s + Number(x.net_a_payer ?? 0), 0)
  const hasEnAttente = salaires.some(s => s.statut === 'en_attente')

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <BadgeEuro className="w-4 h-4 text-gray-500" />
        <h2 className="text-base font-semibold text-gray-900">Paie</h2>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={mois}
            onChange={e => setMois(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
          <span className="text-xs text-gray-400">{employes.length} salarié{employes.length > 1 ? 's' : ''}</span>
        </div>
        {hasEnAttente && (
          <button
            onClick={toutMarquerPaye}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
          >
            Tout marquer payé
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <Loader2 className="w-6 h-6 text-gray-400 mx-auto animate-spin" />
        </div>
      ) : employes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <BadgeEuro className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Aucun salarié actif</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-left text-xs font-medium text-gray-500">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Prénom</th>
                <th className="px-4 py-3">Poste</th>
                <th className="px-4 py-3">Contrat</th>
                <th className="px-4 py-3 text-right">Salaire brut</th>
                <th className="px-4 py-3 text-right">Prime</th>
                <th className="px-4 py-3 text-right">Net</th>
                <th className="px-4 py-3 text-right">Statut virement</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {employes.map(emp => {
                const sal = salaireOf(emp.id)
                const isEditing = editing === emp.id
                return (
                  <PaieRow
                    key={emp.id}
                    emp={emp}
                    sal={sal}
                    isEditing={isEditing}
                    onStartEdit={() => setEditing(emp.id)}
                    onCancelEdit={() => setEditing(null)}
                    onSave={async (patch, contrat) => {
                      if (contrat !== undefined && contrat !== emp.contrat) await updateContrat(emp.id, contrat)
                      await upsertSalaire(emp.id, patch)
                      setEditing(null)
                    }}
                    onToggleStatut={() => toggleStatut(emp.id)}
                  />
                )
              })}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-4 py-3" colSpan={4}>TOTAL</td>
                <td className="px-4 py-3 text-right">{fmt(totalSalaire)}</td>
                <td className="px-4 py-3 text-right">{fmt(totalPrime)}</td>
                <td className="px-4 py-3 text-right">{fmt(totalNet)}</td>
                <td className="px-4 py-3" colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function PaieRow({
  emp, sal, isEditing, onStartEdit, onCancelEdit, onSave, onToggleStatut,
}: {
  emp: Employe
  sal: Salaire | undefined
  isEditing: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: (patch: Partial<Salaire>, contrat?: string) => void
  onToggleStatut: () => void
}) {
  const [contrat, setContrat]   = useState(emp.contrat ?? '')
  const [brut, setBrut]         = useState(sal?.salaire_brut != null ? String(sal.salaire_brut) : '')
  const [prime, setPrime]       = useState(sal?.prime != null ? String(sal.prime) : '')
  const [net, setNet]           = useState(sal?.net_a_payer != null ? String(sal.net_a_payer) : '')

  // Sync quand on entre en édition
  useEffect(() => {
    if (isEditing) {
      setContrat(emp.contrat ?? '')
      setBrut(sal?.salaire_brut != null ? String(sal.salaire_brut) : '')
      setPrime(sal?.prime != null ? String(sal.prime) : '')
      setNet(sal?.net_a_payer != null ? String(sal.net_a_payer) : '')
    }
  }, [isEditing, emp.contrat, sal])

  function handleSave() {
    onSave({
      salaire_brut: brut ? Number(brut) : 0,
      prime:        prime ? Number(prime) : 0,
      net_a_payer:  net ? Number(net) : 0,
    }, contrat)
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 font-medium text-gray-900">{emp.nom}</td>
      <td className="px-4 py-3 text-gray-700">{emp.prenom}</td>
      <td className="px-4 py-3 text-gray-500 text-xs">{emp.poste ?? '—'}</td>
      <td className="px-4 py-3">
        {isEditing ? (
          <select value={contrat} onChange={e => setContrat(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
            <option value="">—</option>
            <option>CDI</option>
            <option>CDD</option>
            <option>Apprentissage</option>
            <option>Stage</option>
            <option>Intérim</option>
            <option>Freelance</option>
          </select>
        ) : (
          <span className="text-xs text-gray-600">{emp.contrat ?? '—'}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {isEditing ? (
          <input type="number" step="0.01" value={brut} onChange={e => setBrut(e.target.value)} className="w-24 text-sm text-right border border-gray-200 rounded px-2 py-1" />
        ) : (
          <span className="text-gray-900">{fmt(Number(sal?.salaire_brut ?? 0))}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {isEditing ? (
          <input type="number" step="0.01" value={prime} onChange={e => setPrime(e.target.value)} className="w-20 text-sm text-right border border-gray-200 rounded px-2 py-1" />
        ) : (
          <span className="text-gray-600">{fmt(Number(sal?.prime ?? 0))}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {isEditing ? (
          <input type="number" step="0.01" value={net} onChange={e => setNet(e.target.value)} className="w-24 text-sm text-right border border-gray-200 rounded px-2 py-1" />
        ) : (
          <span className="font-medium text-gray-900">{fmt(Number(sal?.net_a_payer ?? 0))}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <select
          value={sal?.statut ?? 'en_attente'}
          disabled={!sal}
          onChange={onToggleStatut}
          className={`text-xs border rounded px-2 py-1 font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            sal?.statut === 'paye'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
          title={sal ? '' : 'Saisir d\'abord le salaire'}
        >
          <option value="en_attente">En attente</option>
          <option value="paye">
            Payé{sal?.statut === 'paye' && sal.date_paiement ? ' (' + new Date(sal.date_paiement).toLocaleDateString('fr-FR') + ')' : ''}
          </option>
        </select>
      </td>
      <td className="px-4 py-3 text-right">
        {isEditing ? (
          <div className="inline-flex items-center gap-1">
            <button onClick={handleSave} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Enregistrer">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={onCancelEdit} className="p-1 text-gray-400 hover:bg-gray-100 rounded" title="Annuler">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button onClick={onStartEdit} className="p-1 text-gray-400 hover:text-gray-700" title="Modifier">
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  )
}
