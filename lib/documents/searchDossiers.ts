export interface Dossier {
  chemin: string
  label: string
  mots_cles: string[]
  roles: string[]
}

const ALL_ROLES = ['co', 'commercial', 'economiste', 'dessinatrice', 'comptable', 'gerant', 'admin', 'assistant_travaux', 'rh', 'cho', 'st', 'controle', 'client']

export const DOSSIERS: Dossier[] = [
  // 00 — Client
  { chemin: '00_client', label: 'Elements client', mots_cles: ['client', 'elements'], roles: ALL_ROLES },

  // 01 — Etudes
  { chemin: '01_etudes/01_geometre', label: 'Geometre', mots_cles: ['geometre', 'leve', 'terrain'], roles: ALL_ROLES },
  { chemin: '01_etudes/02_rapport_ct', label: 'Rapport CT', mots_cles: ['rapport', 'ct', 'controle technique', 'rict', 'rfct'], roles: ALL_ROLES },
  { chemin: '01_etudes/03_csps', label: 'CSPS', mots_cles: ['csps', 'sps', 'pgc', 'ppsps', 'coordination'], roles: ALL_ROLES },

  // 02 — Commercial
  { chemin: '02_commercial', label: 'Propositions & offres', mots_cles: ['commercial', 'proposition', 'offre'], roles: ALL_ROLES },

  // 03 — Contractuels
  { chemin: '03_contractuels', label: 'Contrats, CGV, ADP', mots_cles: ['contrat', 'cgv', 'apd', 'signature', 'marche'], roles: ALL_ROLES },

  // 04 — Conception
  { chemin: '04_conception/01_faisabilite', label: 'Faisabilite', mots_cles: ['faisabilite', 'etude prealable'], roles: ALL_ROLES },
  { chemin: '04_conception/02_apd', label: 'APD', mots_cles: ['apd', 'avant projet', 'aps'], roles: ALL_ROLES },
  { chemin: '04_conception/03_urbanisme', label: 'Urbanisme', mots_cles: ['urbanisme', 'permis', 'pc', 'dp'], roles: ALL_ROLES },

  // 05 — Preparation
  { chemin: '05_preparation/01_dce', label: 'DCE', mots_cles: ['dce', 'cctp', 'notice', 'descriptif', 'pieces ecrites', 'pieces graphiques'], roles: ALL_ROLES },
  { chemin: '05_preparation/02_devis', label: 'Devis', mots_cles: ['devis', 'offre prix', 'st', 'chiffrage'], roles: ALL_ROLES },
  { chemin: '05_preparation/03_achats', label: 'Achats', mots_cles: ['achat', 'commande', 'bon commande', 'marche'], roles: ALL_ROLES },

  // 06 — Chantier
  { chemin: '06_chantier/01_planning', label: 'Planning', mots_cles: ['planning', 'ppe', 'calendrier', 'gantt'], roles: ALL_ROLES },
  { chemin: '06_chantier/02_plans', label: 'Plans', mots_cles: ['plan', 'exe', 'execution', 'indice', 'graphique'], roles: ALL_ROLES },
  { chemin: '06_chantier/03_reserves', label: 'Reserves', mots_cles: ['reserve', 'levee', 'ot'], roles: ALL_ROLES },
  { chemin: '06_chantier/04_avenants', label: 'Avenants', mots_cles: ['avenant', 'travaux supplementaires', 'ts'], roles: ALL_ROLES },
  { chemin: '06_chantier/05_cr/01_cr_interne', label: 'CR interne', mots_cles: ['cr interne', 'compte rendu', 'reunion interne'], roles: ALL_ROLES },
  { chemin: '06_chantier/05_cr/02_cr_client', label: 'CR client', mots_cles: ['cr client', 'compte rendu client'], roles: ALL_ROLES },
  { chemin: '06_chantier/06_reception', label: 'Reception', mots_cles: ['reception', 'pvr', 'livraison'], roles: ALL_ROLES },
  { chemin: '06_chantier/07_doe', label: 'DOE', mots_cles: ['doe', 'ouvrages executes', 'as built'], roles: ALL_ROLES },

  // 07 — Facturation
  { chemin: '07_facturation/01_client', label: 'Facturation client', mots_cles: ['facture client', 'situation', 'decompte'], roles: ALL_ROLES },
  { chemin: '07_facturation/02_entreprises_dic', label: 'Entreprises / DIC', mots_cles: ['dic', 'facture st', 'facture entreprise'], roles: ALL_ROLES },

  // 08 — GPA
  { chemin: '08_gpa', label: 'Garantie (GPA)', mots_cles: ['gpa', 'garantie', 'desordre', 'parfait achevement'], roles: ALL_ROLES },

  // 09 — Reserve
  { chemin: '09', label: 'Reserve', mots_cles: ['reserve', 'divers'], roles: ALL_ROLES },

  // 10 — Photos
  { chemin: '10_photos/01_edl', label: 'Etat des lieux', mots_cles: ['photo edl', 'etat des lieux', 'avant travaux'], roles: ALL_ROLES },
  { chemin: '10_photos/02_travaux', label: 'Travaux', mots_cles: ['photo travaux', 'avancement', 'chantier'], roles: ALL_ROLES },
  { chemin: '10_photos/03_reception', label: 'Reception', mots_cles: ['photo reception', 'livraison'], roles: ALL_ROLES },
]

export function searchDossiers(query: string, userRole: string): Dossier[] {
  if (!query || query.length < 2) return []
  const q = query.toLowerCase()
  return DOSSIERS
    .filter(d => d.roles.includes(userRole))
    .filter(d =>
      d.mots_cles.some(m => m.includes(q)) ||
      d.label.toLowerCase().includes(q) ||
      d.chemin.toLowerCase().includes(q)
    )
    .slice(0, 5)
}

// ─── Arborescence hierarchique ───────────────────────────────────────────────

export interface TreeNode {
  segment: string
  label: string
  chemin: string
  roles: string[]
  children: TreeNode[]
  dossier?: Dossier // present si c'est un dossier final
}

// Labels lisibles pour les dossiers parents intermediaires
const PARENT_LABELS: Record<string, string> = {
  '00_client': 'Elements client',
  '01_etudes': 'Etudes',
  '02_commercial': 'Propositions & offres',
  '03_contractuels': 'Contrats, CGV, ADP',
  '04_conception': 'Conception',
  '05_preparation': 'Preparation chantier',
  '06_chantier': 'Execution',
  '07_facturation': 'Facturation',
  '08_gpa': 'Garantie (GPA)',
  '09': 'Reserve',
  '10_photos': 'Photos',
  '05_cr': 'Comptes-rendus',
}

function segmentLabel(seg: string): string {
  return PARENT_LABELS[seg] || seg.replace(/^\d+_/, '').replace(/_/g, ' ')
}

function buildTree(dossiers: Dossier[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const d of dossiers) {
    const parts = d.chemin.split('/')
    let current = root
    let cumulPath = ''

    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i]
      cumulPath = cumulPath ? `${cumulPath}/${seg}` : seg
      let node = current.find(n => n.segment === seg)

      if (!node) {
        node = {
          segment: seg,
          label: i === parts.length - 1 ? d.label : segmentLabel(seg),
          chemin: cumulPath,
          roles: [...d.roles],
          children: [],
        }
        current.push(node)
      } else {
        for (const r of d.roles) {
          if (!node.roles.includes(r)) node.roles.push(r)
        }
      }

      if (i === parts.length - 1) {
        node.label = d.label
        node.dossier = d
      }

      current = node.children
    }
  }

  return root
}

const _tree = buildTree(DOSSIERS)

export function getDossierTree(userRole: string): TreeNode[] {
  function filterTree(nodes: TreeNode[]): TreeNode[] {
    return nodes
      .filter(n => n.roles.includes(userRole))
      .map(n => ({ ...n, children: filterTree(n.children) }))
  }
  return filterTree(_tree)
}

export function getChildren(path: string, userRole: string): TreeNode[] {
  const tree = getDossierTree(userRole)
  if (!path) return tree

  const parts = path.split('/')
  let current = tree
  for (const seg of parts) {
    const node = current.find(n => n.segment === seg)
    if (!node) return []
    current = node.children
  }
  return current
}
