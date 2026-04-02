'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Search, Loader2, Star, Phone, Mail, Globe, X,
  UserPlus, Package, ExternalLink, CheckCircle2,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/* ── Types ── */

interface Lot {
  id: string
  numero: number
  corps_etat: string
  budget_prevu: number | null
  statut: string
  st_retenu_id: string | null
}

interface ProjetInfo {
  nom: string
  adresse: string | null
}

interface Suggestion {
  id: string
  raison_sociale: string
  adresse: string | null
  contact_tel: string | null
  contact_email: string | null
  site_web: string | null
  place_id: string | null
  note_google: number | null
  nb_avis_google: number | null
  statut: string
  lot_corps_etat: string | null
}

/* ── Helpers ── */

function extractVille(adresse: string | null): string {
  if (!adresse) return ''
  // Try to get city from "... XXXXX Ville" or "... Ville"
  const match = adresse.match(/\d{5}\s+(.+?)(?:\s*,|$)/)
  if (match) return match[1].trim()
  // Fallback: last meaningful word
  const parts = adresse.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

/* ── Component ── */

export default function AchatsPhase() {
  const { id: projetId } = useParams<{ id: string }>()
  const { user } = useUser()
  const supabase = createClient()

  const [projet, setProjet] = useState<ProjetInfo | null>(null)
  const [lots, setLots] = useState<Lot[]>([])
  const [loading, setLoading] = useState(true)

  // Per-lot state
  const [searchingLotId, setSearchingLotId] = useState<string | null>(null)
  const [suggestionsMap, setSuggestionsMap] = useState<Record<string, Suggestion[]>>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null) // suggestion id

  /* ── Load data ── */
  useEffect(() => {
    async function load() {
      const [projetRes, lotsRes] = await Promise.all([
        supabase.schema('app').from('projets')
          .select('nom, adresse').eq('id', projetId).single(),
        supabase.schema('app').from('lots')
          .select('id, numero, corps_etat, budget_prevu, statut, st_retenu_id')
          .eq('projet_id', projetId).order('numero'),
      ])
      setProjet(projetRes.data as ProjetInfo | null)
      setLots((lotsRes.data ?? []) as Lot[])

      // Load existing suggestions for all lots
      const { data: existingSuggestions } = await supabase.schema('app')
        .from('sts_prospection')
        .select('*')
        .eq('projet_id', projetId)
        .eq('statut', 'suggestion')
        .order('nb_avis_google', { ascending: false })

      if (existingSuggestions?.length) {
        const map: Record<string, Suggestion[]> = {}
        for (const s of existingSuggestions as Suggestion[]) {
          const lotId = (s as unknown as { lot_id: string }).lot_id
          if (!map[lotId]) map[lotId] = []
          map[lotId].push(s)
        }
        setSuggestionsMap(map)
      }

      setLoading(false)
    }
    load()
  }, [projetId]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Search ST for a lot ── */
  async function handleFindST(lot: Lot) {
    if (!projet || !user) return
    setSearchingLotId(lot.id)

    try {
      const ville = extractVille(projet.adresse)
      const res = await fetch('/api/co/consultation-st', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot: lot.corps_etat,
          ville: ville || 'Paris',
          nb_resultats: 3,
          projet_id: projetId,
          lot_id: lot.id,
          co_id: user.id,
        }),
      })

      const data = await res.json()

      if (data.success || data.nb_suggestions) {
        // Reload suggestions from DB
        const { data: fresh } = await supabase.schema('app')
          .from('sts_prospection')
          .select('*')
          .eq('lot_id', lot.id)
          .eq('statut', 'suggestion')
          .order('nb_avis_google', { ascending: false })

        setSuggestionsMap(prev => ({ ...prev, [lot.id]: (fresh ?? []) as Suggestion[] }))
      }
    } catch {
      // Silent fail
    } finally {
      setSearchingLotId(null)
    }
  }

  /* ── Ignore suggestion ── */
  async function handleIgnore(suggestion: Suggestion, lotId: string) {
    setActionLoading(suggestion.id)
    await supabase.schema('app').from('sts_prospection')
      .update({ statut: 'ignore' })
      .eq('id', suggestion.id)

    setSuggestionsMap(prev => ({
      ...prev,
      [lotId]: (prev[lotId] ?? []).filter(s => s.id !== suggestion.id),
    }))
    setActionLoading(null)
  }

  /* ── Add to consultation ── */
  async function handleAddToConsultation(suggestion: Suggestion, lotId: string) {
    if (!user) return
    setActionLoading(suggestion.id)

    try {
      // A: Upsert sous_traitant (check doublon on contact_tel)
      let stId: string | null = null

      if (suggestion.contact_tel) {
        const { data: existing } = await supabase.schema('app').from('sous_traitants')
          .select('id')
          .eq('contact_tel', suggestion.contact_tel)
          .limit(1)
          .maybeSingle()
        if (existing) stId = existing.id
      }

      if (!stId) {
        const { data: newST } = await supabase.schema('app').from('sous_traitants')
          .insert({
            raison_sociale: suggestion.raison_sociale,
            contact_tel: suggestion.contact_tel,
            contact_email: suggestion.contact_email,
            adresse: suggestion.adresse,
            corps_etat: suggestion.lot_corps_etat ? [suggestion.lot_corps_etat] : [],
            source: 'scraping',
            statut: 'actif',
          })
          .select('id')
          .single()
        stId = newST?.id ?? null
      }

      if (!stId) throw new Error('Impossible de creer le ST')

      // B: Update sts_prospection
      await supabase.schema('app').from('sts_prospection')
        .update({ statut: 'valide', st_id: stId })
        .eq('id', suggestion.id)

      // C: Insert consultation
      await supabase.schema('app').from('consultations_st')
        .insert({
          projet_id: projetId,
          lot_id: lotId,
          st_id: stId,
          statut: 'a_contacter',
          attribue: false,
        })

      // D: Remove from suggestions
      setSuggestionsMap(prev => ({
        ...prev,
        [lotId]: (prev[lotId] ?? []).filter(s => s.id !== suggestion.id),
      }))
    } catch {
      alert('Erreur lors de l\'ajout')
    } finally {
      setActionLoading(null)
    }
  }

  /* ── Render ── */

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  if (lots.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
        <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700">Aucun lot sur ce projet</p>
        <p className="text-xs text-gray-400 mt-1">Creez des lots depuis la page Achats dans la sidebar</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {lots.map(lot => {
        const suggestions = suggestionsMap[lot.id] ?? []
        const isSearching = searchingLotId === lot.id
        const hasSTRetenu = !!lot.st_retenu_id

        return (
          <div key={lot.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Lot header */}
            <div className="flex items-center gap-4 px-5 py-4">
              <span className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {String(lot.numero).padStart(2, '0')}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{lot.corps_etat}</p>
                <p className="text-xs text-gray-400">
                  {lot.budget_prevu ? `${lot.budget_prevu.toLocaleString('fr-FR')} EUR` : 'Budget non defini'}
                  {' / '}
                  <span className="capitalize">{lot.statut.replace('_', ' ')}</span>
                </p>
              </div>

              {hasSTRetenu ? (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
                  <CheckCircle2 className="w-3.5 h-3.5" />ST attribue
                </span>
              ) : (
                <button onClick={() => handleFindST(lot)} disabled={isSearching}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {isSearching ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />Recherche...</>
                  ) : (
                    <><Search className="w-3.5 h-3.5" />Trouver ST</>
                  )}
                </button>
              )}
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="border-t border-gray-100 bg-gray-50/50">
                <div className="px-5 py-2.5">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                    {suggestions.length} entreprise{suggestions.length > 1 ? 's' : ''} trouvee{suggestions.length > 1 ? 's' : ''} sur Google
                  </p>
                </div>

                <div className="divide-y divide-gray-100">
                  {suggestions.map(s => {
                    const isActioning = actionLoading === s.id
                    return (
                      <div key={s.id} className="px-5 py-3.5">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{s.raison_sociale}</p>
                            {s.adresse && (
                              <p className="text-xs text-gray-500 mt-0.5">{s.adresse}</p>
                            )}
                            <div className="flex items-center flex-wrap gap-3 mt-1.5">
                              {s.note_google != null && (
                                <span className="flex items-center gap-1 text-xs text-amber-600">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  {s.note_google}
                                  {s.nb_avis_google != null && (
                                    <span className="text-gray-400"> / {s.nb_avis_google} avis</span>
                                  )}
                                </span>
                              )}
                              {s.contact_tel ? (
                                <a href={`tel:${s.contact_tel}`}
                                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                                  <Phone className="w-3 h-3" />{s.contact_tel}
                                </a>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-gray-300">
                                  <Phone className="w-3 h-3" />Non disponible
                                </span>
                              )}
                              {s.contact_email ? (
                                <a href={`mailto:${s.contact_email}`}
                                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                                  <Mail className="w-3 h-3" />{s.contact_email}
                                </a>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-gray-300">
                                  <Mail className="w-3 h-3" />Non disponible
                                </span>
                              )}
                              {s.site_web && (
                                <a href={s.site_web} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700">
                                  <ExternalLink className="w-3 h-3" />Voir le site
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                            <button onClick={() => handleIgnore(s, lot.id)} disabled={isActioning}
                              className="flex items-center gap-1 px-2.5 py-1.5 border border-red-200 text-red-500 rounded-md text-xs font-medium hover:bg-red-50 disabled:opacity-40 transition-colors">
                              <X className="w-3 h-3" />Ignorer
                            </button>
                            <button onClick={() => handleAddToConsultation(s, lot.id)} disabled={isActioning}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-900 text-white rounded-md text-xs font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                              {isActioning ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <UserPlus className="w-3 h-3" />
                              )}
                              Ajouter a la consultation
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
