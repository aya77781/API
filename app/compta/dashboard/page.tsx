import { TrendingUp, CreditCard, Users, AlertTriangle, CheckCircle2, Clock, BarChart3, Shield, FileCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/co/StatCard'
import { TopBar } from '@/components/co/TopBar'
import { RecentDocumentNotifs } from '@/components/shared/RecentDocumentNotifs'

type Cloture = { id: string; mois: string; statut: string; factures_ok: boolean; rapprochement_ok: boolean; tva_calculee: boolean; transmis_expert: boolean; montant_tva_estime: number | null }
type Virement = { id: string; mois: string; numero_campagne: number; montant_total: number; statut: string; nb_virements: number }
type Caution  = { id: string; st_nom: string; montant: number; statut: string; date_fin_gpa: string | null }
type ATFacture = { id: string; montant_ht: number; statut: string }

function getMoisCourant() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function formatMois(m: string) {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

async function getDashboardData() {
  const supabase = createClient()
  const [cloturesRes, virementsRes, cautionsRes, facturesSTRes] = await Promise.all([
    supabase.schema('app').from('compta_clotures').select('*').order('mois', { ascending: false }).limit(6),
    supabase.schema('app').from('compta_virements').select('*').order('created_at', { ascending: false }).limit(10),
    supabase.schema('app').from('compta_cautions').select('*').order('date_fin_gpa', { ascending: true }),
    supabase.schema('app').from('at_factures').select('id,montant_ht,statut').in('statut', ['a_verifier', 'bon_a_payer']),
  ])
  return {
    clotures: (cloturesRes.data ?? []) as Cloture[],
    virements: (virementsRes.data ?? []) as Virement[],
    cautions: (cautionsRes.data ?? []) as Caution[],
    facturesST: (facturesSTRes.data ?? []) as ATFacture[],
  }
}

const PHASES = [
  { label: 'Trésorerie',  href: '/compta/tresorerie', icon: BarChart3,  tasks: ['Rapprochement bancaire', 'Clôture mensuelle', 'Estimation TVA'] },
  { label: 'Règlements',  href: '/compta/reglements', icon: CreditCard, tasks: ['Campagnes de virements', 'Arbitrage Direction', 'Exécution des paiements'] },
  { label: 'Gestion ST',  href: '/compta/gestion-st', icon: Users,      tasks: ['Validation factures ST', 'Intégration virements', 'Registre des cautions'] },
]

export default async function ComptaDashboardPage() {
  let data: { clotures: Cloture[]; virements: Virement[]; cautions: Caution[]; facturesST: ATFacture[] }
  try { data = await getDashboardData() }
  catch { data = { clotures: [], virements: [], cautions: [], facturesST: [] } }

  const { clotures, virements, cautions, facturesST } = data

  const mois = getMoisCourant()
  const clotureMois = clotures.find((c) => c.mois === mois)
  const virementsEnAttente = virements.filter((v) => ['preparation', 'arbitrage'].includes(v.statut)).length
  const facturesAValider   = facturesST.filter((f) => f.statut === 'a_verifier').length

  const now = new Date()
  const cautionsAliberer = cautions.filter((c) => c.statut === 'active' && c.date_fin_gpa && new Date(c.date_fin_gpa) <= now)

  const totalVirementsMois = virements
    .filter((v) => v.mois === mois && v.statut === 'execute')
    .reduce((s, v) => s + v.montant_total, 0)

  return (
    <div>
      <TopBar
        title="Tableau de bord"
        subtitle={`Comptabilité · ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
      />

      <div className="p-6 space-y-8">
        {/* KPIs */}
        <section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Clôture mensuelle"
              value={clotureMois ? (clotureMois.statut === 'transmis' ? 'OK' : '...') : '—'}
              subtitle={clotureMois ? (clotureMois.statut === 'transmis' ? 'Transmise à l\'expert' : 'En cours') : formatMois(mois)}
              icon={BarChart3}
              color={clotureMois?.statut === 'transmis' ? 'green' : 'blue'}
            />
            <StatCard
              label="Virements en attente"
              value={virementsEnAttente}
              subtitle="Campagnes à traiter"
              icon={CreditCard}
              color={virementsEnAttente > 0 ? 'amber' : 'default'}
            />
            <StatCard
              label="Factures ST à valider"
              value={facturesAValider}
              subtitle="Bons à payer en attente"
              icon={Users}
              color={facturesAValider > 0 ? 'amber' : 'default'}
            />
            <StatCard
              label="Cautions à libérer"
              value={cautionsAliberer.length}
              subtitle="GPA terminée"
              icon={AlertTriangle}
              color={cautionsAliberer.length > 0 ? 'red' : 'green'}
            />
          </div>
        </section>

        {/* Phases */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Domaines</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {PHASES.map((item) => {
              const Icon = item.icon
              return (
              <a key={item.label} href={item.href}
                className="block bg-white rounded-lg border border-gray-200 shadow-card p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-gray-600" />
                  </span>
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
            )})}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Suivi clôtures */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Clôtures mensuelles</h2>
              <a href="/compta/tresorerie" className="text-xs text-gray-400 hover:text-gray-700">Voir tout →</a>
            </div>

            {clotures.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-10 text-center">
                <BarChart3 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Aucune clôture enregistrée</p>
                <p className="text-xs text-gray-400 mt-1">Créez la première clôture mensuelle.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Mois</th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-500">Factures</th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-500">Rapproch.</th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-500">TVA</th>
                      <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-500">Expert</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {clotures.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">{formatMois(c.mois)}</td>
                        {[c.factures_ok, c.rapprochement_ok, c.tva_calculee, c.transmis_expert].map((ok, i) => (
                          <td key={i} className="px-3 py-3 text-center">
                            {ok
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                              : <span className="w-4 h-4 rounded-full border-2 border-gray-200 inline-block" />
                            }
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            c.statut === 'transmis' ? 'bg-emerald-50 text-emerald-600' :
                            c.statut === 'complet'  ? 'bg-blue-50 text-blue-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>
                            {c.statut === 'transmis' ? 'Transmis' : c.statut === 'complet' ? 'Complet' : 'En cours'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Virements récents */}
            {virements.length > 0 && (
              <>
                <div className="flex items-center justify-between mt-6">
                  <h2 className="text-sm font-semibold text-gray-700">Campagnes de virements</h2>
                  <a href="/compta/reglements" className="text-xs text-gray-400 hover:text-gray-700">Voir tout →</a>
                </div>
                <div className="space-y-2">
                  {virements.slice(0, 4).map((v) => (
                    <div key={v.id} className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Campagne {v.numero_campagne === 1 ? '1ère' : '2ème'} quinzaine — {formatMois(v.mois)}
                          </p>
                          <p className="text-xs text-gray-400">{v.montant_total.toLocaleString('fr-FR')} € · {v.nb_virements} virement{v.nb_virements > 1 ? 's' : ''}</p>
                        </div>
                        <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          v.statut === 'execute'     ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                          v.statut === 'valide'      ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                          v.statut === 'arbitrage'   ? 'bg-purple-50 text-purple-600 border border-purple-200' :
                          'bg-amber-50 text-amber-600 border border-amber-200'
                        }`}>
                          {v.statut === 'execute' ? 'Exécuté' : v.statut === 'valide' ? 'Validé' : v.statut === 'arbitrage' ? 'Arbitrage' : 'Préparation'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Panneau droit */}
          <div className="space-y-4">
            <RecentDocumentNotifs roleBase="compta" />
            <h2 className="text-sm font-semibold text-gray-700">À traiter</h2>

            {cautionsAliberer.length > 0 && (
              <div className="bg-red-50 rounded-lg border border-red-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <p className="text-xs font-semibold text-red-700">{cautionsAliberer.length} caution{cautionsAliberer.length > 1 ? 's' : ''} à libérer</p>
                </div>
                {cautionsAliberer.slice(0, 2).map((c) => (
                  <p key={c.id} className="text-xs text-red-600">· {c.st_nom} — {c.montant.toLocaleString('fr-FR')} €</p>
                ))}
              </div>
            )}

            {facturesAValider > 0 && (
              <a href="/compta/gestion-st" className="block bg-amber-50 rounded-lg border border-amber-200 p-4 hover:border-amber-300 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <p className="text-xs font-semibold text-amber-700">{facturesAValider} facture{facturesAValider > 1 ? 's' : ''} ST à valider</p>
                </div>
                <p className="text-xs text-amber-600">
                  Montant : {facturesST.filter((f) => f.statut === 'a_verifier').reduce((s, f) => s + f.montant_ht, 0).toLocaleString('fr-FR')} € HT
                </p>
              </a>
            )}

            {cautionsAliberer.length === 0 && facturesAValider === 0 && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-card p-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">Tout est à jour</p>
              </div>
            )}

            {/* Pennylane */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">Pennylane</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                Centralisation de toutes les pièces comptables (factures, devis, contrats) en temps réel.
                Accès via le portail Pennylane.
              </p>
              <p className="text-xs text-gray-500 mt-2 font-medium">Virements exécutés ce mois</p>
              <p className="text-lg font-semibold text-gray-900 mt-0.5">{totalVirementsMois.toLocaleString('fr-FR')} €</p>
            </div>

            {/* Accès rapide */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-card p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 mb-3">Accès rapide</p>
              {[
                { href: '/compta/tresorerie', label: 'Créer une clôture',      icon: BarChart3 },
                { href: '/compta/reglements', label: 'Nouvelle campagne',      icon: CreditCard },
                { href: '/compta/gestion-st', label: 'Valider une facture ST', icon: FileCheck },
                { href: '/compta/gestion-st', label: 'Saisir une caution',     icon: Shield },
              ].map((link, i) => {
                const Icon = link.icon
                return (
                <a key={i} href={link.href}
                  className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 py-1 transition-colors">
                  <Icon className="w-3.5 h-3.5 text-gray-400" />
                  <span>{link.label}</span>
                  <TrendingUp className="w-3 h-3 ml-auto text-gray-300" />
                </a>
              )})}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
