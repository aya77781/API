'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileWarning, Plus, Eye } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { NouvelAvenantModal } from '@/components/economiste/NouvelAvenantModal'
import {
  AvenantDetailDrawer,
  type AvenantFull,
} from '@/components/economiste/AvenantDetailDrawer'

type Cas = 'avant_debut' | 'pendant' | 'apres_fin'
type AvenantStatut =
  | 'ouvert' | 'chiffre' | 'devis_recu' | 'valide_co' | 'valide_client' | 'integre' | 'refuse'

const CAS_BADGE: Record<Cas, { label: string; bg: string; fg: string }> = {
  avant_debut: { label: 'Avant démarrage', bg: '#E6F1FB', fg: '#185FA5' },
  pendant:     { label: 'En cours de lot', bg: '#FAEEDA', fg: '#854F0B' },
  apres_fin:   { label: 'Post-lot',        bg: '#FCEBEB', fg: '#A32D2D' },
}

const STATUT_BADGE: Record<AvenantStatut, { label: string; bg: string; fg: string }> = {
  ouvert:        { label: 'Ouvert',        bg: '#F1EFE8', fg: '#5F5E5A' },
  chiffre:       { label: 'Chiffré',       bg: '#FAEEDA', fg: '#854F0B' },
  devis_recu:    { label: 'Devis reçu',    bg: '#FAEEDA', fg: '#854F0B' },
  valide_co:     { label: 'Validé CO',     bg: '#E6F1FB', fg: '#185FA5' },
  valide_client: { label: 'Validé client', bg: '#EAF3DE', fg: '#3B6D11' },
  integre:       { label: 'Intégré',       bg: '#085041', fg: '#9FE1CB' },
  refuse:        { label: 'Refusé',        bg: '#FCEBEB', fg: '#A32D2D' },
}

function fmtEur(n: number | null | undefined): string {
  const v = Number(n ?? 0)
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} € HT`
}

export default function AvenantsPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const [avenants, setAvenants] = useState<AvenantFull[]>([])
  const [stNameByAccesId, setStNameByAccesId] = useState<Record<string, string>>({})
  const [fetching, setFetching] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<AvenantFull | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setFetching(true)
    const supabase = createClient()

    const { data: projets } = await supabase
      .schema('app')
      .from('projets')
      .select('id, nom, reference, statut')
      .eq('economiste_id', user.id)

    if (!projets?.length) { setAvenants([]); setFetching(false); return }

    const projetIds = projets.map((p) => p.id)

    // Enrichissement projet : budget_client_ht est dans public.projets
    const { data: projetsPublic } = await supabase
      .from('projets' as never)
      .select('id, budget_client_ht')
      .in('id', projetIds)

    const budgetById = new Map<string, number | null>()
    ;(((projetsPublic ?? []) as Array<{ id: string; budget_client_ht: number | null }>)).forEach((p) => {
      budgetById.set(p.id, p.budget_client_ht)
    })

    const [avRes, lotsRes] = await Promise.all([
      supabase
        .schema('app')
        .from('avenants')
        .select('*')
        .in('projet_id', projetIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('lots' as never)
        .select('id, nom, planning_debut, planning_fin, total_ht')
        .in('projet_id', projetIds),
    ])

    const rows = ((avRes.data ?? []) as unknown) as Array<{
      id: string; projet_id: string; lot_id: string | null
      numero: number; code: string | null; titre: string | null; description: string
      cas: Cas | null; acces_st_id: string | null; devis_id: string | null
      montant_ht: number | null; statut: AvenantStatut
      created_by: string | null; created_at: string
    }>

    const lotById = new Map<string, { nom: string; planning_debut: string | null; planning_fin: string | null; total_ht: number | null }>()
    ;((lotsRes.data ?? []) as Array<{ id: string; nom: string; planning_debut: string | null; planning_fin: string | null; total_ht: number | null }>)
      .forEach((l) => lotById.set(l.id, { nom: l.nom, planning_debut: l.planning_debut, planning_fin: l.planning_fin, total_ht: l.total_ht }))

    // Créateurs
    const creatorIds = Array.from(new Set(rows.map((r) => r.created_by).filter((v): v is string => !!v)))
    let creatorNames = new Map<string, string>()
    if (creatorIds.length > 0) {
      const { data: users } = await supabase
        .schema('app')
        .from('utilisateurs')
        .select('id, nom, prenom')
        .in('id', creatorIds)
      ;((users ?? []) as Array<{ id: string; nom: string; prenom: string }>).forEach((u) => {
        creatorNames.set(u.id, `${u.prenom ?? ''} ${u.nom ?? ''}`.trim())
      })
    }

    // ST names via acces
    const accesIds = Array.from(new Set(rows.map((r) => r.acces_st_id).filter((v): v is string => !!v)))
    const stMap: Record<string, string> = {}
    if (accesIds.length > 0) {
      const { data: accesRows } = await supabase
        .from('dce_acces_st' as never)
        .select('id, st_nom, st_societe')
        .in('id', accesIds)
      ;(((accesRows ?? []) as Array<{ id: string; st_nom: string | null; st_societe: string | null }>)).forEach((a) => {
        stMap[a.id] = a.st_societe || a.st_nom || '—'
      })
    }

    const enriched: AvenantFull[] = rows.map((r) => {
      const projet = projets.find((p) => p.id === r.projet_id)
      const lot    = r.lot_id ? lotById.get(r.lot_id) : null
      return {
        id:              r.id,
        projet_id:       r.projet_id,
        lot_id:          r.lot_id,
        numero:          r.numero,
        code:            r.code,
        titre:           r.titre,
        description:     r.description,
        cas:             r.cas,
        acces_st_id:     r.acces_st_id,
        devis_id:        r.devis_id,
        montant_ht:      r.montant_ht,
        statut:          r.statut,
        created_by:      r.created_by,
        created_at:      r.created_at,
        projet_nom:      projet?.nom ?? '—',
        projet_reference: projet?.reference ?? null,
        lot_nom:         lot?.nom ?? null,
        lot_planning_debut: lot?.planning_debut ?? null,
        lot_planning_fin:   lot?.planning_fin ?? null,
        lot_total_ht:       lot?.total_ht ?? null,
        projet_budget_client_ht: budgetById.get(r.projet_id) ?? null,
        creator_nom:     r.created_by ? creatorNames.get(r.created_by) ?? null : null,
      }
    })

    setAvenants(enriched)
    setStNameByAccesId(stMap)
    setFetching(false)
  }, [user])

  useEffect(() => { load() }, [load])

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  const aTraiter  = avenants.filter((a) => a.statut === 'ouvert' || a.statut === 'devis_recu' || a.statut === 'chiffre')
  const historique = avenants.filter((a) => a.statut === 'valide_co' || a.statut === 'valide_client' || a.statut === 'integre' || a.statut === 'refuse')

  return (
    <div>
      <TopBar
        title="Avenants"
        subtitle={`${aTraiter.length} à chiffrer · ${avenants.length} au total`}
      />

      <div className="p-6 space-y-6">
        {/* Bouton création */}
        <div className="flex items-center justify-end">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-black"
          >
            <Plus className="w-4 h-4" /> Nouvel avenant
          </button>
        </div>

        {avenants.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-16 text-center">
            <FileWarning className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-sm font-medium text-gray-700">Aucun avenant</p>
            <p className="text-xs text-gray-400 mt-1">
              Créez un avenant via le bouton « Nouvel avenant » pour démarrer.
            </p>
          </div>
        ) : (
          <>
            <Section
              title="À traiter"
              avenants={aTraiter}
              stNameByAccesId={stNameByAccesId}
              onView={setSelected}
              empty="Aucun avenant à traiter."
            />
            <Section
              title="Historique"
              avenants={historique}
              stNameByAccesId={stNameByAccesId}
              onView={setSelected}
              empty="Aucun avenant archivé."
            />
          </>
        )}
      </div>

      {showModal && user && (
        <NouvelAvenantModal
          userId={user.id}
          onClose={() => { setShowModal(false); load() }}
          onCreated={({ projetId, lotId }) => {
            setShowModal(false)
            router.push(`/economiste/projets/${projetId}?tab=chiffrage&lot=${lotId}`)
          }}
        />
      )}

      {selected && (
        <AvenantDetailDrawer
          avenant={avenants.find((a) => a.id === selected.id) ?? selected}
          onClose={() => setSelected(null)}
          onChanged={() => load()}
        />
      )}
    </div>
  )
}

function Section({
  title, avenants, stNameByAccesId, onView, empty,
}: {
  title: string
  avenants: AvenantFull[]
  stNameByAccesId: Record<string, string>
  onView: (a: AvenantFull) => void
  empty: string
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      {avenants.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-card p-6 text-xs text-gray-400 text-center">
          {empty}
        </div>
      ) : (
        avenants.map((a) => (
          <AvenantCard
            key={a.id}
            avenant={a}
            stName={a.acces_st_id ? stNameByAccesId[a.acces_st_id] ?? null : null}
            onView={() => onView(a)}
          />
        ))
      )}
    </div>
  )
}

function AvenantCard({
  avenant, stName, onView,
}: {
  avenant: AvenantFull
  stName: string | null
  onView: () => void
}) {
  const cBadge = avenant.cas ? CAS_BADGE[avenant.cas] : null
  const sBadge = STATUT_BADGE[avenant.statut]

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4 hover:border-gray-300 transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono text-gray-500">
              {avenant.code ?? `AVN-${String(avenant.numero).padStart(3, '0')}`}
            </span>
            {cBadge && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{ background: cBadge.bg, color: cBadge.fg }}
              >
                {cBadge.label}
              </span>
            )}
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ background: sBadge.bg, color: sBadge.fg }}
            >
              {sBadge.label}
            </span>
          </div>

          <p className="text-sm font-semibold text-gray-900 truncate">
            {avenant.titre ?? avenant.description?.slice(0, 80) ?? 'Avenant sans titre'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {avenant.projet_reference ? `[${avenant.projet_reference}] ` : ''}
            {avenant.projet_nom}
            {avenant.lot_nom && <span className="text-gray-400"> · {avenant.lot_nom}</span>}
          </p>
          {stName && (
            <p className="text-xs text-gray-400 mt-1">ST consulté : {stName}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="text-right">
            {avenant.montant_ht ? (
              <p className="text-sm font-semibold text-gray-900">{fmtEur(avenant.montant_ht)}</p>
            ) : (
              <p className="text-xs text-gray-400">À chiffrer</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(avenant.created_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
          <button
            onClick={onView}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            <Eye className="w-3 h-3" /> Voir
          </button>
        </div>
      </div>
    </div>
  )
}
