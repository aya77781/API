import jsPDF from 'jspdf'

export type CCTPItem = {
  id: string
  type: 'chapitre' | 'ouvrage'
  parent_id: string | null
  designation: string
  detail: string | null
  ordre: number
}

export type CCTPData = {
  projet_nom: string
  projet_reference: string | null
  lot_nom: string
  lot_code?: string | null  // ex: "1", "2"
  items: CCTPItem[]  // chapitres + ouvrages a plat (parent_id determine la hierarchie)
}

type TreeNode = { item: CCTPItem; code: string; level: number; children: TreeNode[] }

function buildTree(items: CCTPItem[], rootPrefix: string): TreeNode[] {
  const byParent = new Map<string | null, CCTPItem[]>()
  items.forEach((it) => {
    const p = it.parent_id ?? null
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p)!.push(it)
  })
  byParent.forEach((arr) => arr.sort((a, b) => a.ordre - b.ordre))

  function build(parentId: string | null, parentCode: string, level: number): TreeNode[] {
    const children = byParent.get(parentId) ?? []
    return children.map((c, i) => {
      const code = parentCode ? `${parentCode}.${i + 1}` : `${i + 1}`
      return { item: c, code, level, children: build(c.id, code, level + 1) }
    })
  }
  return build(null, rootPrefix, 0)
}

export function generateCCTPPdf(d: CCTPData): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginL = 40
  const marginR = 40
  const contentW = pageW - marginL - marginR

  // ─── En-tete page 1 ─────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('CAHIER DES CLAUSES TECHNIQUES PARTICULIERES', pageW / 2, 60, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(90)
  doc.text(`Lot : ${d.lot_nom}`, pageW / 2, 80, { align: 'center' })
  doc.setTextColor(0)

  // Encart projet
  doc.setDrawColor(220)
  doc.setFillColor(249, 250, 251)
  doc.roundedRect(marginL, 100, contentW, 56, 4, 4, 'FD')
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Projet :', marginL + 12, 118)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `${d.projet_nom}${d.projet_reference ? `  (${d.projet_reference})` : ''}`,
    marginL + 60, 118,
  )
  doc.setFont('helvetica', 'bold')
  doc.text('Lot :', marginL + 12, 138)
  doc.setFont('helvetica', 'normal')
  const lotLabel = d.lot_code ? `${d.lot_code} - ${d.lot_nom}` : d.lot_nom
  doc.text(lotLabel, marginL + 60, 138)

  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(
    'Le present document decrit les prescriptions techniques applicables. Aucune quantite ni prix n\'y figure.',
    marginL, 178,
    { maxWidth: contentW },
  )
  doc.setTextColor(0)

  // ─── Construction de l'arbre ────────────────────────────
  const tree = buildTree(d.items, d.lot_code ?? '')

  // ─── Render hierarchique ─────────────────────────────────
  let y = 210
  const lineH = 14

  function ensureSpace(needed: number) {
    if (y + needed > pageH - 50) {
      doc.addPage()
      y = 60
    }
  }

  function renderChapitre(node: TreeNode) {
    const isTopChapitre = node.level === 0
    const fontSize = isTopChapitre ? 13 : 11
    const padBefore = isTopChapitre ? 18 : 12
    const padAfter = 6
    const indent = node.level * 14

    ensureSpace(padBefore + lineH + 4)
    y += padBefore

    if (isTopChapitre) {
      // Bandeau bleu fonce pour chapitre niveau 1
      doc.setFillColor(33, 41, 54)
      doc.rect(marginL, y - 12, contentW, 22, 'F')
      doc.setTextColor(255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(fontSize)
      doc.text(`${node.code}  ${node.item.designation}`, marginL + 8, y + 2)
      doc.setTextColor(0)
      y += 18
    } else {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(fontSize)
      doc.setDrawColor(180)
      doc.line(marginL + indent, y + 4, marginL + indent + 100, y + 4)
      doc.text(`${node.code}  ${node.item.designation}`, marginL + indent, y)
      y += lineH + padAfter
    }

    for (const child of node.children) {
      if (child.item.type === 'chapitre') renderChapitre(child)
      else renderOuvrage(child)
    }
  }

  function renderOuvrage(node: TreeNode) {
    const indent = node.level * 14
    const x = marginL + indent
    const widthAvail = contentW - indent

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    const titleLines = doc.splitTextToSize(`${node.code}  ${node.item.designation}`, widthAvail)
    const titleH = titleLines.length * lineH
    ensureSpace(titleH + (node.item.detail ? 40 : 12))
    doc.text(titleLines, x, y)
    y += titleH

    if (node.item.detail && node.item.detail.trim()) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(80)
      const detailLines = doc.splitTextToSize(node.item.detail.trim(), widthAvail - 8)
      const detailH = detailLines.length * 12
      ensureSpace(detailH + 8)
      doc.text(detailLines, x + 8, y + 4)
      doc.setTextColor(0)
      y += detailH + 6
    } else {
      y += 4
    }
  }

  if (tree.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(150)
    doc.text('Aucun chapitre ni ouvrage dans ce lot.', marginL, y + 20)
  } else {
    for (const node of tree) {
      if (node.item.type === 'chapitre') renderChapitre(node)
      else renderOuvrage(node)
    }
  }

  // ─── Footer numero de page ──────────────────────────────
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
