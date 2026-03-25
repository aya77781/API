import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, UserCheck, UserX, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

async function getStats() {
  const supabase = createClient()
  const { data } = await supabase
    .schema('app')
    .from('utilisateurs')
    .select('id, actif, categorie, role')

  const users = data ?? []
  return {
    total: users.length,
    actifs: users.filter(u => u.actif).length,
    inactifs: users.filter(u => !u.actif).length,
    parCategorie: {
      interne:  users.filter(u => u.categorie === 'interne').length,
      st:       users.filter(u => u.categorie === 'st').length,
      controle: users.filter(u => u.categorie === 'controle').length,
      client:   users.filter(u => u.categorie === 'client').length,
    },
  }
}

export default async function AdminDashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.user_metadata?.role !== 'admin') redirect('/login')

  const stats = await getStats()

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Administration</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={Users}     label="Total comptes"  value={stats.total}    color="gray" />
        <StatCard icon={UserCheck} label="Actifs"         value={stats.actifs}   color="emerald" />
        <StatCard icon={UserX}     label="Inactifs"       value={stats.inactifs} color="red" />
      </div>

      {/* Répartition par catégorie */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Répartition par catégorie</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { key: 'interne',  label: 'Équipe interne',  count: stats.parCategorie.interne,  color: 'bg-blue-50 text-blue-700 border-blue-200' },
            { key: 'st',       label: 'Sous-traitants',  count: stats.parCategorie.st,       color: 'bg-amber-50 text-amber-700 border-amber-200' },
            { key: 'controle', label: 'Contrôle',        count: stats.parCategorie.controle, color: 'bg-purple-50 text-purple-700 border-purple-200' },
            { key: 'client',   label: 'Clients',         count: stats.parCategorie.client,   color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          ].map(cat => (
            <div key={cat.key} className={`rounded-lg border p-4 ${cat.color}`}>
              <p className="text-2xl font-semibold">{cat.count}</p>
              <p className="text-xs font-medium mt-1">{cat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Accès rapide */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Actions rapides</h2>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          <ShieldCheck className="w-4 h-4" />
          Gérer les comptes utilisateurs
        </Link>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon, label, value, color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  color: 'gray' | 'emerald' | 'red'
}) {
  const colors = {
    gray:    'bg-gray-100 text-gray-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red:     'bg-red-50 text-red-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        <p className="text-xs font-medium text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}
