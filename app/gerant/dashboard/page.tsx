import { createClient } from '@/lib/supabase/server'
import { Users, FolderOpen, ShieldCheck, Briefcase } from 'lucide-react'
import { RecentDocumentNotifs } from '@/components/shared/RecentDocumentNotifs'

async function getStats() {
  const supabase = createClient()

  const [usersRes, projetsRes] = await Promise.all([
    supabase.schema('app').from('utilisateurs').select('id, actif, categorie'),
    supabase.schema('app').from('projets').select('id, statut'),
  ])

  const users = usersRes.data ?? []
  const projets = projetsRes.data ?? []

  return {
    totalUsers: users.length,
    actifs: users.filter(u => u.actif).length,
    internes: users.filter(u => u.categorie === 'interne').length,
    projetsEnCours: projets.filter(p => !['cloture', 'gpa', 'termine'].includes(p.statut)).length,
    totalProjets: projets.length,
  }
}

export default async function GerantDashboardPage() {
  const stats = await getStats()

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Tableau de bord</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}       label="Comptes actifs"     value={stats.actifs}         sub={`${stats.totalUsers} au total`}      color="blue" />
        <StatCard icon={Briefcase}   label="Équipe interne"     value={stats.internes}       sub="Collaborateurs"                       color="purple" />
        <StatCard icon={FolderOpen}  label="Projets en cours"   value={stats.projetsEnCours} sub={`${stats.totalProjets} au total`}    color="amber" />
        <StatCard icon={ShieldCheck} label="Administration"     value="→"                    sub="Gérer les comptes"  href="/gerant/admin" color="emerald" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Accès rapide</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Projets',          href: '/gerant/projets',   icon: FolderOpen },
            { label: 'Équipe',           href: '/gerant/equipe',    icon: Users },
            { label: 'Gestion comptes',  href: '/gerant/admin',     icon: ShieldCheck },
            { label: 'Finance',          href: '/gerant/finance',   icon: Briefcase },
          ].map(item => (
            <a
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-center"
            >
              <item.icon className="w-5 h-5 text-gray-500" />
              <span className="text-xs font-medium text-gray-700">{item.label}</span>
            </a>
          ))}
        </div>
      </div>

      <RecentDocumentNotifs roleBase="gerant" />
    </div>
  )
}

function StatCard({
  icon: Icon, label, value, sub, color, href,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  sub: string
  color: 'blue' | 'purple' | 'amber' | 'emerald'
  href?: string
}) {
  const colors = {
    blue:    'bg-blue-50 text-blue-600',
    purple:  'bg-purple-50 text-purple-600',
    amber:   'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  }
  const Wrapper = href ? 'a' : 'div'
  return (
    <Wrapper
      {...(href ? { href } : {})}
      className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 hover:border-gray-300 transition-colors"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        <p className="text-xs font-medium text-gray-700 mt-0.5">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
    </Wrapper>
  )
}
