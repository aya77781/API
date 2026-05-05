'use client'

const DEFINITIONS: Record<string, string> = {
  APS:   "Avant-Projet Sommaire — premiere intention de plan",
  APD:   "Avant-Projet Definitif — plan annexe au contrat signe",
  PC:    "Permis de Construire — autorisation administrative",
  ATR:   "Autorisation de Travaux — autorisation administrative pour travaux",
  DCE:   "Dossier de Consultation des Entreprises — pieces transmises aux ST pour chiffrer",
  EXE:   "Plan d'EXEcution — plan technique definitif utilise sur chantier",
  DOE:   "Dossier des Ouvrages Executes — synthese finale livree au client",
  CO:    "Conducteur d'Operation — pilote le chantier",
  ST:    "Sous-Traitant",
  CR:    "Compte-Rendu (de chantier ou de reunion)",
  MOA:   "Maitrise d'Ouvrage — le client",
  MOE:   "Maitrise d'Oeuvre — l'equipe de conception",
  CCTP:  "Cahier des Clauses Techniques Particulieres",
  DPGF:  "Decomposition du Prix Global et Forfaitaire",
  OPR:   "Operations Prealables a la Reception",
  GPA:   "Garantie de Parfait Achevement",
  DGD:   "Decompte General Definitif",
  PV:    "Proces-Verbal",
  OS:    "Ordre de Service",
  AT:    "Appel a Traiter",
  NDF:   "Note de Frais",
  RH:    "Ressources Humaines",
  PMR:   "Personne a Mobilite Reduite",
  ERP:   "Etablissement Recevant du Public",
  VRD:   "Voirie et Reseaux Divers",
  CSPS:  "Coordonnateur Securite et Protection de la Sante",
  SPS:   "Securite et Protection de la Sante",
  TCE:   "Tous Corps d'Etat",
  RICT:  "Rapport Initial de Controle Technique",
  AOR:   "Assistance aux Operations de Reception",
  DIUO:  "Dossier d'Intervention Ulterieure sur l'Ouvrage",
  DET:   "Direction de l'Execution des Travaux",
  PEM:   "Plan d'Execution Modifie",
  BTP:   "Batiment et Travaux Publics",
  IPN:   "I a Profil Normal — poutre metallique",
  OA:    "Ouvrage d'Art",
  SAV:   "Service Apres-Vente",
  DIC:   "Depenses d'Interet Commun — frais partages entre lots (compte prorata)",
  HT:    "Hors Taxes — montant avant TVA",
  TVA:   "Taxe sur la Valeur Ajoutee",
  TTC:   "Toutes Taxes Comprises — montant final TVA incluse",
  CA:    "Chiffre d'Affaires",
  URSSAF:"Union de Recouvrement des cotisations de Securite Sociale et d'Allocations Familiales",
  SIRET: "Systeme d'Identification du Repertoire des Etablissements — identifiant unique d'entreprise",
  RIB:   "Releve d'Identite Bancaire",
  CGV:   "Conditions Generales de Vente",
  "RC Pro": "Responsabilite Civile Professionnelle",
  Kbis:  "Extrait Kbis — carte d'identite officielle de l'entreprise au RCS",

  // ─── Lots de construction (corps d'etat) ───
  GO:      "Gros Oeuvre — fondations, dalles, murs porteurs, planchers",
  TP:      "Travaux Publics",
  DEMO:    "Demolition — depose, dechargement, evacuation",
  TER:     "Terrassement — fouilles, remblais, nivellement",
  MAC:     "Maconnerie — murs, cloisons en parpaings/briques",
  CHARP:   "Charpente — ossature bois ou metallique",
  COUV:    "Couverture — toiture, tuiles, zinguerie",
  ETAN:    "Etancheite — toitures-terrasses, sous-sol",
  ISO:     "Isolation — thermique et acoustique",
  ITE:     "Isolation Thermique par l'Exterieur",
  ITI:     "Isolation Thermique par l'Interieur",
  MEN:     "Menuiseries — interieures et exterieures",
  MENEXT:  "Menuiseries Exterieures — fenetres, portes, baies",
  MENINT:  "Menuiseries Interieures — portes, placards, plinthes",
  SERR:    "Serrurerie — metallerie, garde-corps, escaliers",
  PLAT:    "Platrerie — cloisons seches, doublages, faux plafonds",
  CLOIS:   "Cloisons — distributives ou techniques",
  CARR:    "Carrelage — sols et faiences murales",
  REV:     "Revetements — sols souples, parquets, moquettes",
  PEINT:   "Peinture — interieure et exterieure",
  PLOMB:   "Plomberie — alimentation, evacuation, sanitaires",
  SAN:     "Sanitaires — equipements WC, vasques, douches",
  CVC:     "Chauffage Ventilation Climatisation",
  CHAUF:   "Chauffage",
  VENTIL:  "Ventilation — VMC, extraction d'air",
  CLIM:    "Climatisation",
  ELEC:    "Electricite — courants forts et faibles",
  CFO:     "Courants Forts — electricite de puissance",
  CFA:     "Courants Faibles — informatique, telephonie, alarme",
  ASC:     "Ascenseur",
  DOMO:    "Domotique — pilotage intelligent du batiment",
  CUIS:    "Cuisine — meubles, plan de travail, electromenager",
  AGEN:    "Agencement — meubles sur-mesure, dressings",
  ESV:     "Espaces Verts — jardins, plantations, gazon",
  PISC:    "Piscine",
  FACADE:  "Facade — enduits, bardages, ravalement",
  BARD:    "Bardage — habillage exterieur",
  ENDUIT:  "Enduit — finition de facade",
  ELEV:    "Elevation — murs, voiles beton",
  FOND:    "Fondations",
  STRUCT:  "Structure — beton arme, charpente porteuse",
  PROT:    "Protections incendie",
  SSI:     "Systeme de Securite Incendie",
  DESEN:   "Desenfumage",
  COMPT:   "Compte prorata — frais partages chantier (cf. DIC)",
  NETT:    "Nettoyage de chantier — fin de travaux",
  OPC:     "Ordonnancement, Pilotage, Coordination",
}

type Props = {
  k: keyof typeof DEFINITIONS | string
  className?: string
}

export function Abbr({ k, className = '' }: Props) {
  const def = DEFINITIONS[k]
  if (!def) return <>{k}</>
  return (
    <abbr
      title={def}
      className={`cursor-help no-underline border-b border-dotted border-gray-400 hover:border-current ${className}`}
    >
      {k}
    </abbr>
  )
}

// ─── Mapping nom complet de lot → cle abrevee ──────────────────────────────
// Pour wrapper rapidement un libelle de lot (ex: "Gros oeuvre" → key "GO")
const LOT_NAME_TO_KEY: Record<string, string> = {
  'gros oeuvre': 'GO',
  'gros œuvre': 'GO',
  'travaux publics': 'TP',
  'demolition': 'DEMO',
  'démolition': 'DEMO',
  'demolitions': 'DEMO',
  'démolitions': 'DEMO',
  'terrassement': 'TER',
  'maconnerie': 'MAC',
  'maçonnerie': 'MAC',
  'charpente': 'CHARP',
  'couverture': 'COUV',
  'etancheite': 'ETAN',
  'étanchéité': 'ETAN',
  'isolation': 'ISO',
  'isolation thermique exterieure': 'ITE',
  'isolation thermique extérieure': 'ITE',
  'isolation thermique interieure': 'ITI',
  'isolation thermique intérieure': 'ITI',
  'menuiseries': 'MEN',
  'menuiseries exterieures': 'MENEXT',
  'menuiseries extérieures': 'MENEXT',
  'menuiseries interieures': 'MENINT',
  'menuiseries intérieures': 'MENINT',
  'menuiseries ext.': 'MENEXT',
  'menuiseries int.': 'MENINT',
  'serrurerie': 'SERR',
  'metallerie': 'SERR',
  'métallerie': 'SERR',
  'platrerie': 'PLAT',
  'plâtrerie': 'PLAT',
  'cloisons': 'CLOIS',
  'cloisonnement': 'CLOIS',
  'carrelage': 'CARR',
  'carrelage faience': 'CARR',
  'carrelage faïence': 'CARR',
  'revetements': 'REV',
  'revêtements': 'REV',
  'revetements de sol': 'REV',
  'revêtements de sols': 'REV',
  'sols': 'REV',
  'peinture': 'PEINT',
  'peintures': 'PEINT',
  'plomberie': 'PLOMB',
  'sanitaires': 'SAN',
  'salles de bains': 'SAN',
  'cvc': 'CVC',
  'chauffage ventilation climatisation': 'CVC',
  'chauffage': 'CHAUF',
  'ventilation': 'VENTIL',
  'climatisation': 'CLIM',
  'electricite': 'ELEC',
  'électricité': 'ELEC',
  'eclairage': 'ELEC',
  'éclairage': 'ELEC',
  'courants forts': 'CFO',
  'courants faibles': 'CFA',
  'ascenseur': 'ASC',
  'domotique': 'DOMO',
  'cuisine': 'CUIS',
  'cuisine ouverte': 'CUIS',
  'agencement': 'AGEN',
  'mobilier': 'AGEN',
  'espaces verts': 'ESV',
  'piscine': 'PISC',
  'facade': 'FACADE',
  'façade': 'FACADE',
  'bardage': 'BARD',
  'enduit': 'ENDUIT',
  'fondations': 'FOND',
  'structure': 'STRUCT',
  'desenfumage': 'DESEN',
  'désenfumage': 'DESEN',
  'nettoyage': 'NETT',
  'opc': 'OPC',
}

export function lotKey(label: string | null | undefined): string | null {
  if (!label) return null
  return LOT_NAME_TO_KEY[label.trim().toLowerCase()] ?? null
}

// Composant pratique : affiche un libelle de lot, avec tooltip si abreviation connue.
export function AbbrLot({ label, className = '' }: { label: string | null | undefined; className?: string }) {
  if (!label) return null
  const key = lotKey(label)
  if (!key) return <span className={className}>{label}</span>
  const def = DEFINITIONS[key]
  return (
    <abbr
      title={def}
      className={`cursor-help no-underline border-b border-dotted border-gray-400 hover:border-current ${className}`}
    >
      {label}
    </abbr>
  )
}
