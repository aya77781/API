import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export type CCTPLigne = {
  designation: string
  detail: string | null
  ordre: number
}

export type CCTPData = {
  projet_nom: string
  projet_reference: string | null
  lot_nom: string
  lignes: CCTPLigne[]
}

export function generateCCTPPdf(d: CCTPData): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('CAHIER DES CLAUSES TECHNIQUES PARTICULIERES', pageW / 2, 60, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(90)
  doc.text(`Lot : ${d.lot_nom}`, pageW / 2, 80, { align: 'center' })
  doc.setTextColor(0)

  doc.setDrawColor(220)
  doc.setFillColor(249, 250, 251)
  doc.roundedRect(40, 100, pageW - 80, 50, 4, 4, 'FD')
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Projet :', 52, 118)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `${d.projet_nom}${d.projet_reference ? `  (${d.projet_reference})` : ''}`,
    100, 118,
  )
  doc.setFont('helvetica', 'bold')
  doc.text('Lot :', 52, 136)
  doc.setFont('helvetica', 'normal')
  doc.text(d.lot_nom, 100, 136)

  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(
    'Le present document decrit les prescriptions techniques applicables. Aucune quantite ni prix n\'y figure.',
    40, 170,
    { maxWidth: pageW - 80 },
  )
  doc.setTextColor(0)

  const sorted = [...d.lignes].sort((a, b) => a.ordre - b.ordre)

  autoTable(doc, {
    startY: 195,
    head: [['#', 'Prescription technique']],
    body: sorted.map((l, i) => {
      const designation = (l.designation || '').trim() || '(sans titre)'
      const detail = (l.detail || '').trim()
      const cell = detail ? `${designation}\n\n${detail}` : designation
      return [String(i + 1), cell]
    }),
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 8,
      valign: 'top',
      lineColor: [220, 220, 220],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [33, 41, 54],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: 32, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 40, right: 40 },
  })

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(
      `CCTP ${d.lot_nom} — page ${i}/${pageCount}`,
      pageW / 2,
      pageH - 20,
      { align: 'center' },
    )
  }

  return doc.output('blob')
}
