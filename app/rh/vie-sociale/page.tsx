'use client'

import { useEffect, useState } from 'react'
import { Calendar, GraduationCap, Plus, X, Loader2, Trash2, Pencil, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Employe = { id: string; nom: string; prenom: string }
type Entretien = {
  id: string
  employe_id: string
  type: string
  date_prevue: string
  date_realise: string | null
  evaluateur: string | null
  notes: string | null
  statut: 'planifie' | 'realise' | 'annule'
}
type Formation = {
  id: string
  employe_id: string
  intitule: string
  organisme: string | null
  date_debut: string | null
  date_fin: string | null
  budget: number | null
  financement: string | null
  statut: 'prevue' | 'en_cours' | 'terminee' | 'annulee'
}

export default function VieSocialePage() {
  const [tab, setTab] = useState<'entretiens' | 'formations'>('entretiens')

  return (
    <div>
      <TopBar title="Vie sociale" subtitle="Contractualisation, suivi de carrière, formation" />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-1 border-b border-gray-200">
          <TabBtn active={tab === 'entretiens'} onClick={() => setTab('entretiens')} icon={<Calendar className="w-4 h-4" />} label="Entretiens" />
          <TabBtn active={tab === 'formations'} onClick={() => setTab('formations')} icon={<GraduationCap className="w-4 h-4" />} label="Formations" />
        </div>

        {tab === 'entretiens' ? <EntretiensTab /> : <FormationsTab />}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
        active ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}{label}
    </button>
  )
}

/* ────────────────────── ENTRETIENS ────────────────────── */

function EntretiensTab() {
  const supabase = createClient()
  const [entretiens, setEntretiens] = useState<Entretien[]>([])
  const [employes, setEmployes] = useState<Record<string, Employe>>({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Entretien | null>(null)

  async function load() {
    setLoading(true)
    const [e, emps] = await Promise.all([
      supabase.from('entretiens').select('*').order('date_prevue', { ascending: false }),
      supabase.from('employes').select('id,nom,prenom'),
    ])
    setEntretiens((e.data ?? []) as Entretien[])
    const m: Record<string, Employe> = {}
    for (const x of (emps.data ?? []) as Employe[]) m[x.id] = x
    setEmployes(m)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const now = new Date()
  const thisMonth = entretiens.filter(e => {
    const d = new Date(e.date_prevue)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const planifies = entretiens.filter(e => e.statut === 'planifie').length
  const realises  = entretiens.filter(e => e.statut === 'realise').length
  const empAvecEntretienAnnee = new Set(
    entretiens
      .filter(e => new Date(e.date_prevue).getFullYear() === now.getFullYear())
      .map(e => e.employe_id)
  )
  const sansEntretien = Object.keys(employes).filter(id => !empAvecEntretienAnnee.has(id)).length

  async function deleteOne(id: string) {
    if (!confirm('Supprimer cet entretien ?')) return
    await supabase.from('entretiens').delete().eq('id', id)
    load()
  }
  async function marquerRealise(id: string) {
    await supabase.from('entretiens').update({
      statut: 'realise',
      date_realise: new Date().toISOString().slice(0, 10),
    }).eq('id', id)
    load()
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500">Planification et suivi des entretiens annuels d'évaluation — tous les salariés</p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Counter label="Planifiés" value={planifies} />
        <Counter label="Réalisés" value={realises} />
        <Counter label="Ce mois" value={thisMonth.length} />
        <Counter label="Sans entretien cette année" value={sansEntretien} />
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Liste des entretiens</h3>
        <button
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" /> Planifier
        </button>
      </div>
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <Loader2 className="w-5 h-5 text-gray-400 mx-auto animate-spin" />
        </div>
      ) : entretiens.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Aucun entretien planifié</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-left text-xs font-medium text-gray-500">
                <th className="px-4 py-3">Salarié</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Date prévue</th>
                <th className="px-4 py-3">Évaluateur</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entretiens.map(e => {
                const emp = employes[e.employe_id]
                return (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{emp ? `${emp.prenom} ${emp.nom}` : '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{e.type}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(e.date_prevue).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3 text-gray-600">{e.evaluateur ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${
                        e.statut === 'realise'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : e.statut === 'annule'
                          ? 'bg-gray-100 text-gray-600 border-gray-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {e.statut === 'realise' ? 'Réalisé' : e.statut === 'annule' ? 'Annulé' : 'Planifié'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {e.statut === 'planifie' && (
                          <button onClick={() => marquerRealise(e.id)} className="p-1 text-gray-400 hover:text-emerald-600" title="Marquer réalisé">
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => { setEditing(e); setShowModal(true) }} className="p-1 text-gray-400 hover:text-gray-700" title="Modifier">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteOne(e.id)} className="p-1 text-gray-400 hover:text-red-600" title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {showModal && (
        <EntretienModal
          entretien={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function EntretienModal({ entretien, onClose, onSaved }: { entretien: Entretien | null; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const employes = useEmployes()
  const isEdit = !!entretien
  const [empId, setEmpId] = useState(entretien?.employe_id ?? '')
  const [type, setType] = useState(entretien?.type ?? 'Annuel')
  const [date, setDate] = useState(entretien?.date_prevue ?? '')
  const [evaluateur, setEvaluateur] = useState(entretien?.evaluateur ?? '')
  const [notes, setNotes] = useState(entretien?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    if (!empId)  { setError('Salarié requis'); return }
    if (!date)   { setError('Date requise'); return }
    setSaving(true)
    const payload = {
      employe_id: empId,
      type,
      date_prevue: date,
      evaluateur: evaluateur.trim() || null,
      notes: notes.trim() || null,
    }
    const { error: err } = isEdit
      ? await supabase.from('entretiens').update(payload).eq('id', entretien!.id)
      : await supabase.from('entretiens').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Modifier l\'entretien' : 'Planifier un entretien'} onClose={onClose}>
      <Field label="Salarié">
        <select value={empId} onChange={e => setEmpId(e.target.value)} className="rh-input">
          <option value="">— Sélectionner —</option>
          {employes.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
        </select>
      </Field>
      <Field label="Type">
        <select value={type} onChange={e => setType(e.target.value)} className="rh-input">
          <option>Annuel</option>
          <option>Mi-parcours</option>
          <option>Période d'essai</option>
        </select>
      </Field>
      <Field label="Date">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rh-input" />
      </Field>
      <Field label="Évaluateur">
        <input value={evaluateur} onChange={e => setEvaluateur(e.target.value)} className="rh-input" />
      </Field>
      <Field label="Notes">
        <textarea value={notes} onChange={e => setNotes(e.target.value)} className="rh-input" rows={3} />
      </Field>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Enregistrer
        </button>
      </div>
    </Modal>
  )
}

/* ────────────────────── FORMATIONS ────────────────────── */

function FormationsTab() {
  const supabase = createClient()
  const [formations, setFormations] = useState<Formation[]>([])
  const [employes, setEmployes] = useState<Record<string, Employe>>({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Formation | null>(null)

  async function load() {
    setLoading(true)
    const [f, emps] = await Promise.all([
      supabase.from('formations').select('*').order('date_debut', { ascending: false }),
      supabase.from('employes').select('id,nom,prenom'),
    ])
    setFormations((f.data ?? []) as Formation[])
    const m: Record<string, Employe> = {}
    for (const x of (emps.data ?? []) as Employe[]) m[x.id] = x
    setEmployes(m)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function deleteOne(id: string) {
    if (!confirm('Supprimer cette formation ?')) return
    await supabase.from('formations').delete().eq('id', id)
    load()
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500">Montage des dossiers de financement pour les formations</p>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Formations</h3>
        <button
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" /> Ajouter une formation
        </button>
      </div>
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <Loader2 className="w-5 h-5 text-gray-400 mx-auto animate-spin" />
        </div>
      ) : formations.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <GraduationCap className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Aucune formation enregistrée</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-left text-xs font-medium text-gray-500">
                <th className="px-4 py-3">Salarié</th>
                <th className="px-4 py-3">Intitulé</th>
                <th className="px-4 py-3">Organisme</th>
                <th className="px-4 py-3">Période</th>
                <th className="px-4 py-3 text-right">Budget</th>
                <th className="px-4 py-3">Financement</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {formations.map(f => {
                const emp = employes[f.employe_id]
                return (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{emp ? `${emp.prenom} ${emp.nom}` : '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{f.intitule}</td>
                    <td className="px-4 py-3 text-gray-600">{f.organisme ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {f.date_debut ? new Date(f.date_debut).toLocaleDateString('fr-FR') : '—'}
                      {f.date_fin && ' → ' + new Date(f.date_fin).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {f.budget != null ? Number(f.budget).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €' : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{f.financement ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => { setEditing(f); setShowModal(true) }} className="p-1 text-gray-400 hover:text-gray-700">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteOne(f.id)} className="p-1 text-gray-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {showModal && (
        <FormationModal
          formation={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function FormationModal({ formation, onClose, onSaved }: { formation: Formation | null; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const employes = useEmployes()
  const isEdit = !!formation
  const [empId, setEmpId] = useState(formation?.employe_id ?? '')
  const [intitule, setIntitule] = useState(formation?.intitule ?? '')
  const [organisme, setOrganisme] = useState(formation?.organisme ?? '')
  const [dateDebut, setDateDebut] = useState(formation?.date_debut ?? '')
  const [dateFin, setDateFin] = useState(formation?.date_fin ?? '')
  const [budget, setBudget] = useState(formation?.budget != null ? String(formation.budget) : '')
  const [financement, setFinancement] = useState(formation?.financement ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    if (!empId)            { setError('Salarié requis'); return }
    if (!intitule.trim())  { setError('Intitulé requis'); return }
    setSaving(true)
    const payload = {
      employe_id: empId,
      intitule: intitule.trim(),
      organisme: organisme.trim() || null,
      date_debut: dateDebut || null,
      date_fin: dateFin || null,
      budget: budget ? Number(budget) : null,
      financement: financement.trim() || null,
    }
    const { error: err } = isEdit
      ? await supabase.from('formations').update(payload).eq('id', formation!.id)
      : await supabase.from('formations').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Modifier la formation' : 'Ajouter une formation'} onClose={onClose}>
      <Field label="Salarié">
        <select value={empId} onChange={e => setEmpId(e.target.value)} className="rh-input">
          <option value="">— Sélectionner —</option>
          {employes.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
        </select>
      </Field>
      <Field label="Intitulé">
        <input value={intitule} onChange={e => setIntitule(e.target.value)} className="rh-input" />
      </Field>
      <Field label="Organisme">
        <input value={organisme} onChange={e => setOrganisme(e.target.value)} className="rh-input" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date début">
          <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} className="rh-input" />
        </Field>
        <Field label="Date fin">
          <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} className="rh-input" />
        </Field>
      </div>
      <Field label="Budget (€)">
        <input type="number" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} className="rh-input" />
      </Field>
      <Field label="OPCO / Financement">
        <input value={financement} onChange={e => setFinancement(e.target.value)} className="rh-input" />
      </Field>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Enregistrer
        </button>
      </div>
    </Modal>
  )
}

/* ────────────────────── HELPERS ────────────────────── */

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  )
}

function useEmployes() {
  const supabase = createClient()
  const [emps, setEmps] = useState<Employe[]>([])
  useEffect(() => {
    supabase.from('employes').select('id,nom,prenom').eq('actif', true).order('nom').then(({ data }) => {
      setEmps((data ?? []) as Employe[])
    })
  }, [])
  return emps
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {children}
        </div>
      </div>
      <style jsx global>{`
        .rh-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          border: 1px solid rgb(229 231 235);
          border-radius: 0.5rem;
          background: white;
        }
        .rh-input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgb(17 24 39 / 0.1);
        }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
