import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, UserCheck, UserX, FolderOpen, AlertTriangle, FileText } from 'lucide-react'
import { TopBar } from '@/components/co/TopBar'

const ROLE_LABELS: Record<string, string> = {
  co: "Chargé d'opérations", commercial: 'Commercial', economiste: 'Économiste',
  dessinatrice: 'Dessinatrice', comptable: 'Comptable', gerant: 'Gérant',
  admin: 'Administrateur', rh: 'RH', cho: 'CHO', assistant_travaux: 'AT', st: 'ST',
}

const STATUT_LABELS: Record<string, string> = {
  en_cours: 'En cours', termine: 'Terminé', suspendu: 'Suspendu',
  brouillon: 'Brouillon', livre: 'Livré',
}

async function getDashboardData() {
  const supabase = createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [usersRes, projetsRes, alertesCritiquesRes, docsAujourdhuiRes, recentAlertesRes, recentProjetsRes] =
    await Promise.all([
      supabase.schema('app').from('utilisateurs').select('id, actif, role'),
      supabase.schema('app').from('projets').select('id, statut'),
      supabase.schema('app').from('alertes')
        .select('id', { count: 'exact', head: true })
        .in('priorite', ['high', 'urgent']).eq('lue', false),
      supabase.schema('app').from('documents')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today.toISOString()),
      supabase.schema('app').from('alertes')
        .select('id, titre, message, priorite, lue, created_at, projet_id, utilisateur_id')
        .order('created_at', { ascending: false }).limit(10),
      supabase.schema('app').from('projets')
        .select('id, nom, reference, statut, co_id, commercial_id, created_at')
        .order('created_at', { ascending: false }).limit(5),
    ])

  const users = usersRes.data ?? []
  const projets = projetsRes.data ?? []

  // Fetch user names for recent alertes and recent projets
  const alertes = recentAlertesRes.data ?? []
  const recentProjets = recentProjetsRes.data ?? []

  const userIds = [
    ...new Set([
      ...alertes.map(a => a.utilisateur_id).filter(Boolean),
      ...recentProjets.map(p => p.co_id).filter(Boolean),
      ...recentProjets.map(p => p.commercial_id).filter(Boolean),
    ])
  ] as string[]

  const projetIds = [...new Set(alertes.map(a => a.projet_id).filter(Boolean))] as string[]

  const [usersMapRes, projetsMapRes] = await Promise.all([
    userIds.length > 0
      ? supabase.schema('app').from('utilisateurs').select('id, prenom, nom').in('id', userIds)
      : { data: [] },
    projetIds.length > 0
      ? supabase.schema('app').from('projets').select('id, nom').in('id', projetIds)
      : { data: [] },
  ])

  const usersMap = new Map((usersMapRes.data ?? []).map(u => [u.id, u]))
  const projetsMap = new Map((projetsMapRes.data ?? []).map(p => [p.id, p]))

  // Role distribution
  const roleCount: Record<string, { total: number; actifs: number }> = {}
  for (const u of users) {
    if (!roleCount[u.role]) roleCount[u.role] = { total: 0, actifs: 0 }
    roleCount[u.role].total++
    if (u.actif) roleCount[u.role].actifs++
  }

  return {
    stats: {
      total: users.length,
      actifs: users.filter(u => u.actif).length,
      inactifs: users.filter(u => !u.actif).length,
      projetsActifs: projets.filter(p => p.statut !== 'termine' && p.statut !== 'livre').length,
      alertesCritiques: alertesCritiquesRes.count ?? 0,
      docsAujourdhui: docsAujourdhuiRes.count ?? 0,
    },
    roleCount,
    recentAlertes: alertes.map(a => ({
      ...a,
      utilisateur: a.utilisateur_id ? usersMap.get(a.utilisateur_id) ?? null : null,
      projet: a.projet_id ? projetsMap.get(a.projet_id) ?? null : null,
    })),
    recentProjets: recentProjets.map(p => ({
      ...p,
      co: p.co_id ? usersMap.get(p.co_id) ?? null : null,
      commercial: p.commercial_id ? usersMap.get(p.commercial_id) ?? null : null,
    })),
  }
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'hier'
  return `il y a ${days} j`
}

export default async function AdminDashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') redirect('/login')

  const { stats, roleCount, recentAlertes, recentProjets } = await getDashboardData()

  const statCards = [
    { label: 'Total utilisateurs',       value: stats.total,            icon: Users,         sub: 'comptes enregistrés' },
    { label: 'Utilisateurs actifs',       value: stats.actifs,           icon: UserCheck,     sub: 'connectés' },
    { label: 'Utilisateurs inactifs',     value: stats.inactifs,         icon: UserX,         sub: 'désactivés' },
    { label: 'Projets en cours',          value: stats.projetsActifs,    icon: FolderOpen,    sub: 'non terminés' },
    { label: 'Alertes critiques non lues',value: stats.alertesCritiques, icon: AlertTriangle, sub: 'high / urgent' },
    { label: "Documents aujourd'hui",     value: stats.docsAujourdhui,   icon: FileText,      sub: 'uploadés aujourd\'hui' },
  ]

  const roleRows = Object.entries(roleCount).sort((a, b) => b[1].total - a[1].total)

  return (
    <>
      <TopBar title="Tableau de bord" />
      <div className="p-6 space-y-6">
        <p className="text-xs text-gray-400">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        {/* 6 stats */}
      <div className="grid grid-cols-3 gap-4">
        {statCards.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-gray-500">{s.label}</p>
                <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-gray-500" />
                </div>
              </div>
              <p className="text-3xl font-semibold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Répartition par rôle */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Répartition par rôle</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-2.5">Rôle</th>
                <th className="text-right px-5 py-2.5">Total</th>
                <th className="text-right px-5 py-2.5">Actifs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {roleRows.map(([role, counts]) => (
                <tr key={role} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-2.5">
                    <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                      {ROLE_LABELS[role] ?? role}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right text-sm font-semibold text-gray-900">
                    {counts.total}
                  </td>
                  <td className="px-5 py-2.5 text-right text-sm text-gray-500">
                    {counts.actifs}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Projets récents */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Projets récents</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {recentProjets.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">Aucun projet</p>
            ) : recentProjets.map(p => (
              <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {p.reference && (
                      <span className="text-xs text-gray-400 font-mono flex-shrink-0">{p.reference}</span>
                    )}
                    <p className="text-sm font-medium text-gray-900 truncate">{p.nom}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                    {p.co && <span>CO : {(p.co as {prenom:string;nom:string}).prenom} {(p.co as {prenom:string;nom:string}).nom}</span>}
                    {p.commercial && <span>· {(p.commercial as {prenom:string;nom:string}).prenom} {(p.commercial as {prenom:string;nom:string}).nom}</span>}
                  </div>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium flex-shrink-0">
                  {STATUT_LABELS[p.statut ?? ''] ?? (p.statut ?? '—')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activité récente */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Activité récente</h2>
          <p className="text-xs text-gray-400 mt-0.5">Dernières alertes système</p>
        </div>
        {recentAlertes.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">Aucune activité</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentAlertes.map(a => (
              <div key={a.id} className="flex items-start gap-4 px-5 py-3">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                  a.priorite === 'urgent' || a.priorite === 'high' ? 'bg-red-500' : 'bg-gray-300'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{a.titre}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                    {a.utilisateur && (
                      <span>{(a.utilisateur as {prenom:string;nom:string}).prenom} {(a.utilisateur as {prenom:string;nom:string}).nom}</span>
                    )}
                    {a.projet && (
                      <span>· {(a.projet as {nom:string}).nom}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{timeAgo(a.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  )
}
