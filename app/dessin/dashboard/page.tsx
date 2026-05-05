import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/co/TopBar'
import { Lightbulb, Rocket, FileSearch, Hammer, ArrowRight, CheckCircle, Clock, Inbox, Pencil } from 'lucide-react'
import Link from 'next/link'
import { RecentDocumentNotifs } from '@/components/shared/RecentDocumentNotifs'
import { Abbr } from '@/components/shared/Abbr'

const TAB_FOR_TYPE: Record<string, string> = {
  plan_intention: 'APS',
  plan_proposition: 'APD',
  plan_apd: 'AT',
}
const LABEL_TYPE: Record<string, string> = {
  plan_intention: 'Plan APS (V1)',
  plan_proposition: 'Plan APD (V2+)',
  plan_apd: 'Plan AT (final)',
}

export default async function DessinDashboard() {
  const supabase = await createClient()

  // User courant pour filtrer les demandes adressees
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profil } = user
    ? await supabase.schema('app').from('utilisateurs').select('id').eq('email', user.email!).maybeSingle()
    : { data: null }
  const myId = profil?.id ?? null

  const [
    { data: plans },
    { data: notices },
    { data: variantes },
    { data: demandes },
  ] = await Promise.all([
    supabase.schema('app').from('dessin_plans').select('id, statut, phase, type_plan, projet_nom'),
    supabase.schema('app').from('dessin_notices').select('id, statut'),
    supabase.schema('app').from('dessin_variantes').select('id, statut'),
    myId
      ? supabase.schema('app').from('demandes_travail')
          .select('id, projet_id, type, statut, version, message_demandeur, date_livraison_souhaitee, date_livraison_prevue, date_demande, demandeur_id, projet:projets(id, nom, reference)')
          .eq('destinataire_id', myId)
          .in('type', ['plan_intention', 'plan_proposition', 'plan_apd'])
          .in('statut', ['en_attente', 'en_cours'])
          .order('date_livraison_souhaitee', { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: null as null | unknown[] }),
  ])

  const plansData     = plans     ?? []
  const noticesData   = notices   ?? []
  const variantesData = variantes ?? []
  type DemandeRow = {
    id: string
    projet_id: string
    type: string | null
    statut: string | null
    version: number | null
    message_demandeur: string | null
    date_livraison_souhaitee: string | null
    date_livraison_prevue: string | null
    date_demande: string | null
    demandeur_id: string | null
    projet: { id: string; nom: string; reference: string | null } | { id: string; nom: string; reference: string | null }[] | null
  }
  const demandesData  = (demandes ?? []) as DemandeRow[]

  // Demandeurs : on charge leur prenom/nom
  const demandeurIds = Array.from(new Set(demandesData.map(d => d.demandeur_id).filter(Boolean))) as string[]
  const { data: demandeursData } = demandeurIds.length
    ? await supabase.schema('app').from('utilisateurs').select('id, prenom, nom').in('id', demandeurIds)
    : { data: null as null | { id: string; prenom: string; nom: string }[] }
  const demandeurs = new Map((demandeursData ?? []).map(u => [u.id, u]))

  const plansEnCours     = plansData.filter(p => p.statut === 'en_cours').length
  const noticesAValider  = noticesData.filter(n => n.statut === 'brouillon').length
  const variantesAPrerendre = variantesData.filter(v => v.statut === 'proposee').length
  const demandesATraiter = demandesData.length

  const phases: { label: string; href: string; icon: typeof Lightbulb; color: string; desc: React.ReactNode }[] = [
    { label: 'Lancement',    href: '/dessin/lancement',    icon: Rocket,      color: 'bg-blue-50 text-blue-600',    desc: <>Passation, notices, validation <Abbr k="CO" /></> },
    { label: 'Consultation', href: '/dessin/consultation', icon: FileSearch,  color: 'bg-purple-50 text-purple-600',desc: <><Abbr k="DCE" />, variantes <Abbr k="ST" /></> },
    { label: 'Chantier',     href: '/dessin/chantier',     icon: Hammer,      color: 'bg-orange-50 text-orange-600',desc: <>Plans <Abbr k="EXE" />, indices A/B/C…</> },
  ]

  const stats: { label: React.ReactNode; value: number; color: string; bg: string }[] = [
    { label: 'Demandes à traiter',     value: demandesATraiter,    color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Plans en cours',         value: plansEnCours,        color: 'text-blue-600',   bg: 'bg-blue-50'   },
    { label: 'Notices à valider',      value: noticesAValider,     color: 'text-amber-600',  bg: 'bg-amber-50'  },
    { label: 'Variantes à traiter',    value: variantesAPrerendre, color: 'text-purple-600', bg: 'bg-purple-50' },
  ]

  const recentPlans = plansData.slice(0, 6)

  const PHASE_LABEL: Record<string, string> = {
    conception: 'Conception', lancement: 'Lancement', consultation: 'Consultation',
    chantier: 'Chantier', cloture: 'Clôture',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Tableau de bord" subtitle="Vue globale — Dessinatrice" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Demandes de conception du commercial */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Inbox className="w-4 h-4 text-violet-600" />
              Demandes de conception
              {demandesATraiter > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-600 text-white font-bold">{demandesATraiter}</span>
              )}
            </h2>
          </div>
          {demandesATraiter === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-400 italic">
              Aucune demande en attente. Tu seras notifie ici quand un commercial te demandera un plan.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {demandesData.map(d => {
                const projet = Array.isArray(d.projet) ? d.projet[0] : d.projet
                const dem = d.demandeur_id ? demandeurs.get(d.demandeur_id) : null
                const tab = TAB_FOR_TYPE[d.type ?? ''] ?? 'APS'
                const dateLim = d.date_livraison_souhaitee ?? d.date_livraison_prevue
                const days = dateLim ? Math.ceil((new Date(dateLim).getTime() - Date.now()) / 86400000) : null
                const tone = d.statut === 'en_cours'
                  ? 'bg-amber-50 border-amber-200'
                  : days != null && days < 0 ? 'bg-red-50 border-red-200'
                  : days != null && days <= 4 ? 'bg-orange-50 border-orange-200'
                  : 'bg-violet-50 border-violet-200'
                const dotCls = d.statut === 'en_cours' ? 'bg-amber-500' :
                  days != null && days < 0 ? 'bg-red-500' :
                  days != null && days <= 4 ? 'bg-orange-500' : 'bg-violet-500'
                return (
                  <Link
                    key={d.id}
                    href={`/dessin/projets/${d.projet_id}?tab=${tab}`}
                    className={`block rounded-xl border p-4 hover:shadow-md transition-all ${tone}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Pencil className="w-4 h-4 text-violet-600 flex-shrink-0" />
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-gray-900 text-white">{tab}</span>
                        <span className={`w-2 h-2 rounded-full ${dotCls}`} />
                        <span className="text-xs text-gray-600">{d.statut === 'en_cours' ? 'En cours' : 'A traiter'}</span>
                      </div>
                      {dateLim && (
                        <span className="text-xs text-gray-500 inline-flex items-center gap-1 flex-shrink-0">
                          <Clock className="w-3 h-3" />
                          {days != null && days < 0 ? `Retard ${Math.abs(days)}j` : days != null ? `J-${days}` : '—'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {projet?.reference ? `${projet.reference} — ` : ''}{projet?.nom ?? '—'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{LABEL_TYPE[d.type ?? ''] ?? d.type}</p>
                    {dem && <p className="text-xs text-gray-400 mt-1">Par {dem.prenom} {dem.nom}</p>}
                    {d.message_demandeur && (
                      <p className="text-xs text-gray-600 mt-2 line-clamp-2">{d.message_demandeur}</p>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Phase cards */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Phases de mission</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {phases.map(p => {
              const Icon = p.icon
              return (
                <Link key={p.href} href={p.href}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all group">
                  <div className={`w-10 h-10 rounded-lg ${p.color} flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{p.label}</p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">{p.desc}</p>
                  <div className="mt-3 flex items-center gap-1 text-xs text-gray-400 group-hover:text-gray-600">
                    <span>Accéder</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Bottom */}
        <div className="grid grid-cols-3 gap-4">
          {/* Recent plans */}
          <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Plans récents</h3>
            {recentPlans.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Aucun plan créé</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-2 font-medium">Projet</th>
                    <th className="text-left pb-2 font-medium">Type</th>
                    <th className="text-left pb-2 font-medium">Phase</th>
                    <th className="text-left pb-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentPlans.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="py-2 font-medium text-gray-900">{p.projet_nom}</td>
                      <td className="py-2 text-gray-600">{p.type_plan}</td>
                      <td className="py-2 text-gray-500">{PHASE_LABEL[p.phase] ?? p.phase}</td>
                      <td className="py-2">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.statut === 'valide'   ? 'bg-green-100 text-green-700' :
                          p.statut === 'soumis'   ? 'bg-blue-100 text-blue-700'  :
                          p.statut === 'refuse'   ? 'bg-red-100 text-red-700'    :
                          p.statut === 'archive'  ? 'bg-gray-100 text-gray-500'  :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {p.statut === 'valide' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {p.statut}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Quick access */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <RecentDocumentNotifs roleBase="dessin" />
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Accès rapide</h3>
            <div className="space-y-2">
              {phases.map(p => {
                const Icon = p.icon
                return (
                  <Link key={p.href} href={p.href}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group">
                    <div className={`w-7 h-7 rounded-lg ${p.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">{p.label}</span>
                    <ArrowRight className="w-3 h-3 text-gray-300 ml-auto group-hover:text-gray-500" />
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
