'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FileCheck, Download, Upload, Clock, Check, AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, cn } from '@/lib/utils'

type Signature = {
  id: string
  acces_id: string
  projet_id: string
  lot_id: string
  montant_ht: number
  devis_url: string | null
  signed_eco_url: string | null
  signed_final_url: string | null
  statut: 'genere' | 'signe_eco' | 'signe_st' | 'finalise'
  created_at: string
  signed_eco_at: string | null
  signed_st_at: string | null
}

type Acces = {
  id: string
  user_id: string | null
  st_nom: string | null
  st_societe: string | null
  st_email: string | null
  statut: string
  lot_id: string
}

type LotInfo = { id: string; nom: string; ordre: number }

type Enriched = {
  signature: Signature
  acces: Acces | undefined
  lot: LotInfo | undefined
}

const STEP_LABELS: Record<Signature['statut'], { label: string; cls: string }> = {
  genere:    { label: 'Devis généré — à signer',         cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  signe_eco: { label: 'Signé éco — en attente ST',       cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  signe_st:  { label: 'Signé ST',                        cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  finalise:  { label: 'Finalisé (double signé)',         cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

export default function TabDevisFinal({
  projetId,
  projetNom,
}: {
  projetId: string
  projetNom: string
}) {
  const supabase = useMemo(() => createClient(), [])
  const [lots, setLots] = useState<LotInfo[]>([])
  const [rows, setRows] = useState<Enriched[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLotId, setSelectedLotId] = useState<string>('')
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)

    const [{ data: lotsData }, { data: sigsData }] = await Promise.all([
      supabase
        .from('lots')
        .select('id, nom, ordre')
        .eq('projet_id', projetId)
        .order('ordre', { ascending: true }),
      supabase
        .from('st_devis_signatures')
        .select('*')
        .eq('projet_id', projetId)
        .order('created_at', { ascending: false }),
    ])

    const lotsArr = (lotsData ?? []) as LotInfo[]
    setLots(lotsArr)
    setSelectedLotId((prev) => prev || lotsArr[0]?.id || '')

    const signatures = (sigsData ?? []) as Signature[]
    if (signatures.length === 0) {
      setRows([])
      setLoading(false)
      return
    }

    const accesIds = Array.from(new Set(signatures.map((s) => s.acces_id)))
    const { data: accesData } = await supabase
      .from('dce_acces_st')
      .select('id, user_id, st_nom, st_societe, st_email, statut, lot_id')
      .in('id', accesIds)

    const accesMap = new Map<string, Acces>()
    ;(accesData ?? []).forEach((a: any) => accesMap.set(a.id, a as Acces))
    const lotMap = new Map<string, LotInfo>()
    lotsArr.forEach((l) => lotMap.set(l.id, l))

    setRows(
      signatures.map((s) => ({
        signature: s,
        acces: accesMap.get(s.acces_id),
        lot: lotMap.get(s.lot_id),
      })),
    )
    setLoading(false)
  }, [projetId, supabase])

  useEffect(() => { refresh() }, [refresh])

  async function uploadSignedEco(entry: Enriched, file: File) {
    setBusy(entry.signature.id)
    try {
      const path = `dce-devis/${projetId}/${entry.signature.acces_id}/signed-eco-${Date.now()}.pdf`
      const { error: upErr } = await supabase.storage
        .from('documents')
        .upload(path, file, { contentType: file.type || 'application/pdf', upsert: true })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('documents').getPublicUrl(path)

      const { error: updErr } = await supabase
        .from('st_devis_signatures' as never)
        .update({
          signed_eco_url: pub.publicUrl,
          statut: 'signe_eco',
          signed_eco_at: new Date().toISOString(),
        } as never)
        .eq('id', entry.signature.id)
      if (updErr) throw updErr

      if (entry.acces?.user_id) {
        await supabase.schema('app').from('alertes').insert({
          projet_id: projetId,
          utilisateur_id: entry.acces.user_id,
          type: 'devis_a_signer',
          titre: 'Devis à signer',
          message: `Le devis du lot « ${entry.lot?.nom ?? ''} » (projet ${projetNom}) a été signé par API Rénovation. Merci de le contre-signer et le déposer.`,
          priorite: 'high',
        })
      }

      setToast(`Devis signé éco déposé — ${entry.acces?.st_societe || entry.acces?.st_nom || 'ST'} notifié.`)
      await refresh()
    } catch (e: any) {
      setToast(`Erreur : ${e?.message ?? 'upload impossible'}`)
    }
    setBusy(null)
    setTimeout(() => setToast(null), 5000)
  }

  if (loading) {
    return <div className="text-sm text-gray-400 py-10 text-center">Chargement…</div>
  }

  if (lots.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
        <FileCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Aucun lot</h3>
        <p className="text-xs text-gray-400 max-w-md mx-auto">
          Ce projet n'a pas encore de lot.
        </p>
      </div>
    )
  }

  // Comptage par lot
  const countByLot = new Map<string, number>()
  const finaliseByLot = new Map<string, number>()
  rows.forEach((r) => {
    countByLot.set(r.signature.lot_id, (countByLot.get(r.signature.lot_id) ?? 0) + 1)
    if (r.signature.statut === 'finalise') {
      finaliseByLot.set(r.signature.lot_id, (finaliseByLot.get(r.signature.lot_id) ?? 0) + 1)
    }
  })

  const selectedLot = lots.find((l) => l.id === selectedLotId) ?? lots[0]
  const lotRows = rows.filter((r) => r.signature.lot_id === selectedLot.id)

  const totalFinalise = rows
    .filter((r) => r.signature.statut === 'finalise')
    .reduce((s, r) => s + Number(r.signature.montant_ht || 0), 0)
  const totalEngage = rows.reduce((s, r) => s + Number(r.signature.montant_ht || 0), 0)

  return (
    <div className="space-y-4">
      {toast && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-2 text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* Sélecteur de lot (même UX que Comparatif ST) */}
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium mr-1">Lot :</span>
          {lots.map((l) => {
            const isActive = l.id === selectedLot.id
            const cnt = countByLot.get(l.id) ?? 0
            const fin = finaliseByLot.get(l.id) ?? 0
            return (
              <button
                key={l.id}
                onClick={() => setSelectedLotId(l.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                }`}
              >
                <span className="font-mono text-[10px] opacity-70">L{String(l.ordre + 1).padStart(2, '0')}</span>
                {l.nom}
                {cnt > 0 && (
                  <span
                    className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : fin > 0
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-orange-100 text-orange-700'
                    }`}
                    title={`${cnt} devis${fin > 0 ? ` · ${fin} finalisé(s)` : ''}`}
                  >
                    {cnt}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* KPIs projet */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider">Devis engagés (projet)</p>
          <p className="text-xl font-semibold text-gray-900 mt-1">{rows.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider">Montant total HT</p>
          <p className="text-xl font-semibold text-gray-900 mt-1 tabular-nums">{formatCurrency(totalEngage)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider">Finalisés (double-signés)</p>
          <p className="text-xl font-semibold text-emerald-700 mt-1 tabular-nums">{formatCurrency(totalFinalise)}</p>
        </div>
      </div>

      {/* Détail du lot sélectionné */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-semibold text-gray-400">
              LOT {String(selectedLot.ordre + 1).padStart(2, '0')}
            </span>
            <span className="text-sm font-medium text-gray-900">{selectedLot.nom}</span>
          </div>
          <span className="text-xs text-gray-500">
            {lotRows.length === 0 ? 'Aucun devis' : `${lotRows.length} devis`}
          </span>
        </div>

        {lotRows.length === 0 ? (
          <div className="p-10 text-center">
            <FileCheck className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Aucun ST retenu pour ce lot</p>
            <p className="text-xs text-gray-400 mt-1">
              Acceptez une offre dans l'onglet <strong>Comparatif ST</strong> pour générer automatiquement le devis final.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {lotRows.map((entry) => {
              const sig = entry.signature
              const name = entry.acces?.st_societe || entry.acces?.st_nom || entry.acces?.st_email || 'ST'
              const step = STEP_LABELS[sig.statut]
              const isBusy = busy === sig.id

              return (
                <div key={sig.id} className="px-5 py-4 flex items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-[240px]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">{name}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 border rounded font-medium', step.cls)}>
                        {step.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Montant HT : <span className="text-gray-900 font-semibold">{formatCurrency(sig.montant_ht)}</span>
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Généré le {new Date(sig.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {sig.signed_eco_at && ` · signé éco le ${new Date(sig.signed_eco_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`}
                      {sig.signed_st_at && ` · signé ST le ${new Date(sig.signed_st_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {sig.devis_url && (
                      <a
                        href={sig.devis_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50"
                        title="Devis initial non signé"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Devis à signer
                      </a>
                    )}

                    {sig.signed_eco_url && (
                      <a
                        href={sig.signed_eco_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-700 border border-blue-200 bg-blue-50 rounded-md hover:bg-blue-100"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Signé éco
                      </a>
                    )}

                    {sig.signed_final_url && (
                      <a
                        href={sig.signed_final_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-md hover:bg-emerald-100"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Version finale
                      </a>
                    )}

                    {!sig.signed_eco_url && (
                      <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-gray-900 rounded-md hover:bg-black cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        {isBusy ? 'Envoi…' : 'Déposer signé éco'}
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          className="hidden"
                          disabled={isBusy}
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) uploadSignedEco(entry, f)
                            e.target.value = ''
                          }}
                        />
                      </label>
                    )}

                    {sig.statut === 'signe_eco' && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        En attente ST
                      </span>
                    )}
                    {sig.statut === 'finalise' && (
                      <span className="flex items-center gap-1 text-xs text-emerald-700 font-medium">
                        <Check className="w-3 h-3" />
                        Finalisé
                      </span>
                    )}

                    {!entry.acces?.user_id && sig.statut !== 'finalise' && (
                      <span
                        className="flex items-center gap-1 text-[10px] text-amber-700"
                        title="Ce ST n'a pas de compte lié — la transmission se fait par email."
                      >
                        <AlertCircle className="w-3 h-3" />
                        Hors plateforme
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
