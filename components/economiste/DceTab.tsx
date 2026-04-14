'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Upload, FileText, Trash2, Download, Plus, X, Calendar,
  Mail, Phone, Building2, Copy, Check, Eye, ThumbsUp, ThumbsDown, Search, Pencil,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, cn } from '@/lib/utils'
import { FAKE_POPY3_LIGNES_BY_LOT_NOM, isPopy3Demo } from '@/lib/fake-data/metres-popy3'

type Lot = {
  id: string
  projet_id: string
  nom: string
  ordre: number
  total_ht: number | null
  cctp_url: string | null
  cctp_nom_fichier: string | null
  plans_urls: { nom: string; url: string }[] | null
  planning_debut: string | null
  planning_fin: string | null
  planning_notes: string | null
}

type AccesST = {
  id: string
  lot_id: string
  projet_id: string
  st_nom: string | null
  st_email: string | null
  st_telephone: string | null
  st_societe: string | null
  token: string
  statut: 'envoye' | 'ouvert' | 'en_cours' | 'soumis' | 'retenu' | 'refuse'
  date_limite: string | null
  ouvert_le: string | null
  soumis_le: string | null
  created_at: string
}

type Offre = {
  id: string
  acces_id: string
  chiffrage_ligne_id: string | null
  designation: string | null
  quantite: number | null
  unite: string | null
  prix_unitaire: number | null
  total_ht: number | null
  montant_total_ht: number | null
  notes_st: string | null
}

const STATUT_LABEL: Record<AccesST['statut'], { label: string; cls: string }> = {
  envoye:   { label: 'Envoyé',     cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  ouvert:   { label: 'Ouvert',     cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  en_cours: { label: 'En cours',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  soumis:   { label: 'Offre reçue',cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  retenu:   { label: 'Retenu',     cls: 'bg-green-50 text-green-700 border-green-200' },
  refuse:   { label: 'Refusé',     cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

function lotGlobalStatus(accesList: AccesST[]): { label: string; cls: string } {
  if (accesList.some((a) => a.statut === 'retenu')) return { label: 'Retenu', cls: 'bg-green-100 text-green-700 border-green-200' }
  if (accesList.some((a) => a.statut === 'soumis')) return { label: 'Offre reçue', cls: 'bg-orange-100 text-orange-700 border-orange-200' }
  if (accesList.length > 0) return { label: 'En cours', cls: 'bg-blue-50 text-blue-700 border-blue-200' }
  return { label: 'Non lancé', cls: 'bg-gray-100 text-gray-500 border-gray-200' }
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function DceTab({
  projetId,
  projetReference,
}: {
  projetId: string
  projetReference?: string | null
}) {
  const supabase = useMemo(() => createClient(), [])
  const [lots, setLots] = useState<Lot[]>([])
  const [activeLotId, setActiveLotId] = useState<string | null>(null)
  const [accesByLot, setAccesByLot] = useState<Record<string, AccesST[]>>({})
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Pour la démo POPY3 : les lignes de métré vivent en mémoire côté MetresTab.
  // Pour que le flow DCE → Comparatif ST fonctionne, on sème les lignes en DB
  // (idempotent : seulement si le lot est vide).
  async function seedDemoLignesIfNeeded(lotsList: Lot[]) {
    if (!isPopy3Demo(projetReference)) return
    for (const lot of lotsList) {
      const seeds = FAKE_POPY3_LIGNES_BY_LOT_NOM[lot.nom]
      if (!seeds || seeds.length === 0) continue
      const { count } = await supabase
        .from('chiffrage_lignes' as never)
        .select('id', { count: 'exact', head: true })
        .eq('lot_id', lot.id)
      if ((count ?? 0) > 0) continue
      await supabase.from('chiffrage_lignes' as never).insert(
        seeds.map((s) => ({
          lot_id: lot.id,
          projet_id: projetId,
          designation: s.designation,
          detail: s.detail,
          quantite: s.quantite,
          unite: s.unite,
          prix_unitaire: s.prix_unitaire,
          ordre: s.ordre,
        })) as never,
      )
    }
  }

  async function refreshLots() {
    const { data, error } = await supabase
      .from('lots' as never)
      .select('*')
      .eq('projet_id', projetId)
      .order('ordre', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) { setErrorMsg(error.message); return }
    const rows = (data ?? []) as unknown as Lot[]
    await seedDemoLignesIfNeeded(rows)
    setLots(rows)
    if (!activeLotId && rows[0]) setActiveLotId(rows[0].id)
  }

  async function refreshAcces() {
    const { data } = await supabase
      .from('dce_acces_st' as never)
      .select('*')
      .eq('projet_id', projetId)
      .order('created_at', { ascending: false })
    const rows = (data ?? []) as unknown as AccesST[]
    const grouped: Record<string, AccesST[]> = {}
    rows.forEach((a) => {
      if (!grouped[a.lot_id]) grouped[a.lot_id] = []
      grouped[a.lot_id].push(a)
    })
    setAccesByLot(grouped)
  }

  useEffect(() => {
    Promise.all([refreshLots(), refreshAcces()]).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetId])

  const activeLot = lots.find((l) => l.id === activeLotId) ?? null
  const activeAcces = activeLot ? accesByLot[activeLot.id] ?? [] : []

  if (loading) return <div className="text-sm text-gray-400 py-10 text-center">Chargement…</div>

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 flex items-start justify-between gap-4">
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600 text-xs">Fermer</button>
        </div>
      )}

      <div className="flex items-stretch gap-4 min-h-[600px]">
        {/* PANNEAU GAUCHE — Liste des lots */}
        <aside className="w-[260px] flex-shrink-0 bg-gray-50 border border-gray-200 rounded-lg flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Lots du projet</h3>
            <p className="text-xs text-gray-400 mt-0.5">{lots.length} lot{lots.length > 1 ? 's' : ''}</p>
          </div>
          <ul className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {lots.length === 0 && (
              <li className="text-xs text-gray-400 px-2 py-6 text-center">Créez d'abord des lots dans l'onglet Métrés</li>
            )}
            {lots.map((lot) => {
              const isActive = lot.id === activeLotId
              const status = lotGlobalStatus(accesByLot[lot.id] ?? [])
              return (
                <li key={lot.id}>
                  <button
                    onClick={() => setActiveLotId(lot.id)}
                    className={cn(
                      'w-full px-3 py-2.5 rounded-md text-left transition-colors',
                      isActive
                        ? 'bg-blue-50 border-l-[3px] border-blue-600 pl-[9px]'
                        : 'hover:bg-white border-l-[3px] border-transparent pl-[9px]',
                    )}
                  >
                    <div className="text-sm font-medium text-gray-900 truncate">{lot.nom}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', status.cls)}>
                        {status.label}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* PANNEAU DROIT — Détail du lot */}
        <section className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg overflow-y-auto">
          {!activeLot ? (
            <div className="h-full flex items-center justify-center p-12 text-sm text-gray-400">
              Sélectionnez un lot dans le panneau de gauche
            </div>
          ) : (
            <LotDcePanel
              lot={activeLot}
              acces={activeAcces}
              onLotUpdated={refreshLots}
              onAccesChanged={refreshAcces}
              onError={setErrorMsg}
            />
          )}
        </section>
      </div>
    </div>
  )
}

// ─── Panneau Lot ──────────────────────────────────────────────────────────────

function LotDcePanel({
  lot, acces, onLotUpdated, onAccesChanged, onError,
}: {
  lot: Lot
  acces: AccesST[]
  onLotUpdated: () => Promise<void>
  onAccesChanged: () => Promise<void>
  onError: (m: string) => void
}) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{lot.nom}</h2>
        <p className="text-xs text-gray-400 mt-0.5">Dossier de Consultation des Entreprises</p>
      </div>

      <CCTPSection lot={lot} onUpdated={onLotUpdated} onError={onError} />
      <PlansSection lot={lot} onUpdated={onLotUpdated} onError={onError} />
      <PlanningSection lot={lot} onUpdated={onLotUpdated} onError={onError} />
      <STSection lot={lot} acces={acces} onChanged={onAccesChanged} onError={onError} />
    </div>
  )
}

// ─── Section CCTP ─────────────────────────────────────────────────────────────

function CCTPSection({ lot, onUpdated, onError }: { lot: Lot; onUpdated: () => Promise<void>; onError: (m: string) => void }) {
  const supabase = useMemo(() => createClient(), [])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File) {
    if (!file) return
    setUploading(true)
    const path = `${lot.projet_id}/cctp/${lot.id}_${file.name.replace(/\s+/g, '_')}`
    const { error: upErr } = await supabase.storage.from('checklist-docs').upload(path, file, { upsert: true })
    if (upErr) { onError(`Upload CCTP : ${upErr.message}`); setUploading(false); return }
    const { data: pub } = supabase.storage.from('checklist-docs').getPublicUrl(path)
    const { error: updErr } = await supabase
      .from('lots' as never)
      .update({ cctp_url: pub.publicUrl, cctp_nom_fichier: file.name } as never)
      .eq('id', lot.id)
    if (updErr) onError(`MAJ CCTP : ${updErr.message}`)
    await onUpdated()
    setUploading(false)
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">CCTP — Cahier des Clauses Techniques</h3>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
      />
      {lot.cctp_url ? (
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
          <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="flex-1 text-sm text-gray-900 truncate">{lot.cctp_nom_fichier ?? 'CCTP.pdf'}</span>
          <a
            href={lot.cctp_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 border border-gray-200 rounded hover:bg-white"
          >
            <Download className="w-3 h-3" /> Télécharger
          </a>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 border border-gray-200 rounded hover:bg-white disabled:opacity-50"
          >
            {uploading ? '…' : 'Remplacer'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-gray-300 rounded-md px-4 py-6 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
        >
          <Upload className="w-5 h-5 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-700">{uploading ? 'Upload en cours…' : 'Déposer le CCTP (PDF)'}</p>
        </button>
      )}
    </div>
  )
}

// ─── Section Plans ────────────────────────────────────────────────────────────

function PlansSection({ lot, onUpdated, onError }: { lot: Lot; onUpdated: () => Promise<void>; onError: (m: string) => void }) {
  const supabase = useMemo(() => createClient(), [])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const plans = lot.plans_urls ?? []

  async function handleUpload(files: FileList) {
    setUploading(true)
    const newPlans: { nom: string; url: string }[] = []
    for (const file of Array.from(files)) {
      const path = `${lot.projet_id}/plans/${lot.id}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`
      const { error: upErr } = await supabase.storage.from('checklist-docs').upload(path, file, { upsert: false })
      if (upErr) { onError(`Upload plan ${file.name} : ${upErr.message}`); continue }
      const { data: pub } = supabase.storage.from('checklist-docs').getPublicUrl(path)
      newPlans.push({ nom: file.name, url: pub.publicUrl })
    }
    const merged = [...plans, ...newPlans]
    const { error } = await supabase
      .from('lots' as never)
      .update({ plans_urls: merged } as never)
      .eq('id', lot.id)
    if (error) onError(`MAJ plans : ${error.message}`)
    await onUpdated()
    setUploading(false)
  }

  async function removePlan(idx: number) {
    if (!confirm('Supprimer ce plan ?')) return
    const merged = plans.filter((_, i) => i !== idx)
    const { error } = await supabase
      .from('lots' as never)
      .update({ plans_urls: merged } as never)
      .eq('id', lot.id)
    if (error) onError(`Suppression plan : ${error.message}`)
    await onUpdated()
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Plans</h3>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          {uploading ? 'Upload…' : 'Ajouter des plans'}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf"
        className="hidden"
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
      />
      {plans.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Aucun plan déposé</p>
      ) : (
        <ul className="space-y-1.5">
          {plans.map((p, i) => (
            <li key={i} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
              <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="flex-1 text-sm text-gray-900 truncate">{p.nom}</span>
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 border border-gray-200 rounded hover:bg-white"
              >
                <Download className="w-3 h-3" />
              </a>
              <button
                onClick={() => removePlan(i)}
                className="p-1 text-gray-400 hover:text-red-600 rounded"
                title="Supprimer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Section Planning ─────────────────────────────────────────────────────────

function PlanningSection({ lot, onUpdated, onError }: { lot: Lot; onUpdated: () => Promise<void>; onError: (m: string) => void }) {
  const supabase = useMemo(() => createClient(), [])
  const [debut, setDebut] = useState(lot.planning_debut ?? '')
  const [fin, setFin] = useState(lot.planning_fin ?? '')
  const [notes, setNotes] = useState(lot.planning_notes ?? '')
  const [saved, setSaved] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setDebut(lot.planning_debut ?? '')
    setFin(lot.planning_fin ?? '')
    setNotes(lot.planning_notes ?? '')
  }, [lot.id])

  function scheduleSave(payload: Partial<Lot>) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from('lots' as never)
        .update(payload as never)
        .eq('id', lot.id)
      if (error) onError(`MAJ planning : ${error.message}`)
      else {
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
        await onUpdated()
      }
    }, 1000)
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Planning prévisionnel</h3>
        {saved && <span className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" />Enregistré</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date de début</label>
          <input
            type="date"
            value={debut}
            onChange={(e) => { setDebut(e.target.value); scheduleSave({ planning_debut: e.target.value || null } as Partial<Lot>) }}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date de fin</label>
          <input
            type="date"
            value={fin}
            onChange={(e) => { setFin(e.target.value); scheduleSave({ planning_fin: e.target.value || null } as Partial<Lot>) }}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
      <label className="block text-xs text-gray-500 mb-1">Notes planning</label>
      <textarea
        rows={2}
        value={notes}
        onChange={(e) => { setNotes(e.target.value); scheduleSave({ planning_notes: e.target.value || null } as Partial<Lot>) }}
        placeholder="Contraintes, jalons, accès chantier…"
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 resize-y"
      />
    </div>
  )
}

// ─── Section Sous-traitants ───────────────────────────────────────────────────

function STSection({ lot, acces, onChanged, onError }: {
  lot: Lot
  acces: AccesST[]
  onChanged: () => Promise<void>
  onError: (m: string) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [showInvite, setShowInvite] = useState(false)
  const [viewOffre, setViewOffre] = useState<AccesST | null>(null)
  const [editAcces, setEditAcces] = useState<AccesST | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function copyLink(token: string, id: string) {
    const url = `${window.location.origin}/dce/${token}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  async function setStatut(a: AccesST, statut: AccesST['statut']) {
    const { error } = await supabase
      .from('dce_acces_st' as never)
      .update({ statut } as never)
      .eq('id', a.id)
    if (error) onError(`MAJ statut ST : ${error.message}`)
    else await onChanged()
  }

  async function deleteAcces(a: AccesST) {
    const label = a.st_societe || a.st_nom || a.st_email || 'cette invitation'
    if (!confirm(`Supprimer l'invitation pour ${label} ?\nLes offres déposées (si présentes) seront également supprimées.`)) return
    // Les offres DCE liées sont dans public.dce_offres_st ; on nettoie d'abord.
    await supabase.from('dce_offres_st' as never).delete().eq('acces_id', a.id)
    const { error } = await supabase.from('dce_acces_st' as never).delete().eq('id', a.id)
    if (error) onError(`Suppression invitation : ${error.message}`)
    else await onChanged()
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Sous-traitants consultés</h3>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-black"
        >
          <Plus className="w-3.5 h-3.5" />
          Inviter un ST
        </button>
      </div>

      {acces.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Aucun sous-traitant invité</p>
      ) : (
        <ul className="space-y-2">
          {acces.map((a) => {
            const st = STATUT_LABEL[a.statut] ?? STATUT_LABEL.envoye
            return (
              <li key={a.id} className="border border-gray-200 rounded-md p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">{a.st_nom}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', st.cls)}>
                        {st.label}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      {a.st_societe && <div className="flex items-center gap-1"><Building2 className="w-3 h-3" />{a.st_societe}</div>}
                      {a.st_email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{a.st_email}</div>}
                      {a.st_telephone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{a.st_telephone}</div>}
                      {a.date_limite && <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />Limite : {new Date(a.date_limite).toLocaleDateString('fr-FR')}</div>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => copyLink(a.token, a.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 border border-gray-200 rounded hover:bg-gray-50"
                    >
                      {copiedId === a.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                      {copiedId === a.id ? 'Copié' : 'Copier le lien'}
                    </button>
                    {a.statut === 'soumis' && (
                      <button
                        onClick={() => setViewOffre(a)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-orange-700 border border-orange-200 bg-orange-50 rounded hover:bg-orange-100"
                      >
                        <Eye className="w-3 h-3" />
                        Voir l'offre
                      </button>
                    )}
                    {a.statut !== 'retenu' && a.statut !== 'refuse' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => setStatut(a, 'retenu')}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-green-700 border border-green-200 bg-green-50 rounded hover:bg-green-100"
                          title="Retenir cette offre"
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setStatut(a, 'refuse')}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
                          title="Refuser"
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditAcces(a)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
                        title="Modifier l'invitation"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteAcces(a)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
                        title="Supprimer l'invitation"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {showInvite && (
        <InviteModal
          lot={lot}
          onClose={() => setShowInvite(false)}
          onCreated={async () => { await onChanged(); setShowInvite(false) }}
          onError={onError}
        />
      )}
      {viewOffre && (
        <OffreDrawer acces={viewOffre} onClose={() => setViewOffre(null)} />
      )}
      {editAcces && (
        <EditAccesModal
          acces={editAcces}
          onClose={() => setEditAcces(null)}
          onSaved={async () => { await onChanged(); setEditAcces(null) }}
          onError={onError}
        />
      )}
    </div>
  )
}

// ─── Modal d'édition invitation ──────────────────────────────────────────────

function EditAccesModal({ acces, onClose, onSaved, onError }: {
  acces: AccesST
  onClose: () => void
  onSaved: () => Promise<void>
  onError: (m: string) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [stNom, setStNom] = useState(acces.st_nom ?? '')
  const [stSociete, setStSociete] = useState(acces.st_societe ?? '')
  const [stEmail, setStEmail] = useState(acces.st_email ?? '')
  const [stTel, setStTel] = useState(acces.st_telephone ?? '')
  const [dateLimite, setDateLimite] = useState(acces.date_limite ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!stNom.trim() || !stEmail.trim()) {
      onError('Nom et email sont obligatoires.')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('dce_acces_st' as never)
      .update({
        st_nom: stNom.trim(),
        st_societe: stSociete.trim() || null,
        st_email: stEmail.trim(),
        st_telephone: stTel.trim() || null,
        date_limite: dateLimite || null,
      } as never)
      .eq('id', acces.id)
    setSaving(false)
    if (error) { onError(`MAJ invitation : ${error.message}`); return }
    await onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Modifier l'invitation</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nom du contact *</label>
            <input
              type="text"
              value={stNom}
              onChange={(e) => setStNom(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Société</label>
            <input
              type="text"
              value={stSociete}
              onChange={(e) => setStSociete(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email *</label>
            <input
              type="email"
              value={stEmail}
              onChange={(e) => setStEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Téléphone</label>
            <input
              type="tel"
              value={stTel}
              onChange={(e) => setStTel(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date limite de remise</label>
            <input
              type="date"
              value={dateLimite}
              onChange={(e) => setDateLimite(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:bg-gray-300"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Invitation ST (sélection depuis la base) ──────────────────────────

type SousTraitant = {
  id: string
  source: 'base' | 'user'
  raison_sociale: string
  corps_etat: string[] | null
  specialites: string[] | null
  contact_nom: string | null
  contact_tel: string | null
  contact_email: string | null
  ville: string | null
}

function InviteModal({ lot, onClose, onCreated, onError }: {
  lot: Lot
  onClose: () => void
  onCreated: () => Promise<void>
  onError: (m: string) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [stList, setStList] = useState<SousTraitant[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<SousTraitant | null>(null)
  const [dateLimite, setDateLimite] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [stRes, userRes] = await Promise.all([
        supabase
          .schema('app')
          .from('sous_traitants')
          .select('id,raison_sociale,corps_etat,specialites,contact_nom,contact_tel,contact_email,ville')
          .eq('statut', 'actif')
          .order('raison_sociale'),
        supabase
          .schema('app')
          .from('utilisateurs')
          .select('id,email,nom,prenom,role,categorie,actif')
          .eq('actif', true)
          .or('role.eq.st,categorie.eq.st')
          .order('nom'),
      ])
      if (cancelled) return

      if (stRes.error) onError(`Chargement ST : ${stRes.error.message}`)
      if (userRes.error) onError(`Chargement utilisateurs ST : ${userRes.error.message}`)

      const stRows = ((stRes.data ?? []) as unknown as Array<Omit<SousTraitant, 'source'>>).map(
        (s): SousTraitant => ({ ...s, source: 'base' }),
      )

      type UserRow = { id: string; email: string; nom: string; prenom: string; role: string; categorie: string; actif: boolean }
      const userRows = ((userRes.data ?? []) as unknown as UserRow[]).map((u): SousTraitant => {
        const fullName = `${u.prenom ?? ''} ${u.nom ?? ''}`.trim() || u.email
        return {
          id: u.id,
          source: 'user',
          raison_sociale: fullName,
          corps_etat: null,
          specialites: null,
          contact_nom: fullName,
          contact_tel: null,
          contact_email: u.email,
          ville: null,
        }
      })

      // Dédoublonne : si un utilisateur partage le même email qu'un ST en base, garde le ST (plus complet).
      const seenEmails = new Set(
        stRows.map((s) => (s.contact_email ?? '').toLowerCase()).filter(Boolean),
      )
      const dedupedUsers = userRows.filter((u) => {
        const e = (u.contact_email ?? '').toLowerCase()
        return e ? !seenEmails.has(e) : true
      })

      setStList([...stRows, ...dedupedUsers])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = stList.filter((s) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      s.raison_sociale.toLowerCase().includes(q) ||
      (s.contact_nom?.toLowerCase().includes(q) ?? false) ||
      (s.ville?.toLowerCase().includes(q) ?? false) ||
      (s.specialites?.some((sp) => sp.toLowerCase().includes(q)) ?? false) ||
      (s.corps_etat?.some((c) => c.toLowerCase().includes(q)) ?? false)
    )
  })

  async function handleCreate() {
    if (!selected) return
    const email = selected.contact_email
    if (!email) {
      onError('Ce sous-traitant n\'a pas d\'email enregistré. Mettez à jour sa fiche.')
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('dce_acces_st' as never)
      .insert({
        lot_id: lot.id,
        projet_id: lot.projet_id,
        st_nom: selected.contact_nom || selected.raison_sociale,
        st_societe: selected.raison_sociale,
        st_email: email,
        st_telephone: selected.contact_tel || null,
        date_limite: dateLimite || null,
        statut: 'envoye',
        user_id: selected.source === 'user' ? selected.id : null,
      } as never)
      .select('token')
      .single()
    setSaving(false)
    if (error) { onError(`Création invitation : ${error.message}`); return }
    setCreatedToken((data as unknown as { token: string }).token)
    await onCreated()
  }

  function copyLink() {
    if (!createdToken) return
    const url = `${window.location.origin}/dce/${createdToken}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-semibold text-gray-900">
            {createdToken ? 'Invitation créée' : 'Inviter un sous-traitant'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {createdToken ? (
          <div className="p-5 space-y-3">
            <p className="text-sm text-gray-700">Transmettez ce lien au sous-traitant :</p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
              <code className="flex-1 text-xs text-gray-700 truncate">
                {typeof window !== 'undefined' ? `${window.location.origin}/dce/${createdToken}` : ''}
              </code>
              <button
                onClick={copyLink}
                className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-gray-900 rounded hover:bg-black"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copié' : 'Copier'}
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-full mt-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black"
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-gray-200 flex-shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher (raison sociale, contact, ville, spécialité…)"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="text-sm text-gray-400 py-8 text-center">Chargement…</div>
              ) : filtered.length === 0 ? (
                <div className="text-sm text-gray-400 py-8 text-center">
                  {stList.length === 0 ? 'Aucun sous-traitant actif en base' : 'Aucun résultat'}
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filtered.map((s) => {
                    const isSelected = selected?.id === s.id
                    const email = s.contact_email
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => setSelected(s)}
                          className={cn(
                            'w-full px-5 py-3 text-left transition-colors flex items-start gap-3',
                            isSelected ? 'bg-blue-50 border-l-[3px] border-blue-600' : 'hover:bg-gray-50',
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium text-gray-900 truncate">{s.raison_sociale}</div>
                              {s.source === 'user' && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded whitespace-nowrap">
                                  Utilisateur
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-xs text-gray-500 space-y-0.5">
                              {s.contact_nom && s.source === 'base' && <div>{s.contact_nom}</div>}
                              {email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{email}</div>}
                              {s.ville && <div>{s.ville}</div>}
                            </div>
                            {(s.specialites?.length || s.corps_etat?.length) ? (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {s.specialites?.slice(0, 3).map((sp) => (
                                  <span key={sp} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{sp}</span>
                                ))}
                                {s.corps_etat?.slice(0, 2).map((c) => (
                                  <span key={c} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{c}</span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-200 flex-shrink-0 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date limite de remise (optionnel)</label>
                <input
                  type="date"
                  value={dateLimite}
                  onChange={(e) => setDateLimite(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-between items-center gap-2">
                <p className="text-xs text-gray-500 truncate">
                  {selected ? <>Sélectionné : <span className="text-gray-900 font-medium">{selected.raison_sociale}</span></> : 'Sélectionnez un sous-traitant'}
                </p>
                <div className="flex gap-2">
                  <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
                  <button
                    onClick={handleCreate}
                    disabled={saving || !selected}
                    className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:bg-gray-300"
                  >
                    {saving ? 'Création…' : 'Créer l\'invitation'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Drawer Offre ─────────────────────────────────────────────────────────────

function OffreDrawer({ acces, onClose }: { acces: AccesST; onClose: () => void }) {
  const supabase = useMemo(() => createClient(), [])
  const [offres, setOffres] = useState<Offre[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('dce_offres_st' as never)
      .select('*')
      .eq('acces_id', acces.id)
      .then(({ data }) => {
        setOffres(((data ?? []) as unknown) as Offre[])
        setLoading(false)
      })
  }, [acces.id, supabase])

  const total = offres.reduce((s, o) => s + (Number(o.total_ht) || 0), 0)
  const notes = offres[0]?.notes_st

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="ml-auto bg-white shadow-xl w-full max-w-2xl h-full overflow-y-auto relative"
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Offre — {acces.st_nom}</h3>
            <p className="text-xs text-gray-500">{acces.st_societe} · Soumise le {acces.soumis_le ? new Date(acces.soumis_le).toLocaleDateString('fr-FR') : '—'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-sm text-gray-400 py-8 text-center">Chargement…</div>
          ) : offres.length === 0 ? (
            <div className="text-sm text-gray-400 py-8 text-center">Aucune ligne dans cette offre</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-medium text-gray-500">
                    <th className="px-3 py-2">Désignation</th>
                    <th className="px-3 py-2 w-20">Qté</th>
                    <th className="px-3 py-2 w-16">Unité</th>
                    <th className="px-3 py-2 w-28 text-right">PU HT</th>
                    <th className="px-3 py-2 w-28 text-right">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {offres.map((o) => (
                    <tr key={o.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-900">{o.designation}</td>
                      <td className="px-3 py-2 text-gray-600 tabular-nums">{Number(o.quantite) || 0}</td>
                      <td className="px-3 py-2 text-gray-600">{o.unite}</td>
                      <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{formatCurrency(Number(o.prix_unitaire) || 0)}</td>
                      <td className="px-3 py-2 text-right text-gray-900 tabular-nums font-medium">{formatCurrency(Number(o.total_ht) || 0)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                    <td colSpan={4} className="px-3 py-3 text-right text-gray-700">TOTAL OFFRE HT</td>
                    <td className="px-3 py-3 text-right text-gray-900 tabular-nums">{formatCurrency(total)}</td>
                  </tr>
                </tbody>
              </table>
              {notes && (
                <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                  <p className="text-xs text-gray-500 mb-1">Notes du sous-traitant</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
