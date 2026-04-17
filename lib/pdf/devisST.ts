import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export type DevisLigne = {
  designation: string
  detail: string | null
  quantite: number
  unite: string
  prix_unitaire: number
}

export type DevisSTData = {
  projet_nom: string
  projet_reference: string | null
  lot_nom: string
  st_societe: string | null
  st_nom: string | null
  st_email: string | null
  st_telephone: string | null
  lignes: DevisLigne[]
  total_ht: number
  /** Data URL (PNG/JPG) de la signature API Rénovation, embarquée dans le cadre gauche. */
  signature_api_dataurl?: string | null
  signature_api_format?: 'PNG' | 'JPEG'
  signataire_label?: string | null
  signe_le?: string | null
  /** Data URL (PNG/JPG) de la signature ST, embarquée dans le cadre droit. */
  signature_st_dataurl?: string | null
  signature_st_format?: 'PNG' | 'JPEG'
  signataire_st_label?: string | null
  signe_le_st?: string | null
}

function uniteLabel(u: string): string {
  if (u === 'm2') return 'm²'
  if (u === 'm3') return 'm³'
  return u
}

function fmtEUR(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(n)
}

export function generateDevisSTPdf(d: DevisSTData): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  // ── Entête
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('DEVIS DE SOUS-TRAITANCE', pageW / 2, 50, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text('API Rénovation', pageW / 2, 66, { align: 'center' })
  doc.setTextColor(0)

  // ── Bloc projet / lot
  doc.setFontSize(10)
  doc.setDrawColor(220)
  doc.setFillColor(249, 250, 251)
  doc.roundedRect(40, 90, pageW - 80, 60, 4, 4, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.text('Projet :', 52, 108)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `${d.projet_nom}${d.projet_reference ? `  (${d.projet_reference})` : ''}`,
    100, 108,
  )

  doc.setFont('helvetica', 'bold')
  doc.text('Lot :', 52, 126)
  doc.setFont('helvetica', 'normal')
  doc.text(d.lot_nom, 100, 126)

  doc.setFont('helvetica', 'bold')
  doc.text('Date :', 52, 144)
  doc.setFont('helvetica', 'normal')
  doc.text(new Date().toLocaleDateString('fr-FR'), 100, 144)

  // ── Bloc ST
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Sous-traitant', 40, 180)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  let y = 196
  if (d.st_societe) { doc.text(d.st_societe, 40, y); y += 14 }
  if (d.st_nom && d.st_nom !== d.st_societe) { doc.text(d.st_nom, 40, y); y += 14 }
  if (d.st_email) { doc.text(d.st_email, 40, y); y += 14 }
  if (d.st_telephone) { doc.text(d.st_telephone, 40, y); y += 14 }

  // ── Tableau des lignes
  const body = d.lignes.map((l, i) => {
    const total = l.quantite * l.prix_unitaire
    return [
      String(i + 1),
      l.detail ? `${l.designation}\n${l.detail}` : l.designation,
      String(l.quantite),
      uniteLabel(l.unite),
      fmtEUR(l.prix_unitaire),
      fmtEUR(total),
    ]
  })

  autoTable(doc, {
    startY: Math.max(y + 8, 260),
    head: [['N°', 'Désignation', 'Qté', 'Unité', 'PU HT', 'Total HT']],
    body,
    styles: { fontSize: 9, cellPadding: 6, valign: 'top' },
    headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 40, halign: 'right' },
      3: { cellWidth: 42, halign: 'center' },
      4: { cellWidth: 70, halign: 'right' },
      5: { cellWidth: 80, halign: 'right' },
    },
    theme: 'grid',
  })

  const afterTableY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16

  // ── Total
  doc.setDrawColor(0)
  doc.setFillColor(17, 24, 39)
  doc.rect(pageW - 260, afterTableY, 220, 34, 'F')
  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('TOTAL HT', pageW - 250, afterTableY + 22)
  doc.setFontSize(13)
  doc.text(fmtEUR(d.total_ht), pageW - 50, afterTableY + 22, { align: 'right' })
  doc.setTextColor(0)

  // ── Cadres de signature
  const sigY = afterTableY + 80
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Pour API Rénovation', 60, sigY)
  doc.text('Pour le Sous-traitant', pageW - 220, sigY)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120)
  doc.text('(date, signature et cachet)', 60, sigY + 14)
  doc.text('(lu et approuvé, date, signature)', pageW - 220, sigY + 14)
  doc.setTextColor(0)
  doc.setDrawColor(200)

  const boxApi = { x: 40, y: sigY + 22, w: 220, h: 100 }
  const boxSt  = { x: pageW - 260, y: sigY + 22, w: 220, h: 100 }
  doc.rect(boxApi.x, boxApi.y, boxApi.w, boxApi.h)
  doc.rect(boxSt.x, boxSt.y, boxSt.w, boxSt.h)

  // Signature API Rénovation dans le cadre gauche
  if (d.signature_api_dataurl) {
    const fmt = d.signature_api_format ?? 'PNG'
    const pad = 8
    const maxW = boxApi.w - pad * 2
    const maxH = boxApi.h - pad * 2 - 14
    try {
      doc.addImage(d.signature_api_dataurl, fmt, boxApi.x + pad, boxApi.y + pad, maxW, maxH, undefined, 'FAST')
    } catch { /* noop */ }
    if (d.signataire_label || d.signe_le) {
      doc.setFontSize(8)
      doc.setTextColor(60)
      const dateTxt = d.signe_le
        ? new Date(d.signe_le).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
        : ''
      const label = [d.signataire_label, dateTxt].filter(Boolean).join(' · ')
      doc.text(label, boxApi.x + pad, boxApi.y + boxApi.h - 6)
      doc.setTextColor(0)
    }
  }

  // Signature ST dans le cadre droit
  if (d.signature_st_dataurl) {
    const fmt = d.signature_st_format ?? 'PNG'
    const pad = 8
    const maxW = boxSt.w - pad * 2
    const maxH = boxSt.h - pad * 2 - 14
    try {
      doc.addImage(d.signature_st_dataurl, fmt, boxSt.x + pad, boxSt.y + pad, maxW, maxH, undefined, 'FAST')
    } catch { /* noop */ }
    if (d.signataire_st_label || d.signe_le_st) {
      doc.setFontSize(8)
      doc.setTextColor(60)
      const dateTxt = d.signe_le_st
        ? new Date(d.signe_le_st).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
        : ''
      const label = [d.signataire_st_label, dateTxt].filter(Boolean).join(' · ')
      doc.text(label, boxSt.x + pad, boxSt.y + boxSt.h - 6)
      doc.setTextColor(0)
    }
  }

  // ── Pied
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text(
    'Document généré automatiquement. Valable après double signature.',
    pageW / 2,
    doc.internal.pageSize.getHeight() - 30,
    { align: 'center' },
  )

  return doc.output('blob')
}
