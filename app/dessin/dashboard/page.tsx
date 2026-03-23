import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/co/TopBar'
import { Lightbulb, Rocket, FileSearch, Hammer, FolderCheck, ArrowRight, CheckCircle, Clock } from 'lucide-react'
import Link from 'next/link'

export default async function DessinDashboard() {
  const supabase = await createClient()

  const [
    { data: plans },
    { data: notices },
    { data: variantes },
  ] = await Promise.all([
    supabase.schema('app').from('dessin_plans').select('id, statut, phase, type_plan, projet_nom'),
    supabase.schema('app').from('dessin_notices').select('id, statut'),
    supabase.schema('app').from('dessin_variantes').select('id, statut'),
  ])

  const plansData     = plans     ?? []
  const noticesData   = notices   ?? []
  const variantesData = variantes ?? []

  const plansEnCours     = plansData.filter(p => p.statut === 'en_cours').length
  const noticesAValider  = noticesData.filter(n => n.statut === 'brouillon').length
  const variantesAPrerendre = variantesData.filter(v => v.statut === 'proposee').length
  const doeEnCours       = plansData.filter(p => p.phase === 'cloture' && p.statut !== 'valide').length

  const phases = [
    { label: 'Conception',   href: '/dessin/conception',   icon: Lightbulb,   color: 'bg-amber-50 text-amber-600',  desc: 'APD, intentions, propositions' },
    { label: 'Lancement',    href: '/dessin/lancement',    icon: Rocket,      color: 'bg-blue-50 text-blue-600',    desc: 'Passation, notices, validation CO' },
    { label: 'Consultation', href: '/dessin/consultation', icon: FileSearch,  color: 'bg-purple-50 text-purple-600',desc: 'DCE, variantes ST' },
    { label: 'Chantier',     href: '/dessin/chantier',     icon: Hammer,      color: 'bg-orange-50 text-orange-600',desc: 'Plans EXE, indices A/B/C…' },
    { label: 'Clôture',      href: '/dessin/cloture',      icon: FolderCheck, color: 'bg-green-50 text-green-600',  desc: 'DOE, synthèse, avenants' },
  ]

  const stats = [
    { label: 'Plans en cours',         value: plansEnCours,        color: 'text-blue-600',   bg: 'bg-blue-50'   },
    { label: 'Notices à valider',      value: noticesAValider,     color: 'text-amber-600',  bg: 'bg-amber-50'  },
    { label: 'Variantes à traiter',    value: variantesAPrerendre, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'DOE en cours',           value: doeEnCours,          color: 'text-green-600',  bg: 'bg-green-50'  },
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
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Phase cards */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Phases de mission</h2>
          <div className="grid grid-cols-5 gap-3">
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
