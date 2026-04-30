'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { Calculator, Layers, FileText, FilePlus } from 'lucide-react'
import {
  type ProjetBase, Card, CardTitle, SubPageHeader,
  formatBudget, formatDate, formatDateTime, statutColor,
} from '../_lib/shared'

interface ProjetForChiffrage extends ProjetBase {
  budget_total: number | null
}

interface ChiffrageVersion {
  id: string
  version: number | null
  montant_total: number | null
  motif_revision: string | null
  statut: string | null
  created_at: string
}

interface Lot {
  id: string
  numero: number | null
  corps_etat: string | null
  budget_prevu: number | null
  budget_final: number | null
  statut: string | null
  st_retenu_id: string | null
  st_retenu?: { raison_sociale: string | null } | null
}

interface Proposition {
  id: string
  numero: number | null
  type: string | null
  montant_ht: number | null
  statut: string | null
  date_soumission: string | null
}

interface Avenant {
  id: string
  numero: number | null
  titre: string | null
  cas: string | null
  montant_ht: number | null
  statut: string | null
}

export default function ChiffragePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const projetId = params.id
  const supabase = createClient()
  const { profil, loading: userLoading } = useUser()

  const [projet, setProjet] = useState<ProjetForChiffrage | null>(null)
  const [versions, setVersions] = useState<ChiffrageVersion[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [propositions, setPropositions] = useState<Proposition[]>([])
  const [avenants, setAvenants] = useState<Avenant[]>([])
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
        .select('id, nom, reference, statut, archived_at, archived_by, client_nom, budget_total')
        .eq('id', projetId).single()

      if (!projetData) { setLoading(false); return }
      setProjet(projetData as ProjetForChiffrage)

      const [versionsRes, lotsRes, propsRes, avenRes] = await Promise.all([
        supabase.schema('app').from('chiffrage_versions').select('*').eq('projet_id', projetId).order('version', { ascending: true }),
        supabase.schema('app').from('lots')
          .select('*, st_retenu:st_retenu_id(raison_sociale)')
          .eq('projet_id', projetId).order('numero', { ascending: true }),
        supabase.schema('app').from('propositions').select('*').eq('projet_id', projetId).order('numero', { ascending: true }),
        supabase.schema('app').from('avenants').select('*').eq('projet_id', projetId).order('numero', { ascending: true }),
      ])

      setVersions((versionsRes.data ?? []) as ChiffrageVersion[])
      setLots((lotsRes.data ?? []) as Lot[])
      setPropositions((propsRes.data ?? []) as Proposition[])
      setAvenants((avenRes.data ?? []) as Avenant[])
      setLoading(false)
    }
    load()
  }, [projetId, userLoading, supabase])

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

  const totalLotsFinal = lots.reduce((sum, l) => sum + (l.budget_final ?? 0), 0)
  const totalLotsPrevu = lots.reduce((sum, l) => sum + (l.budget_prevu ?? 0), 0)
  const marge = (projet.budget_total ?? 0) - totalLotsFinal
  const margePct = projet.budget_total && projet.budget_total > 0 ? (marge / projet.budget_total) * 100 : null
  const margeAlerte = margePct !== null && margePct < 10

  return (
    <div className="bg-gray-50 min-h-screen pb-12">
      <SubPageHeader projet={projet} sectionTitle="Chiffrage" />

      <div className="p-6 space-y-4">
        <Card>
          <CardTitle icon={Calculator} title="Versions de chiffrage" count={versions.length} />
          <div className="p-5">
            {versions.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune version</p>
            ) : (
              <div className="space-y-2">
                {versions.map(v => (
                  <div key={v.id} className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                    <span className="text-xs font-mono font-semibold text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded flex-shrink-0">
                      V{v.version ?? '?'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{formatBudget(v.montant_total)}</p>
                      {v.motif_revision && <p className="text-xs text-gray-500 truncate">{v.motif_revision}</p>}
                      <p className="text-xs text-gray-400">{formatDateTime(v.created_at)}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${statutColor(v.statut)}`}>{v.statut ?? '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle icon={Layers} title="Lots & budget" count={lots.length} />
          <div className="overflow-x-auto">
            {lots.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400">Aucun lot</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-5 py-2.5">N°</th>
                    <th className="text-left px-5 py-2.5">Corps d'état</th>
                    <th className="text-right px-5 py-2.5">Budget prévu</th>
                    <th className="text-right px-5 py-2.5">Budget final</th>
                    <th className="text-left px-5 py-2.5">ST retenu</th>
                    <th className="text-left px-5 py-2.5">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lots.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-5 py-2.5 text-gray-700 font-mono text-xs">{l.numero ?? '—'}</td>
                      <td className="px-5 py-2.5 text-gray-900">{l.corps_etat ?? '—'}</td>
                      <td className="px-5 py-2.5 text-right text-gray-600">{formatBudget(l.budget_prevu)}</td>
                      <td className="px-5 py-2.5 text-right text-gray-900 font-medium">{formatBudget(l.budget_final)}</td>
                      <td className="px-5 py-2.5 text-gray-500 text-xs">{l.st_retenu?.raison_sociale ?? '—'}</td>
                      <td className="px-5 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${statutColor(l.statut)}`}>{l.statut ?? '—'}</span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-5 py-3 text-xs uppercase tracking-wide text-gray-500" colSpan={2}>Total</td>
                    <td className="px-5 py-3 text-right text-gray-700">{formatBudget(totalLotsPrevu)}</td>
                    <td className="px-5 py-3 text-right text-gray-900">{formatBudget(totalLotsFinal)}</td>
                    <td className="px-5 py-3" colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Budget projet : <span className="font-medium text-gray-900">{formatBudget(projet.budget_total)}</span>
              <span className="mx-2">·</span>
              Marge : <span className="font-medium text-gray-900">{formatBudget(marge)}</span>
              {margePct !== null && <span className="ml-1">({margePct.toFixed(1)}%)</span>}
            </div>
            {margeAlerte && (
              <span className="text-xs px-2 py-0.5 rounded font-medium bg-red-100 text-red-700">
                Marge inférieure à 10%
              </span>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle icon={FileText} title="Propositions commerciales" count={propositions.length} />
          <div className="p-5">
            {propositions.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune proposition</p>
            ) : (
              <div className="space-y-2">
                {propositions.map(p => (
                  <div key={p.id} className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                    <span className="text-xs font-mono font-semibold text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded flex-shrink-0">
                      #{p.numero ?? '?'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{p.type ?? '—'} · {formatBudget(p.montant_ht)}</p>
                      <p className="text-xs text-gray-400">Soumise le {formatDate(p.date_soumission)}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${statutColor(p.statut)}`}>{p.statut ?? '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle icon={FilePlus} title="Avenants" count={avenants.length} />
          <div className="p-5">
            {avenants.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun avenant</p>
            ) : (
              <div className="space-y-2">
                {avenants.map(a => (
                  <div key={a.id} className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                    <span className="text-xs font-mono font-semibold text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded flex-shrink-0">
                      #{a.numero ?? '?'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.titre ?? '—'}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {a.cas && <span>{a.cas}</span>}
                        <span>·</span>
                        <span>{formatBudget(a.montant_ht)}</span>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${statutColor(a.statut)}`}>{a.statut ?? '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
