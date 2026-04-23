'use client'

import { useState, useEffect } from 'react'
import { FolderCheck, Plus, CheckCircle2, Send, Wrench, Ruler, Shield, Book } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type Projet = { id: string; nom: string; reference: string | null }
type DOE = {
  id: string; projet_id: string; statut: string; notes: string | null; date_envoi: string | null
  fiches_produits: boolean; notes_calcul: boolean; memoire_technique: boolean
  plans_architecte: boolean; plans_exe_pdf: boolean; synoptiques: boolean
  assurances_compilees: boolean; carnet_entretien: boolean
}

const DOE_SECTIONS = [
  {
    id: 'technique',
    label: 'Volet Technique',
    Icon: Wrench,
    description: 'Fiches produits, notes de calcul (via ST)',
    fields: [
      { key: 'fiches_produits',    label: 'Fiches techniques / produits' },
      { key: 'notes_calcul',       label: 'Notes de calcul et dimensionnement' },
      { key: 'memoire_technique',  label: 'Memoire technique du batiment' },
    ],
  },
  {
    id: 'plans',
    label: 'Volet Plans',
    Icon: Ruler,
    description: 'Plans de recolement (via Dessinatrice)',
    fields: [
      { key: 'plans_architecte', label: 'Plans Architecte (PDF, cotes)' },
      { key: 'plans_exe_pdf',    label: 'Plans EXE tous niveaux cotes et reperes' },
      { key: 'synoptiques',      label: 'Synoptiques lots techniques' },
    ],
  },
  {
    id: 'admin',
    label: 'Volet Administratif',
    Icon: Shield,
    description: 'Attestations decennales de CHAQUE entreprise intervenue',
    fields: [
      { key: 'assurances_compilees', label: 'Attestations decennales tous les ST compilees' },
      { key: 'carnet_entretien',     label: 'Guides d\'entretien / contrats de maintenance' },
    ],
  },
]

function doeProgress(doe: DOE): number {
  const all = DOE_SECTIONS.flatMap((s) => s.fields)
  const done = all.filter((f) => doe[f.key as keyof DOE]).length
  return Math.round((done / all.length) * 100)
}

const STATUT_DOE: Record<string, { label: string; color: string }> = {
  en_cours: { label: 'En cours',  color: 'bg-blue-50 text-blue-600 border-blue-200' },
  complet:  { label: 'Complet',   color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  envoye:   { label: 'Envoye', color: 'bg-gray-100 text-gray-500 border-gray-200' },
}

export default function ClotureDoePage() {
  const [projets, setProjets]   = useState<Projet[]>([])
  const [does, setDoes]         = useState<DOE[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<DOE | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formProjet, setFormProjet] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function fetchData() {
    const supabase = createClient()
    const [pRes, dRes] = await Promise.all([
      supabase.schema('app').from('projets').select('id,nom,reference').order('nom'),
      supabase.schema('app').from('at_doe').select('*').order('created_at', { ascending: false }),
    ])
    setProjets((pRes.data ?? []) as Projet[])
    setDoes((dRes.data ?? []) as DOE[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function createDOE(e: React.FormEvent) {
    e.preventDefault()
    if (!formProjet) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('at_doe').insert({ projet_id: formProjet, statut: 'en_cours' })
    setFormProjet('')
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function toggleField(id: string, field: string, current: boolean) {
    const supabase = createClient()
    await supabase.schema('app').from('at_doe').update({ [field]: !current }).eq('id', id)
    setSelected((s) => s ? { ...s, [field]: !current } : null)
    fetchData()
  }

  async function markEnvoye(id: string) {
    const supabase = createClient()
    await supabase.schema('app').from('at_doe').update({ statut: 'envoye', date_envoi: new Date().toISOString().split('T')[0] }).eq('id', id)
    setSelected(null)
    fetchData()
  }

  const projetName = (id: string) => {
    const p = projets.find((p) => p.id === id)
    return p ? `${p.reference ? `[${p.reference}] ` : ''}${p.nom}` : 'Projet inconnu'
  }

  const selectedFull = selected ? does.find((d) => d.id === selected.id) ?? selected : null

  const stats = {
    en_cours: does.filter((d) => d.statut === 'en_cours').length,
    complet:  does.filter((d) => d.statut === 'complet').length,
    envoye:   does.filter((d) => d.statut === 'envoye').length,
  }

  return (
    <div>
      <TopBar title="Clôture DOE" subtitle="Dossier des Ouvrages Exécutés — technique, plans, admin" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">DOE en cours</p>
            <p className="text-2xl font-semibold text-blue-600">{stats.en_cours}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">DOE complets</p>
            <p className="text-2xl font-semibold text-emerald-600">{stats.complet}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">DOE envoyés</p>
            <p className="text-2xl font-semibold text-gray-600">{stats.envoye}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total</p>
            <p className="text-2xl font-semibold text-gray-900">{does.length}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
            <Plus className="w-4 h-4" /> Nouveau DOE
          </button>
        </div>

        {showForm && (
          <form onSubmit={createDOE} className="bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <FolderCheck className="w-4 h-4 text-orange-500" /> Créer un DOE
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Projet *</label>
              <select value={formProjet} onChange={(e) => setFormProjet(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">Sélectionner un projet...</option>
                {projets.filter((p) => !does.find((d) => d.projet_id === p.id)).map((p) => (
                  <option key={p.id} value={p.id}>{p.reference ? `[${p.reference}] ` : ''}{p.nom}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              <button type="submit" disabled={submitting || !formProjet}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
                {submitting ? 'Création...' : 'Créer'}
              </button>
            </div>
          </form>
        )}

        {/* Liste + détail */}
        {loading ? (
          <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-20 bg-white rounded-lg border border-gray-200 animate-pulse" />)}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Liste */}
            <div className="lg:col-span-2 space-y-2">
              {does.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                  <FolderCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700">Aucun DOE créé</p>
                  <p className="text-xs text-gray-400 mt-1">Créez un DOE pour chaque projet en phase de clôture.</p>
                </div>
              ) : does.map((d) => {
                const pct = doeProgress(d)
                const s = STATUT_DOE[d.statut]
                return (
                  <button key={d.id} onClick={() => setSelected(selectedFull?.id === d.id ? null : d)}
                    className={`w-full text-left bg-white rounded-lg border shadow-card p-4 transition-colors ${selectedFull?.id === d.id ? 'border-gray-900' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{projetName(d.projet_id)}</p>
                        {d.date_envoi && <p className="text-xs text-gray-400">Envoyé le {new Date(d.date_envoi).toLocaleDateString('fr-FR')}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${s.color}`}>{s.label}</span>
                        <span className="text-xs text-gray-400">{pct}%</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Checklist détail */}
            {selectedFull && (
              <div className="lg:col-span-3 bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-5 h-fit">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-gray-900">{projetName(selectedFull.projet_id)}</p>
                    <p className="text-xs text-gray-400">DOE — {doeProgress(selectedFull)}% complété</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-600 text-lg">×</button>
                </div>

                {/* Barre de progression */}
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${doeProgress(selectedFull)}%` }} />
                </div>

                {/* Sections */}
                {DOE_SECTIONS.map((section) => (
                  <div key={section.id}>
                    <div className="mb-2 flex items-start gap-2">
                      <section.Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-gray-700">{section.label}</p>
                        <p className="text-xs text-gray-400">{section.description}</p>
                      </div>
                    </div>
                    <div className="space-y-2 pl-2 border-l-2 border-gray-100">
                      {section.fields.map((field) => {
                        const val = selectedFull[field.key as keyof DOE] as boolean
                        return (
                          <label key={field.key} className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={val}
                              onChange={() => toggleField(selectedFull.id, field.key, val)}
                              className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900" />
                            <span className={`text-sm ${val ? 'line-through text-gray-400' : 'text-gray-700'}`}>{field.label}</span>
                            {val && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto flex-shrink-0" />}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Note de clôture */}
                {selectedFull.notes && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">{selectedFull.notes}</p>
                  </div>
                )}

                {/* Actions */}
                {selectedFull.statut !== 'envoye' && (
                  <button
                    onClick={() => markEnvoye(selectedFull.id)}
                    disabled={doeProgress(selectedFull) < 100}
                    className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    {doeProgress(selectedFull) < 100
                      ? `Compléter le DOE (${doeProgress(selectedFull)}%)`
                      : 'Marquer DOE envoyé au client'}
                  </button>
                )}

                {selectedFull.statut === 'envoye' && (
                  <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4 text-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                    <p className="text-sm font-medium text-emerald-700">DOE envoyé au client</p>
                    {selectedFull.date_envoi && (
                      <p className="text-xs text-emerald-600 mt-0.5">
                        Le {new Date(selectedFull.date_envoi).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
