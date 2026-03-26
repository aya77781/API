import {
  UserPlus,
  UserCheck,
  CreditCard,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/co/StatCard'
import { TopBar } from '@/components/co/TopBar'
import { RecentDocumentNotifs } from '@/components/shared/RecentDocumentNotifs'

type Candidat = { id: string; nom: string; prenom: string; poste: string; statut: string; created_at: string }
type Onboarding = { id: string; employe_nom: string; employe_prenom: string; poste: string; date_arrivee: string; statut: string; bureau_pret: boolean; pc_pret: boolean; contrat_signe: boolean }
type NDF = { id: string; employe_nom: string; mois: string; montant_total: number; statut: string }
type Entretien = { id: string; employe_nom: string; type: string; date_prevu: string | null; statut: string }

async function getDashboardData() {
  const supabase = createClient()
  const [candidatsRes, onboardingRes, ndfRes, entretiensRes] = await Promise.all([
    supabase.schema('app').from('rh_candidats').select('*').order('created_at', { ascending: false }),
    supabase.schema('app').from('rh_onboarding').select('*').eq('statut', 'en_cours').order('date_arrivee', { ascending: true }),
    supabase.schema('app').from('rh_ndf').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.schema('app').from('rh_entretiens').select('*').order('date_prevu', { ascending: true }),
  ])
  return {
    candidats: (candidatsRes.data ?? []) as Candidat[],
    onboardings: (onboardingRes.data ?? []) as Onboarding[],
    ndfs: (ndfRes.data ?? []) as NDF[],
    entretiens: (entretiensRes.data ?? []) as Entretien[],
  }
}

const STATUT_CANDIDAT: Record<string, { label: string; color: string }> = {
  nouveau:        { label: 'Nouveau',        color: 'bg-gray-100 text-gray-600' },
  preselectionne: { label: 'Présélectionné', color: 'bg-blue-50 text-blue-600' },
  entretien:      { label: 'Entretien',      color: 'bg-purple-50 text-purple-600' },
  shortlist:      { label: 'Shortlist',      color: 'bg-amber-50 text-amber-600' },
  retenu:         { label: 'Retenu',         color: 'bg-emerald-50 text-emerald-600' },
  refuse:         { label: 'Refusé',         color: 'bg-red-50 text-red-500' },
}

const PHASE_RH = [
  { phase: 'recrutement', label: 'Recrutement', href: '/rh/recrutement', emoji: '👤', tasks: ['Sourcing & offres', 'Présélection & entretiens'] },
  { phase: 'onboarding',  label: 'Onboarding',  href: '/rh/onboarding',  emoji: '🤝', tasks: ['Installation logistique', 'Administratif & carte BTP'] },
  { phase: 'vie_sociale', label: 'Vie Sociale', href: '/rh/vie-sociale', emoji: '🌱', tasks: ['Contrats & entretiens', 'Formation & montage dossiers'] },
  { phase: 'paie_frais',  label: 'Paie & Frais',href: '/rh/paie-frais', emoji: '💳', tasks: ['Variables de paie', 'Notes de frais (NDF)'] },
  { phase: 'transverse',  label: 'Transverse',  href: '/rh/transverse',  emoji: '📋', tasks: ['Achats internes', 'Support comptable'] },
]

export default async function RHDashboardPage() {
  let data: { candidats: Candidat[]; onboardings: Onboarding[]; ndfs: NDF[]; entretiens: Entretien[] }
  try {
    data = await getDashboardData()
  } catch {
    data = { candidats: [], onboardings: [], ndfs: [], entretiens: [] }
  }

  const { candidats, onboardings, ndfs, entretiens } = data

  const candidatsActifs = candidats.filter((c) => !['retenu', 'refuse', 'abandonne'].includes(c.statut)).length
  const ndfsEnAttente = ndfs.filter((n) => n.statut === 'en_attente').length

  const now = new Date()
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const entretiensProchains = entretiens.filter((e) => {
    if (!e.date_prevu || e.statut !== 'planifie') return false
    const d = new Date(e.date_prevu)
    return d >= now && d <= in30days
  })

  const candidatsRecents = candidats.filter((c) => !['retenu', 'refuse', 'abandonne'].includes(c.statut)).slice(0, 5)

  return (
    <div>
      <TopBar
        title="Tableau de bord RH"
        subtitle={`Ressources Humaines · ${new Date().toLocaleDateString('fr-FR', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })}`}
      />

      <div className="p-6 space-y-8">
        {/* KPIs */}
        <section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Candidats actifs"
              value={candidatsActifs}
              subtitle="En cours de recrutement"
              icon={UserPlus}
              color="blue"
            />
            <StatCard
              label="Onboardings en cours"
              value={onboardings.length}
              subtitle="Nouveaux arrivants"
              icon={UserCheck}
              color="green"
            />
            <StatCard
              label="NDF à valider"
              value={ndfsEnAttente}
              subtitle="Notes de frais en attente"
              icon={CreditCard}
              color={ndfsEnAttente > 5 ? 'red' : ndfsEnAttente > 0 ? 'amber' : 'default'}
            />
            <StatCard
              label="Entretiens ce mois"
              value={entretiensProchains.length}
              subtitle="Planifiés dans 30 jours"
              icon={Calendar}
              color="purple"
            />
          </div>
        </section>

        {/* Phases RH */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Domaines RH</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {PHASE_RH.map((item) => (
              <a
                key={item.phase}
                href={item.href}
                className="block bg-white rounded-lg border border-gray-200 shadow-card p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{item.emoji}</span>
                  <span className="text-xs font-semibold text-gray-900">{item.label}</span>
                </div>
                <div className="space-y-1">
                  {item.tasks.map((t) => (
                    <p key={t} className="text-xs text-gray-400 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />
                      {t}
                    </p>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Candidats en cours */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Candidats en cours</h2>
              <a href="/rh/recrutement" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                Voir tout →
              </a>
            </div>

            {candidatsRecents.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                <UserPlus className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Aucun recrutement en cours</p>
                <p className="text-xs text-gray-400 mt-1">Commencez par créer une offre d&apos;emploi.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {candidatsRecents.map((c) => {
                  const s = STATUT_CANDIDAT[c.statut] ?? { label: c.statut, color: 'bg-gray-100 text-gray-600' }
                  return (
                    <div key={c.id} className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-600 flex-shrink-0">
                            {c.prenom[0]}{c.nom[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{c.prenom} {c.nom}</p>
                            <p className="text-xs text-gray-400">{c.poste}</p>
                          </div>
                        </div>
                        <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>
                          {s.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Onboardings */}
            {onboardings.length > 0 && (
              <>
                <div className="flex items-center justify-between mt-6">
                  <h2 className="text-sm font-semibold text-gray-700">Onboardings en cours</h2>
                  <a href="/rh/onboarding" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Voir tout →</a>
                </div>
                <div className="space-y-2">
                  {onboardings.map((o) => {
                    const total = 10
                    const done = [o.bureau_pret, o.pc_pret, o.contrat_signe].filter(Boolean).length
                    const pct = Math.round((done / total) * 100)
                    return (
                      <div key={o.id} className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{o.employe_prenom} {o.employe_nom}</p>
                            <p className="text-xs text-gray-400">
                              {o.poste} · Arrivée {new Date(o.date_arrivee).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                          <span className="text-xs text-gray-500">{pct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Panneau droit */}
          <div className="space-y-4">
            <RecentDocumentNotifs roleBase="rh" />
            <h2 className="text-sm font-semibold text-gray-700">À traiter</h2>

            {ndfsEnAttente > 0 && (
              <a href="/rh/paie-frais" className="block bg-amber-50 rounded-lg border border-amber-200 p-4 hover:border-amber-300 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="w-4 h-4 text-amber-500" />
                  <p className="text-xs font-semibold text-amber-700">
                    {ndfsEnAttente} NDF en attente de validation
                  </p>
                </div>
                <p className="text-xs text-amber-600">Montant total : {ndfs.filter((n) => n.statut === 'en_attente').reduce((s, n) => s + n.montant_total, 0).toLocaleString('fr-FR')} €</p>
              </a>
            )}

            {entretiensProchains.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-purple-500" />
                  <p className="text-xs font-semibold text-gray-700">Prochains entretiens</p>
                </div>
                {entretiensProchains.slice(0, 3).map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-gray-800">{e.employe_nom}</p>
                      <p className="text-xs text-gray-400">{e.type === 'annuel' ? 'Entretien annuel' : e.type === 'mi_annuel' ? 'Mi-annuel' : 'Période essai'}</p>
                    </div>
                    {e.date_prevu && (
                      <p className="text-xs text-gray-500 flex-shrink-0">
                        {new Date(e.date_prevu).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {ndfsEnAttente === 0 && entretiensProchains.length === 0 && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">Tout est à jour</p>
                <p className="text-xs text-gray-400 mt-1">Aucune action urgente en attente.</p>
              </div>
            )}

            {/* Accès rapide */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 mb-3">Accès rapide</p>
              {[
                { href: '/rh/recrutement', label: 'Ajouter un candidat', emoji: '👤' },
                { href: '/rh/onboarding',  label: 'Nouvel onboarding',   emoji: '🤝' },
                { href: '/rh/paie-frais',  label: 'Saisir une NDF',      emoji: '💳' },
                { href: '/rh/vie-sociale', label: 'Planifier un entretien', emoji: '🌱' },
              ].map((link) => (
                <a key={link.href} href={link.href} className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 py-1 transition-colors">
                  <span>{link.emoji}</span>
                  <span>{link.label}</span>
                  <Clock className="w-3 h-3 ml-auto text-gray-300" />
                </a>
              ))}
            </div>

            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-600">Rôle RH</p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    Recrutement · Onboarding · Vie sociale<br />
                    Paie & Frais · Support transverse.
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
