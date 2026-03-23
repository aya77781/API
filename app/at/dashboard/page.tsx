import { UserCheck, CreditCard, FolderCheck, AlertTriangle, CheckCircle2, Clock, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/co/StatCard'
import { TopBar } from '@/components/co/TopBar'

type ST = { id: string; nom: string; corps_etat: string | null; statut: string; decennale_ok: boolean; decennale_validite: string | null }
type Facture = { id: string; numero_facture: string | null; montant_ht: number; statut: string }
type Caution = { id: string; montant: number; statut: string; date_fin_gpa: string | null }
type DOE = { id: string; statut: string }

async function getDashboardData() {
  const supabase = createClient()
  const [stRes, facturesRes, cautionsRes, doeRes] = await Promise.all([
    supabase.schema('app').from('at_sous_traitants').select('id,nom,corps_etat,statut,decennale_ok,decennale_validite').order('created_at', { ascending: false }),
    supabase.schema('app').from('at_factures').select('id,numero_facture,montant_ht,statut').order('created_at', { ascending: false }),
    supabase.schema('app').from('at_cautions').select('id,montant,statut,date_fin_gpa').order('created_at', { ascending: false }),
    supabase.schema('app').from('at_doe').select('id,statut').order('created_at', { ascending: false }),
  ])
  return {
    sts: (stRes.data ?? []) as ST[],
    factures: (facturesRes.data ?? []) as Facture[],
    cautions: (cautionsRes.data ?? []) as Caution[],
    does: (doeRes.data ?? []) as DOE[],
  }
}

const PHASES = [
  { phase: 'onboarding_st',    label: 'Onboarding ST',    href: '/at/onboarding-st',    emoji: '🤝', tasks: ['Collecte admin & vigilance sociale', 'Vérification assurances & contrats'] },
  { phase: 'admin_financiere', label: 'Admin Financière', href: '/at/admin-financiere', emoji: '💰', tasks: ['Compte prorata & cautions', 'Contrôle & bon à payer factures'] },
  { phase: 'cloture_doe',      label: 'Clôture DOE',     href: '/at/cloture-doe',      emoji: '📁', tasks: ['Collecte technique & plans', 'Finalisation & envoi DOE'] },
]

export default async function ATDashboardPage() {
  let data: { sts: ST[]; factures: Facture[]; cautions: Caution[]; does: DOE[] }
  try { data = await getDashboardData() }
  catch { data = { sts: [], factures: [], cautions: [], does: [] } }

  const { sts, factures, cautions, does } = data

  const stEnCours      = sts.filter((s) => s.statut === 'en_cours').length
  const facturesAVerif = factures.filter((f) => f.statut === 'a_verifier').length
  const cautionsActives = cautions.filter((c) => c.statut === 'active').length
  const doesEnCours    = does.filter((d) => d.statut === 'en_cours').length

  // Décennales proches d'expiration (< 3 mois)
  const now = new Date()
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  const decennalesAlert = sts.filter((s) => {
    if (!s.decennale_validite || !s.decennale_ok) return false
    return new Date(s.decennale_validite) <= in90
  })

  // GPA à libérer (date_fin_gpa dépassée)
  const cautionsALiberer = cautions.filter((c) => {
    if (c.statut !== 'active' || !c.date_fin_gpa) return false
    return new Date(c.date_fin_gpa) <= now
  })

  const stRecents = sts.filter((s) => s.statut === 'en_cours').slice(0, 5)
  const facturesRecentes = factures.filter((f) => f.statut === 'a_verifier').slice(0, 5)

  return (
    <div>
      <TopBar
        title="Tableau de bord"
        subtitle={`Assistant de Travaux · ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
      />

      <div className="p-6 space-y-8">
        {/* KPIs */}
        <section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="ST en onboarding" value={stEnCours} subtitle="Dossiers en cours" icon={UserCheck} color="blue" />
            <StatCard label="Factures à vérifier" value={facturesAVerif} subtitle="En attente bon à payer" icon={CreditCard} color={facturesAVerif > 0 ? 'amber' : 'default'} />
            <StatCard label="Cautions actives" value={cautionsActives} subtitle="Retenues de garantie" icon={AlertTriangle} color={cautionsALiberer.length > 0 ? 'red' : 'green'} />
            <StatCard label="DOE en cours" value={doesEnCours} subtitle="Dossiers à finaliser" icon={FolderCheck} color="purple" />
          </div>
        </section>

        {/* Phases */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Domaines</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {PHASES.map((item) => (
              <a key={item.phase} href={item.href}
                className="block bg-white rounded-lg border border-gray-200 shadow-card p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{item.emoji}</span>
                  <span className="text-sm font-semibold text-gray-900">{item.label}</span>
                </div>
                <div className="space-y-1.5">
                  {item.tasks.map((t) => (
                    <p key={t} className="text-xs text-gray-400 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />{t}
                    </p>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ST en cours */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">ST en onboarding</h2>
              <a href="/at/onboarding-st" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Voir tout →</a>
            </div>

            {stRecents.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                <UserCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Aucun ST en onboarding</p>
                <p className="text-xs text-gray-400 mt-1">Ajoutez les sous-traitants du projet en cours.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stRecents.map((s) => {
                  const decAlert = s.decennale_validite && new Date(s.decennale_validite) <= in90
                  return (
                    <div key={s.id} className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-semibold text-orange-600 flex-shrink-0">
                            {s.nom[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{s.nom}</p>
                            <p className="text-xs text-gray-400">{s.corps_etat ?? 'Corps d\'état non précisé'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {decAlert && <span className="text-xs text-amber-600 font-medium">⚠ Décennale</span>}
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">En cours</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Factures en attente */}
            {facturesRecentes.length > 0 && (
              <>
                <div className="flex items-center justify-between mt-6">
                  <h2 className="text-sm font-semibold text-gray-700">Factures à vérifier</h2>
                  <a href="/at/admin-financiere" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Voir tout →</a>
                </div>
                <div className="space-y-2">
                  {facturesRecentes.map((f) => (
                    <div key={f.id} className="bg-white rounded-lg border border-amber-200 shadow-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{f.numero_facture ?? 'Sans numéro'}</p>
                          <p className="text-xs text-gray-400">{f.montant_ht.toLocaleString('fr-FR')} € HT</p>
                        </div>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">À vérifier</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Panneau droit */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">À traiter</h2>

            {cautionsALiberer.length > 0 && (
              <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <p className="text-xs font-semibold text-amber-700">
                    {cautionsALiberer.length} caution{cautionsALiberer.length > 1 ? 's' : ''} à libérer
                  </p>
                </div>
                <p className="text-xs text-amber-600">GPA terminée — libération de garantie à déclencher</p>
              </div>
            )}

            {decennalesAlert.length > 0 && (
              <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <p className="text-xs font-semibold text-orange-700">
                    {decennalesAlert.length} décennale{decennalesAlert.length > 1 ? 's' : ''} proches d&apos;expiration
                  </p>
                </div>
                {decennalesAlert.slice(0, 2).map((s) => (
                  <p key={s.id} className="text-xs text-orange-600">
                    · {s.nom} — expire {s.decennale_validite ? new Date(s.decennale_validite).toLocaleDateString('fr-FR') : '?'}
                  </p>
                ))}
              </div>
            )}

            {cautionsALiberer.length === 0 && decennalesAlert.length === 0 && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">Tout est à jour</p>
                <p className="text-xs text-gray-400 mt-1">Aucune action urgente.</p>
              </div>
            )}

            {/* Accès rapide */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 mb-3">Accès rapide</p>
              {[
                { href: '/at/onboarding-st',    label: 'Nouveau ST',           emoji: '🤝' },
                { href: '/at/admin-financiere', label: 'Saisir une caution',   emoji: '🏦' },
                { href: '/at/admin-financiere', label: 'Valider une facture',   emoji: '💰' },
                { href: '/at/cloture-doe',      label: 'Avancer sur le DOE',   emoji: '📁' },
              ].map((link, i) => (
                <a key={i} href={link.href}
                  className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 py-1 transition-colors">
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
                  <p className="text-xs font-semibold text-gray-600">Rôle AT</p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    Onboarding ST · Admin financière<br />
                    Clôture technique & envoi DOE.
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
