'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText, Trash2, Download, Plus, X, Calendar,
  Mail, Phone, Building2, Copy, Check, Eye, ThumbsUp, ThumbsDown, Search, Pencil,
  ExternalLink, User as UserIcon, Sparkles, AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, cn } from '@/lib/utils'
import { FAKE_POPY3_LIGNES_BY_LOT_NOM, isPopy3Demo } from '@/lib/fake-data/metres-popy3'
import { Abbr } from '@/components/shared/Abbr'
import { generateCCTPPdf } from '@/lib/pdf/cctp'

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
  token: string | null
  statut: 'envoye' | 'ouvert' | 'en_cours' | 'soumis' | 'retenu' | 'refuse'
  date_limite: string | null
  ouvert_le: string | null
  soumis_le: string | null
  created_at: string
  type_acces: 'externe' | 'interne'
  employe_id: string | null
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

// URL de l'app hebergee — utilisee pour les liens DCE partages aux ST.
// En dev (localhost), on redirige vers la prod pour que le lien fonctionne depuis l'exterieur.
const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://api-1-aj7d.onrender.com'

function dceLink(token: string): string {
  return `${APP_BASE_URL}/dce/${token}`
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
  projetNom,
}: {
  projetId: string
  projetReference?: string | null
  projetNom?: string | null
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
      // Upsert idempotent sur (lot_id, designation, ordre) — evite les doublons
      // meme si React strict mode ou double montage declenche le seed en parallele.
      await supabase
        .from('chiffrage_lignes' as never)
        .upsert(
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
          { onConflict: 'lot_id,designation,ordre', ignoreDuplicates: false },
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
              projetReference={projetReference ?? null}
              projetNom={projetNom ?? null}
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
  lot, acces, projetReference, projetNom, onLotUpdated, onAccesChanged, onError,
}: {
  lot: Lot
  acces: AccesST[]
  projetReference: string | null
  projetNom: string | null
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

      <CCTPSection
        lot={lot}
        projetReference={projetReference}
        projetNom={projetNom}
        onUpdated={onLotUpdated}
        onError={onError}
      />
      <PlansSection lot={lot} onUpdated={onLotUpdated} onError={onError} />
      <PlanningSection lot={lot} onUpdated={onLotUpdated} onError={onError} />
      <STSection lot={lot} acces={acces} onChanged={onAccesChanged} onError={onError} />
    </div>
  )
}

// ─── Section CCTP ─────────────────────────────────────────────────────────────

function CCTPSection({
  lot, projetReference, projetNom, onUpdated, onError,
}: {
  lot: Lot
  projetReference: string | null
  projetNom: string | null
  onUpdated: () => Promise<void>
  onError: (m: string) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [generating, setGenerating] = useState(false)
  const [lignesCount, setLignesCount] = useState<number | null>(null)
  const [maxUpdatedAt, setMaxUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [{ count }, { data: maxRow }] = await Promise.all([
        supabase.from('chiffrage_lignes' as never)
          .select('id', { count: 'exact', head: true })
          .eq('lot_id', lot.id),
        supabase.from('chiffrage_lignes' as never)
          .select('created_at')
          .eq('lot_id', lot.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      if (cancelled) return
      setLignesCount(count ?? 0)
      setMaxUpdatedAt((maxRow as { created_at: string } | null)?.created_at ?? null)
    })()
    return () => { cancelled = true }
  }, [lot.id, lot.cctp_url, supabase])

  // Detection CCTP obsolete : compare timestamp dans cctp_url (?t=...) avec derniere ligne modifiee
  const cctpStale = useMemo(() => {
    if (!lot.cctp_url || !maxUpdatedAt) return false
    const m = lot.cctp_url.match(/[?&]t=(\d+)/)
    if (!m) return false
    const cctpTime = Number(m[1])
    const updatedTime = new Date(maxUpdatedAt).getTime()
    return updatedTime > cctpTime
  }, [lot.cctp_url, maxUpdatedAt])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const { data, error } = await supabase
        .from('chiffrage_lignes' as never)
        .select('id, parent_id, type, designation, detail, ordre')
        .eq('lot_id', lot.id)
        .order('ordre', { ascending: true })
      if (error) { onError(`Lecture des metres : ${error.message}`); return }
      const rows = ((data ?? []) as unknown as {
        id: string
        parent_id: string | null
        type: string | null
        designation: string | null
        detail: string | null
        ordre: number
      }[])
      // On ne garde que chapitres et ouvrages (le "lot" cote chiffrage est l'objet `lot` lui-meme)
      const items = rows
        .filter((r) => (r.type ?? 'ouvrage') !== 'lot')
        .map((r) => ({
          id: r.id,
          parent_id: r.parent_id,
          type: ((r.type ?? 'ouvrage') === 'chapitre' ? 'chapitre' : 'ouvrage') as 'chapitre' | 'ouvrage',
          designation: r.designation ?? '',
          detail: r.detail ?? null,
          ordre: r.ordre ?? 0,
        }))
        .filter((i) => i.designation.trim() || (i.detail ?? '').trim())

      if (items.length === 0) {
        onError('Aucune ligne dans ce lot. Renseignez chapitres et ouvrages dans l\'onglet Chiffrage avant de generer le CCTP.')
        return
      }

      const blob = generateCCTPPdf({
        projet_nom: projetNom ?? 'Projet',
        projet_reference: projetReference,
        lot_nom: lot.nom,
        lot_code: String((lot.ordre ?? 0) + 1),
        items,
      })
      const fileName = `CCTP_${lot.nom.replace(/\s+/g, '_')}.pdf`
      const path = `${lot.projet_id}/cctp/${lot.id}_${fileName}`
      const { error: upErr } = await supabase.storage
        .from('checklist-docs')
        .upload(path, blob, { upsert: true, contentType: 'application/pdf' })
      if (upErr) { onError(`Upload CCTP : ${upErr.message}`); return }
      const { data: pub } = supabase.storage.from('checklist-docs').getPublicUrl(path)
      const cacheBustedUrl = `${pub.publicUrl}?t=${Date.now()}`
      const { error: updErr } = await supabase
        .from('lots' as never)
        .update({ cctp_url: cacheBustedUrl, cctp_nom_fichier: fileName } as never)
        .eq('id', lot.id)
      if (updErr) { onError(`MAJ CCTP : ${updErr.message}`); return }
      await onUpdated()
    } finally {
      setGenerating(false)
    }
  }

  const hasLignes = (lignesCount ?? 0) > 0

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900"><Abbr k="CCTP" /> — Cahier des Clauses Techniques</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Genere automatiquement depuis les designations des metres et chiffrages — sans quantites ni prix.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || !hasLignes}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:bg-gray-300 disabled:cursor-not-allowed flex-shrink-0"
          title={hasLignes ? 'Generer le CCTP a partir des metres' : 'Renseignez d\'abord les lignes dans l\'onglet Metres'}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {generating ? 'Generation…' : (lot.cctp_url ? 'Regenerer' : 'Generer le CCTP')}
        </button>
      </div>

      {!hasLignes && lignesCount !== null && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-md px-3 py-2 text-xs mb-3">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Aucune ligne dans les metres pour ce lot. Le CCTP sera genere une fois les designations renseignees.</span>
        </div>
      )}

      {cctpStale && hasLignes && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-md px-3 py-2 text-xs mb-3">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Le lot a ete modifie depuis la derniere generation. Cliquez sur <strong>Regenerer</strong> pour mettre a jour le <Abbr k="CCTP" />.</span>
        </div>
      )}

      {lot.cctp_url ? (
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
          <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="flex-1 text-sm text-gray-900 truncate">{lot.cctp_nom_fichier ?? <><Abbr k="CCTP" />.pdf</>}</span>
          <a
            href={lot.cctp_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 border border-gray-200 rounded hover:bg-white"
          >
            <Download className="w-3 h-3" /> Telecharger
          </a>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-md px-4 py-6 text-center text-sm text-gray-500">
          {hasLignes
            ? 'Cliquez sur « Generer le CCTP » pour produire le document a partir des metres.'
            : 'Le CCTP sera disponible une fois les metres renseignes.'}
        </div>
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
  const [sharedLink, setSharedLink] = useState<{ token: string; code: string } | null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)

  function copyLink(token: string | null, id: string) {
    if (!token) return
    navigator.clipboard.writeText(dceLink(token))
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

  async function generateShareableLink() {
    setGeneratingLink(true)
    const token = crypto.randomUUID()
    const { data, error } = await supabase
      .from('dce_acces_st' as never)
      .insert({
        lot_id: lot.id,
        projet_id: lot.projet_id,
        type_acces: 'externe',
        st_nom: '',
        st_societe: null,
        st_email: '',
        st_telephone: null,
        date_limite: null,
        statut: 'envoye',
        token,
      } as never)
      .select('token, code_acces')
      .single()
    setGeneratingLink(false)
    if (error || !data) { onError(`Génération lien : ${error?.message ?? 'erreur'}`); return }
    const row = data as unknown as { token: string; code_acces: string }
    setSharedLink({ token: row.token, code: row.code_acces })
    await onChanged()
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Sous-traitants consultés</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={generateShareableLink}
            disabled={generatingLink}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-60"
            title="Crée un lien public non nominatif — le ST renseigne son identité à l'ouverture"
          >
            <Copy className="w-3.5 h-3.5" />
            {generatingLink ? 'Génération…' : 'Lien partageable'}
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-black"
          >
            <Plus className="w-3.5 h-3.5" />
            Inviter un <Abbr k="ST" />
          </button>
        </div>
      </div>

      {acces.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Aucun sous-traitant invité</p>
      ) : (
        <ul className="space-y-2">
          {acces.map((a) => {
            const st = STATUT_LABEL[a.statut] ?? STATUT_LABEL.envoye
            const isInterne = a.type_acces === 'interne'
            return (
              <li key={a.id} className="border border-gray-200 rounded-md p-3">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0',
                      isInterne ? 'bg-[#E6F1FB] text-[#185FA5]' : 'bg-[#F1EFE8] text-[#5F5E5A]',
                    )}
                    aria-hidden
                  >
                    {isInterne ? <UserIcon className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{a.st_nom}</span>
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-medium',
                          isInterne
                            ? 'bg-[#E6F1FB] text-[#185FA5]'
                            : 'bg-[#F1EFE8] text-[#5F5E5A]',
                        )}
                      >
                        {isInterne ? 'Interne' : 'Externe'}
                      </span>
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
                    {!isInterne && a.token && (
                      <button
                        onClick={() => copyLink(a.token, a.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 border border-gray-200 rounded hover:bg-gray-50"
                      >
                        {copiedId === a.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                        {copiedId === a.id ? 'Copié' : 'Copier le lien'}
                      </button>
                    )}
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
      {sharedLink && (
        <ShareableLinkModal token={sharedLink.token} code={sharedLink.code} onClose={() => setSharedLink(null)} />
      )}
    </div>
  )
}

// ─── Modal Lien partageable (non nominatif) ─────────────────────────────────

function ShareableLinkModal({ token, code, onClose }: { token: string; code: string; onClose: () => void }) {
  const [copiedKey, setCopiedKey] = useState<'code' | 'url' | null>(null)
  const url = dceLink(token)

  function copy(kind: 'code' | 'url', value: string) {
    navigator.clipboard.writeText(value)
    setCopiedKey(kind)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Accès <Abbr k="ST" /> généré</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-700">
            Transmettez ce <strong>code d&apos;accès</strong> au(x) <Abbr k="ST" /> — il suffit de le saisir sur
            la page de connexion (section <em>« Répondre à un appel d&apos;offre »</em>) pour
            accéder au <Abbr k="DCE" /> et déposer une offre.
          </p>

          {/* Code d'acces */}
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Code d&apos;accès</p>
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-3">
              <code className="flex-1 text-xl font-mono font-bold text-amber-900 tracking-widest">
                {code}
              </code>
              <button
                onClick={() => copy('code', code)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-amber-600 rounded hover:bg-amber-700"
              >
                {copiedKey === 'code' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedKey === 'code' ? 'Copié' : 'Copier le code'}
              </button>
            </div>
          </div>

          {/* Lien direct alternatif */}
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Ou lien direct</p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
              <code className="flex-1 text-xs text-gray-700 truncate">{url}</code>
              <button
                onClick={() => copy('url', url)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-gray-900 rounded hover:bg-black"
              >
                {copiedKey === 'url' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedKey === 'url' ? 'Copié' : 'Copier'}
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Le <Abbr k="ST" /> renseignera son identité (nom, société, email) au premier accès, puis remplira le <Abbr k="DPGF" />.
            Son offre apparaîtra automatiquement dans le comparatif <Abbr k="ST" />.
          </p>
          <button
            onClick={onClose}
            className="w-full mt-1 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black"
          >
            Fermer
          </button>
        </div>
      </div>
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

// ─── Modal Invitation ST (2 onglets : externe / interne) ─────────────────────

type StInterne = {
  id: string
  nom: string
  prenom: string
  email: string
  societe: string | null
}

function initials(prenom: string, nom: string): string {
  const p = (prenom?.[0] ?? '').toUpperCase()
  const n = (nom?.[0] ?? '').toUpperCase()
  return `${p}${n}` || '?'
}

function InviteModal({ lot, onClose, onCreated, onError }: {
  lot: Lot
  onClose: () => void
  onCreated: () => Promise<void>
  onError: (m: string) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [tab, setTab] = useState<'externe' | 'interne'>('externe')

  // ── Etat partagé
  const [saving, setSaving] = useState(false)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [createdInterne, setCreatedInterne] = useState<{ prenom: string; nom: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // ── Externe
  const [extNom, setExtNom] = useState('')
  const [extSociete, setExtSociete] = useState('')
  const [extEmail, setExtEmail] = useState('')
  const [extTel, setExtTel] = useState('')
  const [extDateLimite, setExtDateLimite] = useState('')

  // ── Interne : sous-traitants qui ont un compte dans l'app (role/categorie = 'st')
  const [stInternes, setStInternes] = useState<StInterne[]>([])
  const [loadingSt, setLoadingSt] = useState(true)
  const [stSearch, setStSearch] = useState('')
  const [stSelected, setStSelected] = useState<StInterne | null>(null)
  const [intDateLimite, setIntDateLimite] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadInternes() {
      const [userRes, baseRes] = await Promise.all([
        supabase
          .schema('app')
          .from('utilisateurs')
          .select('id, email, nom, prenom, role, categorie')
          .eq('actif', true)
          .or('role.eq.st,categorie.eq.st')
          .order('nom'),
        supabase
          .schema('app')
          .from('sous_traitants')
          .select('raison_sociale, contact_email')
          .eq('statut', 'actif'),
      ])
      if (cancelled) return
      if (userRes.error) onError(`Chargement ST internes : ${userRes.error.message}`)

      // Index société par email pour enrichir l'affichage.
      const societeByEmail = new Map<string, string>()
      ;(baseRes.data ?? []).forEach((r: any) => {
        if (r.contact_email) societeByEmail.set(String(r.contact_email).toLowerCase(), r.raison_sociale ?? '')
      })

      const rows = ((userRes.data ?? []) as Array<{ id: string; email: string; nom: string; prenom: string }>).map((u): StInterne => ({
        id: u.id,
        nom: u.nom ?? '',
        prenom: u.prenom ?? '',
        email: u.email,
        societe: societeByEmail.get((u.email ?? '').toLowerCase()) || null,
      }))
      setStInternes(rows)
      setLoadingSt(false)
    }
    loadInternes()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stFiltered = stInternes.filter((s) => {
    if (!stSearch.trim()) return true
    const q = stSearch.toLowerCase()
    return (
      s.nom.toLowerCase().includes(q) ||
      s.prenom.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.societe?.toLowerCase().includes(q) ?? false)
    )
  })

  async function handleCreateExterne() {
    if (!extNom.trim() || !extEmail.trim()) {
      onError('Nom et email sont obligatoires.')
      return
    }
    setSaving(true)
    const token = crypto.randomUUID()
    const { data, error } = await supabase
      .from('dce_acces_st' as never)
      .insert({
        lot_id: lot.id,
        projet_id: lot.projet_id,
        type_acces: 'externe',
        st_nom: extNom.trim(),
        st_societe: extSociete.trim() || null,
        st_email: extEmail.trim(),
        st_telephone: extTel.trim() || null,
        date_limite: extDateLimite || null,
        statut: 'envoye',
        token,
      } as never)
      .select('token')
      .single()
    setSaving(false)
    if (error) { onError(`Création invitation : ${error.message}`); return }
    setCreatedToken((data as unknown as { token: string }).token)
    await onCreated()
  }

  async function handleCreateInterne() {
    if (!stSelected) return
    setSaving(true)
    const fullName = `${stSelected.prenom} ${stSelected.nom}`.trim()
    const { data, error } = await supabase
      .from('dce_acces_st' as never)
      .insert({
        lot_id: lot.id,
        projet_id: lot.projet_id,
        type_acces: 'interne',
        st_nom: fullName,
        st_societe: stSelected.societe,
        st_email: stSelected.email,
        st_telephone: null,
        date_limite: intDateLimite || null,
        statut: 'envoye',
        token: null,
        user_id: stSelected.id,
      } as never)
      .select('id')
      .single()
    if (error || !data) {
      setSaving(false)
      onError(`Création invitation : ${error?.message ?? 'erreur'}`)
      return
    }
    const accesId = (data as unknown as { id: string }).id
    // Alerte cloche pour le ST (utilisateurs.id = auth.uid())
    await supabase.schema('app').from('alertes').insert({
      projet_id: lot.projet_id,
      utilisateur_id: stSelected.id,
      type: 'dce_invitation',
      titre: `Invitation DCE — ${lot.nom}`,
      message: `Vous êtes invité à soumettre une offre pour le lot « ${lot.nom} ».`,
      priorite: 'normal',
      lue: false,
      metadata: { url: `/st/dce/interne/${lot.id}/${accesId}` },
    })
    setSaving(false)
    setCreatedInterne({ prenom: stSelected.prenom, nom: stSelected.nom })
    await onCreated()
  }

  function copyLink() {
    if (!createdToken) return
    navigator.clipboard.writeText(dceLink(createdToken))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const showSuccess = createdToken || createdInterne

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-semibold text-gray-900">
            {showSuccess ? 'Invitation créée' : 'Inviter un sous-traitant'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {createdToken ? (
          <div className="p-5 space-y-3">
            <p className="text-sm text-gray-700">Envoyez ce lien au <Abbr k="ST" /> par email ou WhatsApp :</p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
              <code className="flex-1 text-xs text-gray-700 truncate">
                {dceLink(createdToken)}
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
        ) : createdInterne ? (
          <div className="p-5 space-y-3">
            <div className="bg-[#E6F1FB] border border-[#C5DDF3] text-[#185FA5] rounded-md p-3 text-sm flex items-start gap-2">
              <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Invitation envoyée à {createdInterne.prenom} {createdInterne.nom}</p>
                <p className="text-xs mt-1">L'employé recevra une notification et pourra accéder au dossier <Abbr k="DCE" /> depuis son compte.</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black"
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            {/* Onglets */}
            <div className="px-5 pt-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex gap-1">
                {(['externe', 'interne'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      'px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors',
                      tab === t
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-transparent text-gray-500 border-transparent hover:text-gray-700',
                    )}
                  >
                    {t === 'externe' ? <><Abbr k="ST" /> externe</> : 'Utilisateur interne'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {tab === 'externe' ? (
                <div className="p-5 space-y-3">
                  <p className="text-xs text-gray-500">
                    Invite un <Abbr k="ST" /> qui n'a pas de compte dans l'app. Un lien public sera généré à transmettre par email ou WhatsApp.
                  </p>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nom du contact *</label>
                    <input
                      type="text"
                      value={extNom}
                      onChange={(e) => setExtNom(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Société</label>
                    <input
                      type="text"
                      value={extSociete}
                      onChange={(e) => setExtSociete(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Email *</label>
                    <input
                      type="email"
                      value={extEmail}
                      onChange={(e) => setExtEmail(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Téléphone</label>
                    <input
                      type="tel"
                      value={extTel}
                      onChange={(e) => setExtTel(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Date limite de remise</label>
                    <input
                      type="date"
                      value={extDateLimite}
                      onChange={(e) => setExtDateLimite(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="px-5 py-3 border-b border-gray-200">
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={stSearch}
                        onChange={(e) => setStSearch(e.target.value)}
                        placeholder="Rechercher un ST interne (nom, prénom, email, société)…"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="max-h-[320px] overflow-y-auto">
                    {loadingSt ? (
                      <div className="text-sm text-gray-400 py-8 text-center">Chargement…</div>
                    ) : stFiltered.length === 0 ? (
                      <div className="text-sm text-gray-400 py-8 text-center">
                        {stInternes.length === 0 ? <>Aucun <Abbr k="ST" /> interne actif dans l&apos;app</> : 'Aucun résultat'}
                      </div>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {stFiltered.map((s) => {
                          const isSelected = stSelected?.id === s.id
                          return (
                            <li key={s.id}>
                              <button
                                onClick={() => setStSelected(s)}
                                className={cn(
                                  'w-full px-5 py-3 text-left transition-colors flex items-center gap-3',
                                  isSelected ? 'bg-[#E6F1FB] border-l-[3px] border-[#185FA5]' : 'hover:bg-gray-50',
                                )}
                              >
                                <div className="w-9 h-9 rounded-full bg-[#E6F1FB] text-[#185FA5] flex items-center justify-center text-xs font-semibold flex-shrink-0">
                                  {initials(s.prenom, s.nom)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-900">{s.prenom} {s.nom}</div>
                                  <div className="text-xs text-gray-500">
                                    {s.societe ? `${s.societe} — ${s.email}` : s.email}
                                  </div>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-[#185FA5] flex-shrink-0" />}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                  <div className="px-5 py-3 border-t border-gray-200">
                    <label className="block text-xs text-gray-500 mb-1">Date limite de remise</label>
                    <input
                      type="date"
                      value={intDateLimite}
                      onChange={(e) => setIntDateLimite(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 flex-shrink-0 flex justify-end gap-2">
              <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
              {tab === 'externe' ? (
                <button
                  onClick={handleCreateExterne}
                  disabled={saving || !extNom.trim() || !extEmail.trim()}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:bg-gray-300"
                >
                  {saving ? 'Création…' : 'Inviter'}
                </button>
              ) : (
                <button
                  onClick={handleCreateInterne}
                  disabled={saving || !stSelected}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:bg-gray-300"
                >
                  {saving ? 'Création…' : 'Inviter'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Drawer Offre ─────────────────────────────────────────────────────────────

type DocStEco = { id: string; type_doc: string; nom_fichier: string; url: string; date_validite: string | null; statut: string; commentaire: string | null }

const DOC_TYPE_LABELS: Record<string, React.ReactNode> = {
  kbis: <Abbr k="Kbis" />, urssaf: <Abbr k="URSSAF" />, rib: <Abbr k="RIB" />, attestation_fiscale: 'Attestation fiscale',
  rc_pro: <Abbr k="RC Pro" />, decennale: 'Decennale', qualification: 'Qualification',
  salaries_etrangers: 'Salaries etrangers', autre: 'Autre',
}

const DOC_STATUT_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  depose:  { bg: '#E6F1FB', color: '#185FA5', label: 'Depose' },
  valide:  { bg: '#EAF3DE', color: '#3B6D11', label: 'Valide' },
  expire:  { bg: '#FAEEDA', color: '#854F0B', label: 'Expire' },
  refuse:  { bg: '#FCEBEB', color: '#A32D2D', label: 'Refuse' },
}

function OffreDrawer({ acces, onClose }: { acces: AccesST; onClose: () => void }) {
  const supabase = useMemo(() => createClient(), [])
  const [offres, setOffres] = useState<Offre[]>([])
  const [docsSt, setDocsSt] = useState<DocStEco[]>([])
  const [accesCA, setAccesCA] = useState<{ ca_annuel: number | null; ratio_ca_alerte: boolean | null }>({ ca_annuel: null, ratio_ca_alerte: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('dce_offres_st' as never).select('*').eq('acces_id', acces.id),
      supabase.from('dce_docs_st').select('*').eq('acces_id', acces.id),
      supabase.from('dce_acces_st').select('ca_annuel, ratio_ca_alerte').eq('id', acces.id).single(),
    ]).then(([offresRes, docsRes, caRes]) => {
      setOffres(((offresRes.data ?? []) as unknown) as Offre[])
      setDocsSt((docsRes.data ?? []) as DocStEco[])
      const ca = caRes.data as { ca_annuel: number | null; ratio_ca_alerte: boolean | null } | null
      if (ca) setAccesCA(ca)
      setLoading(false)
    })
  }, [acces.id, supabase])

  async function updateDocStatut(docId: string, statut: string, commentaire?: string) {
    await supabase.from('dce_docs_st').update({ statut, commentaire: commentaire ?? null } as never).eq('id', docId)
    setDocsSt((prev) => prev.map((d) => (d.id === docId ? { ...d, statut, commentaire: commentaire ?? d.commentaire } : d)))
  }

  const total = offres.reduce((s, o) => s + (Number(o.total_ht) || 0), 0)
  const notes = offres[0]?.notes_st

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="ml-auto bg-white shadow-xl w-full max-w-2xl h-full overflow-y-auto relative"
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Offre — {acces.st_nom}</h3>
            <p className="text-xs text-gray-500">{acces.st_societe} · Soumise le {acces.soumis_le ? new Date(acces.soumis_le).toLocaleDateString('fr-FR') : '—'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-sm text-gray-400 py-8 text-center">Chargement…</div>
          ) : (
            <>
              {/* Alerte ratio CA */}
              {accesCA.ca_annuel != null && accesCA.ca_annuel > 0 && (
                <div className={cn(
                  'rounded-md p-3 text-sm border',
                  accesCA.ratio_ca_alerte
                    ? 'bg-[#FAEEDA] border-[#E8D4A6] text-[#854F0B]'
                    : 'bg-[#EAF3DE] border-[#C7E09A] text-[#3B6D11]',
                )}>
                  {accesCA.ratio_ca_alerte ? (
                    <p className="font-medium">
                      Ce <Abbr k="ST" /> declare un <Abbr k="CA" /> de {formatCurrency(accesCA.ca_annuel)}.
                      Le lot represente {total > 0 && accesCA.ca_annuel > 0 ? ((total / accesCA.ca_annuel) * 100).toFixed(1) : '?'}% de son <Abbr k="CA" /> annuel (seuil : 33%).
                      Verifier sa capacite financiere avant de le retenir.
                    </p>
                  ) : (
                    <p className="font-medium flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> <Abbr k="CA" /> compatible — {formatCurrency(accesCA.ca_annuel)}
                    </p>
                  )}
                </div>
              )}

              {/* Documents administratifs */}
              {docsSt.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Documents administratifs</h4>
                  <div className="space-y-1.5">
                    {docsSt.map((d) => {
                      const badge = DOC_STATUT_BADGE[d.statut] ?? DOC_STATUT_BADGE.depose
                      return (
                        <div key={d.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 truncate">{DOC_TYPE_LABELS[d.type_doc] ?? d.type_doc} — {d.nom_fichier}</p>
                            {d.date_validite && <p className="text-[11px] text-gray-400">Validite : {new Date(d.date_validite).toLocaleDateString('fr-FR')}</p>}
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: badge.bg, color: badge.color }}>
                            {badge.label}
                          </span>
                          <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 hover:text-gray-900 underline">
                            Telecharger
                          </a>
                          {d.statut === 'depose' && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => updateDocStatut(d.id, 'valide')} className="px-1.5 py-0.5 text-[10px] bg-[#EAF3DE] text-[#3B6D11] rounded">Valider</button>
                              <button onClick={() => { const c = prompt('Motif du refus ?'); if (c) updateDocStatut(d.id, 'refuse', c) }}
                                className="px-1.5 py-0.5 text-[10px] bg-[#FCEBEB] text-[#A32D2D] rounded">Refuser</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Offres */}
              {offres.length === 0 ? (
                <div className="text-sm text-gray-400 py-8 text-center">Aucune ligne dans cette offre</div>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs font-medium text-gray-500">
                        <th className="px-3 py-2">Designation</th>
                        <th className="px-3 py-2 w-20">Qte</th>
                        <th className="px-3 py-2 w-16">Unite</th>
                        <th className="px-3 py-2 w-28 text-right">PU <Abbr k="HT" /></th>
                        <th className="px-3 py-2 w-28 text-right">Total <Abbr k="HT" /></th>
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
                        <td colSpan={4} className="px-3 py-3 text-right text-gray-700">TOTAL OFFRE <Abbr k="HT" /></td>
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
