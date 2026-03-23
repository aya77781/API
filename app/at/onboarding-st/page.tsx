'use client'

import { useState, useEffect } from 'react'
import { UserCheck, Plus, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type ST = {
  id: string; nom: string; siret: string | null; email: string | null; telephone: string | null
  corps_etat: string | null; statut: string; notes: string | null
  kbis_ok: boolean; kbis_date: string | null
  rib_ok: boolean; attestation_ca_ok: boolean
  urssaf_ok: boolean; urssaf_date: string | null; fiscalite_ok: boolean; salaries_etrangers_ok: boolean
  rc_ok: boolean; rc_validite: string | null; decennale_ok: boolean; decennale_validite: string | null
  created_at: string
}

type Contrat = {
  id: string; st_id: string; numero: string | null; montant_ht: number | null; statut: string
  cgv_incluses: boolean; delegation_paiement: boolean; second_rang: boolean; second_rang_valide: boolean
}

const CORPS_ETAT = ['Électricité', 'Plomberie', 'CVC', 'Menuiserie', 'Peinture', 'Carrelage', 'Maçonnerie', 'Charpente', 'Couverture', 'VRD', 'Autre']

const CHECKLIST_ADMIN = [
  { key: 'kbis_ok',             label: 'Kbis (- 3 mois)',               section: 'admin' },
  { key: 'rib_ok',              label: 'RIB',                           section: 'admin' },
  { key: 'attestation_ca_ok',   label: 'Attestation CA',                section: 'admin' },
  { key: 'urssaf_ok',           label: 'Attestation URSSAF (- 6 mois)', section: 'vigilance' },
  { key: 'fiscalite_ok',        label: 'Régularité fiscale',            section: 'vigilance' },
  { key: 'salaries_etrangers_ok',label: 'Déclaration salariés étrangers',section: 'vigilance' },
  { key: 'rc_ok',               label: 'RC Pro valide',                 section: 'assurances' },
  { key: 'decennale_ok',        label: 'Garantie décennale valide',     section: 'assurances' },
]

const SECTIONS_LABEL: Record<string, { label: string; emoji: string }> = {
  admin:      { label: 'Pièces administratives', emoji: '📋' },
  vigilance:  { label: 'Vigilance sociale',       emoji: '🔍' },
  assurances: { label: 'Assurances',              emoji: '🛡️' },
}

const STATUT_COLOR: Record<string, string> = {
  en_cours:  'bg-blue-50 text-blue-600 border-blue-200',
  complet:   'bg-emerald-50 text-emerald-600 border-emerald-200',
  incomplet: 'bg-amber-50 text-amber-600 border-amber-200',
  expire:    'bg-red-50 text-red-500 border-red-200',
}

function completionScore(st: ST): number {
  return CHECKLIST_ADMIN.filter((c) => st[c.key as keyof ST]).length
}

export default function OnboardingSTPage() {
  const [sts, setSTs]           = useState<ST[]>([])
  const [contrats, setContrats] = useState<Contrat[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<ST | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showContratForm, setShowContratForm] = useState(false)
  const [filter, setFilter]     = useState('tous')
  const [form, setForm] = useState({ nom: '', siret: '', email: '', telephone: '', corps_etat: '', notes: '' })
  const [formC, setFormC] = useState({ numero: '', montant_ht: '', cgv_incluses: false, delegation_paiement: false, second_rang: false })
  const [submitting, setSubmitting] = useState(false)

  async function fetchData() {
    const supabase = createClient()
    const [stRes, cRes] = await Promise.all([
      supabase.schema('app').from('at_sous_traitants').select('*').order('created_at', { ascending: false }),
      supabase.schema('app').from('at_contrats').select('*'),
    ])
    setSTs((stRes.data ?? []) as ST[])
    setContrats((cRes.data ?? []) as Contrat[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nom) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('at_sous_traitants').insert({ ...form, corps_etat: form.corps_etat || null, statut: 'en_cours' })
    setForm({ nom: '', siret: '', email: '', telephone: '', corps_etat: '', notes: '' })
    setShowForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function toggleCheck(id: string, field: string, current: boolean) {
    const supabase = createClient()
    await supabase.schema('app').from('at_sous_traitants').update({ [field]: !current }).eq('id', id)
    setSelected((s) => s ? { ...s, [field]: !current } : null)
    fetchData()
  }

  async function handleContrat(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.schema('app').from('at_contrats').insert({
      st_id: selected.id, numero: formC.numero || null,
      montant_ht: formC.montant_ht ? Number(formC.montant_ht) : null,
      cgv_incluses: formC.cgv_incluses, delegation_paiement: formC.delegation_paiement,
      second_rang: formC.second_rang, statut: 'brouillon',
    })
    setFormC({ numero: '', montant_ht: '', cgv_incluses: false, delegation_paiement: false, second_rang: false })
    setShowContratForm(false)
    setSubmitting(false)
    fetchData()
  }

  async function updateContratStatut(id: string, statut: string) {
    const supabase = createClient()
    await supabase.schema('app').from('at_contrats').update({ statut, ...(statut === 'signe' ? { date_signature: new Date().toISOString().split('T')[0] } : {}) }).eq('id', id)
    fetchData()
  }

  async function markComplet(id: string) {
    const supabase = createClient()
    await supabase.schema('app').from('at_sous_traitants').update({ statut: 'complet' }).eq('id', id)
    setSelected(null)
    fetchData()
  }

  const filtered = filter === 'tous' ? sts : sts.filter((s) => s.statut === filter)
  const selectedFull = selected ? sts.find((s) => s.id === selected.id) ?? selected : null
  const contratsST = selectedFull ? contrats.filter((c) => c.st_id === selectedFull.id) : []

  const grouped = ['admin', 'vigilance', 'assurances'].map((sec) => ({
    section: sec,
    fields: CHECKLIST_ADMIN.filter((c) => c.section === sec),
  }))

  return (
    <div>
      <TopBar title="Onboarding ST" subtitle="Dossiers administratifs, assurances & contrats" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'En cours',   count: sts.filter((s) => s.statut === 'en_cours').length,  color: 'text-blue-600' },
            { label: 'Complets',   count: sts.filter((s) => s.statut === 'complet').length,   color: 'text-emerald-600' },
            { label: 'Incomplets', count: sts.filter((s) => s.statut === 'incomplet').length, color: 'text-amber-600' },
            { label: 'Total ST',   count: sts.length,                                          color: 'text-gray-900' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-2xl font-semibold ${s.color}`}>{s.count}</p>
            </div>
          ))}
        </div>

        {/* Filtres + bouton */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'tous',      label: 'Tous' },
              { value: 'en_cours',  label: 'En cours' },
              { value: 'complet',   label: 'Complets' },
              { value: 'incomplet', label: 'Incomplets' },
            ].map((f) => (
              <button key={f.value} onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f.value ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
            <Plus className="w-4 h-4" /> Nouveau ST
          </button>
        </div>

        {/* Formulaire ST */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-orange-500" /> Nouveau sous-traitant
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="col-span-2 lg:col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Raison sociale *</label>
                <input type="text" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">SIRET</label>
                <input type="text" value={form.siret} onChange={(e) => setForm((f) => ({ ...f, siret: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Corps d&apos;état</label>
                <select value={form.corps_etat} onChange={(e) => setForm((f) => ({ ...f, corps_etat: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">Sélectionner...</option>
                  {CORPS_ETAT.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone</label>
                <input type="tel" value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              <button type="submit" disabled={submitting || !form.nom}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
                {submitting ? 'Enregistrement...' : 'Créer'}
              </button>
            </div>
          </form>
        )}

        {/* Liste + détail */}
        {loading ? (
          <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-16 bg-white rounded-lg border border-gray-200 animate-pulse" />)}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Liste */}
            <div className="lg:col-span-2 space-y-2">
              {filtered.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                  <UserCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700">Aucun ST</p>
                </div>
              ) : filtered.map((s) => {
                const score = completionScore(s)
                const s_info = STATUT_COLOR[s.statut]
                return (
                  <button key={s.id} onClick={() => setSelected(selectedFull?.id === s.id ? null : s)}
                    className={`w-full text-left bg-white rounded-lg border shadow-card p-4 transition-colors ${selectedFull?.id === s.id ? 'border-gray-900' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-semibold text-orange-600 flex-shrink-0">{s.nom[0]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.nom}</p>
                        <p className="text-xs text-gray-400">{s.corps_etat ?? '—'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${s_info}`}>
                          {s.statut === 'en_cours' ? 'En cours' : s.statut === 'complet' ? 'Complet' : s.statut === 'incomplet' ? 'Incomplet' : 'Expiré'}
                        </span>
                        <span className="text-xs text-gray-400">{score}/{CHECKLIST_ADMIN.length} ✓</span>
                      </div>
                    </div>
                    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(score / CHECKLIST_ADMIN.length) * 100}%` }} />
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Détail */}
            {selectedFull && (
              <div className="lg:col-span-3 space-y-4">
                {/* Info ST */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-card p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-base font-semibold text-gray-900">{selectedFull.nom}</p>
                      <p className="text-xs text-gray-400">{selectedFull.corps_etat ?? '—'}{selectedFull.siret ? ` · SIRET: ${selectedFull.siret}` : ''}</p>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-600 text-lg">×</button>
                  </div>

                  {/* Checklist par section */}
                  {grouped.map(({ section, fields }) => (
                    <div key={section} className="mb-4">
                      <p className="text-xs font-semibold text-gray-600 mb-2">
                        {SECTIONS_LABEL[section].emoji} {SECTIONS_LABEL[section].label}
                      </p>
                      <div className="space-y-2">
                        {fields.map((f) => {
                          const val = selectedFull[f.key as keyof ST] as boolean
                          return (
                            <label key={f.key} className="flex items-center gap-3 cursor-pointer">
                              <input type="checkbox" checked={val}
                                onChange={() => toggleCheck(selectedFull.id, f.key, val)}
                                className="w-4 h-4 rounded border-gray-300 text-gray-900" />
                              <span className={`text-sm ${val ? 'line-through text-gray-400' : 'text-gray-700'}`}>{f.label}</span>
                              {val && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto flex-shrink-0" />}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}

                  {selectedFull.statut === 'en_cours' && completionScore(selectedFull) === CHECKLIST_ADMIN.length && (
                    <button onClick={() => markComplet(selectedFull.id)}
                      className="w-full py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Dossier complet — valider
                    </button>
                  )}
                </div>

                {/* Contrats */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">📝 Contrats</p>
                    <button onClick={() => setShowContratForm(!showContratForm)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800">
                      <Plus className="w-3 h-3" /> Nouveau contrat
                    </button>
                  </div>

                  {showContratForm && (
                    <form onSubmit={handleContrat} className="bg-gray-50 rounded-lg p-4 space-y-3 mb-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">N° contrat</label>
                          <input type="text" value={formC.numero} onChange={(e) => setFormC((f) => ({ ...f, numero: e.target.value }))}
                            className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Montant HT (€)</label>
                          <input type="number" value={formC.montant_ht} onChange={(e) => setFormC((f) => ({ ...f, montant_ht: e.target.value }))}
                            className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        {[
                          { key: 'cgv_incluses', label: 'CGV incluses' },
                          { key: 'delegation_paiement', label: 'Délégation de paiement' },
                          { key: 'second_rang', label: 'Sous-traitance 2nd rang' },
                        ].map((opt) => (
                          <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={formC[opt.key as keyof typeof formC] as boolean}
                              onChange={(e) => setFormC((f) => ({ ...f, [opt.key]: e.target.checked }))}
                              className="w-4 h-4 rounded border-gray-300" />
                            <span className="text-xs text-gray-600">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setShowContratForm(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">Annuler</button>
                        <button type="submit" disabled={submitting}
                          className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 disabled:opacity-50">
                          Créer
                        </button>
                      </div>
                    </form>
                  )}

                  {contratsST.length === 0 ? (
                    <p className="text-xs text-gray-400">Aucun contrat</p>
                  ) : (
                    <div className="space-y-2">
                      {contratsST.map((c) => (
                        <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <div>
                            <p className="text-xs font-medium text-gray-800">
                              {c.numero ?? 'Sans numéro'}
                              {c.montant_ht ? ` — ${c.montant_ht.toLocaleString('fr-FR')} € HT` : ''}
                            </p>
                            <p className="text-xs text-gray-400">
                              {c.cgv_incluses ? 'CGV · ' : ''}{c.delegation_paiement ? 'Délégation · ' : ''}{c.second_rang ? '2nd rang' : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.statut === 'signe' ? 'bg-emerald-50 text-emerald-600' : c.statut === 'envoye' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                              {c.statut === 'signe' ? 'Signé ✓' : c.statut === 'envoye' ? 'Envoyé' : 'Brouillon'}
                            </span>
                            {c.statut === 'brouillon' && (
                              <button onClick={() => updateContratStatut(c.id, 'envoye')} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100">→ Envoyer</button>
                            )}
                            {c.statut === 'envoye' && (
                              <button onClick={() => updateContratStatut(c.id, 'signe')} className="px-2 py-0.5 text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 rounded hover:bg-emerald-100">✓ Signé</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
