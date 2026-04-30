'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { Search, FolderOpen, Pencil, Archive, RotateCcw, X, CheckCircle2, XCircle, Trash2, Upload } from 'lucide-react'
import { DocumentUploadModal } from '@/components/shared/DocumentUploadModal'

interface ProjetRow {
  id: string
  nom: string
  reference: string | null
  type_chantier: string | null
  adresse: string | null
  statut: string | null
  budget_total: number | null
  surface_m2: number | null
  date_debut: string | null
  date_livraison: string | null
  co_id: string | null
  economiste_id: string | null
  commercial_id: string | null
  client_nom: string | null
  client_email: string | null
  client_tel: string | null
  created_at: string
  co_nom: string | null
  commercial_nom: string | null
}

interface EditForm {
  nom: string
  reference: string
  type_chantier: string
  adresse: string
  statut: string
  budget_total: string
  surface_m2: string
  date_debut: string
  date_livraison: string
  co_id: string
  economiste_id: string
  commercial_id: string
  client_nom: string
  client_email: string
  client_tel: string
}

interface UserItem { id: string; prenom: string; nom: string; role: string }

const STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon', en_cours: 'En cours', suspendu: 'Suspendu',
  livre: 'Livré', termine: 'Terminé', archive: 'Archivé',
}

const STATUTS = Object.entries(STATUT_LABELS)

const ROLE_LABELS: Record<string, string> = {
  co: "CO", commercial: 'Commercial', economiste: 'Économiste',
  dessinatrice: 'Dessin', comptable: 'Comptable', gerant: 'Gérant',
  admin: 'Admin', rh: 'RH', cho: 'CHO', assistant_travaux: 'AT', st: 'ST',
}

function formatBudget(n: number | null) {
  if (!n) return '—'
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' DA'
}

function emptyForm(): EditForm {
  return {
    nom: '', reference: '', type_chantier: '', adresse: '', statut: 'en_cours',
    budget_total: '', surface_m2: '', date_debut: '', date_livraison: '',
    co_id: '', economiste_id: '', commercial_id: '',
    client_nom: '', client_email: '', client_tel: '',
  }
}

export default function AdminProjetsPage() {
  const supabase = createClient()
  const { user, profil } = useUser()
  const [projets, setProjets] = useState<ProjetRow[]>([])
  const [allUsers, setAllUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)

  const canArchive = profil ? ['admin', 'gerant'].includes(profil.role) : false

  const [editTarget, setEditTarget] = useState<ProjetRow | null>(null)
  const [editForm, setEditForm] = useState<EditForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProjetRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<ProjetRow | null>(null)
  const [archiving, setArchiving] = useState(false)

  function notify(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function load() {
    const [projetsRes, usersRes] = await Promise.all([
      supabase.schema('app').from('projets')
        .select('id, nom, reference, type_chantier, adresse, statut, budget_total, surface_m2, date_debut, date_livraison, co_id, economiste_id, commercial_id, client_nom, client_email, client_tel, created_at')
        .order('created_at', { ascending: false }),
      supabase.schema('app').from('utilisateurs').select('id, prenom, nom, role').eq('actif', true).order('prenom'),
    ])

    const users = (usersRes.data ?? []) as UserItem[]
    setAllUsers(users)

    const usersMap = new Map(users.map(u => [u.id, `${u.prenom} ${u.nom}`]))
    const rows: ProjetRow[] = (projetsRes.data ?? []).map(p => ({
      ...p,
      co_nom: p.co_id ? (usersMap.get(p.co_id) ?? null) : null,
      commercial_nom: p.commercial_id ? (usersMap.get(p.commercial_id) ?? null) : null,
    }))
    setProjets(rows)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Filtrage ──
  const filtered = useMemo(() => projets.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || `${p.nom} ${p.reference ?? ''} ${p.client_nom ?? ''}`.toLowerCase().includes(q)
    const matchStatut = !filterStatut || p.statut === filterStatut
    return matchSearch && matchStatut
  }), [projets, search, filterStatut])

  const actifs   = filtered.filter(p => p.statut !== 'archive')
  const archives = filtered.filter(p => p.statut === 'archive')

  // ── Ouvrir modal modifier ──
  function openEdit(p: ProjetRow) {
    setEditTarget(p)
    setEditForm({
      nom: p.nom ?? '',
      reference: p.reference ?? '',
      type_chantier: p.type_chantier ?? '',
      adresse: p.adresse ?? '',
      statut: p.statut ?? 'en_cours',
      budget_total: p.budget_total ? String(p.budget_total) : '',
      surface_m2: p.surface_m2 ? String(p.surface_m2) : '',
      date_debut: p.date_debut ? p.date_debut.slice(0, 10) : '',
      date_livraison: p.date_livraison ? p.date_livraison.slice(0, 10) : '',
      co_id: p.co_id ?? '',
      economiste_id: p.economiste_id ?? '',
      commercial_id: p.commercial_id ?? '',
      client_nom: p.client_nom ?? '',
      client_email: p.client_email ?? '',
      client_tel: p.client_tel ?? '',
    })
    setEditError('')
  }

  // ── Enregistrer ──
  async function handleSave() {
    if (!editTarget) return
    if (!editForm.nom.trim()) { setEditError('Le nom du projet est obligatoire'); return }
    setSaving(true)

    const { error } = await supabase.schema('app').from('projets').update({
      nom:            editForm.nom.trim(),
      reference:      editForm.reference.trim() || null,
      type_chantier:  editForm.type_chantier.trim() || null,
      adresse:        editForm.adresse.trim() || null,
      statut:         editForm.statut || null,
      budget_total:   editForm.budget_total ? Number(editForm.budget_total) : null,
      surface_m2:     editForm.surface_m2 ? Number(editForm.surface_m2) : null,
      date_debut:     editForm.date_debut || null,
      date_livraison: editForm.date_livraison || null,
      co_id:          editForm.co_id || null,
      economiste_id:  editForm.economiste_id || null,
      commercial_id:  editForm.commercial_id || null,
      client_nom:     editForm.client_nom.trim() || null,
      client_email:   editForm.client_email.trim() || null,
      client_tel:     editForm.client_tel.trim() || null,
    }).eq('id', editTarget.id)

    setSaving(false)
    if (error) { setEditError(error.message); return }

    setEditTarget(null)
    notify('Projet mis à jour')
    load()
  }

  // ── Archiver (avec modale + archived_at/by) ──
  async function confirmArchiver() {
    if (!archiveTarget) return
    setArchiving(true)
    const { error } = await supabase.schema('app').from('projets').update({
      statut: 'archive',
      archived_at: new Date().toISOString(),
      archived_by: user?.id ?? null,
    }).eq('id', archiveTarget.id)
    setArchiving(false)
    if (error) { notify(error.message, false); return }
    setArchiveTarget(null)
    notify(`"${archiveTarget.nom}" archivé`)
    // Redirige vers la page Historique comme demandé dans la spec
    if (typeof window !== 'undefined') window.location.href = '/admin/historique'
  }

  async function handleRestaurer(p: ProjetRow) {
    const { error } = await supabase.schema('app').from('projets').update({
      statut: 'gpa',
      archived_at: null,
      archived_by: null,
    }).eq('id', p.id)
    if (error) { notify(error.message, false); return }
    await load()
    notify(`"${p.nom}" restauré`)
  }

  // ── Supprimer (archivés uniquement) ──
  async function handleSupprimer() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.schema('app').from('projets').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) { notify(error.message, false); setDeleteTarget(null); return }
    setProjets(prev => prev.filter(x => x.id !== deleteTarget.id))
    notify(`"${deleteTarget.nom}" supprimé`)
    setDeleteTarget(null)
  }

  // ── Helpers ──
  function usersByRole(...roles: string[]) {
    return allUsers.filter(u => roles.includes(u.role))
  }

  function f(key: keyof EditForm, value: string) {
    setEditForm(prev => ({ ...prev, [key]: value }))
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1.5'

  return (
    <div>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Projets</h1>
          <p className="text-xs text-gray-400">{projets.length} projets au total</p>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          Deposer
        </button>
      </header>

      <div className="p-6 space-y-4">
        {/* Filtres */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom, référence ou client…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            />
          </div>
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
            <option value="">Tous les statuts</option>
            {STATUTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl flex flex-col items-center py-16">
            <FolderOpen className="w-8 h-8 text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">Aucun projet trouvé</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Projets actifs */}
            {actifs.length > 0 && (
              <ProjetTable
                rows={actifs}
                onEdit={openEdit}
                onArchive={canArchive ? p => setArchiveTarget(p) : null}
                onRestore={null}
              />
            )}

            {/* Projets archivés */}
            {archives.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Archivés</p>
                <div className="opacity-70">
                  <ProjetTable
                    rows={archives}
                    onEdit={openEdit}
                    onArchive={null}
                    onRestore={handleRestaurer}
                    onDelete={p => setDeleteTarget(p)}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal Modifier ── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setEditTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Modifier le projet</h2>
                {editTarget.reference && (
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">{editTarget.reference}</p>
                )}
              </div>
              <button onClick={() => setEditTarget(null)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {editError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{editError}</p>
              )}

              {/* Identité */}
              <Section title="Identité">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Nom du projet *</label>
                    <input value={editForm.nom} onChange={e => f('nom', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Référence</label>
                    <input value={editForm.reference} onChange={e => f('reference', e.target.value)} className={inputCls} placeholder="EX-2024-001" />
                  </div>
                  <div>
                    <label className={labelCls}>Type de chantier</label>
                    <input value={editForm.type_chantier} onChange={e => f('type_chantier', e.target.value)} className={inputCls} placeholder="Résidentiel, Commercial…" />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Adresse</label>
                    <input value={editForm.adresse} onChange={e => f('adresse', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Statut</label>
                    <select value={editForm.statut} onChange={e => f('statut', e.target.value)} className={inputCls}>
                      {STATUTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
              </Section>

              {/* Budget & planning */}
              <Section title="Budget & planning">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Budget total (DA)</label>
                    <input type="number" value={editForm.budget_total} onChange={e => f('budget_total', e.target.value)} className={inputCls} placeholder="0" />
                  </div>
                  <div>
                    <label className={labelCls}>Surface (m²)</label>
                    <input type="number" value={editForm.surface_m2} onChange={e => f('surface_m2', e.target.value)} className={inputCls} placeholder="0" />
                  </div>
                  <div>
                    <label className={labelCls}>Date de début</label>
                    <input type="date" value={editForm.date_debut} onChange={e => f('date_debut', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Date de livraison</label>
                    <input type="date" value={editForm.date_livraison} onChange={e => f('date_livraison', e.target.value)} className={inputCls} />
                  </div>
                </div>
              </Section>

              {/* Équipe */}
              <Section title="Équipe">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Chargé d'opérations</label>
                    <select value={editForm.co_id} onChange={e => f('co_id', e.target.value)} className={inputCls}>
                      <option value="">— Aucun —</option>
                      {usersByRole('co').map(u => (
                        <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Économiste</label>
                    <select value={editForm.economiste_id} onChange={e => f('economiste_id', e.target.value)} className={inputCls}>
                      <option value="">— Aucun —</option>
                      {usersByRole('economiste').map(u => (
                        <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Commercial</label>
                    <select value={editForm.commercial_id} onChange={e => f('commercial_id', e.target.value)} className={inputCls}>
                      <option value="">— Aucun —</option>
                      {usersByRole('commercial').map(u => (
                        <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </Section>

              {/* Client */}
              <Section title="Client">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Nom du client</label>
                    <input value={editForm.client_nom} onChange={e => f('client_nom', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input type="email" value={editForm.client_email} onChange={e => f('client_email', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Téléphone</label>
                    <input value={editForm.client_tel} onChange={e => f('client_tel', e.target.value)} className={inputCls} />
                  </div>
                </div>
              </Section>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setEditTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Archiver ── */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setArchiveTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Archiver le projet</h2>
              <button onClick={() => setArchiveTarget(null)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              Voulez-vous archiver le projet <span className="font-medium">&laquo;&nbsp;{archiveTarget.nom}&nbsp;&raquo;</span>&nbsp;?
            </p>
            <p className="text-xs text-gray-500 mb-5">
              Le projet passera en lecture seule et sera visible dans la page Historique.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Annuler
              </button>
              <button onClick={confirmArchiver} disabled={archiving}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                <Archive className="w-3.5 h-3.5" />
                {archiving ? 'Archivage…' : 'Confirmer l\'archivage'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Supprimer ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Supprimer le projet</h2>
            <p className="text-sm text-gray-500 mb-5">
              Cette action est irréversible. Le projet <span className="font-medium text-gray-800">&ldquo;{deleteTarget.nom}&rdquo;</span> sera définitivement supprimé.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Annuler
              </button>
              <button onClick={handleSupprimer} disabled={deleting}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
          toast.ok ? 'bg-gray-900' : 'bg-red-600'
        }`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <DocumentUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => setUploadOpen(false)}
      />
    </div>
  )
}

/* ── Sub-components ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</p>
      {children}
    </div>
  )
}

function ProjetTable({
  rows, onEdit, onArchive, onRestore, onDelete,
}: {
  rows: ProjetRow[]
  onEdit: (p: ProjetRow) => void
  onArchive: ((p: ProjetRow) => void) | null
  onRestore: ((p: ProjetRow) => void) | null
  onDelete?: (p: ProjetRow) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <th className="text-left px-5 py-3">Référence</th>
            <th className="text-left px-5 py-3">Nom</th>
            <th className="text-left px-5 py-3">Statut</th>
            <th className="text-left px-5 py-3">CO</th>
            <th className="text-left px-5 py-3">Commercial</th>
            <th className="text-left px-5 py-3">Budget</th>
            <th className="text-left px-5 py-3">Créé le</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map(p => (
            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-5 py-3 font-mono text-xs text-gray-500">{p.reference ?? '—'}</td>
              <td className="px-5 py-3 font-medium text-gray-900 max-w-[14rem]">
                <p className="truncate">{p.nom}</p>
                {p.client_nom && <p className="text-xs text-gray-400 truncate">{p.client_nom}</p>}
              </td>
              <td className="px-5 py-3">
                <span className="text-xs bg-gray-100 text-gray-700 font-medium px-2 py-0.5 rounded">
                  {STATUT_LABELS[p.statut ?? ''] ?? (p.statut ?? '—')}
                </span>
              </td>
              <td className="px-5 py-3 text-gray-600 text-xs">{p.co_nom ?? '—'}</td>
              <td className="px-5 py-3 text-gray-600 text-xs">{p.commercial_nom ?? '—'}</td>
              <td className="px-5 py-3 text-gray-600 text-xs">{formatBudget(p.budget_total)}</td>
              <td className="px-5 py-3 text-gray-400 text-xs">
                {new Date(p.created_at).toLocaleDateString('fr-FR')}
              </td>
              <td className="px-5 py-3">
                <div className="flex items-center justify-end gap-1.5">
                  <button onClick={() => onEdit(p)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <Pencil className="w-3 h-3" /> Modifier
                  </button>
                  {onArchive && (
                    <button onClick={() => onArchive(p)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <Archive className="w-3 h-3" /> Archiver
                    </button>
                  )}
                  {onRestore && (
                    <button onClick={() => onRestore(p)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition-colors">
                      <RotateCcw className="w-3 h-3" /> Restaurer
                    </button>
                  )}
                  {onDelete && (
                    <button onClick={() => onDelete(p)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3 h-3" /> Supprimer
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
