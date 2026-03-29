'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Eye, EyeOff, ChevronRight, ChevronDown, CheckSquare, Square, ArrowLeft } from 'lucide-react'

interface LotDisponible {
  id: string
  numero: number
  corps_etat: string
  statut: string
}

interface ProjetDisponible {
  id: string
  nom: string
  reference: string | null
  lots: LotDisponible[]
}

type Etape = 'infos' | 'lots'

const STATUT_LABEL: Record<string, string> = {
  en_attente:   'En attente',
  consultation: 'Consultation',
  negociation:  'Négociation',
  retenu:       'Retenu',
  en_cours:     'En cours',
}

export default function InscriptionSTPage() {
  const router = useRouter()

  // Etape courante
  const [etape, setEtape] = useState<Etape>('infos')

  // Formulaire infos
  const [prenom, setPrenom]       = useState('')
  const [nom, setNom]             = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPwd, setShowPwd]     = useState(false)

  // Données lots
  const [projets, setProjets]     = useState<ProjetDisponible[]>([])
  const [lotsLoading, setLotsLoading] = useState(false)
  const [lotsError, setLotsError] = useState('')
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set())
  const [expanded, setExpanded]   = useState<Set<string>>(new Set())

  // Soumission
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  // Charger les lots disponibles dès l'étape "lots"
  useEffect(() => {
    if (etape !== 'lots') return
    setLotsLoading(true)
    setLotsError('')
    fetch('/api/st/lots-disponibles')
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setLotsError(data.error)
        } else {
          setProjets(data)
          // Auto-expand tous les projets si peu nombreux
          if (data.length <= 5) {
            setExpanded(new Set(data.map((p: ProjetDisponible) => p.id)))
          }
        }
      })
      .catch(() => setLotsError('Impossible de charger les lots. Réessayez.'))
      .finally(() => setLotsLoading(false))
  }, [etape])

  function validerInfos(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!prenom.trim() || !nom.trim() || !email.trim() || !password.trim()) {
      setError('Tous les champs sont obligatoires.')
      return
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    setEtape('lots')
  }

  function toggleLot(lotId: string) {
    setSelectedLots(prev => {
      const next = new Set(prev)
      if (next.has(lotId)) next.delete(lotId)
      else next.add(lotId)
      return next
    })
  }

  function toggleProjet(projetId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(projetId)) next.delete(projetId)
      else next.add(projetId)
      return next
    })
  }

  function selectAllInProjet(projet: ProjetDisponible) {
    const allSelected = projet.lots.every(l => selectedLots.has(l.id))
    setSelectedLots(prev => {
      const next = new Set(prev)
      if (allSelected) {
        projet.lots.forEach(l => next.delete(l.id))
      } else {
        projet.lots.forEach(l => next.add(l.id))
      }
      return next
    })
  }

  async function handleSubmit() {
    setError('')
    if (selectedLots.size === 0) {
      setError('Sélectionnez au moins un lot.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/st/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prenom,
          nom,
          email,
          password,
          lot_ids: Array.from(selectedLots),
        }),
      })
      let d: any = {}
      try { d = await res.json() } catch { d = { error: `Erreur serveur (HTTP ${res.status})` } }
      if (!res.ok) {
        setError(d.error ?? 'Erreur lors de la création du compte.')
        return
      }
      router.push('/login?confirmed=1')
    } catch (e: any) {
      setError(`Erreur réseau : ${e?.message ?? e}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-lg">
      {/* Logo */}
      <div className="text-center mb-8">
        <Image src="/logo.png" alt="API" width={80} height={80} className="mx-auto" priority />
        <p className="text-sm text-gray-400 mt-3">Inscription sous-traitant</p>
      </div>

      {/* Indicateur d'étape */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
            etape === 'infos' ? 'bg-gray-900 text-white' : 'bg-emerald-500 text-white'
          }`}>
            {etape === 'lots' ? '✓' : '1'}
          </div>
          <span className={`text-xs font-medium ${etape === 'infos' ? 'text-gray-900' : 'text-emerald-600'}`}>
            Informations
          </span>
        </div>
        <div className="w-8 h-px bg-gray-300" />
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
            etape === 'lots' ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-400'
          }`}>
            2
          </div>
          <span className={`text-xs font-medium ${etape === 'lots' ? 'text-gray-900' : 'text-gray-400'}`}>
            Mes lots
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">

        {/* ── Étape 1 : Informations ── */}
        {etape === 'infos' && (
          <>
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-base font-semibold text-gray-900">Créer mon compte</h2>
              <p className="text-xs text-gray-400 mt-0.5">Renseignez vos informations personnelles</p>
            </div>

            <form onSubmit={validerInfos} className="px-6 py-4 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Prénom</label>
                  <input
                    type="text"
                    value={prenom}
                    onChange={e => setPrenom(e.target.value)}
                    required
                    placeholder="Jean"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Nom</label>
                  <input
                    type="text"
                    value={nom}
                    onChange={e => setNom(e.target.value)}
                    required
                    placeholder="Martin"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Email professionnel</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="jean.martin@electricite-martin.fr"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Min. 6 caractères"
                    className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-800 transition-colors mt-2"
              >
                Continuer
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          </>
        )}

        {/* ── Étape 2 : Sélection des lots ── */}
        {etape === 'lots' && (
          <>
            <div className="px-6 pt-6 pb-2 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Sélectionnez vos lots</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Cochez les lots sur lesquels vous intervenez
                  {selectedLots.size > 0 && (
                    <span className="ml-2 font-semibold text-amber-600">
                      {selectedLots.size} sélectionné{selectedLots.size > 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => { setEtape('infos'); setError('') }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors mt-0.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Retour
              </button>
            </div>

            <div className="px-6 pb-4">
              {error && (
                <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
                  {error}
                </div>
              )}

              {lotsLoading ? (
                <div className="py-12 text-center text-sm text-gray-400">Chargement des lots disponibles…</div>
              ) : lotsError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">{lotsError}</div>
              ) : projets.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-gray-500 font-medium">Aucun lot disponible pour le moment</p>
                  <p className="text-xs text-gray-400 mt-1">Contactez votre chargé d&apos;opérations.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {projets.map(projet => {
                    const isExpanded = expanded.has(projet.id)
                    const allSelected = projet.lots.every(l => selectedLots.has(l.id))
                    const someSelected = projet.lots.some(l => selectedLots.has(l.id))
                    return (
                      <div key={projet.id} className="border border-gray-200 rounded-xl overflow-hidden">
                        {/* Projet header */}
                        <div className="flex items-center bg-gray-50">
                          <button
                            type="button"
                            onClick={() => toggleProjet(projet.id)}
                            className="flex-1 flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-100 transition-colors"
                          >
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            }
                            <span className="font-medium text-sm text-gray-900 truncate">{projet.nom}</span>
                            {projet.reference && (
                              <span className="text-xs text-gray-400 flex-shrink-0">({projet.reference})</span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => selectAllInProjet(projet)}
                            className="px-3 py-3 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
                            title={allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                          >
                            {allSelected
                              ? <CheckSquare className="w-4 h-4 text-amber-500" />
                              : someSelected
                                ? <CheckSquare className="w-4 h-4 text-amber-300" />
                                : <Square className="w-4 h-4" />
                            }
                          </button>
                        </div>

                        {/* Lots */}
                        {isExpanded && (
                          <div className="divide-y divide-gray-50">
                            {projet.lots.map(lot => {
                              const isChecked = selectedLots.has(lot.id)
                              return (
                                <label
                                  key={lot.id}
                                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-amber-50 transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleLot(lot.id)}
                                    className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm text-gray-800 font-medium">
                                      Lot {lot.numero}
                                    </span>
                                    <span className="text-sm text-gray-600"> — {lot.corps_etat}</span>
                                  </div>
                                  <span className="text-xs text-gray-400 flex-shrink-0">
                                    {STATUT_LABEL[lot.statut] ?? lot.statut}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || selectedLots.size === 0 || lotsLoading}
                className="w-full mt-4 bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {loading
                  ? 'Création du compte…'
                  : selectedLots.size === 0
                    ? 'Sélectionnez au moins un lot'
                    : `Créer mon compte (${selectedLots.size} lot${selectedLots.size > 1 ? 's' : ''})`
                }
              </button>
            </div>
          </>
        )}
      </div>

      <p className="text-center text-xs text-gray-400 mt-4">
        Déjà un compte ?{' '}
        <Link href="/login" className="text-gray-700 font-medium hover:text-gray-900 transition-colors">
          Se connecter
        </Link>
      </p>
    </div>
  )
}
