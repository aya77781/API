import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { FileSignature, FileText, CheckCircle2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const TYPE_DOC_LABEL: Record<string, string> = {
  devis: 'Devis',
  contrat: 'Contrat',
  plan_apd: 'Plan APD',
  plan_exe: 'Plan EXE',
  autre: 'Autre',
}

export default async function ContratPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const projetId = params.id

  const [
    { data: projet },
    { data: propositions },
    { data: documents },
    { data: avenants },
  ] = await Promise.all([
    supabase
      .schema('app')
      .from('projets')
      .select('id, nom, budget_total, date_debut, date_livraison')
      .eq('id', projetId)
      .single(),
    supabase
      .schema('app')
      .from('propositions')
      .select('id, numero, type, statut, montant_total_ht, date_reponse_client, verrouillee_apres_signature')
      .eq('projet_id', projetId)
      .order('numero', { ascending: false }),
    supabase
      .schema('app')
      .from('documents')
      .select('id, nom_fichier, type_doc, storage_path, created_at')
      .eq('projet_id', projetId)
      .in('type_doc', ['devis', 'contrat', 'plan_apd', 'plan_exe'])
      .order('created_at', { ascending: false }),
    supabase
      .schema('app')
      .from('avenants')
      .select('*')
      .eq('projet_id', projetId)
      .order('created_at', { ascending: false }),
  ])

  if (!projet) return notFound()

  const propositionSignee = (propositions ?? []).find(
    p => p.verrouillee_apres_signature || p.statut === 'acceptee',
  )

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <FileSignature className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Engagement contractuel</h2>
            <p className="text-xs text-gray-500 mt-1">
              Statut de signature, montants validés et avenants en cours.
            </p>
          </div>
        </div>

        {propositionSignee ? (
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-semibold">
                Proposition V{propositionSignee.numero}
                {propositionSignee.type === 'finale' ? ' — APD' : ''} signée
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {propositionSignee.montant_total_ht != null && (
                <Field label="Montant signé" value={formatCurrency(propositionSignee.montant_total_ht)} />
              )}
              {propositionSignee.date_reponse_client && (
                <Field label="Date de signature" value={formatDate(propositionSignee.date_reponse_client)} />
              )}
              {projet.date_livraison && (
                <Field label="Livraison prévue" value={formatDate(projet.date_livraison)} />
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            Aucune proposition signée pour ce projet. La signature se déclenche lorsqu&apos;une proposition est acceptée par le client.
          </p>
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Documents contractuels ({documents?.length ?? 0})
        </p>
        {(documents ?? []).length === 0 ? (
          <p className="text-sm text-gray-400">
            Aucun devis, contrat ou plan signé déposé pour ce projet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {(documents ?? []).map(doc => (
              <li key={doc.id} className="flex items-center justify-between py-2.5 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {doc.nom_fichier ?? 'Document'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {TYPE_DOC_LABEL[doc.type_doc ?? ''] ?? doc.type_doc ?? '—'} · ajouté le {formatDate(doc.created_at)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Avenants ({avenants?.length ?? 0})
        </p>
        {(avenants ?? []).length === 0 ? (
          <p className="text-sm text-gray-400">Aucun avenant pour ce projet.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {(avenants ?? []).map(a => (
              <li key={a.id} className="py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-800 truncate">
                    {a.titre ?? `Avenant ${a.numero}`}
                  </p>
                  {a.montant_ht != null && (
                    <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                      {formatCurrency(a.montant_ht)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  Créé le {formatDate(a.created_at)}
                  {a.statut ? ` · ${a.statut.replace(/_/g, ' ')}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className="font-semibold text-gray-900 mt-0.5">{value}</p>
    </div>
  )
}
