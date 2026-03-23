'use client'

import { useState } from 'react'
import { FileText, ChevronDown, ChevronUp, Edit3, Save, X } from 'lucide-react'
import { TopBar } from '@/components/co/TopBar'

type Regle = {
  id: string
  titre: string
  contenu: string
  categorie: 'vie_bureau' | 'frais'
  editable: boolean
}

const reglesInitiales: Regle[] = [
  {
    id: 'horaires',
    titre: 'Horaires de bureau',
    categorie: 'vie_bureau',
    editable: true,
    contenu: `Les horaires de bureau sont de 9h à 18h du lundi au vendredi.
Une flexibilité de ±1h est possible en accord avec le responsable direct.
Le télétravail est possible 1 jour par semaine après validation.`,
  },
  {
    id: 'espaces',
    titre: 'Usage des espaces communs',
    categorie: 'vie_bureau',
    editable: true,
    contenu: `La cuisine doit être laissée propre après utilisation.
La vaisselle doit être faite immédiatement après usage.
La salle de réunion doit être réservée via le calendrier partagé.
Le niveau sonore dans l'open space doit rester raisonnable.`,
  },
  {
    id: 'respect',
    titre: 'Respect & Communication',
    categorie: 'vie_bureau',
    editable: true,
    contenu: `Toute tension entre collègues doit être signalée à la CHO.
La communication respectueuse est de mise dans tous les échanges.
Les conflits sont traités en médiation avec la CHO si nécessaire.
Le droit à la déconnexion est respecté après 18h30 et les weekends.`,
  },
  {
    id: 'repas',
    titre: 'Plafond repas d\'affaires',
    categorie: 'frais',
    editable: true,
    contenu: `Repas solo (déplacement) : 25 € maximum par repas.
Repas client/partenaire : 50 € par personne, nécessite une validation préalable.
Repas d'équipe (≤ 5 personnes) : 35 € par personne.
Justificatif obligatoire pour tout repas supérieur à 15 €.`,
  },
  {
    id: 'transport',
    titre: 'Frais de transport',
    categorie: 'frais',
    editable: true,
    contenu: `Train/avion : réservation via le secrétariat avec validation Direction.
Véhicule personnel (mission) : remboursement au barème kilométrique en vigueur.
Taxi/VTC : plafonné à 30 € par trajet, sur justificatif.
Location véhicule : uniquement sur validation préalable Direction.`,
  },
  {
    id: 'fournitures',
    titre: 'Achats fournitures & matériel',
    categorie: 'frais',
    editable: true,
    contenu: `Fournitures bureau standard : remontée à la CHO, commande groupée mensuelle.
Matériel informatique : validation Direction obligatoire.
Petits équipements (< 50 €) : remboursement sur note de frais + justificatif.
Équipements > 50 € : bon de commande préalable requis.`,
  },
]

const CATEGORIE_LABEL = {
  vie_bureau: { label: 'Vie au bureau', emoji: '🏢', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  frais: { label: 'Politique de frais', emoji: '💳', color: 'bg-purple-50 text-purple-600 border-purple-200' },
}

export default function ProcessusPage() {
  const [regles, setRegles] = useState<Regle[]>(reglesInitiales)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [activeTab, setActiveTab] = useState<'vie_bureau' | 'frais'>('vie_bureau')

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function startEdit(regle: Regle) {
    setEditing(regle.id)
    setEditContent(regle.contenu)
  }

  function saveEdit(id: string) {
    setRegles((prev) =>
      prev.map((r) => (r.id === id ? { ...r, contenu: editContent } : r))
    )
    setEditing(null)
  }

  const filteredRegles = regles.filter((r) => r.categorie === activeTab)

  return (
    <div>
      <TopBar title="Processus" subtitle="Règles de vie & Politique de frais" />

      <div className="p-6 space-y-6">
        {/* En-tête informatif */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-700">Documentation des processus CHO</p>
              <p className="text-xs text-gray-500 mt-1">
                Ces règles ont été définies en collaboration avec la Direction. Elles peuvent être mises à jour par la CHO.
                Tout changement majeur nécessite validation de la Direction.
              </p>
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-2">
          {(Object.keys(CATEGORIE_LABEL) as Array<'vie_bureau' | 'frais'>).map((cat) => {
            const info = CATEGORIE_LABEL[cat]
            return (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === cat
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <span>{info.emoji}</span>
                {info.label}
              </button>
            )
          })}
        </div>

        {/* Règles */}
        <div className="space-y-3">
          {filteredRegles.map((regle) => {
            const isExpanded = expanded[regle.id]
            const isEditing = editing === regle.id
            const catInfo = CATEGORIE_LABEL[regle.categorie]

            return (
              <div
                key={regle.id}
                className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden"
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => !isEditing && toggleExpand(regle.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${catInfo.color}`}>
                      {catInfo.emoji} {catInfo.label}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{regle.titre}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {regle.editable && !isEditing && isExpanded && (
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(regle) }}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                      >
                        <Edit3 className="w-3 h-3" />
                        Modifier
                      </button>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Contenu */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    {isEditing ? (
                      <div className="pt-3 space-y-3">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={6}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none font-mono"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setEditing(null)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <X className="w-3 h-3" /> Annuler
                          </button>
                          <button
                            onClick={() => saveEdit(regle.id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                          >
                            <Save className="w-3 h-3" /> Sauvegarder
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-3">
                        {regle.contenu.split('\n').map((line, i) => (
                          line.trim() ? (
                            <p key={i} className="text-sm text-gray-600 flex items-start gap-2 mb-2">
                              <span className="text-gray-300 flex-shrink-0 mt-0.5">·</span>
                              {line.trim()}
                            </p>
                          ) : null
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Note bas de page */}
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
          <p className="text-xs text-amber-700 font-medium">⚠️ Note importante</p>
          <p className="text-xs text-amber-600 mt-1">
            Les modifications effectuées ici sont temporaires et locales. Pour une mise à jour officielle du
            règlement intérieur, contactez la Direction et mettez à jour le document partagé.
          </p>
        </div>
      </div>
    </div>
  )
}
