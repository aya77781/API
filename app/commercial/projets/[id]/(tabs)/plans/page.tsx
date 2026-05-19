import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { BriefClientForm } from '../../conception/components/BriefClientForm'
import { DemandesActions } from '../../conception/components/DemandesActions'
import { PropositionsTimeline } from '../../conception/components/PropositionsTimeline'

export const dynamic = 'force-dynamic'

export default async function PlansPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const projetId = params.id

  const [
    { data: projet },
    { data: brief },
    { data: demandes },
    { data: propositions },
    { data: utilisateurs },
  ] = await Promise.all([
    supabase
      .schema('app')
      .from('projets')
      .select('id, dessinatrice_id, economiste_id')
      .eq('id', projetId)
      .single(),
    supabase.schema('app').from('brief_client').select('*').eq('projet_id', projetId).maybeSingle(),
    supabase
      .schema('app')
      .from('demandes_travail')
      .select('*')
      .eq('projet_id', projetId)
      .in('type', ['plan_intention', 'plan_proposition', 'plan_apd'])
      .order('date_demande', { ascending: false }),
    supabase
      .schema('app')
      .from('propositions')
      .select('*')
      .eq('projet_id', projetId)
      .order('numero', { ascending: true }),
    supabase
      .schema('app')
      .from('utilisateurs')
      .select('id, prenom, nom, role')
      .eq('actif', true)
      .in('role', ['dessinatrice', 'economiste']),
  ])

  if (!projet) return notFound()

  const dessinatrices = (utilisateurs ?? []).filter(u => u.role === 'dessinatrice')
  const economistes = (utilisateurs ?? []).filter(u => u.role === 'economiste')

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Brief client</h2>
        <BriefClientForm projetId={projetId} brief={brief ?? null} />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Demander un plan</h2>
        <DemandesActions
          projetId={projetId}
          briefRempli={!!brief?.besoin_exprime || !!brief?.budget_evoque}
          dessinatrices={dessinatrices}
          economistes={economistes}
          dessinatriceProjetId={projet.dessinatrice_id}
          economisteProjetId={projet.economiste_id}
          demandes={demandes ?? []}
          propositions={propositions ?? []}
        />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Historique des plans</h2>
        <PropositionsTimeline
          propositions={propositions ?? []}
          demandes={demandes ?? []}
          projetId={projetId}
        />
      </section>
    </div>
  )
}
