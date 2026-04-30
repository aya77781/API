'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { Building2, User as UserIcon, Calculator, ShieldCheck } from 'lucide-react'
import {
  type Projet, Card, CardTitle, Field, SubPageHeader,
  formatBudget, formatDate,
} from '../_lib/shared'

export default function InformationsPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const projetId = params.id
  const supabase = createClient()
  const { profil, loading: userLoading } = useUser()

  const [projet, setProjet] = useState<Projet | null>(null)
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
      const { data } = await supabase.schema('app').from('projets').select('*').eq('id', projetId).single()
      setProjet(data as Projet | null)
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

  return (
    <div className="bg-gray-50 min-h-screen pb-12">
      <SubPageHeader projet={projet} sectionTitle="Informations" />

      <div className="p-6 space-y-4">
        <Card>
          <CardTitle icon={Building2} title="Identité du projet" />
          <div className="p-5 grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Nom" value={projet.nom} />
            <Field label="Référence" value={projet.reference} />
            <Field label="Type de chantier" value={projet.type_chantier} />
            <Field label="Surface" value={projet.surface_m2 ? `${projet.surface_m2} m²` : '—'} />
            <Field label="Adresse" value={projet.adresse} />
            <Field label="Urgence" value={projet.urgence} />
            <Field label="Maturité client" value={projet.maturite_client} />
            <Field label="Source client" value={projet.source_client} />
          </div>
        </Card>

        <Card>
          <CardTitle icon={UserIcon} title="Client" />
          <div className="p-5 grid grid-cols-3 gap-x-6 gap-y-4">
            <Field label="Nom" value={projet.client_nom} />
            <Field label="Email" value={projet.client_email} />
            <Field label="Téléphone" value={projet.client_tel} />
          </div>
          {clientsSupp.length > 0 && (
            <div className="border-t border-gray-100 px-5 py-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Clients supplémentaires</p>
              <div className="space-y-2">
                {clientsSupp.map((c, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 grid grid-cols-3 gap-3 text-sm">
                    <div><span className="text-xs text-gray-400">Nom : </span>{c.nom ?? '—'}</div>
                    <div><span className="text-xs text-gray-400">Email : </span>{c.email ?? '—'}</div>
                    <div><span className="text-xs text-gray-400">Tel : </span>{c.tel ?? '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle icon={Calculator} title="Budget & planning" />
          <div className="p-5 grid grid-cols-3 gap-x-6 gap-y-4">
            <Field label="Budget total" value={formatBudget(projet.budget_total)} />
            <Field label="Date début" value={formatDate(projet.date_debut)} />
            <Field label="Date livraison" value={formatDate(projet.date_livraison)} />
            <Field label="Date signature" value={formatDate(projet.date_signature)} />
            <Field label="Apporteur d'affaire" value={projet.apporteur_affaire} />
          </div>
        </Card>

        <Card>
          <CardTitle icon={ShieldCheck} title="Psychologie client (transmis au CO)" />
          <div className="p-5 space-y-4">
            <Field label="Psychologie client" value={<span className="whitespace-pre-wrap">{projet.psychologie_client ?? ''}</span>} />
            <Field label="Infos hors contrat" value={<span className="whitespace-pre-wrap">{projet.infos_hors_contrat ?? ''}</span>} />
            <Field label="Alertes clés" value={<span className="whitespace-pre-wrap">{projet.alertes_cles ?? ''}</span>} />
            <Field label="Remarque" value={<span className="whitespace-pre-wrap">{projet.remarque ?? ''}</span>} />
          </div>
        </Card>
      </div>
    </div>
  )
}
