// Fake data pour démo — projet POPY3 (réf 2026-003) uniquement.
// Remplace les lectures/écritures Supabase côté Métrés/Chiffrage par des
// données en mémoire réalistes.

export type FakeLot = {
  id: string
  projet_id: string
  nom: string
  ordre: number
  total_ht: number | null
  created_at: string
}

export type FakeLigne = {
  id: string
  lot_id: string
  projet_id: string
  designation: string | null
  detail: string | null
  quantite: number | null
  unite: string | null
  prix_unitaire: number | null
  total_ht: number | null
  ordre: number
  created_at: string
}

const NOW = '2026-03-15T09:00:00.000Z'

// ID fictif du projet POPY3 (n'a pas besoin de correspondre au vrai UUID,
// on n'écrit jamais en base quand fakeData === true).
const PROJET_ID = 'fake-popy3'

type Row = {
  designation: string
  detail?: string
  quantite: number
  unite: string // dans le format DB (m2, m3, ml, u, forfait…)
  prix_unitaire: number
}

type LotDef = {
  nom: string
  lignes: Row[]
}

const LOTS_DEF: LotDef[] = [
  {
    nom: 'Menuiseries intérieures',
    lignes: [
      { designation: 'Bloc-porte BP âme alvéolaire 83×204', detail: 'Finition prépeinte, huisserie bois', quantite: 8, unite: 'u', prix_unitaire: 285 },
      { designation: 'Bloc-porte acoustique 38 dB', detail: 'Chambre + bureau', quantite: 2, unite: 'u', prix_unitaire: 540 },
      { designation: 'Plinthes MDF h.80 mm peintes', quantite: 64, unite: 'ml', prix_unitaire: 12 },
      { designation: 'Placard stratifié coulissant 2 vantaux', detail: 'L.180 × H.240', quantite: 1, unite: 'u', prix_unitaire: 1450 },
      { designation: 'Trappe de visite plâtre 60×60', quantite: 3, unite: 'u', prix_unitaire: 95 },
    ],
  },
  {
    nom: 'Démolition / Dépose',
    lignes: [
      { designation: 'Dépose revêtement de sol PVC', detail: 'Y compris colle et primaire', quantite: 82, unite: 'm2', prix_unitaire: 8 },
      { designation: 'Démolition cloison 72/48 placo', quantite: 32, unite: 'm2', prix_unitaire: 18 },
      { designation: 'Dépose faïence murale', quantite: 22, unite: 'm2', prix_unitaire: 12 },
      { designation: 'Dépose bloc-porte existant', quantite: 6, unite: 'u', prix_unitaire: 45 },
      { designation: 'Évacuation gravats en benne 10 m³', quantite: 1, unite: 'forfait', prix_unitaire: 650 },
    ],
  },
  {
    nom: 'Gros œuvre / Maçonnerie',
    lignes: [
      { designation: 'Percement pour gaine technique Ø160', detail: 'Dalle béton 20 cm', quantite: 4, unite: 'u', prix_unitaire: 95 },
      { designation: 'Rebouchage saignées béton', quantite: 18, unite: 'ml', prix_unitaire: 28 },
      { designation: 'Scellement chaînage', quantite: 1, unite: 'forfait', prix_unitaire: 450 },
      { designation: 'Reprise en sous-œuvre linteau', detail: 'Ouverture cuisine L.2,40', quantite: 1, unite: 'forfait', prix_unitaire: 1850 },
    ],
  },
  {
    nom: 'Cloisons / Plâtrerie',
    lignes: [
      { designation: 'Cloison 72/48 + BA13 2 faces', detail: 'Isolation laine de verre 45 mm', quantite: 58, unite: 'm2', prix_unitaire: 52 },
      { designation: 'Doublage placo laine de verre 10+100', quantite: 124, unite: 'm2', prix_unitaire: 48 },
      { designation: 'Bande résiliente en pied de cloison', quantite: 62, unite: 'ml', prix_unitaire: 4.5 },
      { designation: 'Renfort ossature pour meubles suspendus', quantite: 6, unite: 'u', prix_unitaire: 35 },
    ],
  },
  {
    nom: 'Faux-plafonds',
    lignes: [
      { designation: 'Faux-plafond BA13 hydrofuge', detail: 'Salle de bain et WC', quantite: 14, unite: 'm2', prix_unitaire: 72 },
      { designation: 'Faux-plafond BA13 standard', quantite: 42, unite: 'm2', prix_unitaire: 58 },
      { designation: 'Plenum technique H.30 cm', quantite: 42, unite: 'm2', prix_unitaire: 18 },
      { designation: 'Trappe de visite 60×60', quantite: 3, unite: 'u', prix_unitaire: 85 },
    ],
  },
  {
    nom: 'Revêtements de sol',
    lignes: [
      { designation: 'PVC acoustique 2 mm', detail: 'Pose collée, classement U3P3', quantite: 82, unite: 'm2', prix_unitaire: 38 },
      { designation: 'Plinthe PVC h.60 mm', quantite: 124, unite: 'ml', prix_unitaire: 7 },
      { designation: 'Ragréage autolissant', quantite: 82, unite: 'm2', prix_unitaire: 22 },
      { designation: 'Primaire d\'accrochage', quantite: 82, unite: 'm2', prix_unitaire: 4 },
    ],
  },
  {
    nom: 'Carrelage / Faïence',
    lignes: [
      { designation: 'Carrelage grès cérame 60×60', detail: 'Pose droite au ciment-colle', quantite: 28, unite: 'm2', prix_unitaire: 65 },
      { designation: 'Faïence salle de bain H.2,10 m', quantite: 36, unite: 'm2', prix_unitaire: 58 },
      { designation: 'Plinthes carrelage h.80 mm', quantite: 42, unite: 'ml', prix_unitaire: 15 },
      { designation: 'Joints hydrofuges', quantite: 1, unite: 'forfait', prix_unitaire: 320 },
    ],
  },
  {
    nom: 'Menuiseries extérieures',
    lignes: [
      { designation: 'Fenêtre alu 2 vantaux 120×140', detail: 'Double vitrage 4/16/4 argon', quantite: 4, unite: 'u', prix_unitaire: 780 },
      { designation: 'Porte d\'entrée alu vitrée sécurisée', quantite: 1, unite: 'u', prix_unitaire: 2800 },
      { designation: 'Volet roulant alu 120×140', detail: 'Motorisation radio', quantite: 4, unite: 'u', prix_unitaire: 420 },
      { designation: 'Appui de fenêtre pierre reconstituée', quantite: 4, unite: 'u', prix_unitaire: 145 },
    ],
  },
  {
    nom: 'Électricité CFO/CFA',
    lignes: [
      { designation: 'Point lumineux commandé', detail: 'Simple allumage, double ou va-et-vient', quantite: 28, unite: 'u', prix_unitaire: 95 },
      { designation: 'Prise 16A 2P+T', quantite: 42, unite: 'u', prix_unitaire: 58 },
      { designation: 'Prise RJ45 cat.6', quantite: 6, unite: 'u', prix_unitaire: 85 },
      { designation: 'Tableau électrique 4 rangées 72 modules', quantite: 1, unite: 'u', prix_unitaire: 680 },
      { designation: 'Radiateur électrique inertie 1500 W', quantite: 6, unite: 'u', prix_unitaire: 380 },
      { designation: 'Détecteur de fumée DAAF', quantite: 2, unite: 'u', prix_unitaire: 45 },
    ],
  },
  {
    nom: 'Plomberie / Sanitaires',
    lignes: [
      { designation: 'Alimentation EF/EC PER Ø16', detail: 'Y compris raccords rapides', quantite: 48, unite: 'ml', prix_unitaire: 28 },
      { designation: 'Évacuation PVC Ø40/Ø100', quantite: 22, unite: 'ml', prix_unitaire: 35 },
      { designation: 'Meuble vasque suspendu 80 cm', detail: 'Robinetterie mitigeuse incluse', quantite: 1, unite: 'u', prix_unitaire: 780 },
      { designation: 'WC suspendu + bâti-support', quantite: 1, unite: 'u', prix_unitaire: 620 },
      { designation: 'Receveur de douche extra-plat 90×140', quantite: 1, unite: 'u', prix_unitaire: 450 },
      { designation: 'Colonne de douche thermostatique', quantite: 1, unite: 'u', prix_unitaire: 380 },
      { designation: 'Évier inox 1 bac égouttoir', quantite: 1, unite: 'u', prix_unitaire: 285 },
      { designation: 'Chauffe-eau électrique 200 L', quantite: 1, unite: 'u', prix_unitaire: 540 },
      { designation: 'Mise aux normes raccordements', quantite: 1, unite: 'forfait', prix_unitaire: 850 },
    ],
  },
  {
    nom: 'VMC / Ventilation',
    lignes: [
      { designation: 'Groupe VMC hygroréglable type B', detail: 'Basse consommation, silencieuse', quantite: 1, unite: 'u', prix_unitaire: 680 },
      { designation: 'Gaine souple isolée Ø125', quantite: 32, unite: 'ml', prix_unitaire: 14 },
      { designation: 'Bouche extraction hygro cuisine', quantite: 1, unite: 'u', prix_unitaire: 95 },
      { designation: 'Bouche extraction hygro SdB', quantite: 1, unite: 'u', prix_unitaire: 75 },
      { designation: 'Bouche extraction hygro WC', quantite: 1, unite: 'u', prix_unitaire: 65 },
      { designation: 'Entrée d\'air acoustique', detail: 'Coulisse anti-bruit 30 dB', quantite: 5, unite: 'u', prix_unitaire: 42 },
      { designation: 'Sortie de toiture Ø125', quantite: 1, unite: 'u', prix_unitaire: 185 },
      { designation: 'Mise en service + mesures de débit', quantite: 1, unite: 'forfait', prix_unitaire: 320 },
    ],
  },
  {
    nom: 'Peinture / Finitions',
    lignes: [
      { designation: 'Préparation murs (enduit + ponçage)', detail: 'Rebouchage + lissage 2 passes', quantite: 186, unite: 'm2', prix_unitaire: 14 },
      { designation: 'Impression murs', quantite: 186, unite: 'm2', prix_unitaire: 6 },
      { designation: 'Peinture acrylique mate 2 couches', detail: 'Murs chambres et séjour', quantite: 148, unite: 'm2', prix_unitaire: 18 },
      { designation: 'Peinture acrylique satinée 2 couches', detail: 'Murs cuisine, SdB, WC (lessivable)', quantite: 38, unite: 'm2', prix_unitaire: 22 },
      { designation: 'Peinture plafonds blanc mat', quantite: 82, unite: 'm2', prix_unitaire: 16 },
      { designation: 'Peinture boiseries (portes, plinthes)', quantite: 14, unite: 'u', prix_unitaire: 85 },
      { designation: 'Reprise enduit fissures', quantite: 1, unite: 'forfait', prix_unitaire: 450 },
      { designation: 'Nettoyage et protection sols', quantite: 1, unite: 'forfait', prix_unitaire: 380 },
    ],
  },
]

function buildLots(): FakeLot[] {
  return LOTS_DEF.map((def, i) => {
    const total = def.lignes.reduce((s, r) => s + r.quantite * r.prix_unitaire, 0)
    return {
      id: `fake-lot-${i + 1}`,
      projet_id: PROJET_ID,
      nom: def.nom,
      ordre: i,
      total_ht: Math.round(total * 100) / 100,
      created_at: NOW,
    }
  })
}

function buildLignesByLot(): Record<string, FakeLigne[]> {
  const map: Record<string, FakeLigne[]> = {}
  LOTS_DEF.forEach((def, i) => {
    const lotId = `fake-lot-${i + 1}`
    map[lotId] = def.lignes.map((r, j) => {
      const total = Math.round(r.quantite * r.prix_unitaire * 100) / 100
      return {
        id: `${lotId}-l${j + 1}`,
        lot_id: lotId,
        projet_id: PROJET_ID,
        designation: r.designation,
        detail: r.detail ?? null,
        quantite: r.quantite,
        unite: r.unite,
        prix_unitaire: r.prix_unitaire,
        total_ht: total,
        ordre: j,
        created_at: NOW,
      }
    })
  })
  return map
}

export const FAKE_POPY3_LOTS: FakeLot[] = buildLots()
export const FAKE_POPY3_LIGNES: Record<string, FakeLigne[]> = buildLignesByLot()

// Détection : marque ce projet comme démo fake data.
export function isPopy3Demo(reference: string | null | undefined): boolean {
  return reference === '2026-003'
}

// Lignes de démo à semer dans public.chiffrage_lignes, indexées par nom de lot
// (utile pour permettre au flow DCE → Comparatif ST de fonctionner en démo).
export type FakeLigneSeed = {
  designation: string
  detail: string | null
  quantite: number
  unite: string
  prix_unitaire: number
  ordre: number
}

export const FAKE_POPY3_LIGNES_BY_LOT_NOM: Record<string, FakeLigneSeed[]> =
  LOTS_DEF.reduce<Record<string, FakeLigneSeed[]>>((acc, def) => {
    acc[def.nom] = def.lignes.map((r, i) => ({
      designation: r.designation,
      detail: r.detail ?? null,
      quantite: r.quantite,
      unite: r.unite,
      prix_unitaire: r.prix_unitaire,
      ordre: i,
    }))
    return acc
  }, {})
