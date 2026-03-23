'use client'

import { useState } from 'react'
import { Briefcase, Plus, FileText, ShoppingCart, ChevronDown, ChevronUp, Edit3, Save, X } from 'lucide-react'
import { TopBar } from '@/components/co/TopBar'

type Achat = {
  id: string; description: string; fournisseur: string; montant: number
  statut: 'en_comparaison' | 'commande' | 'livre' | 'annule'; categorie: string; created_at: string
}

type PieceComptable = {
  id: string; type: 'facture' | 'ndf' | 'autre'; description: string
  fournisseur: string; montant: number; mois: string; transmis: boolean
}

const CATEGORIES_ACHAT = ['Fournitures bureau', 'Informatique', 'Mobilier', 'Services', 'Entretien locaux', 'Autre']

const STATUT_ACHAT: Record<string, { label: string; color: string }> = {
  en_comparaison: { label: 'En comparaison', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  commande:       { label: 'Commandé',        color: 'bg-amber-50 text-amber-600 border-amber-200' },
  livre:          { label: 'Livré ✓',         color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  annule:         { label: 'Annulé',          color: 'bg-gray-100 text-gray-500 border-gray-200' },
}

function getMois6(): string[] {
  const months = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function formatMois(m: string): string {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export default function TransversePage() {
  const [tab, setTab] = useState<'achats' | 'comptable'>('achats')
  const [achats, setAchats] = useState<Achat[]>([])
  const [pieces, setPieces] = useState<PieceComptable[]>([])
  const [showForm, setShowForm] = useState(false)
  const [expandedAchat, setExpandedAchat] = useState<string | null>(null)
  const [formAchat, setFormAchat] = useState({ description: '', fournisseur: '', montant: '', categorie: '', notes: '' })
  const [formPiece, setFormPiece] = useState({ type: 'facture', description: '', fournisseur: '', montant: '', mois: getMois6()[0] })

  function addAchat(e: React.FormEvent) {
    e.preventDefault()
    if (!formAchat.description) return
    const newAchat: Achat = {
      id: crypto.randomUUID(), description: formAchat.description, fournisseur: formAchat.fournisseur,
      montant: Number(formAchat.montant), statut: 'en_comparaison',
      categorie: formAchat.categorie, created_at: new Date().toISOString(),
    }
    setAchats((a) => [newAchat, ...a])
    setFormAchat({ description: '', fournisseur: '', montant: '', categorie: '', notes: '' })
    setShowForm(false)
  }

  function updateAchatStatut(id: string, statut: Achat['statut']) {
    setAchats((a) => a.map((ac) => ac.id === id ? { ...ac, statut } : ac))
  }

  function addPiece(e: React.FormEvent) {
    e.preventDefault()
    if (!formPiece.description) return
    const newPiece: PieceComptable = {
      id: crypto.randomUUID(), type: formPiece.type as PieceComptable['type'],
      description: formPiece.description, fournisseur: formPiece.fournisseur,
      montant: Number(formPiece.montant), mois: formPiece.mois, transmis: false,
    }
    setPieces((p) => [newPiece, ...p])
    setFormPiece({ type: 'facture', description: '', fournisseur: '', montant: '', mois: getMois6()[0] })
    setShowForm(false)
  }

  function toggleTransmis(id: string) {
    setPieces((p) => p.map((pc) => pc.id === id ? { ...pc, transmis: !pc.transmis } : pc))
  }

  const achatStats = {
    en_comparaison: achats.filter((a) => a.statut === 'en_comparaison').length,
    commande: achats.filter((a) => a.statut === 'commande').length,
    total: achats.filter((a) => a.statut !== 'annule').reduce((s, a) => s + a.montant, 0),
  }

  return (
    <div>
      <TopBar title="Transverse" subtitle="Achats internes · Support comptable" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Achats en cours</p>
            <p className="text-2xl font-semibold text-blue-600">{achatStats.en_comparaison + achatStats.commande}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Budget achats</p>
            <p className="text-2xl font-semibold text-gray-900">{achatStats.total.toLocaleString('fr-FR')} €</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Pièces à transmettre</p>
            <p className="text-2xl font-semibold text-amber-600">{pieces.filter((p) => !p.transmis).length}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Pièces transmises</p>
            <p className="text-2xl font-semibold text-emerald-600">{pieces.filter((p) => p.transmis).length}</p>
          </div>
        </div>

        {/* Tabs + bouton */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {[
              { value: 'achats',    label: '🛒 Achats internes' },
              { value: 'comptable', label: '📄 Support comptable' },
            ].map((t) => (
              <button key={t.value} onClick={() => { setTab(t.value as typeof tab); setShowForm(false) }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.value ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
            <Plus className="w-4 h-4" /> {tab === 'achats' ? 'Nouvel achat' : 'Ajouter une pièce'}
          </button>
        </div>

        {/* ACHATS */}
        {tab === 'achats' && (
          <>
            {showForm && (
              <form onSubmit={addAchat} className="bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-blue-500" /> Nouvel achat interne
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
                    <input type="text" value={formAchat.description} onChange={(e) => setFormAchat((f) => ({ ...f, description: e.target.value }))} placeholder="Ex: Cartouches imprimante Canon"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Catégorie</label>
                    <select value={formAchat.categorie} onChange={(e) => setFormAchat((f) => ({ ...f, categorie: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      <option value="">Sélectionner...</option>
                      {CATEGORIES_ACHAT.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fournisseur</label>
                    <input type="text" value={formAchat.fournisseur} onChange={(e) => setFormAchat((f) => ({ ...f, fournisseur: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Montant estimé (€)</label>
                    <input type="number" value={formAchat.montant} onChange={(e) => setFormAchat((f) => ({ ...f, montant: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
                  <button type="submit" disabled={!formAchat.description}
                    className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
                    Créer
                  </button>
                </div>
              </form>
            )}

            {achats.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                <ShoppingCart className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Aucun achat en cours</p>
                <p className="text-xs text-gray-400 mt-1">Créez votre premier achat interne.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {achats.map((a) => {
                  const s = STATUT_ACHAT[a.statut]
                  return (
                    <div key={a.id} className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
                      <div className="p-4 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium text-gray-900">{a.description}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${s.color}`}>{s.label}</span>
                          </div>
                          <p className="text-xs text-gray-400">
                            {a.categorie}{a.fournisseur ? ` · ${a.fournisseur}` : ''}
                            {a.montant ? ` · ${a.montant.toLocaleString('fr-FR')} €` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {a.statut === 'en_comparaison' && (
                            <button onClick={() => updateAchatStatut(a.id, 'commande')}
                              className="px-3 py-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100">
                              Commandé
                            </button>
                          )}
                          {a.statut === 'commande' && (
                            <button onClick={() => updateAchatStatut(a.id, 'livre')}
                              className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                              Livré ✓
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* COMPTABLE */}
        {tab === 'comptable' && (
          <>
            {showForm && (
              <form onSubmit={addPiece} className="bg-white rounded-lg border border-gray-200 shadow-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-500" /> Nouvelle pièce comptable
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                    <select value={formPiece.type} onChange={(e) => setFormPiece((f) => ({ ...f, type: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      <option value="facture">Facture d&apos;achat</option>
                      <option value="ndf">Note de frais</option>
                      <option value="autre">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Mois</label>
                    <select value={formPiece.mois} onChange={(e) => setFormPiece((f) => ({ ...f, mois: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      {getMois6().map((m) => <option key={m} value={m}>{formatMois(m)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
                    <input type="text" value={formPiece.description} onChange={(e) => setFormPiece((f) => ({ ...f, description: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fournisseur / Nom</label>
                    <input type="text" value={formPiece.fournisseur} onChange={(e) => setFormPiece((f) => ({ ...f, fournisseur: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Montant (€)</label>
                    <input type="number" value={formPiece.montant} onChange={(e) => setFormPiece((f) => ({ ...f, montant: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
                  <button type="submit" disabled={!formPiece.description}
                    className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
                    Ajouter
                  </button>
                </div>
              </form>
            )}

            {pieces.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Aucune pièce comptable</p>
                <p className="text-xs text-gray-400 mt-1">Ajoutez les factures et NDF à transmettre à la comptabilité.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pieces.map((p) => (
                  <div key={p.id} className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.transmis ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium text-gray-900">{p.description}</p>
                            <span className="text-xs text-gray-400">
                              {p.type === 'facture' ? '🧾 Facture' : p.type === 'ndf' ? '💳 NDF' : '📄 Autre'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">
                            {formatMois(p.mois)}
                            {p.fournisseur ? ` · ${p.fournisseur}` : ''}
                            {p.montant ? ` · ${p.montant.toLocaleString('fr-FR')} €` : ''}
                          </p>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                        <input type="checkbox" checked={p.transmis} onChange={() => toggleTransmis(p.id)}
                          className="w-4 h-4 rounded border-gray-300 text-emerald-600" />
                        <span className="text-xs text-gray-600">{p.transmis ? 'Transmis ✓' : 'À transmettre'}</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
