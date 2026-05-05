import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BriefClientForm } from './components/BriefClientForm'
import { NoticesCommercialesEditor } from './components/NoticesCommercialesEditor'
import { DemandesActions } from './components/DemandesActions'
import { PropositionsTimeline } from './components/PropositionsTimeline'
import { RetourClientForm } from './components/RetourClientForm'

export const dynamic = 'force-dynamic'

export default async function ConceptionCommercialPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const projetId = params.id

  const [
    { data: projet },
    { data: brief },
    { data: notices },
    { data: demandes },
    { data: propositions },
    { data: utilisateurs },
  ] = await Promise.all([
    supabase.schema('app').from('projets')
      .select('id, nom, reference, client_nom, dessinatrice_id, economiste_id, commercial_id, phase, statut')
      .eq('id', projetId).single(),
    supabase.schema('app').from('brief_client').select('*').eq('projet_id', projetId).maybeSingle(),
    supabase.schema('app').from('notices_commerciales').select('*').eq('projet_id', projetId).order('ordre'),
    supabase.schema('app').from('demandes_travail')
      .select('*')
      .eq('projet_id', projetId)
      .in('type', ['plan_intention','plan_proposition','plan_apd','estimation_initiale','chiffrage_proposition','chiffrage_apd'])
      .order('date_demande', { ascending: false }),
    supabase.schema('app').from('propositions')
      .select('*')
      .eq('projet_id', projetId)
      .order('numero', { ascending: true }),
    supabase.schema('app').from('utilisateurs')
      .select('id, prenom, nom, role').eq('actif', true).in('role', ['dessinatrice','economiste']),
  ])

  if (!projet) return notFound()

  const dessinatrices = (utilisateurs ?? []).filter(u => u.role === 'dessinatrice')
  const economistes = (utilisateurs ?? []).filter(u => u.role === 'economiste')

  // Proposition active = la plus haute non archivée
  const propositionActive = (propositions ?? []).find(p => !p.is_archived) ?? null
  const propositionEnvoyee = (propositions ?? []).find(p => p.statut === 'envoyee' && !p.is_archived)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/commercial/projets/${projetId}`} className="p-1.5 rounded-lg hover:bg-gray-100">
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </Link>
            <div>
              <p className="text-xs text-gray-500">Phase Conception</p>
              <h1 className="text-lg font-semibold text-gray-900">
                {projet.reference ? `${projet.reference} — ` : ''}{projet.nom}
              </h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Client</p>
            <p className="text-sm font-medium text-gray-700">{projet.client_nom ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Bloc 1 — Brief client */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">1. Brief client</h2>
          <BriefClientForm projetId={projetId} brief={brief ?? null} />
        </section>

        {/* Bloc 2 — Notices commerciales */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">2. Notices commerciales</h2>
          <NoticesCommercialesEditor projetId={projetId} initialNotices={notices ?? []} />
        </section>

        {/* Bloc 3 — Lancer la conception */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">3. Lancer la conception</h2>
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

        {/* Bloc 4 — Timeline */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">4. Timeline des propositions</h2>
          <PropositionsTimeline
            propositions={propositions ?? []}
            demandes={demandes ?? []}
            projetId={projetId}
          />
        </section>

        {/* Bloc 5 — Retour client */}
        {propositionEnvoyee && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">5. Retour client</h2>
            <RetourClientForm
              projetId={projetId}
              proposition={propositionEnvoyee}
              dessinatriceProjetId={projet.dessinatrice_id}
              economisteProjetId={projet.economiste_id}
            />
          </section>
        )}
      </div>
    </div>
  )
}
