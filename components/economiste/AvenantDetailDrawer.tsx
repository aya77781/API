'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  X, Check, Ban, ThumbsUp, ThumbsDown, FileSignature, ExternalLink, Plus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type Cas = 'avant_debut' | 'pendant' | 'apres_fin'
type AvenantStatut = 'ouvert' | 'chiffre' | 'devis_recu' | 'valide_co' | 'valide_client' | 'integre' | 'refuse'

export type AvenantFull = {
  id:            string
  projet_id:     string
  lot_id:        string | null
  numero:        number
  code:          string | null
  titre:         string | null
  description:   string
  cas:           Cas | null
  acces_st_id:   string | null
  devis_id:      string | null
  montant_ht:    number | null
  statut:        AvenantStatut
  created_by:    string | null
  created_at:    string
  projet_nom:    string
  projet_reference: string | null
  lot_nom:       string | null
  lot_planning_debut: string | null
  lot_planning_fin:   string | null
  lot_total_ht:       number | null
  projet_budget_client_ht: number | null
  creator_nom:   string | null
}

type AccesInfo = {
  id:          string
  st_nom:      string | null
  st_societe:  string | null
  st_email:    string | null
  statut:      'envoye' | 'ouvert' | 'en_cours' | 'soumis' | 'retenu' | 'refuse'
  type_acces:  'externe' | 'interne'
}

const CAS_BADGE: Record<Cas, { label: string; bg: string; fg: string }> = {
  avant_debut: { label: 'Avant démarrage', bg: '#E6F1FB', fg: '#185FA5' },
  pendant:     { label: 'En cours de lot', bg: '#FAEEDA', fg: '#854F0B' },
  apres_fin:   { label: 'Post-lot',        bg: '#FCEBEB', fg: '#A32D2D' },
}

const STATUT_BADGE: Record<AvenantStatut, { label: string; bg: string; fg: string }> = {
  ouvert:        { label: 'Ouvert',        bg: '#F1EFE8', fg: '#5F5E5A' },
  chiffre:       { label: 'Chiffré',       bg: '#FAEEDA', fg: '#854F0B' },
  devis_recu:    { label: 'Devis reçu',    bg: '#FAEEDA', fg: '#854F0B' },
  valide_co:     { label: 'Validé CO',     bg: '#E6F1FB', fg: '#185FA5' },
  valide_client: { label: 'Validé client', bg: '#EAF3DE', fg: '#3B6D11' },
  integre:       { label: 'Intégré',       bg: '#085041', fg: '#9FE1CB' },
  refuse:        { label: 'Refusé',        bg: '#FCEBEB', fg: '#A32D2D' },
}

function fmtEur(n: number | null | undefined): string {
  const v = Number(n ?? 0)
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} € HT`
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))
}

export function AvenantDetailDrawer({
  avenant,
  onClose,
  onChanged,
}: {
  avenant: AvenantFull
  onClose: () => void
  onChanged: () => void
}) {
  const supabase = useMemo(() => createClient(), [])

  const [acces, setAcces]           = useState<AccesInfo | null>(null)
  const [offreMontant, setOffreMontant] = useState<number | null>(null)
  const [working, setWorking]       = useState(false)
  const [toast, setToast]           = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  const cas    = avenant.cas
  const statut = avenant.statut

  useEffect(() => {
    let cancel = false
    async function load() {
      if (!avenant.acces_st_id) { setAcces(null); setOffreMontant(null); return }
      const { data: a } = await supabase
        .from('dce_acces_st' as never)
        .select('id, st_nom, st_societe, st_email, statut, type_acces')
        .eq('id', avenant.acces_st_id)
        .single()
      if (cancel) return
      setAcces(((a ?? null) as unknown) as AccesInfo | null)

      // Montant total de l'offre soumise
      const { data: offres } = await supabase
        .from('dce_offres_st' as never)
        .select('montant_total_ht, total_ht')
        .eq('acces_id', avenant.acces_st_id)
      if (cancel) return
      const arr = ((offres ?? []) as Array<{ montant_total_ht: number | null; total_ht: number | null }>)
      if (arr.length === 0) { setOffreMontant(null); return }
      // Priorité : champ pré-agrégé si présent sur la première ligne, sinon somme des total_ht
      const pre = arr.find((o) => typeof o.montant_total_ht === 'number' && o.montant_total_ht !== null)
      if (pre) { setOffreMontant(Number(pre.montant_total_ht ?? 0)); return }
      const sum = arr.reduce((s, o) => s + (Number(o.total_ht) || 0), 0)
      setOffreMontant(sum || null)
    }
    load()
    return () => { cancel = true }
  }, [avenant.acces_st_id, supabase])

  async function updateAvenant(patch: Record<string, unknown>) {
    setWorking(true)
    const { error } = await supabase
      .schema('app')
      .from('avenants')
      .update(patch as never)
      .eq('id', avenant.id)
    setWorking(false)
    if (error) { setToast({ kind: 'err', msg: error.message }); return false }
    onChanged()
    return true
  }

  async function handleValiderCO() {
    const patch: Record<string, unknown> = { statut: 'valide_co' }
    if (typeof offreMontant === 'number' && !avenant.montant_ht) {
      patch.montant_ht = offreMontant
    }
    const ok = await updateAvenant(patch)
    if (ok && avenant.projet_id) {
      await supabase.schema('app').from('alertes').insert({
        projet_id: avenant.projet_id,
        utilisateur_id: null,
        type: 'avenant_valide_co',
        titre: `Avenant ${avenant.code ?? 'AVN'} validé CO`,
        message: `${avenant.titre ?? 'Avenant'} — à transmettre au client.`,
        priorite: 'normal',
        lue: false,
        metadata: { avenant_id: avenant.id },
      })
    }
  }

  async function handleRefuser() {
    await updateAvenant({ statut: 'refuse' })
  }

  async function handleValiderClient() {
    await updateAvenant({ statut: 'valide_client' })
  }

  async function handleIntegrerLot() {
    if (!avenant.lot_id || !avenant.montant_ht) {
      setToast({ kind: 'err', msg: "Montant ou lot manquant pour intégration." })
      return
    }
    setWorking(true)
    const nouveau = (avenant.lot_total_ht ?? 0) + avenant.montant_ht
    const { error: e1 } = await supabase
      .from('lots' as never)
      .update({ total_ht: nouveau } as never)
      .eq('id', avenant.lot_id)
    if (e1) {
      setWorking(false)
      setToast({ kind: 'err', msg: e1.message })
      return
    }
    setWorking(false)
    await updateAvenant({ statut: 'integre' })
  }

  async function handleGenererDevis() {
    if (!avenant.lot_id || !acces || typeof offreMontant !== 'number') {
      setToast({ kind: 'err', msg: "Données insuffisantes pour générer le devis." })
      return
    }
    setWorking(true)

    // 1) Numero canonique via RPC (partage la sequence annuelle DEV-YYYY-NNN)
    const { data: num } = await supabase.rpc('next_devis_numero' as never)
    const numero = (num as unknown as string) ?? `DEV-${avenant.code ?? 'AVN'}`

    // 2) Snapshot des lignes depuis les offres du ST pour CET avenant
    const { data: offresRows } = await supabase
      .from('dce_offres_st')
      .select('designation, quantite, unite, prix_unitaire, total_ht')
      .eq('acces_id', avenant.acces_st_id!)
    const lignesSnapshot = (offresRows ?? []).map((o: any) => ({
      designation:   o.designation ?? '',
      quantite:      Number(o.quantite) || 0,
      unite:         o.unite ?? '',
      prix_unitaire: Number(o.prix_unitaire) || 0,
      total_ht:      Number(o.total_ht) || 0,
    }))

    const tvaPct = 10
    const montantTtc = Math.round(offreMontant * (1 + tvaPct / 100) * 100) / 100

    // 3) Insert devis avec avenant_id (unique constraint compound)
    const { data, error } = await supabase
      .from('devis' as never)
      .insert({
        projet_id:   avenant.projet_id,
        lot_id:      avenant.lot_id,
        acces_st_id: avenant.acces_st_id,
        avenant_id:  avenant.id,
        st_nom:      acces.st_nom ?? '—',
        st_societe:  acces.st_societe,
        st_email:    acces.st_email,
        montant_ht:  offreMontant,
        tva_pct:     tvaPct,
        montant_ttc: montantTtc,
        lignes:      lignesSnapshot,
        signataire_ids: [],
        statut:      'brouillon',
        numero,
      } as never)
      .select('id')
      .single()
    setWorking(false)
    if (error || !data) { setToast({ kind: 'err', msg: error?.message ?? 'Erreur création devis' }); return }
    await updateAvenant({ devis_id: (data as unknown as { id: string }).id })
    setToast({ kind: 'ok', msg: `Devis ${numero} généré — rendez-vous dans l'onglet Devis final pour signer.` })
  }

  const sBadge = STATUT_BADGE[statut]
  const cBadge = cas ? CAS_BADGE[cas] : null
  const nouveauTotalProjet = (avenant.projet_budget_client_ht ?? 0) + (avenant.montant_ht ?? 0)

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="ml-auto bg-white shadow-xl w-full max-w-2xl h-full overflow-y-auto relative">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-mono text-gray-400">
                {avenant.code ?? `AVN-${String(avenant.numero).padStart(3, '0')}`}
              </span>
              {cBadge && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{ background: cBadge.bg, color: cBadge.fg }}
                >
                  {cBadge.label}
                </span>
              )}
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{ background: sBadge.bg, color: sBadge.fg }}
              >
                {sBadge.label}
              </span>
            </div>
            <h2 className="text-base font-semibold text-gray-900 truncate">
              {avenant.titre ?? 'Avenant sans titre'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {toast && (
            <div className={cn(
              'text-xs rounded-md px-3 py-2 border',
              toast.kind === 'err'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-green-50 border-green-200 text-green-700',
            )}>
              {toast.msg}
            </div>
          )}

          {/* Section Infos */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Informations</h3>
            <div className="bg-white border border-gray-200 rounded-md p-4 space-y-2 text-sm">
              <Row label="Projet" value={
                <span>
                  {avenant.projet_reference ? <span className="font-mono text-gray-400 mr-1.5">[{avenant.projet_reference}]</span> : null}
                  {avenant.projet_nom}
                </span>
              } />
              <Row label="Lot" value={
                <span>
                  {avenant.lot_nom ?? '—'}
                  {avenant.lot_planning_debut && avenant.lot_planning_fin && (
                    <span className="text-gray-400 ml-1.5">
                      · Planning : {fmtDate(avenant.lot_planning_debut)} → {fmtDate(avenant.lot_planning_fin)}
                    </span>
                  )}
                </span>
              } />
              {cBadge && <Row label="Cas détecté" value={cBadge.label} />}
              {avenant.description && (
                <div className="pt-2 border-t border-gray-100">
                  <div className="text-xs text-gray-500 mb-1">Description</div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{avenant.description}</p>
                </div>
              )}
              <Row label="Créé par" value={
                <span className="text-gray-600">
                  {avenant.creator_nom ?? '—'} le {fmtDate(avenant.created_at)}
                </span>
              } />
            </div>
          </section>

          {/* Section ST consulté */}
          {cas !== 'avant_debut' && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">ST consulté</h3>
              <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3 text-sm">
                {!acces ? (
                  <p className="text-xs text-gray-400">Aucun ST consulté.</p>
                ) : (
                  <>
                    <div className="space-y-1">
                      <div className="font-medium text-gray-900">{acces.st_nom ?? '—'}</div>
                      <div className="text-xs text-gray-500">
                        {acces.st_societe ?? '—'}
                        {acces.st_email && <> · {acces.st_email}</>}
                      </div>
                      <div className="text-xs">
                        <span className="text-gray-500">Statut réponse ST : </span>
                        <span className="font-medium text-gray-700">{acces.statut}</span>
                      </div>
                      {typeof offreMontant === 'number' && (
                        <div className="text-xs">
                          <span className="text-gray-500">Montant soumis : </span>
                          <span className="font-semibold text-gray-900">{fmtEur(offreMontant)}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions workflow */}
                    <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                      {(statut === 'ouvert' || statut === 'devis_recu') && acces.statut === 'soumis' && (
                        <>
                          <button
                            onClick={handleValiderCO}
                            disabled={working}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:opacity-50"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" /> Valider CO
                          </button>
                          <button
                            onClick={handleRefuser}
                            disabled={working}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-700 border border-red-200 bg-red-50 rounded-md hover:bg-red-100 disabled:opacity-50"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" /> Refuser
                          </button>
                        </>
                      )}

                      {statut === 'valide_co' && (
                        <button
                          onClick={handleValiderClient}
                          disabled={working}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" /> Valider client
                        </button>
                      )}

                      {statut === 'valide_client' && (cas === 'pendant' || cas === 'apres_fin') && !avenant.devis_id && (
                        <button
                          onClick={handleGenererDevis}
                          disabled={working}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:opacity-50"
                        >
                          <FileSignature className="w-3.5 h-3.5" /> Générer le devis
                        </button>
                      )}

                      {avenant.devis_id && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md">
                          <Check className="w-3.5 h-3.5" /> Devis généré
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* Section Impact budget */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Impact budget</h3>
            <div className="bg-white border border-gray-200 rounded-md p-4 space-y-2 text-sm">
              <Row label="Montant avenant" value={fmtEur(avenant.montant_ht ?? 0)} />
              <Row label="Budget initial projet" value={fmtEur(avenant.projet_budget_client_ht ?? 0)} />
              <Row
                label="Nouveau total avec avenant"
                value={<span className="font-semibold text-gray-900">{fmtEur(nouveauTotalProjet)}</span>}
              />
            </div>
          </section>

          {cas === 'avant_debut' && statut !== 'integre' && statut !== 'refuse' && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Intégration au lot</h3>
              <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
                <div className="bg-[#E6F1FB] border border-[#C5DDF3] text-[#185FA5] rounded-md p-3 text-xs flex items-start gap-2">
                  <ExternalLink className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Ajoutez les lignes dans le chiffrage du lot</p>
                    <p className="mt-1">Une fois le lot validé par le client, revenez ici pour cliquer sur « Intégrer dans le lot ».</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(statut === 'ouvert' || statut === 'devis_recu') && (
                    <button
                      onClick={handleValiderCO}
                      disabled={working}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:opacity-50"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" /> Valider CO
                    </button>
                  )}
                  {statut === 'valide_co' && (
                    <button
                      onClick={handleValiderClient}
                      disabled={working}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-black disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> Valider client
                    </button>
                  )}
                  {statut === 'valide_client' && (
                    <button
                      onClick={handleIntegrerLot}
                      disabled={working || !avenant.montant_ht}
                      title={!avenant.montant_ht ? 'Renseignez le montant avant intégration' : undefined}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#085041] rounded-md hover:bg-[#063a2f] disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> Intégrer dans le lot
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Refuser à tout moment */}
          {statut !== 'refuse' && statut !== 'integre' && (
            <section>
              <button
                onClick={handleRefuser}
                disabled={working}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50"
              >
                <Ban className="w-3.5 h-3.5" /> Annuler l'avenant
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-gray-500 w-40 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-900 flex-1 min-w-0">{value}</span>
    </div>
  )
}
