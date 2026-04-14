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
  doc.rect(40, sigY + 22, 220, 100)
  doc.rect(pageW - 260, sigY + 22, 220, 100)

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
