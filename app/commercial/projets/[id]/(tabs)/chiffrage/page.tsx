import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Layers } from 'lucide-react'
import { NoticesCommercialesEditor } from '../../conception/components/NoticesCommercialesEditor'
import { DemandesActions } from '../../conception/components/DemandesActions'
import { formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const STATUT_LOT_COLOR: Record<string, string> = {
  en_attente: 'bg-gray-100 text-gray-600',
  consultation: 'bg-blue-50 text-blue-700',
  negociation: 'bg-amber-50 text-amber-700',
  retenu: 'bg-emerald-50 text-emerald-700',
  en_cours: 'bg-emerald-100 text-emerald-800',
  termine: 'bg-gray-200 text-gray-500',
}
const STATUT_LOT_LABEL: Record<string, string> = {
  en_attente: 'En attente',
  consultation: 'Consultation',
  negociation: 'Négociation',
  retenu: 'Retenu',
  en_cours: 'En cours',
  termine: 'Terminé',
}

export default async function ChiffragePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const projetId = params.id

  const [
    { data: projet },
    { data: notices },
    { data: demandes },
    { data: propositions },
    { data: utilisateurs },
    { data: lots },
  ] = await Promise.all([
    supabase
      .schema('app')
      .from('projets')
      .select('id, dessinatrice_id, economiste_id, budget_total')
      .eq('id', projetId)
      .single(),
    supabase.schema('app').from('notices_commerciales').select('*').eq('projet_id', projetId).order('ordre'),
    supabase
      .schema('app')
      .from('demandes_travail')
      .select('*')
      .eq('projet_id', projetId)
      .in('type', ['estimation_initiale', 'chiffrage_proposition', 'chiffrage_apd'])
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
    supabase.schema('app').from('lots').select('*').eq('projet_id', projetId).order('numero'),
  ])

  if (!projet) return notFound()

  const dessinatrices = (utilisateurs ?? []).filter(u => u.role === 'dessinatrice')
  const economistes = (utilisateurs ?? []).filter(u => u.role === 'economiste')
  const totalLots = (lots ?? []).reduce((sum, l) => sum + (l.budget_prevu ?? 0), 0)

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Notices commerciales</h2>
        <NoticesCommercialesEditor projetId={projetId} initialNotices={notices ?? []} />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Demander un chiffrage</h2>
        <DemandesActions
          projetId={projetId}
          briefRempli
          dessinatrices={dessinatrices}
          economistes={economistes}
          dessinatriceProjetId={projet.dessinatrice_id}
          economisteProjetId={projet.economiste_id}
          demandes={demandes ?? []}
          propositions={propositions ?? []}
        />
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Métrés par lot ({lots?.length ?? 0})
          </p>
          {totalLots > 0 && (
            <p className="text-xs text-gray-500">
              Total lots : <span className="font-semibold text-gray-900">{formatCurrency(totalLots)}</span>
              {projet.budget_total && (
                <> · Budget projet : <span className="font-semibold text-gray-900">{formatCurrency(projet.budget_total)}</span></>
              )}
            </p>
          )}
        </div>
        {(lots ?? []).length === 0 ? (
          <p className="text-sm text-gray-400">Aucun lot défini pour ce projet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {(lots ?? []).map(lot => (
              <div key={lot.id} className="flex items-center justify-between py-2.5 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
                    {lot.numero}
                  </span>
                  <span className="text-sm text-gray-800 truncate">{lot.corps_etat}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {lot.budget_prevu != null && (
                    <span className="text-xs text-gray-500">
                      Prévu : <span className="font-semibold text-gray-900">{formatCurrency(lot.budget_prevu)}</span>
                    </span>
                  )}
                  {lot.budget_final != null && (
                    <span className="text-xs text-gray-500">
                      Final : <span className="font-semibold text-gray-900">{formatCurrency(lot.budget_final)}</span>
                    </span>
                  )}
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      STATUT_LOT_COLOR[lot.statut] ?? 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {STATUT_LOT_LABEL[lot.statut] ?? lot.statut}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
