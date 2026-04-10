'use client'

import { useEffect, useState } from 'react'
import {
  UserPlus, UserCheck, BadgeEuro, Calendar,
  CheckCircle2, Briefcase, Sprout, Building2,
  ArrowRight, Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { RecentDocumentNotifs } from '@/components/shared/RecentDocumentNotifs'

type Candidat = { id: string; nom: string; prenom: string; pole_cible: string | null; statut: string; matching_pct: number | null }
type Employe  = { id: string; nom: string; prenom: string; poste: string | null; date_entree: string | null }
type OnbItem  = { employe_id: string; done: boolean }
type Entretien = { id: string; employe_id: string; type: string; date_prevue: string; statut: string }
type Salaire   = { id: string; employe_id: string; net_a_payer: number; statut: string }

const STATUT_CANDIDAT: Record<string, { label: string; color: string }> = {
  nouveau:             { label: 'Nouveau',            color: 'bg-gray-100 text-gray-600' },
  en_etude:            { label: 'En étude',           color: 'bg-blue-50 text-blue-600' },
  entretien_planifie:  { label: 'Entretien planifié', color: 'bg-purple-50 text-purple-600' },
  entretien_fait:      { label: 'Entretien fait',     color: 'bg-purple-50 text-purple-600' },
  offre_envoyee:       { label: 'Offre envoyée',      color: 'bg-amber-50 text-amber-600' },
  recrute:             { label: 'Recruté',            color: 'bg-emerald-50 text-emerald-600' },
  refuse:              { label: 'Refusé',             color: 'bg-red-50 text-red-500' },
}

const DOMAINES_RH = [
  { label: 'Recrutement', href: '/rh/recrutement', Icon: UserPlus,  tasks: ['Sourcing & offres', 'Présélection & entretiens'] },
  { label: 'Onboarding',  href: '/rh/onboarding',  Icon: UserCheck, tasks: ['Installation logistique', 'Administratif & carte BTP'] },
  { label: 'Vie Sociale', href: '/rh/vie-sociale', Icon: Sprout,    tasks: ['Contrats & entretiens', 'Formation & dossiers'] },
  { label: 'Paie',        href: '/rh/paie',        Icon: BadgeEuro, tasks: ['Variables de paie', 'Suivi des virements'] },
  { label: 'Transverse',  href: '/rh/transverse',  Icon: Building2, tasks: ['Achats internes', 'Fournisseurs prestataires'] },
]

export default function RHDashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [candidats, setCandidats] = useState<Candidat[]>([])
  const [employes, setEmployes] = useState<Employe[]>([])
  const [onbItems, setOnbItems] = useState<OnbItem[]>([])
  const [entretiens, setEntretiens] = useState<Entretien[]>([])
  const [salaires, setSalaires] = useState<Salaire[]>([])

  useEffect(() => {
    async function load() {
      const trois = new Date()
      trois.setMonth(trois.getMonth() - 3)
      const moisCourant = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

      const [candR, empR, onbR, entR, salR] = await Promise.all([
        supabase.from('candidats').select('id,nom,prenom,pole_cible,statut,matching_pct').order('created_at', { ascending: false }),
        supabase.from('employes').select('id,nom,prenom,poste,date_entree').eq('actif', true).gte('date_entree', trois.toISOString().slice(0, 10)),
        supabase.from('onboarding_items').select('employe_id,done'),
        supabase.from('entretiens').select('id,employe_id,type,date_prevue,statut').order('date_prevue'),
        supabase.from('salaires').select('id,employe_id,net_a_payer,statut').like('mois', `${moisCourant}%`),
      ])
      setCandidats((candR.data ?? []) as Candidat[])
      setEmployes((empR.data ?? []) as Employe[])
      setOnbItems((onbR.data ?? []) as OnbItem[])
      setEntretiens((entR.data ?? []) as Entretien[])
      setSalaires((salR.data ?? []) as Salaire[])
      setLoading(false)
    }
    load()
  }, [])

  const candidatsActifs = candidats.filter(c => !['recrute', 'refuse'].includes(c.statut)).length
  const now = new Date()
  const in30days = new Date(now.getTime() + 30 * 86400000)
  const entretiensProchains = entretiens.filter(e =>
    e.statut === 'planifie' && new Date(e.date_prevue) >= now && new Date(e.date_prevue) <= in30days
  )
  const salairesEnAttente = salaires.filter(s => s.statut === 'en_attente').length
  const totalNetEnAttente = salaires.filter(s => s.statut === 'en_attente').reduce((s, x) => s + Number(x.net_a_payer ?? 0), 0)
  const candidatsRecents = candidats.filter(c => !['recrute', 'refuse'].includes(c.statut)).slice(0, 5)

  const onbByEmp: Record<string, { done: number; total: number }> = {}
  for (const it of onbItems) {
    const cur = onbByEmp[it.employe_id] ??= { done: 0, total: 0 }
    cur.total += 1
    if (it.done) cur.done += 1
  }

  return (
    <div>
      <TopBar
        title="Tableau de bord RH"
        subtitle={`Ressources Humaines · ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
      />
      <div className="p-6 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="Candidats actifs" value={candidatsActifs} sub="En cours de recrutement" Icon={UserPlus} />
              <Kpi label="Onboardings" value={employes.length} sub="Arrivés dans les 3 mois" Icon={UserCheck} />
              <Kpi label="Salaires à payer" value={salairesEnAttente} sub={totalNetEnAttente > 0 ? `${totalNetEnAttente.toLocaleString('fr-FR')} €` : 'Ce mois'} Icon={BadgeEuro} />
              <Kpi label="Entretiens 30j" value={entretiensProchains.length} sub="Planifiés" Icon={Calendar} />
            </div>

            {/* Domaines */}
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Domaines RH</h2>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {DOMAINES_RH.map(item => (
                  <a key={item.href} href={item.href} className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition">
                    <div className="flex items-center gap-2 mb-2">
                      <item.Icon className="w-4 h-4 text-gray-600" />
                      <span className="text-xs font-semibold text-gray-900">{item.label}</span>
                    </div>
                    {item.tasks.map(t => (
                      <p key={t} className="text-xs text-gray-400 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />{t}
                      </p>
                    ))}
                  </a>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-3">
                {/* Candidats */}
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-700">Candidats en cours</h2>
                  <a href="/rh/recrutement" className="text-xs text-gray-400 hover:text-gray-700 inline-flex items-center gap-1">Voir tout <ArrowRight className="w-3 h-3" /></a>
                </div>
                {candidatsRecents.length === 0 ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
                    <UserPlus className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-700">Aucun recrutement en cours</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {candidatsRecents.map(c => {
                      const s = STATUT_CANDIDAT[c.statut] ?? { label: c.statut, color: 'bg-gray-100 text-gray-600' }
                      return (
                        <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-600 flex-shrink-0">
                            {(c.prenom?.[0] ?? '').toUpperCase()}{(c.nom?.[0] ?? '').toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{c.prenom} {c.nom}</p>
                            <p className="text-xs text-gray-400">{c.pole_cible ?? '—'}{c.matching_pct != null && ` · ${c.matching_pct}%`}</p>
                          </div>
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>{s.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Onboardings */}
                {employes.length > 0 && (
                  <>
                    <div className="flex items-center justify-between mt-6">
                      <h2 className="text-sm font-semibold text-gray-700">Onboardings en cours</h2>
                      <a href="/rh/onboarding" className="text-xs text-gray-400 hover:text-gray-700 inline-flex items-center gap-1">Voir tout <ArrowRight className="w-3 h-3" /></a>
                    </div>
                    <div className="space-y-2">
                      {employes.map(o => {
                        const prog = onbByEmp[o.id] ?? { done: 0, total: 0 }
                        const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0
                        return (
                          <div key={o.id} className="bg-white rounded-lg border border-gray-200 p-4">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{o.prenom} {o.nom}</p>
                                <p className="text-xs text-gray-400">{o.poste ?? '—'} · Arrivée {o.date_entree ? new Date(o.date_entree).toLocaleDateString('fr-FR') : '—'}</p>
                              </div>
                              <span className="text-xs text-gray-500">{prog.done}/{prog.total} · {pct}%</span>
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

              {/* Colonne droite */}
              <div className="space-y-4">
                <RecentDocumentNotifs roleBase="rh" />
                <h2 className="text-sm font-semibold text-gray-700">À traiter</h2>

                {salairesEnAttente > 0 && (
                  <a href="/rh/paie" className="block bg-amber-50 rounded-lg border border-amber-200 p-4 hover:border-amber-300 transition">
                    <div className="flex items-center gap-2 mb-1">
                      <BadgeEuro className="w-4 h-4 text-amber-500" />
                      <p className="text-xs font-semibold text-amber-700">{salairesEnAttente} salaire{salairesEnAttente > 1 ? 's' : ''} à virer</p>
                    </div>
                    <p className="text-xs text-amber-600">Total net : {totalNetEnAttente.toLocaleString('fr-FR')} €</p>
                  </a>
                )}

                {entretiensProchains.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-purple-500" />
                      <p className="text-xs font-semibold text-gray-700">Prochains entretiens</p>
                    </div>
                    {entretiensProchains.slice(0, 3).map(e => (
                      <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                        <p className="text-xs font-medium text-gray-800">{e.type}</p>
                        <p className="text-xs text-gray-500">{new Date(e.date_prevue).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
                      </div>
                    ))}
                  </div>
                )}

                {salairesEnAttente === 0 && entretiensProchains.length === 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">Tout est à jour</p>
                  </div>
                )}

                <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 mb-3">Accès rapide</p>
                  {[
                    { href: '/rh/recrutement', label: 'Importer un CV',        Icon: UserPlus },
                    { href: '/rh/onboarding',  label: 'Voir les onboardings',  Icon: UserCheck },
                    { href: '/rh/vie-sociale', label: 'Planifier un entretien',Icon: Calendar },
                    { href: '/rh/paie',        label: 'Saisir la paie',        Icon: BadgeEuro },
                  ].map(link => (
                    <a key={link.href} href={link.href} className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 py-1 transition">
                      <link.Icon className="w-3.5 h-3.5 text-gray-400" />
                      <span>{link.label}</span>
                      <ArrowRight className="w-3 h-3 ml-auto text-gray-300" />
                    </a>
                  ))}
                </div>

                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start gap-3">
                    <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-gray-600">Rôle RH</p>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        Recrutement · Onboarding · Vie sociale<br />
                        Paie · Achats internes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, Icon }: { label: string; value: number; sub: string; Icon: React.ElementType }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-gray-600" />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className="text-xl font-semibold text-gray-900">{value}</p>
        <p className="text-[10px] text-gray-400">{sub}</p>
      </div>
    </div>
  )
}
