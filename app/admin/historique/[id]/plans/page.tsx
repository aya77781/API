'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { Image as ImageIcon, Layers, Download } from 'lucide-react'
import {
  type ProjetBase, Card, CardTitle, SubPageHeader,
  PHASE_LABELS, formatDate, statutColor,
} from '../_lib/shared'

interface ProjetForPlans extends ProjetBase {
  nom: string
}

interface DessinPlan {
  id: string
  type_plan: string | null
  indice: string | null
  lot: string | null
  statut: string | null
  phase: string | null
  fichier_nom: string | null
  fichier_path: string | null
  created_at: string
}

interface PlanExe {
  id: string
  indice: string | null
  statut: string | null
  fichier_nom: string | null
  fichier_url: string | null
  notes: string | null
  cr_source_id: string | null
  lot_id: string | null
  created_at: string
  lot?: { numero: number | null; corps_etat: string | null } | null
}

export default function PlansPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const projetId = params.id
  const supabase = createClient()
  const { profil, loading: userLoading } = useUser()

  const [projet, setProjet] = useState<ProjetForPlans | null>(null)
  const [dessinPlans, setDessinPlans] = useState<DessinPlan[]>([])
  const [plansExe, setPlansExe] = useState<PlanExe[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userLoading) return
    if (!profil || !['admin', 'gerant'].includes(profil.role)) {
      router.replace('/login')
    }
  }, [profil, userLoading, router])

  useEffect(() => {
    if (!projetId || userLoading) return
    async function load() {
      const { data: projetData } = await supabase
        .schema('app').from('projets')
        .select('id, nom, reference, statut, archived_at, archived_by, client_nom')
        .eq('id', projetId).single()

      if (!projetData) { setLoading(false); return }
      setProjet(projetData as ProjetForPlans)

      const [dessinRes, exeRes] = await Promise.all([
        supabase.schema('app').from('dessin_plans').select('*')
          .eq('projet_nom', projetData.nom).order('created_at', { ascending: false }),
        supabase.schema('app').from('plans_exe')
          .select('*, lot:lot_id(numero, corps_etat)')
          .eq('projet_id', projetId).order('created_at', { ascending: false }),
      ])

      setDessinPlans((dessinRes.data ?? []) as DessinPlan[])
      setPlansExe((exeRes.data ?? []) as PlanExe[])
      setLoading(false)
    }
    load()
  }, [projetId, userLoading, supabase])

  async function downloadPath(path: string | null) {
    if (!path) return
    const { data, error } = await supabase.storage.from('plans').createSignedUrl(path, 60)
    if (error || !data?.signedUrl) {
      window.alert('Téléchargement impossible')
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  const plansByPhase = useMemo(() => {
    const buckets: Record<string, DessinPlan[]> = { conception: [], lancement: [], consultation: [], chantier: [], cloture: [], autre: [] }
    for (const p of dessinPlans) {
      const k = (p.phase ?? 'autre').toLowerCase()
      if (buckets[k]) buckets[k].push(p)
      else buckets.autre.push(p)
    }
    return buckets
  }, [dessinPlans])

  const exeByLot = useMemo(() => {
    const map = new Map<string, { lot: { numero: number | null; corps_etat: string | null } | null; plans: PlanExe[] }>()
    for (const p of plansExe) {
      const key = p.lot_id ?? 'sans-lot'
      if (!map.has(key)) map.set(key, { lot: p.lot ?? null, plans: [] })
      map.get(key)!.plans.push(p)
    }
    for (const v of map.values()) {
      v.plans.sort((a, b) => (a.indice ?? '').localeCompare(b.indice ?? ''))
    }
    return Array.from(map.values())
  }, [plansExe])

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!projet) {
    return <div className="p-6 text-sm text-gray-500">Projet introuvable</div>
  }

  const phases = Object.keys(plansByPhase) as Array<keyof typeof plansByPhase>

  return (
    <div className="bg-gray-50 min-h-screen pb-12">
      <SubPageHeader projet={projet} sectionTitle="Plans" />

      <div className="p-6 space-y-4">
        <Card>
          <CardTitle icon={Layers} title="Plans conception" count={dessinPlans.length} />
          <div className="p-5 space-y-3">
            {dessinPlans.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun plan conception</p>
            ) : phases.map(phase => (
              plansByPhase[phase].length > 0 && (
                <div key={phase}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {PHASE_LABELS[phase] ?? phase}
                  </p>
                  <div className="space-y-1.5">
                    {plansByPhase[phase].map(p => (
                      <div key={p.id} className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                        <ImageIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">{p.fichier_nom ?? p.type_plan ?? '—'}</p>
                            {p.indice && (
                              <span className="text-xs font-mono text-gray-700 bg-white border border-gray-200 px-1.5 py-0.5 rounded">
                                {p.indice}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                            {p.type_plan && <span>{p.type_plan}</span>}
                            {p.lot && <span>· Lot {p.lot}</span>}
                            <span>· {formatDate(p.created_at)}</span>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${statutColor(p.statut)}`}>
                          {p.statut ?? '—'}
                        </span>
                        {p.fichier_path && (
                          <button onClick={() => downloadPath(p.fichier_path)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-white">
                            <Download className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle icon={Layers} title="Plans d'exécution" count={plansExe.length} />
          <div className="p-5 space-y-3">
            {plansExe.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun plan d'exécution</p>
            ) : exeByLot.map((g, i) => (
              <div key={i}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {g.lot
                    ? `Lot ${g.lot.numero ?? '?'} · ${g.lot.corps_etat ?? '—'}`
                    : 'Sans lot'}
                </p>
                {g.plans.length > 1 && (
                  <div className="flex items-center gap-1 mb-2 text-xs text-gray-400">
                    {g.plans.map((p, idx) => (
                      <span key={p.id} className="flex items-center gap-1">
                        <span className="font-mono font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                          {p.indice ?? '?'}
                        </span>
                        {idx < g.plans.length - 1 && <span>→</span>}
                      </span>
                    ))}
                  </div>
                )}
                <div className="space-y-1.5">
                  {g.plans.map(p => (
                    <div key={p.id} className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                      <span className="text-xs font-mono font-semibold text-gray-700 bg-white border border-gray-200 px-2 py-0.5 rounded flex-shrink-0">
                        {p.indice ?? '?'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{p.fichier_nom ?? '—'}</p>
                        {p.notes && <p className="text-xs text-gray-500 truncate">{p.notes}</p>}
                        <p className="text-xs text-gray-400">{formatDate(p.created_at)}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${statutColor(p.statut)}`}>
                        {p.statut ?? '—'}
                      </span>
                      {p.fichier_url && (
                        <a href={p.fichier_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-white">
                          <Download className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
