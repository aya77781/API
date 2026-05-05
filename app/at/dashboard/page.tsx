import { AlertTriangle, CheckCircle2, Clock, TrendingUp, UserCheck, FileText, Shield, FolderClosed, Plus, CreditCard, Landmark } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/co/TopBar'
import { RecentDocumentNotifs } from '@/components/shared/RecentDocumentNotifs'
import { Abbr } from '@/components/shared/Abbr'

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

/* ── SVG Icons ── */

function IconPersonnes() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 14c0-2.8 2.2-5 5-5" />
      <circle cx="11" cy="5" r="2.5" />
      <path d="M15 14c0-2.8-2.2-5-5-5" />
    </svg>
  )
}
function IconDocument() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <rect x="2" y="1" width="10" height="13" rx="1.5" />
      <path d="M5 5h5M5 8h4M5 11h2" />
    </svg>
  )
}
function IconBouclier() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M8 1l6 2.5v4.5c0 3.5-2.5 6-6 7.5C2.5 14 0 11.5 0 8V3.5L8 1z" />
    </svg>
  )
}
function IconDossier() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M2 3h5l2 2h5v9H2z" />
    </svg>
  )
}
function IconOnboarding() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <circle cx="9" cy="6" r="3" />
      <path d="M2 17c0-3.9 3.1-7 7-7s7 3.1 7 7" />
      <path d="M13 8l2 2 4-3" opacity=".7" />
    </svg>
  )
}
function IconFinanciere() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <rect x="1" y="4" width="16" height="11" rx="2" />
      <path d="M1 8h16" opacity=".5" />
      <path d="M5 12h3M10 12h2" opacity=".6" />
    </svg>
  )
}
function IconClotureDoe() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M3 3h7l3 3v11H3z" />
      <path d="M10 3v4h4" />
      <path d="M6 10h6M6 13h4" />
    </svg>
  )
}

/* ── Stat Card custom ── */

function StatCardSvg({ label, value, subtitle, icon, bg, color }: {
  label: React.ReactNode; value: number; subtitle: React.ReactNode
  icon: React.ReactNode; bg: string; color: string
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-card p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-gray-900">{value}</p>
          <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>
        </div>
        <div className="p-2.5 rounded-lg flex-shrink-0" style={{ backgroundColor: bg, color }}>
          {icon}
        </div>
      </div>
    </div>
  )
}

/* ── Domaines ── */

const DOMAINES: Array<{
  phase: string
  label: React.ReactNode
  href: string
  icon: React.ReactNode
  bg: string
  color: string
  tasks: React.ReactNode[]
}> = [
  {
    phase: 'onboarding_st', label: <>Onboarding <Abbr k="ST" /></>, href: '/at/onboarding-st',
    icon: <IconOnboarding />, bg: '#E6F1FB', color: '#185FA5',
    tasks: ['Collecte admin & vigilance sociale', 'Verification assurances & contrats'],
  },
  {
    phase: 'admin_financiere', label: 'Admin Financiere', href: '/at/admin-financiere',
    icon: <IconFinanciere />, bg: '#FAEEDA', color: '#854F0B',
    tasks: ['Compte prorata & cautions', 'Controle & bon a payer factures'],
  },
  {
    phase: 'cloture_doe', label: <>Cloture <Abbr k="DOE" /></>, href: '/at/cloture-doe',
    icon: <IconClotureDoe />, bg: '#EEEDFE', color: '#534AB7',
    tasks: ['Collecte technique & plans', <>Finalisation & envoi <Abbr k="DOE" /></>],
  },
]

export default async function ATDashboardPage() {
  let data: { sts: ST[]; factures: Facture[]; cautions: Caution[]; does: DOE[] }
  try { data = await getDashboardData() }
  catch { data = { sts: [], factures: [], cautions: [], does: [] } }

  const { sts, factures, cautions, does } = data

  const stEnCours       = sts.filter((s) => s.statut === 'en_cours').length
  const facturesAVerif  = factures.filter((f) => f.statut === 'a_verifier').length
  const cautionsActives = cautions.filter((c) => c.statut === 'active').length
  const doesEnCours     = does.filter((d) => d.statut === 'en_cours').length

  const now = new Date()
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  const decennalesAlert = sts.filter((s) => {
    if (!s.decennale_validite || !s.decennale_ok) return false
    return new Date(s.decennale_validite) <= in90
  })

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
            <StatCardSvg label={<><Abbr k="ST" /> en onboarding</>} value={stEnCours} subtitle="Dossiers en cours"
              icon={<IconPersonnes />} bg="#E6F1FB" color="#185FA5" />
            <StatCardSvg label="Factures a verifier" value={facturesAVerif} subtitle="En attente bon a payer"
              icon={<IconDocument />} bg="#FAEEDA" color="#854F0B" />
            <StatCardSvg label="Cautions actives" value={cautionsActives} subtitle="Retenues de garantie"
              icon={<IconBouclier />} bg="#EAF3DE" color="#3B6D11" />
            <StatCardSvg label={<><Abbr k="DOE" /> en cours</>} value={doesEnCours} subtitle="Dossiers a finaliser"
              icon={<IconDossier />} bg="#EEEDFE" color="#534AB7" />
          </div>
        </section>

        {/* Domaines */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Domaines</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {DOMAINES.map((item) => (
              <a key={item.phase} href={item.href}
                className="block bg-white rounded-lg border border-gray-200 shadow-card p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="p-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: item.bg, color: item.color }}>
                    {item.icon}
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{item.label}</span>
                </div>
                <div className="space-y-1.5">
                  {item.tasks.map((t, i) => (
                    <p key={i} className="text-xs text-gray-400 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />{t}
                    </p>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700"><Abbr k="ST" /> en onboarding</h2>
              <a href="/at/onboarding-st" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Voir tout →</a>
            </div>

            {stRecents.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                <UserCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Aucun <Abbr k="ST" /> en onboarding</p>
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
                            <p className="text-xs text-gray-400">{s.corps_etat ?? 'Corps d\'etat non precise'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {decAlert && (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              Decennale
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">En cours</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {facturesRecentes.length > 0 && (
              <>
                <div className="flex items-center justify-between mt-6">
                  <h2 className="text-sm font-semibold text-gray-700">Factures a verifier</h2>
                  <a href="/at/admin-financiere" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Voir tout →</a>
                </div>
                <div className="space-y-2">
                  {facturesRecentes.map((f) => (
                    <div key={f.id} className="bg-white rounded-lg border border-amber-200 shadow-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{f.numero_facture ?? 'Sans numero'}</p>
                          <p className="text-xs text-gray-400">{f.montant_ht.toLocaleString('fr-FR')} € <Abbr k="HT" /></p>
                        </div>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">A verifier</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="space-y-4">
            <RecentDocumentNotifs roleBase="at" />
            <h2 className="text-sm font-semibold text-gray-700">A traiter</h2>

            {cautionsALiberer.length > 0 && (
              <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <p className="text-xs font-semibold text-amber-700">
                    {cautionsALiberer.length} caution{cautionsALiberer.length > 1 ? 's' : ''} a liberer
                  </p>
                </div>
                <p className="text-xs text-amber-600"><Abbr k="GPA" /> terminee — liberation de garantie a declencher</p>
              </div>
            )}

            {decennalesAlert.length > 0 && (
              <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <p className="text-xs font-semibold text-orange-700">
                    {decennalesAlert.length} decennale{decennalesAlert.length > 1 ? 's' : ''} proches d&apos;expiration
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
                <p className="text-sm font-medium text-gray-700">Tout est a jour</p>
                <p className="text-xs text-gray-400 mt-1">Aucune action urgente.</p>
              </div>
            )}

            {/* Acces rapide */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 mb-3">Acces rapide</p>
              {[
                { href: '/at/onboarding-st',    label: <>Nouveau <Abbr k="ST" /></>, Icon: Plus },
                { href: '/at/admin-financiere', label: 'Saisir une caution',         Icon: Shield },
                { href: '/at/admin-financiere', label: 'Valider une facture',        Icon: CreditCard },
                { href: '/at/compte-prorata',   label: 'Compte prorata',             Icon: Landmark },
                { href: '/at/cloture-doe',      label: <>Avancer sur le <Abbr k="DOE" /></>, Icon: FolderClosed },
              ].map((link, i) => (
                <a key={i} href={link.href}
                  className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 py-1 transition-colors">
                  <link.Icon className="w-3.5 h-3.5 text-gray-400" />
                  <span>{link.label}</span>
                  <Clock className="w-3 h-3 ml-auto text-gray-300" />
                </a>
              ))}
            </div>

            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-600">Role <Abbr k="AT" /></p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    Onboarding <Abbr k="ST" /> · Admin financiere · Cloture technique & envoi <Abbr k="DOE" />. Aussi responsable du compte prorata (<Abbr k="DIC" /> & repartition <Abbr k="ST" />).
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <FileText className="w-4 h-4 text-gray-400 mb-2" />
              <p className="text-xs text-gray-400 leading-relaxed">Pour gerer les Depenses d&apos;Interet Commun (<Abbr k="DIC" />) et la repartition par <Abbr k="ST" />, voir <a href="/at/compte-prorata" className="text-gray-700 font-medium hover:underline">Compte prorata</a>.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
