import {
  FolderOpen,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  FileText,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/co/StatCard'
import { ProjetCard } from '@/components/co/ProjetCard'
import { TopBar } from '@/components/co/TopBar'
import { StatutBadge } from '@/components/ui/Badge'
import { PHASE_ORDER } from '@/lib/utils'
import type { Projet } from '@/types/database'

async function getDashboardData() {
  const supabase = createClient()

  const [projetsRes, reservesRes, crsRes, alertesRes] = await Promise.all([
    supabase
      .schema('app')
      .from('projets')
      .select('*')
      .order('updated_at', { ascending: false }),
    supabase
      .schema('app')
      .from('reserves')
      .select('id, statut')
      .eq('statut', 'ouvert'),
    supabase
      .schema('app')
      .from('comptes_rendus')
      .select('id, statut')
      .eq('statut', 'brouillon'),
    supabase
      .schema('app')
      .from('alertes')
      .select('id, priorite')
      .eq('lue', false),
  ])

  return {
    projets: (projetsRes.data ?? []) as Projet[],
    reservesOuvertes: reservesRes.data?.length ?? 0,
    crsEnAttente: crsRes.data?.length ?? 0,
    alertesNonLues: alertesRes.data?.length ?? 0,
  }
}

export default async function DashboardPage() {
  const { projets, reservesOuvertes, crsEnAttente, alertesNonLues } =
    await getDashboardData()

  const parStatut = PHASE_ORDER.reduce<Record<string, number>>((acc, phase) => {
    acc[phase] = projets.filter((p) => p.statut === phase).length
    return acc
  }, {})

  const enChantier =
    (parStatut['installation'] ?? 0) +
    (parStatut['chantier'] ?? 0) +
    (parStatut['controle'] ?? 0)
  const termines =
    (parStatut['cloture'] ?? 0) + (parStatut['gpa'] ?? 0)

  const projetsRecents = projets.slice(0, 5)

  const now = Date.now()
  const in30days = now + 30 * 24 * 60 * 60 * 1000
  const projetsAlerte = projets.filter(
    (p) =>
      p.date_livraison &&
      new Date(p.date_livraison).getTime() < in30days &&
      !['cloture', 'gpa', 'termine'].includes(p.statut)
  )

  return (
    <div>
      <TopBar
        title="Tableau de bord"
        subtitle={`${projets.length} projets · ${new Date().toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}`}
      />

      <div className="p-6 space-y-8">
        {/* KPIs */}
        <section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Projets actifs"
              value={enChantier}
              subtitle="En cours de travaux"
              icon={FolderOpen}
              color="blue"
            />
            <StatCard
              label="Réserves ouvertes"
              value={reservesOuvertes}
              subtitle="À lever"
              icon={AlertTriangle}
              color={reservesOuvertes > 10 ? 'red' : 'amber'}
            />
            <StatCard
              label="CR à valider"
              value={crsEnAttente}
              subtitle="Brouillons en attente"
              icon={FileText}
              color="purple"
            />
            <StatCard
              label="Projets terminés"
              value={termines}
              subtitle="Clôturés ou en GPA"
              icon={CheckCircle2}
              color="green"
            />
          </div>
        </section>

        {/* Répartition par phase */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Répartition par phase
          </h2>
          <div className="bg-white rounded-lg border border-gray-200 shadow-card p-5">
            <div className="grid grid-cols-4 lg:grid-cols-7 gap-3">
              {PHASE_ORDER.map((phase) => (
                <div key={phase} className="text-center">
                  <div className="w-10 h-10 mx-auto rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center">
                    <span className="text-lg font-semibold text-gray-900">
                      {parStatut[phase] ?? 0}
                    </span>
                  </div>
                  <StatutBadge statut={phase} className="mt-2" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projets récents */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">
                Projets récents
              </h2>
              <a
                href="/co/projets"
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                Voir tout →
              </a>
            </div>
            {projetsRecents.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title="Aucun projet"
                description="Les projets apparaîtront ici une fois créés dans Supabase."
              />
            ) : (
              <div className="space-y-3">
                {projetsRecents.map((projet) => (
                  <ProjetCard key={projet.id} projet={projet} />
                ))}
              </div>
            )}
          </div>

          {/* Panneau droit */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Attention requise
            </h2>

            {/* Alertes non lues */}
            {alertesNonLues > 0 && (
              <div className="bg-red-50 rounded-lg border border-red-200 p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm font-medium text-red-700">
                    {alertesNonLues} alerte{alertesNonLues > 1 ? 's' : ''} non lue{alertesNonLues > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}

            {projetsAlerte.length === 0 && alertesNonLues === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">
                  Tout est sous contrôle
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Aucun projet n&apos;approche de son échéance
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {projetsAlerte.map((projet) => (
                  <a
                    key={projet.id}
                    href={`/co/projets/${projet.id}/${projet.statut}`}
                    className="block bg-white rounded-lg border border-amber-200 shadow-card p-4 hover:border-amber-300 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {projet.nom}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Livraison :{' '}
                          {projet.date_livraison
                            ? new Date(projet.date_livraison).toLocaleDateString(
                                'fr-FR'
                              )
                            : '—'}
                        </p>
                      </div>
                      <StatutBadge statut={projet.statut} />
                    </div>
                  </a>
                ))}
              </div>
            )}

            {/* Principe API */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mt-2">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-600">
                    Principe API
                  </p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    L&apos;IA prépare · le CO valide · le système envoie.
                    <br />
                    Aucune action automatique sans votre validation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
      <Icon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
      <p className="text-sm font-medium text-gray-700">{title}</p>
      <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">{description}</p>
    </div>
  )
}
