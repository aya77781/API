import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export type ContratClause = {
  titre: string
  contenu: string
}

export type ContratSTData = {
  /* Identification */
  numero: string | null
  date_redaction: string

  /* Projet */
  projet_nom: string
  projet_reference: string | null
  projet_adresse: string | null
  projet_type: string | null

  /* Entreprise principale (API Renovation) */
  entreprise_nom: string
  entreprise_adresse: string | null
  entreprise_siret: string | null
  entreprise_representant: string | null

  /* Sous-traitant */
  st_societe: string | null
  st_nom: string | null
  st_siret: string | null
  st_adresse: string | null
  st_representant: string | null
  st_email: string | null
  st_telephone: string | null

  /* Mission */
  lot_nom: string | null
  corps_etat: string | null
  description_mission: string

  /* Conditions financieres */
  montant_ht: number
  tva_pct: number
  delai_paiement_jours: number
  retenue_garantie_pct: number

  /* Conditions particulieres */
  cgv_incluses: boolean
  delegation_paiement: boolean
  second_rang: boolean
  date_debut: string | null
  date_fin: string | null

  /* Clauses generees par IA */
  clauses: ContratClause[]
}

function fmtEUR(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
  }).format(n)
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return d }
}

export function generateContratSTPdf(d: ContratSTData): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 50

  let y = 50

  function ensureSpace(needed: number) {
    if (y + needed > pageH - 60) {
      doc.addPage()
      y = 50
    }
  }

  function section(title: string) {
    ensureSpace(30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(17, 24, 39)
    doc.text(title, margin, y)
    y += 6
    doc.setDrawColor(31, 41, 55)
    doc.setLineWidth(1)
    doc.line(margin, y, margin + 40, y)
    y += 14
    doc.setLineWidth(0.5)
    doc.setTextColor(0)
  }

  function paragraph(text: string, opts?: { font?: 'normal' | 'bold' | 'italic'; size?: number; color?: number }) {
    doc.setFont('helvetica', opts?.font ?? 'normal')
    doc.setFontSize(opts?.size ?? 10)
    doc.setTextColor(opts?.color ?? 0)
    const lines = doc.splitTextToSize(text, pageW - margin * 2)
    for (const line of lines) {
      ensureSpace(14)
      doc.text(line, margin, y)
      y += 14
    }
    doc.setTextColor(0)
  }

  function keyValue(key: string, value: string) {
    ensureSpace(14)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
    doc.text(key, margin, y)
    doc.setFont('helvetica', 'normal')
    const wrapped = doc.splitTextToSize(value || '—', pageW - margin * 2 - 130)
    doc.text(wrapped, margin + 130, y)
    y += Math.max(14, wrapped.length * 12)
  }

  /* ── En-tete */
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18)
  doc.text('CONTRAT DE SOUS-TRAITANCE', pageW / 2, y, { align: 'center' })
  y += 22
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(`${d.numero ? `N° ${d.numero}` : 'Numero a attribuer'} — Etabli le ${fmtDate(d.date_redaction)}`, pageW / 2, y, { align: 'center' })
  doc.setTextColor(0)
  y += 30

  /* ── Bloc projet */
  section('Projet concerne')
  keyValue('Operation', `${d.projet_nom}${d.projet_reference ? `  (${d.projet_reference})` : ''}`)
  if (d.projet_adresse) keyValue('Adresse', d.projet_adresse)
  if (d.projet_type)    keyValue('Type', d.projet_type)
  y += 6

  /* ── Parties */
  section('Entre les soussignes')
  paragraph(`L'entreprise principale ${d.entreprise_nom}`, { font: 'bold' })
  if (d.entreprise_adresse)     keyValue('Adresse', d.entreprise_adresse)
  if (d.entreprise_siret)       keyValue('SIRET', d.entreprise_siret)
  if (d.entreprise_representant) keyValue('Representee par', d.entreprise_representant)
  y += 4
  paragraph('ci-apres designee "l\'Entrepreneur principal", d\'une part,', { font: 'italic', color: 100 })
  y += 6
  paragraph('ET', { font: 'bold' })
  y += 4
  paragraph(`Le sous-traitant ${d.st_societe || d.st_nom || '—'}`, { font: 'bold' })
  if (d.st_adresse)        keyValue('Adresse', d.st_adresse)
  if (d.st_siret)          keyValue('SIRET', d.st_siret)
  if (d.st_representant)   keyValue('Representee par', d.st_representant)
  if (d.st_email)          keyValue('Email', d.st_email)
  if (d.st_telephone)      keyValue('Telephone', d.st_telephone)
  y += 4
  paragraph('ci-apres designe "le Sous-traitant", d\'autre part,', { font: 'italic', color: 100 })
  y += 10
  paragraph('IL A ETE CONVENU CE QUI SUIT :', { font: 'bold' })
  y += 6

  /* ── Mission */
  section('Article 1 — Objet du contrat')
  paragraph(`Le Sous-traitant s'engage a executer pour le compte de l'Entrepreneur principal les travaux du ` +
    `${d.lot_nom ? `lot "${d.lot_nom}"` : 'lot designe'}${d.corps_etat ? ` (corps d'etat : ${d.corps_etat})` : ''} ` +
    `sur le projet susmentionne.`)
  y += 4
  if (d.description_mission?.trim()) {
    paragraph('Description detaillee de la mission :', { font: 'bold' })
    paragraph(d.description_mission.trim())
  }
  y += 6

  /* ── Conditions financieres */
  section('Article 2 — Prix et modalites de paiement')
  const tva = +(d.montant_ht * d.tva_pct / 100).toFixed(2)
  const ttc = d.montant_ht + tva
  autoTable(doc, {
    startY: y,
    styles: { fontSize: 9.5, cellPadding: 6 },
    headStyles: { fillColor: [31, 41, 55], textColor: 255 },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 150, halign: 'right' } },
    body: [
      ['Montant HT', fmtEUR(d.montant_ht)],
      [`TVA (${d.tva_pct}%)`, fmtEUR(tva)],
      ['Montant TTC', fmtEUR(ttc)],
    ],
    theme: 'grid',
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12
  paragraph(`Delai de paiement : ${d.delai_paiement_jours} jours a compter de la reception de la facture conforme.`)
  if (d.retenue_garantie_pct > 0) {
    paragraph(`Retenue de garantie : ${d.retenue_garantie_pct}% du montant HT, liberee a la levee des reserves.`)
  }
  y += 6

  /* ── Delais */
  if (d.date_debut || d.date_fin) {
    section('Article 3 — Delais d\'execution')
    if (d.date_debut) keyValue('Date de demarrage', fmtDate(d.date_debut))
    if (d.date_fin)   keyValue('Date d\'achevement prevue', fmtDate(d.date_fin))
    y += 6
  }

  /* ── Conditions particulieres */
  const flags: string[] = []
  if (d.cgv_incluses)         flags.push('CGV de l\'entreprise principale incluses')
  if (d.delegation_paiement)  flags.push('Delegation de paiement (article 14 loi 75-1334)')
  if (d.second_rang)          flags.push('Sous-traitance de second rang autorisee')
  if (flags.length > 0) {
    section('Article 4 — Conditions particulieres')
    flags.forEach((f) => paragraph(`• ${f}`))
    y += 6
  }

  /* ── Clauses generees par IA */
  let articleNum = (d.date_debut || d.date_fin ? 4 : 3) + (flags.length > 0 ? 1 : 0)
  d.clauses.forEach((c) => {
    articleNum += 1
    section(`Article ${articleNum} — ${c.titre}`)
    paragraph(c.contenu)
    y += 4
  })

  /* ── Signatures */
  ensureSpace(180)
  y += 20
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('Fait en deux exemplaires originaux,', margin, y)
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.text(`Le ${new Date().toLocaleDateString('fr-FR')}`, margin, y)
  y += 20

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
  doc.text('Pour l\'Entrepreneur principal', margin, y)
  doc.text('Pour le Sous-traitant', pageW - margin - 200, y)
  y += 12
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120)
  doc.text('(nom, qualite, signature)', margin, y)
  doc.text('(lu et approuve, nom, qualite, signature)', pageW - margin - 200, y)
  doc.setTextColor(0)
  y += 8
  doc.setDrawColor(200)
  doc.rect(margin, y, 220, 100)
  doc.rect(pageW - margin - 220, y, 220, 100)

  /* ── Pied */
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFontSize(8); doc.setTextColor(150)
    doc.text(
      `Contrat ${d.numero ?? ''} — ${d.st_societe || d.st_nom || ''} — Page ${p}/${totalPages}`,
      pageW / 2, pageH - 30, { align: 'center' },
    )
    doc.setTextColor(0)
  }

  return doc.output('blob')
}
