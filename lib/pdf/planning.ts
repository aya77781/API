import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export type PlanningRow = {
  corps_etat: string
  st_nom: string | null
  date_debut: string
  date_fin: string
  avancement_pct: number
  statut: string
  notes: string | null
}

export type PlanningData = {
  projet_nom: string
  projet_reference: string | null
  rows: PlanningRow[]
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const STATUT_LABELS: Record<string, string> = {
  planifie: 'Planifie',
  confirme: 'Confirme',
  en_cours: 'En cours',
  termine: 'Termine',
  retarde: 'Retarde',
}

export function generatePlanningPdf(data: PlanningData): Blob {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const margin = 32
  const today = new Date().toLocaleDateString('fr-FR')

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(`Planning — ${data.projet_nom}`, margin, margin)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120)
  const sub = [data.projet_reference, `Edite le ${today}`].filter(Boolean).join(' · ')
  if (sub) doc.text(sub, margin, margin + 14)
  doc.setTextColor(0)

  const tableBody = data.rows.map(r => [
    r.corps_etat,
    r.st_nom ?? '—',
    fmtDate(r.date_debut),
    fmtDate(r.date_fin),
    `${r.avancement_pct}%`,
    STATUT_LABELS[r.statut] ?? r.statut,
    r.notes ?? '',
  ])

  autoTable(doc, {
    startY: margin + 30,
    head: [['Corps d\'etat', 'Sous-traitant', 'Debut', 'Fin', 'Avancement', 'Statut', 'Notes']],
    body: tableBody,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 6, overflow: 'linebreak' },
    headStyles: { fillColor: [17, 24, 39], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 120 },
      2: { cellWidth: 70 },
      3: { cellWidth: 70 },
      4: { cellWidth: 70, halign: 'center' },
      5: { cellWidth: 75 },
      6: { cellWidth: 'auto' },
    },
  })

  return doc.output('blob')
}

export function buildPlanningCsv(data: PlanningData): string {
  const escape = (v: string) => {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`
    }
    return v
  }
  const header = ['Corps d\'etat', 'Sous-traitant', 'Debut', 'Fin', 'Avancement', 'Statut', 'Notes']
  const rows = data.rows.map(r => [
    r.corps_etat,
    r.st_nom ?? '',
    r.date_debut,
    r.date_fin,
    `${r.avancement_pct}%`,
    STATUT_LABELS[r.statut] ?? r.statut,
    (r.notes ?? '').replace(/\r?\n/g, ' '),
  ].map(s => escape(String(s))))
  return [header.join(','), ...rows.map(r => r.join(','))].join('\n')
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
