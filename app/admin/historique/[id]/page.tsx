'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import {
  ArrowLeft, RotateCcw, X, CheckCircle2, XCircle,
  ChevronRight, Building2,
  User as UserIcon, FileText, Layers, Calculator, Users as UsersIcon,
} from 'lucide-react'
import { type ProjetBase, type Utilisateur, formatDate } from './_lib/shared'

interface Counts {
  collaborateurs: number
  documents: number
  plans: number
  lots: number
}

export default function HistoriqueProjetPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const projetId = params.id
  const supabase = createClient()
  const { profil, loading: userLoading } = useUser()

  const [projet, setProjet] = useState<ProjetBase & {
    type_chantier: string | null
    date_debut: string | null
    date_livraison: string | null
  } | null>(null)
  const [archiveur, setArchiveur] = useState<Utilisateur | null>(null)
  const [counts, setCounts] = useState<Counts>({ collaborateurs: 0, documents: 0, plans: 0, lots: 0 })
  const [loading, setLoading] = useState(true)

  const [unarchiveOpen, setUnarchiveOpen] = useState(false)
  const [unarchiving, setUnarchiving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function notify(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    if (userLoading) return
    if (!profil || !['admin', 'gerant'].includes(profil.role)) {
      router.replace('/login')
    }
  }, [profil, userLoading, router])

  useEffect(() => {
    if (!projetId || userLoading) return

    async function load() {
      const { data: projetData } = await supabase
        .schema('app').from('projets')
        .select('id, nom, reference, statut, archived_at, archived_by, client_nom, type_chantier, date_debut, date_livraison, co_id, commercial_id, economiste_id, dessinatrice_id')
        .eq('id', projetId).single()

      if (!projetData) { setLoading(false); return }
      setProjet(projetData as ProjetBase & { type_chantier: string | null; date_debut: string | null; date_livraison: string | null })

      const teamIds = [projetData.co_id, projetData.commercial_id, projetData.economiste_id, projetData.dessinatrice_id].filter(Boolean) as string[]

      const [archRes, atCount, consultCount, externesCount, docsCount, docsStCount, dessinCount, exeCount, lotsCount] = await Promise.all([
        projetData.archived_by
          ? supabase.schema('app').from('utilisateurs').select('id, prenom, nom, role, email').eq('id', projetData.archived_by).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.schema('app').from('at_sous_traitants').select('id', { count: 'exact', head: true }).eq('projet_id', projetId),
        supabase.schema('app').from('consultations_st').select('id', { count: 'exact', head: true }).eq('projet_id', projetId),
        supabase.schema('app').from('acces_externes').select('id', { count: 'exact', head: true }).eq('projet_id', projetId),
        supabase.schema('app').from('documents').select('id', { count: 'exact', head: true }).eq('projet_id', projetId),
        supabase.schema('app').from('documents_st').select('id', { count: 'exact', head: true }),
        supabase.schema('app').from('dessin_plans').select('id', { count: 'exact', head: true }).eq('projet_nom', projetData.nom),
        supabase.schema('app').from('plans_exe').select('id', { count: 'exact', head: true }).eq('projet_id', projetId),
        supabase.schema('app').from('lots').select('id', { count: 'exact', head: true }).eq('projet_id', projetId),
      ])

      setArchiveur(archRes.data as Utilisateur | null)

      // documents_st: filtre par les st_id provenant de consultations + at sts (impossible en HEAD count multi-table), donc on prend le total ; affichage uniquement indicatif
      // Pour rester precis sur "documents du projet", on additionne docs + docs_st filtres cote sous-page
      const stIdsForDocsSt = await supabase
        .schema('app').from('consultations_st').select('st_id').eq('projet_id', projetId)
      const stIds = Array.from(new Set((stIdsForDocsSt.data ?? []).map((r: { st_id: string | null }) => r.st_id).filter(Boolean))) as string[]
      let docsStCountForProjet = 0
      if (stIds.length > 0) {
        const r = await supabase.schema('app').from('documents_st').select('id', { count: 'exact', head: true }).in('st_id', stIds)
        docsStCountForProjet = r.count ?? 0
      }
      void docsStCount

      setCounts({
        collaborateurs: teamIds.length + (atCount.count ?? 0) + (consultCount.count ?? 0) + (externesCount.count ?? 0),
        documents: (docsCount.count ?? 0) + docsStCountForProjet,
        plans: (dessinCount.count ?? 0) + (exeCount.count ?? 0),
        lots: lotsCount.count ?? 0,
      })

      setLoading(false)
    }
    load()
  }, [projetId, userLoading, supabase])

  async function handleDesarchiver() {
    if (!projet) return
    setUnarchiving(true)
    const { error } = await supabase.schema('app').from('projets').update({
      statut: 'gpa',
      archived_at: null,
      archived_by: null,
    }).eq('id', projet.id)
    setUnarchiving(false)
    if (error) { notify(error.message, false); return }
    setUnarchiveOpen(false)
    router.replace('/admin/projets')
  }

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!projet) {
    return (
      <div className="bg-gray-50 min-h-screen p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">Projet introuvable</p>
          <button onClick={() => router.push('/admin/historique')}
            className="mt-3 text-sm text-gray-700 hover:text-gray-900 inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Retour à l'historique
          </button>
        </div>
      </div>
    )
  }

  const sections: Array<{
    key: string
    href: string
    icon: typeof UserIcon
    title: string
    subtitle: string
    count: number | null
    countLabel: string
    color: string
  }> = [
    {
      key: 'informations',
      href: `/admin/historique/${projet.id}/informations`,
      icon: UserIcon,
      title: 'Informations',
      subtitle: 'Identité, client, budget, psychologie',
      count: null,
      countLabel: 'Fiche complète',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      key: 'collaborateurs',
      href: `/admin/historique/${projet.id}/collaborateurs`,
      icon: UsersIcon,
      title: 'Collaborateurs',
      subtitle: 'Équipe, clients, ST, bureau de contrôle',
      count: counts.collaborateurs,
      countLabel: 'personnes',
      color: 'bg-violet-50 text-violet-600',
    },
    {
      key: 'documents',
      href: `/admin/historique/${projet.id}/documents`,
      icon: FileText,
      title: 'Documents',
      subtitle: 'Tous les documents classés par catégorie',
      count: counts.documents,
      countLabel: 'documents',
      color: 'bg-amber-50 text-amber-600',
    },
    {
      key: 'plans',
      href: `/admin/historique/${projet.id}/plans`,
      icon: Layers,
      title: 'Plans',
      subtitle: 'Plans conception et plans d\'exécution',
      count: counts.plans,
      countLabel: 'plans',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      key: 'chiffrage',
      href: `/admin/historique/${projet.id}/chiffrage`,
      icon: Calculator,
      title: 'Chiffrage',
      subtitle: 'Versions, lots, propositions, avenants',
      count: counts.lots,
      countLabel: 'lots',
      color: 'bg-rose-50 text-rose-600',
    },
  ]

  return (
    <div className="bg-gray-50 min-h-screen pb-12">
      {/* Header projet */}
      <header className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <button onClick={() => router.push('/admin/historique')}
              className="text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1 mb-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Retour à l'historique
            </button>
            <div className="flex items-center gap-3 flex-wrap">
              {projet.reference && <span className="text-xs font-mono text-gray-400">{projet.reference}</span>}
              <h1 className="text-xl font-semibold text-gray-900 truncate">{projet.nom}</h1>
              <span className="bg-gray-200 text-gray-600 rounded-full px-3 py-1 text-sm font-medium">ARCHIVÉ</span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
              {projet.client_nom && (
                <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {projet.client_nom}</span>
              )}
              <span>Début : {formatDate(projet.date_debut)}</span>
              <span>Livraison : {formatDate(projet.date_livraison)}</span>
              {projet.archived_at && (
                <span>Archivé le {formatDate(projet.archived_at)}{archiveur ? ` par ${archiveur.prenom} ${archiveur.nom}` : ''}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setUnarchiveOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Désarchiver
          </button>
        </div>
      </header>

      {/* Sitemap visuel */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map(s => {
            const Icon = s.icon
            return (
              <Link
                key={s.key}
                href={s.href}
                className="group bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-gray-300 hover:shadow-md transition-all flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl ${s.color} flex items-center justify-center`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <h2 className="text-base font-semibold text-gray-900 mb-1">{s.title}</h2>
                <p className="text-xs text-gray-500 leading-relaxed mb-4 flex-1">{s.subtitle}</p>
                <div className="pt-3 border-t border-gray-100">
                  {s.count !== null ? (
                    <p className="text-sm">
                      <span className="font-semibold text-gray-900">{s.count}</span>
                      <span className="text-gray-500"> {s.countLabel}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">{s.countLabel}</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Modal Désarchiver */}
      {unarchiveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setUnarchiveOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Désarchiver le projet</h2>
              <button onClick={() => setUnarchiveOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Remettre <span className="font-medium text-gray-800">&laquo;&nbsp;{projet.nom}&nbsp;&raquo;</span> en statut actif&nbsp;? Le projet réapparaîtra dans les vues de l'équipe.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setUnarchiveOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Annuler
              </button>
              <button onClick={handleDesarchiver} disabled={unarchiving}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
                <RotateCcw className="w-3.5 h-3.5" />
                {unarchiving ? 'Désarchivage…' : 'Désarchiver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
          toast.ok ? 'bg-gray-900' : 'bg-red-600'
        }`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
