import { createClient } from '@/lib/supabase/client'

export const OCR_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_N8N_WEBHOOK_COMPTA
  ?? 'https://apiprojet.app.n8n.cloud/webhook/api-renovation-compta-ocr'

export type OcrExtract = {
  libelle?: string
  fournisseur?: string
  reference_facture?: string
  montant_ht?: string
  montant_ttc?: string
  tva_pct?: string
  date_facture?: string
  categorie?: string
  justificatif_url?: string
}

// Cherche un champ dans un objet en testant plusieurs clés possibles, récursivement
function pickField(obj: unknown, keys: string[]): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  const rec = obj as Record<string, unknown>
  for (const k of keys) {
    const v = rec[k]
    if (v != null && v !== '') return v
  }
  for (const k of Object.keys(rec)) {
    const v = rec[k]
    if (v && typeof v === 'object') {
      const found = pickField(v, keys)
      if (found != null) return found
    }
  }
  return undefined
}

function cleanNumber(v: unknown): string | undefined {
  if (v == null) return undefined
  return String(v).replace(',', '.').replace(/[^0-9.]/g, '') || undefined
}

function parseDateIso(v: unknown): string | undefined {
  if (!v) return undefined
  const d = new Date(v as string)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  return undefined
}

/**
 * Parse libre de la réponse OCR : tente de récupérer libellé, montants,
 * TVA, dates et fournisseur depuis différentes structures possibles.
 */
export function extractInvoiceFromOcr(raw: unknown): OcrExtract {
  const data = Array.isArray(raw) ? raw[0] : raw
  if (!data || typeof data !== 'object') return {}

  const libelle    = pickField(data, ['libelle', 'description', 'objet', 'designation'])
  const fournis    = pickField(data, ['fournisseur', 'merchant', 'vendor', 'commercant', 'supplier', 'emetteur'])
  const refFact    = pickField(data, ['reference_facture', 'numero_facture', 'invoice_number', 'numero', 'reference'])
  const ttc        = pickField(data, ['montant_ttc', 'total_ttc', 'total', 'amount', 'totalAmount'])
  const ht         = pickField(data, ['montant_ht', 'total_ht', 'subtotal'])
  const tva        = pickField(data, ['tva_pct', 'tva', 'vat', 'taux_tva', 'tvaRate'])
  const date       = pickField(data, [
    'date_facture', 'date_emission', 'date_piece', 'date_depense',
    'date_ecriture', 'date', 'invoice_date', 'issueDate', 'IssueDate',
  ])
  const cat        = pickField(data, ['categorie', 'category', 'type'])

  // Calcul HT si seul TTC + TVA sont dispos
  let montantHt = cleanNumber(ht)
  const tvaNum = cleanNumber(tva)
  const tvaPct = tvaNum != null ? Number(tvaNum) : null
  if (!montantHt && ttc != null) {
    const ttcNum = Number(cleanNumber(ttc))
    if (!isNaN(ttcNum)) {
      montantHt = tvaPct && tvaPct > 0
        ? (ttcNum / (1 + tvaPct / 100)).toFixed(2)
        : String(ttcNum)
    }
  }

  return {
    libelle:           libelle ? String(libelle) : undefined,
    fournisseur:       fournis ? String(fournis) : undefined,
    reference_facture: refFact ? String(refFact) : undefined,
    montant_ht:        montantHt,
    montant_ttc:       cleanNumber(ttc),
    tva_pct:           tvaNum,
    date_facture:      parseDateIso(date),
    categorie:         cat ? String(cat).toLowerCase() : undefined,
  }
}

/**
 * Upload le justificatif puis appelle le webhook OCR n8n.
 * Retourne les champs extraits + l'URL publique du justificatif.
 */
export async function scanInvoice(
  file: File,
  opts: { folder: string; type_piece?: string },
): Promise<OcrExtract> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const path = `${opts.folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error: upErr } = await supabase.storage
    .from('factures')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (upErr) throw new Error('Upload échoué : ' + upErr.message)

  const { data: urlData } = supabase.storage.from('factures').getPublicUrl(path)
  const justificatif_url = urlData.publicUrl

  const formData = new FormData()
  formData.append('file', file)
  if (opts.type_piece) formData.append('type_piece', opts.type_piece)
  formData.append('lien_fichier', justificatif_url)

  const res = await fetch(OCR_WEBHOOK_URL, { method: 'POST', body: formData })
  if (!res.ok) throw new Error(`Webhook OCR a renvoyé ${res.status}`)

  let extracted: OcrExtract = {}
  try {
    const json = await res.json()
    extracted = extractInvoiceFromOcr(json)
  } catch {
    // OCR sans JSON exploitable : on renvoie juste le justificatif uploadé
  }
  return { ...extracted, justificatif_url }
}
