import { createClient } from '@/lib/supabase/server'
import { Users, FolderOpen, ShieldCheck, Briefcase, AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, FileSignature, Scale, UserPlus } from 'lucide-react'
import { RecentDocumentNotifs } from '@/components/shared/RecentDocumentNotifs'
import { TopBar } from '@/components/co/TopBar'

const PROJET_FERMES = ['cloture', 'gpa', 'termine']

type Alerte = {
  key: string
  niveau: 'danger' | 'warning'
  type: string
  projet: string
  detail: string
  href: string
}

type DecisionCategorie = 'chiffrage' | 'arbitrage' | 'recrutement'

type Decision = {
  key: string
  categorie: DecisionCategorie
  titre: string
  meta: string
  href: string
  badge?: string
}

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
    projetsEnCours: projets.filter(p => !PROJET_FERMES.includes(p.statut)).length,
    totalProjets: projets.length,
  }
}

async function getAlertes(): Promise<Alerte[]> {
  const supabase = createClient()
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const in30 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10)
  const minus60 = new Date(today.getTime() - 60 * 86400000).toISOString().slice(0, 10)

  type ProjFin = { id: string; nom: string; statut: string | null; budget_client_ht: number | null; marge_brute_ht: number | null }
  type Caut = { id: string; projet_id: string; date_echeance: string; statut: string }
  type Rev = { id: string; projet_id: string; date_facture: string | null; statut: string; reference_facture: string | null }

  const [margeRes, cauRes, revRes] = await Promise.all([
    supabase.from('vue_projet_finance').select('id,nom,statut,budget_client_ht,marge_brute_ht'),
    supabase.from('cautions').select('id,projet_id,date_echeance,statut').eq('statut', 'active').gte('date_echeance', todayStr).lte('date_echeance', in30),
    supabase.from('revenus').select('id,projet_id,date_facture,statut,reference_facture').neq('statut', 'encaisse').lt('date_facture', minus60),
  ])

  const projets = ((margeRes.data ?? []) as ProjFin[]).filter(p => !PROJET_FERMES.includes(p.statut ?? ''))
  const projetNomById = new Map(projets.map(p => [p.id, p.nom]))

  const margeAlertes: Alerte[] = projets
    .filter(p => (p.budget_client_ht ?? 0) > 0 && p.marge_brute_ht != null && (p.marge_brute_ht / (p.budget_client_ht as number)) < 0.10)
    .map(p => ({
      key: `marge-${p.id}`,
      niveau: 'danger',
      type: 'Marge brute projet',
      projet: p.nom,
      detail: `${Math.round(((p.marge_brute_ht ?? 0) / (p.budget_client_ht as number)) * 100)}% du budget client (seuil 10%)`,
      href: `/gerant/projets/${p.id}`,
    }))

  const cautionAlertes: Alerte[] = ((cauRes.data ?? []) as Caut[])
    .filter(c => projetNomById.has(c.projet_id))
    .map(c => {
      const jours = Math.ceil((new Date(c.date_echeance).getTime() - today.getTime()) / 86400000)
      return {
        key: `caution-${c.id}`,
        niveau: 'warning',
        type: 'Caution bancaire',
        projet: projetNomById.get(c.projet_id) as string,
        detail: `Échéance ${new Date(c.date_echeance).toLocaleDateString('fr-FR')} (${jours}j restant${jours > 1 ? 's' : ''})`,
        href: `/gerant/projets/${c.projet_id}`,
      }
    })

  const factureAlertes: Alerte[] = ((revRes.data ?? []) as Rev[])
    .filter(r => r.date_facture && projetNomById.has(r.projet_id))
    .map(r => {
      const jours = Math.floor((today.getTime() - new Date(r.date_facture as string).getTime()) / 86400000)
      return {
        key: `facture-${r.id}`,
        niveau: 'danger',
        type: 'Facture client impayée',
        projet: projetNomById.get(r.projet_id) as string,
        detail: `${r.reference_facture ?? 'Facture'} émise il y a ${jours} jours`,
        href: `/gerant/projets/${r.projet_id}`,
      }
    })

  return [...margeAlertes, ...cautionAlertes, ...factureAlertes]
}

async function getDecisions(): Promise<Decision[]> {
  const supabase = createClient()

  type Prop = { id: string; projet_id: string; numero: number; montant_ht: number | null; valide_le: string | null; created_at: string }
  type Arb = { id: string; libelle: string; montant_ht: number; mois_reference: string; tag: string; arbitre_par: string | null }
  type Cand = { id: string; nom: string; prenom: string; pole_cible: string | null; statut: string; matching_pct: number | null; created_at: string }

  const [propRes, arbRes, candRes, projRes] = await Promise.all([
    supabase.schema('app').from('propositions')
      .select('id,projet_id,numero,montant_ht,valide_le,created_at')
      .eq('statut', 'valide_eco'),
    supabase.from('arbitrage_factures')
      .select('id,libelle,montant_ht,mois_reference,tag,arbitre_par')
      .is('arbitre_par', null)
      .eq('tag', 'a_payer'),
    supabase.from('candidats')
      .select('id,nom,prenom,pole_cible,statut,matching_pct,created_at')
      .eq('statut', 'attente_gerant')
      .order('matching_pct', { ascending: false, nullsFirst: false }),
    supabase.schema('app').from('projets').select('id,nom'),
  ])

  const projetNomById = new Map<string, string>(((projRes.data ?? []) as { id: string; nom: string }[]).map(p => [p.id, p.nom]))
  const fmtEUR = (n: number | null) => n == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  const chiffrages: Decision[] = ((propRes.data ?? []) as Prop[]).map(p => ({
    key: `chiff-${p.id}`,
    categorie: 'chiffrage',
    titre: `${projetNomById.get(p.projet_id) ?? 'Projet'} — proposition n°${p.numero}`,
    meta: `${fmtEUR(p.montant_ht)} · validé éco ${p.valide_le ? new Date(p.valide_le).toLocaleDateString('fr-FR') : '—'}`,
    href: `/gerant/projets/${p.projet_id}`,
    badge: 'Retour CO attendu',
  }))

  const arbitragesParMois = new Map<string, { count: number; total: number }>()
  for (const f of (arbRes.data ?? []) as Arb[]) {
    const cur = arbitragesParMois.get(f.mois_reference) ?? { count: 0, total: 0 }
    cur.count += 1
    cur.total += Number(f.montant_ht ?? 0)
    arbitragesParMois.set(f.mois_reference, cur)
  }
  const arbitrages: Decision[] = Array.from(arbitragesParMois.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([mois, agg]) => {
      const d = new Date(mois)
      const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      return {
        key: `arb-${mois}`,
        categorie: 'arbitrage',
        titre: `Session arbitrage ${label}`,
        meta: `${agg.count} facture${agg.count > 1 ? 's' : ''} en attente · ${fmtEUR(agg.total)}`,
        href: '/compta/arbitrage',
        badge: 'Comptable',
      }
    })

  const recrutements: Decision[] = ((candRes.data ?? []) as Cand[]).slice(0, 5).map(c => ({
    key: `cand-${c.id}`,
    categorie: 'recrutement',
    titre: `${c.prenom} ${c.nom}${c.pole_cible ? ` — ${c.pole_cible}` : ''}`,
    meta: `Statut ${c.statut.replace(/_/g, ' ')}`,
    href: '/rh/recrutement',
    badge: c.matching_pct != null ? `Score IA ${Math.round(c.matching_pct)}%` : 'Score IA —',
  }))

  return [...chiffrages, ...arbitrages, ...recrutements]
}

export default async function GerantDashboardPage() {
  const [stats, alertes, decisions] = await Promise.all([getStats(), getAlertes(), getDecisions()])

  return (
    <div>
      <TopBar
        title="Tableau de bord"
        subtitle={new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      />
      <div className="p-6 space-y-8">

      <p className="text-sm text-gray-600 -mt-2">
        Tout remonte automatiquement. Vous n'avez pas à aller chercher l'information.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}       label="Comptes actifs"     value={stats.actifs}         sub={`${stats.totalUsers} au total`}      color="blue" />
        <StatCard icon={Briefcase}   label="Équipe interne"     value={stats.internes}       sub="Collaborateurs"                       color="purple" />
        <StatCard icon={FolderOpen}  label="Projets en cours"   value={stats.projetsEnCours} sub={`${stats.totalProjets} au total`}    color="amber" />
        <StatCard icon={ShieldCheck} label="Administration"     value="→"                    sub="Gérer les comptes"  href="/gerant/admin" color="emerald" />
      </div>

      <SignauxRemontes alertes={alertes} />

      <DecisionsAprendre decisions={decisions} />

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
    </div>
  )
}

function SignauxRemontes({ alertes }: { alertes: Alerte[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Signaux remontés — Alertes automatiques</h2>
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {alertes.length} alerte{alertes.length > 1 ? 's' : ''} en temps réel
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4 text-xs">
        <SeuilCard label="Marge brute projet"     seuil="< 10% du budget client"   niveau="danger" />
        <SeuilCard label="Caution bancaire"       seuil="Échéance < 30 jours"      niveau="warning" />
        <SeuilCard label="Facture client impayée" seuil="> 60 jours après émission" niveau="danger" />
      </div>

      {alertes.length === 0 ? (
        <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Aucune alerte active sur les projets en cours.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
          {alertes.map(a => (
            <li key={a.key}>
              <a
                href={a.href}
                className="flex items-center gap-3 px-3 py-3 hover:bg-gray-50 transition-colors"
              >
                <span className={`w-1.5 self-stretch rounded-full ${a.niveau === 'danger' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${a.niveau === 'danger' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                      {a.type}
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate">{a.projet}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{a.detail}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SeuilCard({ label, seuil, niveau }: { label: string; seuil: string; niveau: 'danger' | 'warning' }) {
  const dot = niveau === 'danger' ? 'bg-red-500' : 'bg-amber-500'
  const tag = niveau === 'danger' ? 'text-red-600' : 'text-amber-600'
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50/60">
      <span className={`w-2 h-2 rounded-full mt-1.5 ${dot}`} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-700">{label}</p>
        <p className="text-gray-500">{seuil}</p>
        <p className={`text-[10px] uppercase tracking-wide font-semibold mt-0.5 ${tag}`}>
          {niveau === 'danger' ? 'Danger' : 'Warning'}
        </p>
      </div>
    </div>
  )
}

function DecisionsAprendre({ decisions }: { decisions: Decision[] }) {
  const groupes: { categorie: DecisionCategorie; label: string; description: string; icon: typeof Scale; items: Decision[] }[] = [
    {
      categorie: 'chiffrage',
      label: 'Chiffrages soumis par l\'Économiste',
      description: 'En attente de votre retour au CO',
      icon: FileSignature,
      items: decisions.filter(d => d.categorie === 'chiffrage'),
    },
    {
      categorie: 'arbitrage',
      label: 'Sessions d\'arbitrage financier',
      description: 'Préparées par la Comptable (2 fois par mois)',
      icon: Scale,
      items: decisions.filter(d => d.categorie === 'arbitrage'),
    },
    {
      categorie: 'recrutement',
      label: 'Recrutements en cours',
      description: 'Avec score IA',
      icon: UserPlus,
      items: decisions.filter(d => d.categorie === 'recrutement'),
    },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Décisions à prendre</h2>
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {decisions.length} en attente
        </span>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Ce bloc centralise tout ce qui attend votre validation.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {groupes.map(g => (
          <div key={g.categorie} className="border border-gray-100 rounded-lg overflow-hidden flex flex-col">
            <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50/60">
              <div className="flex items-center gap-2">
                <g.icon className="w-3.5 h-3.5 text-gray-500" />
                <p className="text-xs font-semibold text-gray-800">{g.label}</p>
                <span className="ml-auto text-[11px] font-medium px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-700">
                  {g.items.length}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">{g.description}</p>
            </div>

            {g.items.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-4 text-xs text-gray-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Rien à valider
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 flex-1">
                {g.items.map(d => (
                  <li key={d.key}>
                    <a
                      href={d.href}
                      className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{d.titre}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {d.badge && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                              {d.badge}
                            </span>
                          )}
                          <p className="text-[11px] text-gray-500 truncate">{d.meta}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
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
