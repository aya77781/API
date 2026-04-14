'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ThumbsUp, ThumbsDown, X, Check, MessageSquare, FileSignature } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, cn } from '@/lib/utils'
import { generateDevisSTPdf, type DevisLigne } from '@/lib/pdf/devisST'

type Ligne = {
  id: string
  designation: string | null
  detail: string | null
  quantite: number | null
  unite: string | null
  prix_unitaire: number | null
  ordre: number
}

type Acces = {
  id: string
  user_id: string | null
  st_nom: string | null
  st_societe: string | null
  st_email: string | null
  statut: 'envoye' | 'ouvert' | 'en_cours' | 'soumis' | 'retenu' | 'refuse'
  soumis_le: string | null
}

type OffreLigne = {
  acces_id: string
  chiffrage_ligne_id: string | null
  prix_unitaire: number | null
  total_ht: number | null
  montant_total_ht: number | null
}


function uniteLabel(u: string | null): string {
  if (!u) return ''
  if (u === 'm2') return 'm²'
  if (u === 'm3') return 'm³'
  return u
}

export default function DceComparatifDetail({
  lotId,
  projetId,
  projetNom,
  projetReference,
  lotNom,
}: {
  lotId: string
  projetId: string
  projetNom?: string
  projetReference?: string | null
  lotNom?: string
}) {
  const supabase = useMemo(() => createClient(), [])
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [acces, setAcces] = useState<Acces[]>([])
  const [offresByAcces, setOffresByAcces] = useState<Record<string, Map<string, OffreLigne>>>({})
  const [loading, setLoading] = useState(true)
  const [actionModal, setActionModal] = useState<{ acces: Acces; decision: 'accepte' | 'refuse' } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [{ data: lignesData }, { data: accesData }] = await Promise.all([
      supabase
        .from('chiffrage_lignes')
        .select('id, designation, detail, quantite, unite, prix_unitaire, ordre')
        .eq('lot_id', lotId)
        .order('ordre', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('dce_acces_st')
        .select('id, user_id, st_nom, st_societe, st_email, statut, soumis_le')
        .eq('lot_id', lotId)
        .in('statut', ['soumis', 'retenu', 'refuse']),
    ])

    setLignes((lignesData ?? []) as Ligne[])
    const accesRows = (accesData ?? []) as Acces[]
    setAcces(accesRows)

    if (accesRows.length > 0) {
      const accesIds = accesRows.map((a) => a.id)
      const { data: offresData } = await supabase
        .from('dce_offres_st')
        .select('acces_id, chiffrage_ligne_id, prix_unitaire, total_ht, montant_total_ht')
        .in('acces_id', accesIds)
      const grouped: Record<string, Map<string, OffreLigne>> = {}
      ;(offresData ?? []).forEach((o: any) => {
        if (!grouped[o.acces_id]) grouped[o.acces_id] = new Map()
        if (o.chiffrage_ligne_id) {
          grouped[o.acces_id].set(o.chiffrage_ligne_id, o as OffreLigne)
        }
      })
      setOffresByAcces(grouped)
    } else {
      setOffresByAcces({})
    }
    setLoading(false)
  }, [lotId, supabase])

  useEffect(() => {
    refresh()
  }, [refresh])

  // ── Totaux
  const ecoTotal = useMemo(
    () => lignes.reduce((s, l) => s + (Number(l.prix_unitaire) || 0) * (Number(l.quantite) || 0), 0),
    [lignes],
  )
  const stTotals = useMemo(() => {
    const map = new Map<string, number>()
    acces.forEach((a) => {
      const offres = offresByAcces[a.id]
      if (!offres) { map.set(a.id, 0); return }
      let total = 0
      lignes.forEach((l) => {
        const off = offres.get(l.id)
        if (off) total += Number(off.total_ht) || 0
      })
      map.set(a.id, total)
    })
    return map
  }, [acces, offresByAcces, lignes])

  if (loading) return <div className="text-xs text-gray-400 py-6 text-center">Chargement du comparatif…</div>
  if (lignes.length === 0) return <div className="text-xs text-gray-400 py-6 text-center">Aucune ligne de chiffrage pour ce lot</div>
  if (acces.length === 0) return <div className="text-xs text-gray-400 py-6 text-center">Aucune offre DCE soumise pour ce lot</div>

  return (
    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900">Comparatif détaillé — Économiste vs ST</h4>
        <p className="text-xs text-gray-500 mt-0.5">Prix unitaires HT ligne par ligne</p>
      </div>

      {toast && (
        <div className="px-4 py-2 bg-green-50 border-b border-green-200 text-green-800 text-xs flex items-center gap-2">
          <Check className="w-3.5 h-3.5" />
          {toast}
          <button onClick={() => setToast(null)} className="ml-auto text-green-600 hover:text-green-800">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500">
              <th className="px-3 py-2 min-w-[180px] sticky left-0 bg-gray-50 z-10">Désignation</th>
              <th className="px-3 py-2 w-16 text-right">Qté</th>
              <th className="px-3 py-2 w-14">Unité</th>
              <th className="px-3 py-2 w-28 text-right bg-blue-50">Éco PU</th>
              <th className="px-3 py-2 w-28 text-right bg-blue-50">Éco Total</th>
              {acces.map((a) => {
                const name = a.st_societe || a.st_nom || a.st_email || 'ST'
                const isRetenu = a.statut === 'retenu'
                const isRefuse = a.statut === 'refuse'
                return (
                  <th
                    key={a.id}
                    colSpan={2}
                    className={cn(
                      'px-3 py-2 text-center border-l border-gray-200',
                      isRetenu && 'bg-emerald-50',
                      isRefuse && 'bg-red-50 opacity-75',
                    )}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-semibold text-gray-800 truncate max-w-[140px]" title={name}>{name}</span>
                      {isRetenu && <span className="text-[9px] px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded">Retenu</span>}
                      {isRefuse && <span className="text-[9px] px-1 py-0.5 bg-red-100 text-red-700 rounded">Refusé</span>}
                    </div>
                  </th>
                )
              })}
            </tr>
            <tr className="text-left text-gray-400 text-[10px] uppercase tracking-wider">
              <th className="px-3 py-1 sticky left-0 bg-gray-50" />
              <th className="px-3 py-1" />
              <th className="px-3 py-1" />
              <th className="px-3 py-1 bg-blue-50" />
              <th className="px-3 py-1 bg-blue-50" />
              {acces.map((a) => (
                <>
                  <th key={`${a.id}-pu`} className="px-2 py-1 text-right border-l border-gray-200">PU</th>
                  <th key={`${a.id}-tt`} className="px-2 py-1 text-right">Total</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const q = Number(l.quantite) || 0
              const ecoPU = Number(l.prix_unitaire) || 0
              const ecoTotal = ecoPU * q
              return (
                <tr key={l.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-900 sticky left-0 bg-white z-10">
                    <div className="font-medium truncate max-w-[220px]" title={l.designation ?? ''}>{l.designation}</div>
                    {l.detail && <div className="text-gray-400 text-[10px] truncate max-w-[220px]">{l.detail}</div>}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600 tabular-nums">{q || '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{uniteLabel(l.unite)}</td>
                  <td className="px-3 py-2 text-right text-gray-700 tabular-nums bg-blue-50/40">
                    {ecoPU > 0 ? formatCurrency(ecoPU) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900 tabular-nums font-medium bg-blue-50/40">
                    {ecoTotal > 0 ? formatCurrency(ecoTotal) : '—'}
                  </td>
                  {acces.map((a) => {
                    const off = offresByAcces[a.id]?.get(l.id)
                    const pu = Number(off?.prix_unitaire) || 0
                    const tt = Number(off?.total_ht) || 0
                    const diff = ecoPU > 0 && pu > 0 ? (pu - ecoPU) / ecoPU : 0
                    const isHigher = diff > 0.05
                    const isLower = diff < -0.05
                    const isRetenu = a.statut === 'retenu'
                    return (
                      <>
                        <td
                          key={`${a.id}-${l.id}-pu`}
                          className={cn(
                            'px-2 py-2 text-right tabular-nums border-l border-gray-200',
                            isRetenu && 'bg-emerald-50/40',
                            pu === 0 && 'text-gray-300',
                            isHigher && 'text-red-600',
                            isLower && 'text-green-700',
                          )}
                        >
                          {pu > 0 ? formatCurrency(pu) : '—'}
                        </td>
                        <td
                          key={`${a.id}-${l.id}-tt`}
                          className={cn(
                            'px-2 py-2 text-right tabular-nums',
                            isRetenu && 'bg-emerald-50/40',
                            tt === 0 && 'text-gray-300',
                          )}
                        >
                          {tt > 0 ? formatCurrency(tt) : '—'}
                        </td>
                      </>
                    )
                  })}
                </tr>
              )
            })}

            {/* Totaux */}
            <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
              <td colSpan={3} className="px-3 py-2.5 text-right text-gray-700 uppercase text-[10px] tracking-wider sticky left-0 bg-gray-100">
                TOTAL LOT HT
              </td>
              <td className="px-3 py-2.5 bg-blue-100/60" />
              <td className="px-3 py-2.5 text-right text-gray-900 tabular-nums bg-blue-100/60">
                {formatCurrency(ecoTotal)}
              </td>
              {acces.map((a) => {
                const t = stTotals.get(a.id) ?? 0
                const diff = ecoTotal > 0 && t > 0 ? (t - ecoTotal) / ecoTotal : 0
                const isHigher = diff > 0
                const pct = ecoTotal > 0 ? (diff * 100).toFixed(1) : '0'
                const isRetenu = a.statut === 'retenu'
                return (
                  <>
                    <td key={`${a.id}-totpu`} className={cn('px-2 py-2.5 border-l border-gray-200', isRetenu && 'bg-emerald-100/60')} />
                    <td
                      key={`${a.id}-tottt`}
                      className={cn(
                        'px-2 py-2.5 text-right tabular-nums',
                        isRetenu && 'bg-emerald-100/60',
                      )}
                    >
                      <div>{formatCurrency(t)}</div>
                      {ecoTotal > 0 && t > 0 && (
                        <div className={cn(
                          'text-[10px] font-normal',
                          isHigher ? 'text-red-600' : 'text-green-700',
                        )}>
                          {isHigher ? '+' : ''}{pct}% vs éco
                        </div>
                      )}
                    </td>
                  </>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Actions par ST */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex flex-wrap gap-2">
        {acces.map((a) => {
          const name = a.st_societe || a.st_nom || 'ST'
          const isFinal = a.statut === 'retenu' || a.statut === 'refuse'
          if (isFinal) return null
          return (
            <div key={a.id} className="flex items-center gap-1 bg-white border border-gray-200 rounded-md px-2 py-1">
              <span className="text-xs text-gray-700 font-medium mr-1">{name}</span>
              <button
                onClick={() => setActionModal({ acces: a, decision: 'accepte' })}
                className="flex items-center gap-1 px-2 py-1 text-xs text-green-700 border border-green-200 bg-green-50 rounded hover:bg-green-100"
                title="Accepter cette offre"
              >
                <ThumbsUp className="w-3 h-3" />
                Accepter
              </button>
              <button
                onClick={() => setActionModal({ acces: a, decision: 'refuse' })}
                className="flex items-center gap-1 px-2 py-1 text-xs text-red-700 border border-red-200 bg-red-50 rounded hover:bg-red-100"
                title="Refuser cette offre"
              >
                <ThumbsDown className="w-3 h-3" />
                Refuser
              </button>
            </div>
          )
        })}
      </div>

      {/* Info : devis finaux pilotés depuis l'onglet "Devis final" */}
      {acces.some((a) => a.statut === 'retenu') && (
        <div className="border-t border-gray-200 bg-emerald-50/50 px-4 py-3 flex items-center gap-2">
          <FileSignature className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <p className="text-xs text-emerald-800">
            Le devis de chaque ST retenu a été généré. Rendez-vous dans l'onglet{' '}
            <strong>Devis final</strong> pour le signer et le transmettre au sous-traitant.
          </p>
        </div>
      )}

      {actionModal && (
        <DecisionModal
          projetId={projetId}
          lotId={lotId}
          acces={actionModal.acces}
          decision={actionModal.decision}
          onClose={() => setActionModal(null)}
          onDone={async (msg, decision) => {
            setActionModal(null)
            // Auto-génération du devis PDF si la décision est "accepte".
            if (decision === 'accepte') {
              try {
                const offres = offresByAcces[actionModal.acces.id]
                const total = stTotals.get(actionModal.acces.id) ?? 0
                await generateAndUploadInitial(actionModal.acces, offres, lignes, total)
                setToast(`${msg} — devis généré dans "Devis final".`)
              } catch (e: any) {
                setToast(`${msg} (échec génération devis : ${e?.message ?? 'erreur'})`)
              }
            } else {
              setToast(msg)
            }
            await refresh()
            setTimeout(() => setToast(null), 5000)
          }}
        />
      )}
    </div>
  )

  // ── Génération PDF + upload initial (exécuté automatiquement à l'acceptation)
  async function generateAndUploadInitial(
    a: Acces,
    offres: Map<string, OffreLigne> | undefined,
    lignesList: Ligne[],
    total: number,
  ) {
    if (!offres) throw new Error('Aucune offre trouvée')
    const devisLignes: DevisLigne[] = lignesList.map((l) => {
      const off = offres.get(l.id)
      return {
        designation: l.designation ?? '',
        detail: l.detail,
        quantite: Number(l.quantite) || 0,
        unite: l.unite ?? '',
        prix_unitaire: Number(off?.prix_unitaire) || 0,
      }
    })

    const blob = generateDevisSTPdf({
      projet_nom: projetNom ?? 'Projet',
      projet_reference: projetReference ?? null,
      lot_nom: lotNom ?? 'Lot',
      st_societe: a.st_societe,
      st_nom: a.st_nom,
      st_email: a.st_email,
      st_telephone: null,
      lignes: devisLignes,
      total_ht: total,
    })

    const path = `dce-devis/${projetId}/${a.id}/devis-${Date.now()}.pdf`
    const { error: upErr } = await supabase.storage
      .from('documents')
      .upload(path, blob, { contentType: 'application/pdf', upsert: true })
    if (upErr) throw upErr
    const { data: pub } = supabase.storage.from('documents').getPublicUrl(path)

    const { error: insErr } = await supabase.from('st_devis_signatures' as never).upsert({
      acces_id: a.id,
      projet_id: projetId,
      lot_id: lotId,
      montant_ht: total,
      devis_url: pub.publicUrl,
      statut: 'genere',
    } as never, { onConflict: 'acces_id' })
    if (insErr) throw insErr
  }
}


// ─── Modal Décision + message ───────────────────────────────────────────────

function DecisionModal({
  projetId,
  lotId,
  acces,
  decision,
  onClose,
  onDone,
}: {
  projetId: string
  lotId: string
  acces: Acces
  decision: 'accepte' | 'refuse'
  onClose: () => void
  onDone: (toast: string, decision: 'accepte' | 'refuse') => Promise<void>
}) {
  const supabase = useMemo(() => createClient(), [])
  const defaultMsg =
    decision === 'accepte'
      ? `Bonjour,\n\nNous avons le plaisir de vous informer que votre offre pour ce lot a été retenue. Nous reviendrons vers vous pour la suite.\n\nCordialement.`
      : `Bonjour,\n\nNous vous remercions pour votre offre. Après étude comparative, nous avons retenu une autre proposition pour ce lot.\n\nNous restons à votre écoute pour de futures consultations.`
  const [message, setMessage] = useState(defaultMsg)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    if (!message.trim()) {
      setError('Le message ne peut pas être vide.')
      return
    }
    setSaving(true)
    setError(null)

    const newStatut = decision === 'accepte' ? 'retenu' : 'refuse'
    const name = acces.st_societe || acces.st_nom || 'ST'

    // 1) Maj du statut de l'invitation DCE
    const { error: e1 } = await supabase
      .from('dce_acces_st' as never)
      .update({ statut: newStatut } as never)
      .eq('id', acces.id)
    if (e1) { setError(`Maj statut : ${e1.message}`); setSaving(false); return }

    // 2) Trace de la décision dans app.echanges_st
    await supabase.schema('app').from('echanges_st').insert({
      projet_id: projetId,
      lot_id: lotId,
      st_id: acces.user_id,
      type: 'autre',
      contenu: message.trim(),
      decision: decision === 'accepte' ? 'accepte' : 'refuse',
      motif_decision: null,
    })

    // 3) Notification pour l'utilisateur ST (si lié à un compte).
    if (acces.user_id) {
      await supabase.schema('app').from('alertes').insert({
        projet_id: projetId,
        utilisateur_id: acces.user_id,
        type: decision === 'accepte' ? 'offre_acceptee' : 'offre_refusee',
        titre: decision === 'accepte' ? 'Votre offre a été retenue' : 'Offre non retenue',
        message: message.trim(),
        priorite: decision === 'accepte' ? 'high' : 'normal',
      })
    }

    setSaving(false)
    await onDone(
      decision === 'accepte'
        ? `Offre de ${name} acceptée — message envoyé.`
        : `Offre de ${name} refusée — message envoyé.`,
      decision,
    )
  }

  const isAccept = decision === 'accepte'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">
            {isAccept ? 'Accepter l\'offre' : 'Refuser l\'offre'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="text-xs text-gray-500">
            Destinataire :{' '}
            <span className="text-gray-900 font-medium">{acces.st_societe || acces.st_nom || acces.st_email}</span>
            {!acces.user_id && (
              <span className="ml-2 text-amber-700 text-[11px]">
                (utilisateur non lié à un compte — message transmis par email uniquement)
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" />
              Message au sous-traitant
            </label>
            <textarea
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 resize-y"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-2 text-xs">{error}</div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
          <button
            onClick={confirm}
            disabled={saving}
            className={cn(
              'px-4 py-1.5 text-sm font-medium text-white rounded-md disabled:opacity-50 flex items-center gap-1.5',
              isAccept ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700',
            )}
          >
            {isAccept ? <ThumbsUp className="w-3.5 h-3.5" /> : <ThumbsDown className="w-3.5 h-3.5" />}
            {saving ? 'Envoi…' : isAccept ? 'Accepter et notifier' : 'Refuser et notifier'}
          </button>
        </div>
      </div>
    </div>
  )
}
