'use client'

import { useEffect, useMemo, useState } from 'react'
import { Users, Mail, Loader2, Search, Filter } from 'lucide-react'
import { TopBar } from '@/components/co/TopBar'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type Utilisateur = {
  id: string
  email: string
  prenom: string
  nom: string
  role: string
  actif: boolean | null
  categorie: string
  telephone_perso: string | null
  email_perso: string | null
  adresse: string | null
  ville: string | null
  date_naissance: string | null
  statut_emploi: string | null
}

type Salaire = {
  employe_id: string
  mois: string
  salaire_brut: number
  charges_patronales: number
  net_a_payer: number
  statut: string
}

const ROLE_LABEL: Record<string, string> = {
  gerant: 'Gérant',
  co: 'Chargé d\'Opérations',
  commercial: 'Commercial',
  economiste: 'Économiste',
  comptable: 'Comptable',
  rh: 'Ressources Humaines',
  cho: 'CHO',
  assistant_travaux: 'Assistant Travaux',
  dessinatrice: 'Dessinatrice',
  admin: 'Administrateur',
}

const CONTRAT_LABEL: Record<string, string> = {
  cdi: 'CDI',
  cdd: 'CDD',
  stage: 'Stage',
  alternance: 'Alternance',
  freelance: 'Freelance',
  periode_essai: 'Période d\'essai',
  actif: 'Actif',
  conge: 'En congé',
  inactif: 'Inactif',
}

const CONTRAT_BADGE: Record<string, string> = {
  cdi:           'bg-emerald-50 text-emerald-700 border border-emerald-200',
  cdd:           'bg-blue-50 text-blue-700 border border-blue-200',
  stage:         'bg-purple-50 text-purple-700 border border-purple-200',
  alternance:    'bg-purple-50 text-purple-700 border border-purple-200',
  freelance:     'bg-amber-50 text-amber-700 border border-amber-200',
  periode_essai: 'bg-amber-50 text-amber-700 border border-amber-200',
  actif:         'bg-gray-100 text-gray-600 border border-gray-200',
  conge:         'bg-amber-50 text-amber-700 border border-amber-200',
  inactif:       'bg-red-50 text-red-700 border border-red-200',
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
}

export default function EquipePage() {
  const supabase = createClient()
  const [users, setUsers] = useState<Utilisateur[]>([])
  const [salaires, setSalaires] = useState<Record<string, Salaire>>({})
  const [moisReference, setMoisReference] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')

  async function load() {
    setLoading(true)
    // 1. Tous les utilisateurs internes
    const { data: usersData } = await supabase.schema('app').from('utilisateurs')
      .select('*')
      .eq('categorie', 'interne')
      .order('nom')
    const list = (usersData ?? []) as Utilisateur[]
    setUsers(list)

    // 2. Identifier le dernier mois saisi (globalement)
    const { data: lastMonthData } = await supabase.from('salaires')
      .select('mois')
      .order('mois', { ascending: false })
      .limit(1)
    const lastMois = (lastMonthData?.[0]?.mois as string | undefined) ?? null
    setMoisReference(lastMois)

    // 3. Charger UNIQUEMENT les salaires de ce mois la (cohérence avec /compta/salaires)
    const map: Record<string, Salaire> = {}
    if (lastMois) {
      const { data: salairesData } = await supabase.from('salaires')
        .select('*')
        .eq('mois', lastMois)
      ;(salairesData ?? []).forEach((s: Salaire) => {
        map[s.employe_id] = s
      })
    }
    setSalaires(map)
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  const filtered = useMemo(() => users.filter(u => {
    if (filterRole !== 'all' && u.role !== filterRole) return false
    if (search) {
      const term = search.toLowerCase()
      return (
        u.nom?.toLowerCase().includes(term) ||
        u.prenom?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        ROLE_LABEL[u.role]?.toLowerCase().includes(term)
      )
    }
    return true
  }), [users, search, filterRole])

  // Stats
  const totalActifs = users.filter(u => u.actif !== false).length
  const totalBrut = Object.values(salaires).reduce((s, x) => s + Number(x.salaire_brut || 0), 0)
  const totalCharges = Object.values(salaires).reduce((s, x) => s + Number(x.charges_patronales || 0), 0)
  const totalCout = totalBrut + totalCharges

  const roles = Array.from(new Set(users.map(u => u.role))).sort()

  // Libelle du mois de reference pour les KPI
  const moisLabel = moisReference
    ? new Date(moisReference).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : 'Aucun mois saisi'

  return (
    <div>
      <TopBar title="Équipe" subtitle="Annuaire des collaborateurs internes API" />
      <div className="p-4 sm:p-6 space-y-6">

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard label="Effectif" value={`${totalActifs}`} sub={`${users.length} comptes`} />
          <KpiCard label="Masse salariale brute" value={fmt(totalBrut)} sub={`Mois : ${moisLabel}`} />
          <KpiCard label="Coût total employeur" value={fmt(totalCout)} sub={`+ ${fmt(totalCharges)} charges`} highlight />
          <KpiCard label="Rôles distincts" value={`${roles.length}`} sub="Domaines" />
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un nom, email, role..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              <option value="all">Tous les rôles</option>
              {roles.map(r => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
            </select>
            <span className="text-xs text-gray-400">{filtered.length} membre{filtered.length > 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Tableau */}
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Loader2 className="w-6 h-6 text-gray-400 mx-auto animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Aucun collaborateur trouvé</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-left text-xs font-semibold text-gray-700">
                    <th className="px-4 py-3">Membre</th>
                    <th className="px-4 py-3">Poste</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Contrat</th>
                    <th className="px-4 py-3 text-right">Brut / mois</th>
                    <th className="px-4 py-3 text-right">Net / mois</th>
                    <th className="px-4 py-3 text-right">Coût employeur</th>
                    <th className="px-4 py-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(u => {
                    const sal = salaires[u.id]
                    const cout = sal ? Number(sal.salaire_brut) + Number(sal.charges_patronales) : null
                    const initiales = `${u.prenom?.[0] ?? ''}${u.nom?.[0] ?? ''}`.toUpperCase()
                    const contrat = u.statut_emploi ?? 'actif'
                    return (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-semibold text-gray-600 flex-shrink-0">
                              {initiales}
                            </div>
                            <p className="text-sm font-medium text-gray-900">{u.prenom} {u.nom}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{ROLE_LABEL[u.role] ?? u.role}</td>
                        <td className="px-4 py-3">
                          {u.email ? (
                            <a href={`mailto:${u.email}`} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900">
                              <Mail className="w-3 h-3 text-gray-400" />{u.email}
                            </a>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'inline-flex px-2 py-0.5 rounded text-xs font-medium',
                            CONTRAT_BADGE[contrat] ?? 'bg-gray-100 text-gray-600 border border-gray-200',
                          )}>
                            {CONTRAT_LABEL[contrat] ?? contrat}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {sal ? fmt(Number(sal.salaire_brut)) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {sal ? fmt(Number(sal.net_a_payer)) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {cout != null ? fmt(cout) : <span className="text-gray-300 font-normal">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            'inline-flex w-2 h-2 rounded-full',
                            u.actif !== false ? 'bg-emerald-500' : 'bg-gray-300',
                          )} title={u.actif !== false ? 'Actif' : 'Inactif'} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={cn(
      'rounded-lg border p-4',
      highlight ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200',
    )}>
      <p className={cn('text-[10px] font-medium uppercase tracking-wide', highlight ? 'text-gray-400' : 'text-gray-400')}>{label}</p>
      <p className={cn('text-xl font-bold mt-1', highlight ? 'text-white' : 'text-gray-900')}>{value}</p>
      <p className={cn('text-[10px] mt-1', highlight ? 'text-gray-500' : 'text-gray-400')}>{sub}</p>
    </div>
  )
}
