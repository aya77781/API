'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { User as UserIcon, Building2, Users as UsersIcon, ShieldCheck } from 'lucide-react'
import {
  type ProjetBase, type Utilisateur, Card, CardTitle, SubPageHeader,
  ROLE_LABELS, formatBudget, statutColor,
} from '../_lib/shared'

interface ProjetCollab extends ProjetBase {
  co_id: string | null
  commercial_id: string | null
  economiste_id: string | null
  dessinatrice_id: string | null
  client_email: string | null
  client_tel: string | null
  clients_supplementaires: unknown
}

interface AtSt {
  id: string
  nom: string | null
  corps_etat: string | null
  email: string | null
  telephone: string | null
  siret: string | null
  statut: string | null
  kbis_ok: boolean | null
  rc_ok: boolean | null
  decennale_ok: boolean | null
  urssaf_ok: boolean | null
}

interface ConsultationSt {
  id: string
  st_id: string | null
  statut: string | null
  montant_devis: number | null
  attribue: boolean | null
  sous_traitants?: { raison_sociale: string | null; contact_nom: string | null; contact_tel: string | null; contact_email: string | null; corps_etat: string[] | null } | null
}

interface AccesExterne {
  id: string
  nom: string | null
  email: string | null
  type_externe: string | null
  actif: boolean | null
}

function stStatutColor(st: AtSt): string {
  const oks = [st.kbis_ok, st.rc_ok, st.decennale_ok, st.urssaf_ok]
  const completed = oks.filter(Boolean).length
  if (completed === 4) return 'bg-green-100 text-green-700'
  if (completed >= 2) return 'bg-orange-100 text-orange-700'
  return 'bg-red-100 text-red-700'
}

export default function CollaborateursPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const projetId = params.id
  const supabase = createClient()
  const { profil, loading: userLoading } = useUser()

  const [projet, setProjet] = useState<ProjetCollab | null>(null)
  const [equipe, setEquipe] = useState<Utilisateur[]>([])
  const [atSts, setAtSts] = useState<AtSt[]>([])
  const [consultations, setConsultations] = useState<ConsultationSt[]>([])
  const [externes, setExternes] = useState<AccesExterne[]>([])
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
        .select('id, nom, reference, statut, archived_at, archived_by, client_nom, client_email, client_tel, clients_supplementaires, co_id, commercial_id, economiste_id, dessinatrice_id')
        .eq('id', projetId).single()

      if (!projetData) { setLoading(false); return }
      setProjet(projetData as ProjetCollab)

      const ids = [projetData.co_id, projetData.commercial_id, projetData.economiste_id, projetData.dessinatrice_id].filter(Boolean) as string[]

      const [equipeRes, atRes, consultRes, externesRes] = await Promise.all([
        ids.length > 0
          ? supabase.schema('app').from('utilisateurs').select('id, prenom, nom, role, email').in('id', ids)
          : Promise.resolve({ data: [] }),
        supabase.schema('app').from('at_sous_traitants').select('*').eq('projet_id', projetId),
        supabase.schema('app').from('consultations_st')
          .select('*, sous_traitants:st_id(raison_sociale, contact_nom, contact_tel, contact_email, corps_etat)')
          .eq('projet_id', projetId),
        supabase.schema('app').from('acces_externes').select('*').eq('projet_id', projetId),
      ])

      setEquipe((equipeRes.data ?? []) as Utilisateur[])
      setAtSts((atRes.data ?? []) as AtSt[])
      setConsultations((consultRes.data ?? []) as ConsultationSt[])
      setExternes((externesRes.data ?? []) as AccesExterne[])
      setLoading(false)
    }
    load()
  }, [projetId, userLoading, supabase])

  const clientsSupp = useMemo<Array<{ nom?: string; email?: string; tel?: string }>>(() => {
    const v = projet?.clients_supplementaires
    if (!v || !Array.isArray(v)) return []
    return v as Array<{ nom?: string; email?: string; tel?: string }>
  }, [projet?.clients_supplementaires])

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

  const bcExternes = externes.filter(e => e.type_externe === 'bureau_controle')

  return (
    <div className="bg-gray-50 min-h-screen pb-12">
      <SubPageHeader projet={projet} sectionTitle="Collaborateurs" />

      <div className="p-6 space-y-4">
        <Card>
          <CardTitle icon={UsersIcon} title="Équipe interne" count={equipe.length} />
          <div className="p-5">
            {equipe.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun membre assigné</p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {equipe.map(u => (
                  <div key={u.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                        <UserIcon className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <p className="text-sm font-medium text-gray-900">{u.prenom} {u.nom}</p>
                    </div>
                    <p className="text-xs text-gray-500">{ROLE_LABELS[u.role] ?? u.role}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{u.email}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle icon={Building2} title="Client(s)" count={1 + clientsSupp.length} />
          <div className="p-5 space-y-3">
            <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-xs text-gray-400">Nom : </span>{projet.client_nom ?? '—'}</div>
              <div><span className="text-xs text-gray-400">Email : </span>{projet.client_email ?? '—'}</div>
              <div><span className="text-xs text-gray-400">Tel : </span>{projet.client_tel ?? '—'}</div>
            </div>
            {clientsSupp.map((c, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 grid grid-cols-3 gap-3 text-sm">
                <div><span className="text-xs text-gray-400">Nom : </span>{c.nom ?? '—'}</div>
                <div><span className="text-xs text-gray-400">Email : </span>{c.email ?? '—'}</div>
                <div><span className="text-xs text-gray-400">Tel : </span>{c.tel ?? '—'}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle icon={UsersIcon} title="Sous-traitants (onboarding AT)" count={atSts.length} />
          <div className="p-5">
            {atSts.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun sous-traitant onboardé</p>
            ) : (
              <div className="space-y-2">
                {atSts.map(st => (
                  <div key={st.id} className="bg-gray-50 rounded-lg p-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{st.nom ?? '—'}</p>
                        {st.corps_etat && (
                          <span className="text-xs text-gray-700 bg-white border border-gray-200 px-2 py-0.5 rounded">{st.corps_etat}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
                        {st.email && <span>{st.email}</span>}
                        {st.telephone && <span>{st.telephone}</span>}
                        {st.siret && <span>SIRET : {st.siret}</span>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${stStatutColor(st)}`}>
                      {st.statut ?? 'inconnu'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle icon={UsersIcon} title="Sous-traitants consultés" count={consultations.length} />
          <div className="p-5">
            {consultations.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune consultation</p>
            ) : (
              <div className="space-y-2">
                {consultations.map(c => (
                  <div key={c.id} className="bg-gray-50 rounded-lg p-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.sous_traitants?.raison_sociale ?? '—'}</p>
                        {c.attribue && (
                          <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded font-medium">Attribué</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
                        {c.sous_traitants?.contact_nom && <span>{c.sous_traitants.contact_nom}</span>}
                        {c.sous_traitants?.contact_tel && <span>{c.sous_traitants.contact_tel}</span>}
                        {c.sous_traitants?.contact_email && <span>{c.sous_traitants.contact_email}</span>}
                        {c.montant_devis && <span>Devis : {formatBudget(c.montant_devis)}</span>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${statutColor(c.statut)}`}>
                      {c.statut ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle icon={ShieldCheck} title="Bureau de contrôle" count={bcExternes.length} />
          <div className="p-5">
            {bcExternes.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun bureau de contrôle</p>
            ) : (
              <div className="space-y-2">
                {bcExternes.map(b => (
                  <div key={b.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{b.nom ?? '—'}</p>
                      <p className="text-xs text-gray-500">{b.email ?? '—'}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${b.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {b.actif ? 'Actif' : 'Inactif'}
                    </span>
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
