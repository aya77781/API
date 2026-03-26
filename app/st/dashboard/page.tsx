'use client'

import { useUser } from '@/hooks/useUser'
import { useSTProjects } from '@/hooks/useSTProjects'
import Link from 'next/link'
import {
  AlertTriangle, Bell, ChevronRight, FolderOpen,
  Clock, CheckCircle, Wrench, XCircle, Building2
} from 'lucide-react'
import { RecentDocumentNotifs } from '@/components/shared/RecentDocumentNotifs'

const STATUT_LOT: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  consultation:  { label: 'En consultation',  color: 'bg-blue-100 text-blue-700',   icon: <Clock className="w-3 h-3" />        },
  negociation:   { label: 'Négociation',       color: 'bg-purple-100 text-purple-700', icon: <Clock className="w-3 h-3" />      },
  retenu:        { label: 'Retenu',            color: 'bg-amber-100 text-amber-700', icon: <CheckCircle className="w-3 h-3" />  },
  en_cours:      { label: 'En cours',          color: 'bg-green-100 text-green-700', icon: <Wrench className="w-3 h-3" />       },
  termine:       { label: 'Terminé',           color: 'bg-gray-100 text-gray-600',   icon: <CheckCircle className="w-3 h-3" /> },
  en_attente:    { label: 'En attente',        color: 'bg-gray-100 text-gray-500',   icon: <Clock className="w-3 h-3" />        },
}

const ALERTE_ICON: Record<string, React.ReactNode> = {
  plan_mis_a_jour:   <FolderOpen className="w-4 h-4 text-blue-500" />,
  reserve_signalee:  <AlertTriangle className="w-4 h-4 text-red-500" />,
  devis_demande:     <Bell className="w-4 h-4 text-amber-500" />,
  relance_devis:     <AlertTriangle className="w-4 h-4 text-orange-500" />,
  revision_demandee: <AlertTriangle className="w-4 h-4 text-orange-500" />,
  reserve_levee:     <CheckCircle className="w-4 h-4 text-green-500" />,
  document_expire:   <XCircle className="w-4 h-4 text-red-500" />,
  autre:             <Bell className="w-4 h-4 text-gray-400" />,
}

function prochaine_action(statut: string): string {
  if (statut === 'consultation') return 'Déposer votre devis'
  if (statut === 'retenu')       return 'Compléter vos pièces admin'
  if (statut === 'en_cours')     return 'Mettre à jour l\'avancement'
  return ''
}

export default function STDashboard() {
  const { user, profil, loading: userLoading } = useUser()
  const { lots, alertes, loading, unreadCount, markAlerteRead, markAllRead } = useSTProjects(user?.id ?? null)

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Chargement…</p>
        </div>
      </div>
    )
  }

  const urgentAlertes = alertes.filter(a => !a.lu)
  const projetsActifs = [...new Map(lots.map(l => [l.projet_id, l.projet])).values()]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div>
          <h1 className="text-base font-semibold text-gray-900">
            Bonjour {profil?.prenom}
          </h1>
          <p className="text-xs text-gray-400">{projetsActifs.length} projet(s) actif(s) · {lots.length} lot(s) assigné(s)</p>
        </div>
        {unreadCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
            <Bell className="w-4 h-4 text-red-500" />
            <span className="text-sm font-semibold text-red-700">{unreadCount} notification(s) non lue(s)</span>
          </div>
        )}
      </header>

      <div className="p-6 space-y-6">
        {/* Alertes urgentes */}
        {urgentAlertes.length > 0 && (
          <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-red-50 border-b border-red-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h2 className="text-sm font-semibold text-red-800">Actions requises ({urgentAlertes.length})</h2>
              </div>
              {user && (
                <button onClick={() => markAllRead(user.id)}
                  className="text-xs text-red-600 hover:text-red-800 underline">
                  Tout marquer comme lu
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-100">
              {urgentAlertes.slice(0, 5).map(a => (
                <div key={a.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50">
                  <div className="mt-0.5 flex-shrink-0">{ALERTE_ICON[a.type] ?? ALERTE_ICON.autre}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{a.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {a.projet_id && (
                    <Link href={`/st/projets/${a.projet_id}`}
                      className="text-xs text-blue-600 hover:text-blue-800 flex-shrink-0">
                      Voir →
                    </Link>
                  )}
                  <button onClick={() => markAlerteRead(a.id)}
                    className="text-gray-400 hover:text-gray-600 flex-shrink-0"><XCircle className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projets / Lots */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Mes lots actifs</h2>
          {lots.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Building2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Aucun lot assigné pour l'instant</p>
              <p className="text-xs text-gray-400 mt-1">Vous serez notifié dès qu'un projet vous est attribué</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {lots.map(lot => {
                const statut   = STATUT_LOT[lot.statut] ?? STATUT_LOT.en_attente
                const action   = prochaine_action(lot.statut)
                return (
                  <Link key={lot.id} href={`/st/projets/${lot.projet_id}?lot=${lot.id}`}
                    className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all group">
                    {/* Project name */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{lot.projet?.nom}</p>
                        {lot.projet?.reference && (
                          <p className="text-xs text-gray-400">{lot.projet.reference}</p>
                        )}
                      </div>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${statut.color}`}>
                        {statut.icon} {statut.label}
                      </span>
                    </div>

                    {/* Lot info */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-orange-600">{lot.numero}</span>
                      </div>
                      <p className="text-sm text-gray-700 font-medium">{lot.corps_etat}</p>
                    </div>

                    {lot.projet?.adresse && (
                      <p className="text-xs text-gray-400 mb-3 truncate">{lot.projet.adresse}</p>
                    )}

                    {/* Next action */}
                    {action && (
                      <div className="p-2 bg-amber-50 rounded-lg mb-3">
                        <p className="text-xs text-amber-700 font-medium">→ {action}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-1 text-xs text-gray-400 group-hover:text-gray-600 mt-1">
                      <span>Ouvrir le dossier</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <RecentDocumentNotifs roleBase="st" />

        {/* Recent notifications */}
        {alertes.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Notifications récentes</h3>
            <div className="space-y-2">
              {alertes.slice(0, 8).map(a => (
                <div key={a.id} className={`flex items-start gap-3 p-3 rounded-lg ${a.lu ? 'bg-gray-50' : 'bg-blue-50'}`}>
                  <div className="mt-0.5 flex-shrink-0">{ALERTE_ICON[a.type] ?? ALERTE_ICON.autre}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${a.lu ? 'text-gray-500' : 'text-gray-800 font-medium'}`}>{a.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  {!a.lu && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
