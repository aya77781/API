import {
  Heart,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Home,
  Zap,
  TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/co/StatCard'
import { TopBar } from '@/components/co/TopBar'

type Signalement = {
  id: string
  type: string
  description: string
  pole: string | null
  zone: string | null
  statut: string
  priorite: string
  created_at: string
}

type Evenement = {
  id: string
  titre: string
  type: string
  date_prevue: string | null
  lieu: string | null
  budget: number | null
  statut: string
  participants: string[] | null
}

type Action = {
  id: string
  phase: string
  titre: string
  statut: string
  priorite: string
  echeance: string | null
}

async function getDashboardData() {
  const supabase = createClient()

  const [signalementsRes, evenementsRes, actionsRes] = await Promise.all([
    supabase
      .schema('app')
      .from('cho_signalements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .schema('app')
      .from('cho_evenements')
      .select('*')
      .order('date_prevue', { ascending: true })
      .limit(10),
    supabase
      .schema('app')
      .from('cho_actions')
      .select('*')
      .neq('statut', 'termine')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return {
    signalements: (signalementsRes.data ?? []) as Signalement[],
    evenements: (evenementsRes.data ?? []) as Evenement[],
    actions: (actionsRes.data ?? []) as Action[],
  }
}

const TYPE_LABELS: Record<string, string> = {
  tension: 'Tension',
  panne: 'Panne',
  feedback: 'Feedback',
  materiel: 'Matériel',
  autre: 'Autre',
  repas: 'Repas',
  seminaire: 'Séminaire',
  team_building: 'Team Building',
  celebration: 'Célébration',
}

const PRIORITE_COLOR: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  normal: 'bg-gray-100 text-gray-600',
  low: 'bg-blue-50 text-blue-600',
}

const STATUT_COLOR: Record<string, string> = {
  ouvert: 'bg-red-50 text-red-600',
  en_traitement: 'bg-amber-50 text-amber-600',
  resolu: 'bg-emerald-50 text-emerald-600',
  planifie: 'bg-blue-50 text-blue-600',
  confirme: 'bg-emerald-50 text-emerald-600',
  termine: 'bg-gray-100 text-gray-500',
  annule: 'bg-gray-100 text-gray-400',
}

const PHASE_ICON: Record<string, string> = {
  climat_social: '❤️',
  evenementiel: '📅',
  cadre_vie: '🏠',
  processus: '📋',
}

export default async function CHODashboardPage() {
  let data: { signalements: Signalement[]; evenements: Evenement[]; actions: Action[] }

  try {
    data = await getDashboardData()
  } catch {
    data = { signalements: [], evenements: [], actions: [] }
  }

  const { signalements, evenements, actions } = data

  const signalementsOuverts = signalements.filter((s) => s.statut === 'ouvert').length
  const signalementsUrgents = signalements.filter(
    (s) => s.priorite === 'urgent' && s.statut !== 'resolu'
  )

  const now = new Date()
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const evenementsProchains = evenements.filter((e) => {
    if (!e.date_prevue) return false
    const d = new Date(e.date_prevue)
    return d >= now && d <= in30days && e.statut !== 'annule'
  })

  const actionsEnCours = actions.filter((a) => a.statut === 'en_cours').length
  const actionsAFaire = actions.filter((a) => a.statut === 'a_faire').length

  const signalementsRecents = signalements
    .filter((s) => s.statut !== 'resolu')
    .slice(0, 5)

  return (
    <div>
      <TopBar
        title="Tableau de bord"
        subtitle={`Chief Happiness Officer · ${new Date().toLocaleDateString('fr-FR', {
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
              label="Signalements ouverts"
              value={signalementsOuverts}
              subtitle="Tensions, pannes, feedback"
              icon={AlertTriangle}
              color={signalementsOuverts > 3 ? 'red' : signalementsOuverts > 0 ? 'amber' : 'green'}
            />
            <StatCard
              label="Événements ce mois"
              value={evenementsProchains.length}
              subtitle="Dans les 30 prochains jours"
              icon={Calendar}
              color="blue"
            />
            <StatCard
              label="Actions en cours"
              value={actionsEnCours}
              subtitle={`${actionsAFaire} à démarrer`}
              icon={Zap}
              color="purple"
            />
            <StatCard
              label="Bien-être global"
              value={signalementsOuverts === 0 ? '✓' : signalementsUrgents.length > 0 ? '⚠' : '~'}
              subtitle={
                signalementsOuverts === 0
                  ? 'Tout est en ordre'
                  : signalementsUrgents.length > 0
                  ? `${signalementsUrgents.length} urgent${signalementsUrgents.length > 1 ? 's' : ''}`
                  : 'Quelques points à suivre'
              }
              icon={Heart}
              color={signalementsOuverts === 0 ? 'green' : signalementsUrgents.length > 0 ? 'red' : 'amber'}
            />
          </div>
        </section>

        {/* Phases résumé */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Phases CHO</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                phase: 'climat_social',
                label: 'Climat Social',
                href: '/cho/climat-social',
                tasks: ['Gestion ambiance', 'Médiation interne'],
                color: 'border-pink-200 hover:border-pink-300',
              },
              {
                phase: 'evenementiel',
                label: 'Événementiel',
                href: '/cho/evenementiel',
                tasks: ['Repas & célébrations', 'Séminaires & Team Building'],
                color: 'border-blue-200 hover:border-blue-300',
              },
              {
                phase: 'cadre_vie',
                label: 'Cadre de Vie',
                href: '/cho/cadre-vie',
                tasks: ['Environnement de travail', 'Maintenance locaux'],
                color: 'border-emerald-200 hover:border-emerald-300',
              },
              {
                phase: 'processus',
                label: 'Processus',
                href: '/cho/processus',
                tasks: ['Règles de vie bureau', 'Politique de frais'],
                color: 'border-purple-200 hover:border-purple-300',
              },
            ].map((item) => {
              const phaseActions = actions.filter((a) => a.phase === item.phase)
              return (
                <a
                  key={item.phase}
                  href={item.href}
                  className={`block bg-white rounded-lg border shadow-card p-4 transition-colors ${item.color}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{PHASE_ICON[item.phase]}</span>
                    <span className="text-sm font-semibold text-gray-900">{item.label}</span>
                  </div>
                  <div className="space-y-1 mb-3">
                    {item.tasks.map((t) => (
                      <p key={t} className="text-xs text-gray-500 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />
                        {t}
                      </p>
                    ))}
                  </div>
                  {phaseActions.length > 0 && (
                    <p className="text-xs text-gray-400">
                      {phaseActions.length} action{phaseActions.length > 1 ? 's' : ''} en cours
                    </p>
                  )}
                </a>
              )
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Signalements récents */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">
                Signalements en attente
              </h2>
              <a
                href="/cho/climat-social"
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                Voir tout →
              </a>
            </div>

            {signalementsRecents.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Aucun signalement ouvert</p>
                <p className="text-xs text-gray-400 mt-1">
                  Tout est sous contrôle, continuez comme ça !
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {signalementsRecents.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white rounded-lg border border-gray-200 shadow-card p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PRIORITE_COLOR[s.priorite] ?? 'bg-gray-100 text-gray-600'}`}
                          >
                            {s.priorite === 'urgent' ? '🔴' : s.priorite === 'high' ? '🟠' : '⚪'}{' '}
                            {s.priorite}
                          </span>
                          <span className="text-xs text-gray-400">
                            {TYPE_LABELS[s.type] ?? s.type}
                          </span>
                          {s.pole && (
                            <span className="text-xs text-gray-400">· {s.pole}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800 line-clamp-2">{s.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(s.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <span
                        className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUT_COLOR[s.statut] ?? 'bg-gray-100 text-gray-500'}`}
                      >
                        {s.statut === 'ouvert' ? 'Ouvert' : s.statut === 'en_traitement' ? 'En traitement' : 'Résolu'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Prochains événements */}
            <div className="flex items-center justify-between mt-6">
              <h2 className="text-sm font-semibold text-gray-700">
                Prochains événements
              </h2>
              <a
                href="/cho/evenementiel"
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                Voir tout →
              </a>
            </div>

            {evenementsProchains.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-6 text-center">
                <Calendar className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Aucun événement dans les 30 prochains jours</p>
              </div>
            ) : (
              <div className="space-y-2">
                {evenementsProchains.slice(0, 3).map((e) => (
                  <a
                    key={e.id}
                    href="/cho/evenementiel"
                    className="block bg-white rounded-lg border border-gray-200 shadow-card p-4 hover:border-blue-200 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{e.titre}</p>
                        <p className="text-xs text-gray-400">
                          {e.date_prevue
                            ? new Date(e.date_prevue).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                              })
                            : 'Date à définir'}
                          {e.lieu ? ` · ${e.lieu}` : ''}
                        </p>
                      </div>
                      <span
                        className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUT_COLOR[e.statut] ?? 'bg-gray-100 text-gray-500'}`}
                      >
                        {TYPE_LABELS[e.type] ?? e.type}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Panneau droit */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">À traiter</h2>

            {signalementsUrgents.length > 0 && (
              <div className="bg-red-50 rounded-lg border border-red-200 p-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <p className="text-xs font-semibold text-red-700">
                    {signalementsUrgents.length} signalement{signalementsUrgents.length > 1 ? 's' : ''} urgent{signalementsUrgents.length > 1 ? 's' : ''}
                  </p>
                </div>
                {signalementsUrgents.slice(0, 2).map((s) => (
                  <p key={s.id} className="text-xs text-red-600 line-clamp-2">
                    · {s.description}
                  </p>
                ))}
              </div>
            )}

            {/* Actions à démarrer */}
            {actionsAFaire > 0 && (
              <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <p className="text-xs font-semibold text-amber-700">
                    {actionsAFaire} action{actionsAFaire > 1 ? 's' : ''} à démarrer
                  </p>
                </div>
                {actions
                  .filter((a) => a.statut === 'a_faire')
                  .slice(0, 3)
                  .map((a) => (
                    <p key={a.id} className="text-xs text-amber-600 mt-1">
                      {PHASE_ICON[a.phase]} {a.titre}
                    </p>
                  ))}
              </div>
            )}

            {signalementsOuverts === 0 && actionsAFaire === 0 && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">Tout est sous contrôle</p>
                <p className="text-xs text-gray-400 mt-1">
                  Bonne ambiance dans l&apos;équipe !
                </p>
              </div>
            )}

            {/* Principe CHO */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-600">Rôle CHO</p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    Climat · Événements · Cadre de vie · Processus.
                    <br />
                    Veiller au bien-être et à la cohésion de l&apos;équipe.
                  </p>
                </div>
              </div>
            </div>

            {/* Raccourcis phases */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 mb-3">Accès rapide</p>
              {[
                { href: '/cho/climat-social', label: 'Nouveau signalement', emoji: '❤️' },
                { href: '/cho/evenementiel', label: 'Planifier un événement', emoji: '📅' },
                { href: '/cho/cadre-vie', label: 'Signaler une panne', emoji: '🏠' },
                { href: '/cho/processus', label: 'Consulter les règles', emoji: '📋' },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 py-1 transition-colors"
                >
                  <span>{link.emoji}</span>
                  <span>{link.label}</span>
                  <Home className="w-3 h-3 ml-auto text-gray-300" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
