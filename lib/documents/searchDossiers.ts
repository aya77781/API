export interface Dossier {
  chemin: string
  label: string
  mots_cles: string[]
  roles: string[]
}

export const DOSSIERS: Dossier[] = [
  {
    chemin: '00_client',
    label: 'Elements client',
    mots_cles: ['client', 'elements'],
    roles: ['co', 'commercial', 'gerant', 'admin'],
  },
  {
    chemin: '01_etudes/01_geometre',
    label: 'Geometre',
    mots_cles: ['geometre', 'leve', 'terrain'],
    roles: ['co', 'gerant', 'admin'],
  },
  {
    chemin: '01_etudes/06_ct/01_rict',
    label: 'RICT — Bureau de controle',
    mots_cles: ['rict', 'rapport initial', 'ct'],
    roles: ['co', 'controle', 'gerant', 'admin'],
  },
  {
    chemin: '01_etudes/06_ct/02_cr_visite',
    label: 'CR visite CT',
    mots_cles: ['cr visite', 'visite ct'],
    roles: ['co', 'controle', 'gerant', 'admin'],
  },
  {
    chemin: '01_etudes/06_ct/03_rfct',
    label: 'RFCT — Bureau de controle',
    mots_cles: ['rfct', 'rapport final'],
    roles: ['co', 'controle', 'gerant', 'admin'],
  },
  {
    chemin: '01_etudes/07_csps/01_pgc',
    label: 'PGC — CSPS',
    mots_cles: ['pgc', 'coordination', 'csps', 'sps'],
    roles: ['co', 'controle', 'gerant', 'admin'],
  },
  {
    chemin: '01_etudes/07_csps/05_ppsps',
    label: 'PPSPS',
    mots_cles: ['ppsps', 'particulier'],
    roles: ['co', 'controle', 'gerant', 'admin'],
  },
  {
    chemin: '02_commercial',
    label: 'Commercial',
    mots_cles: ['commercial', 'proposition', 'offre'],
    roles: ['co', 'commercial', 'economiste', 'gerant', 'admin'],
  },
  {
    chemin: '03_contractuels',
    label: 'Contractuels',
    mots_cles: ['contrat', 'cgv', 'signature', 'apd'],
    roles: ['co', 'commercial', 'economiste', 'gerant', 'admin'],
  },
  {
    chemin: '04_conception/01_faisabilite',
    label: 'Faisabilite',
    mots_cles: ['faisabilite', 'etude'],
    roles: ['co', 'commercial', 'dessinatrice', 'gerant', 'admin'],
  },
  {
    chemin: '04_conception/02_avant_projet',
    label: 'Avant-projet APD',
    mots_cles: ['apd', 'avant projet', 'aps'],
    roles: ['co', 'commercial', 'dessinatrice', 'gerant', 'admin'],
  },
  {
    chemin: '04_conception/03_urbanisme',
    label: 'Urbanisme',
    mots_cles: ['urbanisme', 'permis', 'pc'],
    roles: ['co', 'commercial', 'dessinatrice', 'gerant', 'admin'],
  },
  {
    chemin: '05_preparation/01_pro_dce/01_pieces_ecrites',
    label: 'DCE — Pieces ecrites',
    mots_cles: ['dce', 'cctp', 'notice', 'descriptif'],
    roles: ['co', 'economiste', 'dessinatrice', 'gerant', 'admin'],
  },
  {
    chemin: '05_preparation/01_pro_dce/02_pieces_graphiques/Plans',
    label: 'DCE — Plans',
    mots_cles: ['plan dce', 'graphique'],
    roles: ['co', 'economiste', 'dessinatrice', 'gerant', 'admin'],
  },
  {
    chemin: '05_preparation/02_devis',
    label: 'Devis ST',
    mots_cles: ['devis', 'offre prix', 'st'],
    roles: ['co', 'economiste', 'gerant', 'admin', 'st'],
  },
  {
    chemin: '05_preparation/03_marches',
    label: 'Marches',
    mots_cles: ['marche', 'commande', 'bon commande'],
    roles: ['co', 'economiste', 'assistant_travaux', 'gerant', 'admin'],
  },
  {
    chemin: '06_chantier/01_ppe',
    label: 'Planning PPE',
    mots_cles: ['ppe', 'planning'],
    roles: ['co', 'gerant', 'admin'],
  },
  {
    chemin: '06_chantier/03_exe',
    label: 'Plans EXE',
    mots_cles: ['plan exe', 'execution', 'exe', 'indice'],
    roles: ['co', 'dessinatrice', 'controle', 'gerant', 'admin', 'st'],
  },
  {
    chemin: '06_chantier/04_raccordements/01_provisoires',
    label: 'Raccordements provisoires',
    mots_cles: ['raccordement provisoire'],
    roles: ['co', 'gerant', 'admin'],
  },
  {
    chemin: '06_chantier/04_raccordements/02_definitifs',
    label: 'Raccordements definitifs',
    mots_cles: ['raccordement definitif', 'concessionnaire'],
    roles: ['co', 'gerant', 'admin'],
  },
  {
    chemin: '06_chantier/05_cr/01_cr_chantier',
    label: 'CR chantier',
    mots_cles: ['cr chantier', 'compte rendu', 'reunion'],
    roles: ['co', 'gerant', 'admin', 'st'],
  },
  {
    chemin: '06_chantier/05_cr/02_cr_client',
    label: 'CR client',
    mots_cles: ['cr client', 'compte rendu client'],
    roles: ['co', 'commercial', 'gerant', 'admin', 'client'],
  },
  {
    chemin: '06_chantier/06_avenants/01_provisoires',
    label: 'Avenant provisoire',
    mots_cles: ['avenant provisoire'],
    roles: ['co', 'economiste', 'gerant', 'admin'],
  },
  {
    chemin: '06_chantier/06_avenants/02_valides',
    label: 'Avenant valide',
    mots_cles: ['avenant valide', 'avenant signe'],
    roles: ['co', 'economiste', 'gerant', 'admin'],
  },
  {
    chemin: '06_chantier/07_reception',
    label: 'Reception',
    mots_cles: ['reception', 'pvr', 'reserve'],
    roles: ['co', 'commercial', 'gerant', 'admin', 'client'],
  },
  {
    chemin: '06_chantier/08_doe',
    label: 'DOE',
    mots_cles: ['doe', 'ouvrages executes', 'as built'],
    roles: ['co', 'dessinatrice', 'assistant_travaux', 'gerant', 'admin'],
  },
  {
    chemin: '07_facturation/client',
    label: 'Facturation client',
    mots_cles: ['facture client', 'situation'],
    roles: ['co', 'comptable', 'commercial', 'gerant', 'admin'],
  },
  {
    chemin: '07_facturation/entreprises/01_dic',
    label: 'Factures ST (DIC)',
    mots_cles: ['dic', 'facture st', 'facture entreprise'],
    roles: ['co', 'comptable', 'assistant_travaux', 'gerant', 'admin'],
  },
  {
    chemin: '08_gpa',
    label: 'GPA',
    mots_cles: ['gpa', 'garantie', 'desordre'],
    roles: ['co', 'commercial', 'gerant', 'admin', 'client'],
  },
  {
    chemin: '10_photos/00_edl',
    label: 'Photos etat des lieux',
    mots_cles: ['photo edl', 'etat des lieux'],
    roles: ['co', 'gerant', 'admin'],
  },
  {
    chemin: '10_photos/01_travaux',
    label: 'Photos travaux',
    mots_cles: ['photo travaux', 'avancement'],
    roles: ['co', 'gerant', 'admin', 'st'],
  },
  {
    chemin: '10_photos/02_reception',
    label: 'Photos reception',
    mots_cles: ['photo reception'],
    roles: ['co', 'commercial', 'gerant', 'admin', 'client'],
  },
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
