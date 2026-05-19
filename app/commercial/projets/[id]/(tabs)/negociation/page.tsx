import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Handshake } from 'lucide-react'
import { PropositionsTimeline } from '../../conception/components/PropositionsTimeline'
import { RetourClientForm } from '../../conception/components/RetourClientForm'

export const dynamic = 'force-dynamic'

export default async function NegociationPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const projetId = params.id

  const [
    { data: projet },
    { data: demandes },
    { data: propositions },
  ] = await Promise.all([
    supabase
      .schema('app')
      .from('projets')
      .select('id, dessinatrice_id, economiste_id, statut_commercial')
      .eq('id', projetId)
      .single(),
    supabase
      .schema('app')
      .from('demandes_travail')
      .select('*')
      .eq('projet_id', projetId)
      .order('date_demande', { ascending: false }),
    supabase
      .schema('app')
      .from('propositions')
      .select('*')
      .eq('projet_id', projetId)
      .order('numero', { ascending: true }),
  ])

  if (!projet) return notFound()

  const propositionEnvoyee = (propositions ?? []).find(p => p.statut === 'envoyee' && !p.is_archived)

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Handshake className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Négociation commerciale</h2>
            <p className="text-xs text-gray-500 mt-1">
              Suivez les propositions envoyées au client, enregistrez ses retours et faites évoluer votre offre jusqu&apos;à validation.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Timeline des propositions</h2>
        <PropositionsTimeline
          propositions={propositions ?? []}
          demandes={demandes ?? []}
          projetId={projetId}
        />
      </section>

      {propositionEnvoyee && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Retour client</h2>
          <RetourClientForm
            projetId={projetId}
            proposition={propositionEnvoyee}
            dessinatriceProjetId={projet.dessinatrice_id}
            economisteProjetId={projet.economiste_id}
          />
        </section>
      )}

      {!propositionEnvoyee && (
        <p className="text-sm text-gray-400">
          Aucune proposition n&apos;est actuellement en attente de retour client. Le formulaire de retour apparaîtra dès qu&apos;une proposition sera envoyée.
        </p>
      )}
    </div>
  )
}
