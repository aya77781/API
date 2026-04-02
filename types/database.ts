export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  app: {
    Tables: {
      projets: {
        Row: {
          id: string
          nom: string
          reference: string | null
          type_chantier: string | null
          adresse: string | null
          surface_m2: number | null
          budget_total: number | null
          date_debut: string | null
          date_livraison: string | null
          statut: 'passation' | 'achats' | 'installation' | 'chantier' | 'controle' | 'cloture' | 'gpa' | 'termine'
          phase_active: string | null
          co_id: string | null
          commercial_id: string | null
          economiste_id: string | null
          client_nom: string | null
          client_email: string | null
          client_tel: string | null
          psychologie_client: string | null
          infos_hors_contrat: string | null
          alertes_cles: string | null
          remarque: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['app']['Tables']['projets']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['app']['Tables']['projets']['Insert']>
      }
      lots: {
        Row: {
          id: string
          projet_id: string
          numero: number
          corps_etat: string
          notice_commerciale: string | null
          notice_technique: string | null
          budget_prevu: number | null
          budget_final: number | null
          st_retenu_id: string | null
          statut: 'en_attente' | 'consultation' | 'negociation' | 'retenu' | 'en_cours' | 'termine'
          remarque: string | null
          created_at: string
        }
        Insert: Omit<Database['app']['Tables']['lots']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['app']['Tables']['lots']['Insert']>
      }
      comptes_rendus: {
        Row: {
          id: string
          projet_id: string
          numero: number
          type: 'passation' | 'lancement' | 'chantier' | 'opr' | 'autre' | 'reunion' | 'tournee_terrain'
          date_reunion: string
          audio_url: string | null
          transcription: string | null
          participants: Json | null
          statut: 'brouillon' | 'valide' | 'envoye'
          valide_par: string | null
          valide_le: string | null
          prochaine_reunion: string | null
          created_at: string
        }
        Insert: Omit<Database['app']['Tables']['comptes_rendus']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['app']['Tables']['comptes_rendus']['Insert']>
      }
      remarques_cr: {
        Row: {
          id: string
          cr_id: string
          lot_id: string | null
          section: string
          auteur: string | null
          contenu: string
          statut: 'nouveau' | 'en_cours' | 'leve' | 'urgent' | 'relance'
          cr_origine: number | null
          photos: string[] | null
          ia_generee: boolean
          modifiee_par_co: boolean
          created_at: string
        }
        Insert: Omit<Database['app']['Tables']['remarques_cr']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['app']['Tables']['remarques_cr']['Insert']>
      }
      cr_versions: {
        Row: {
          id: string
          cr_id: string
          role: 'co' | 'gerant' | 'economiste' | 'dessinatrice' | 'general' | 'client'
          contenu: string | null
          modifie_par_co: boolean
          envoye_le: string | null
          destinataire_email: string | null
        }
        Insert: Omit<Database['app']['Tables']['cr_versions']['Row'], 'id'>
        Update: Partial<Database['app']['Tables']['cr_versions']['Insert']>
      }
      checklists: {
        Row: {
          id: string
          projet_id: string
          lot_id: string | null
          type: 'terrain' | 'opr' | 'gpa'
          points: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['app']['Tables']['checklists']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['app']['Tables']['checklists']['Insert']>
      }
      checklists_templates: {
        Row: {
          id: string
          lot_type: string
          type: 'terrain' | 'opr' | 'gpa'
          points: Json
          created_at: string
        }
        Insert: Omit<Database['app']['Tables']['checklists_templates']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['app']['Tables']['checklists_templates']['Insert']>
      }
      planning_ppe: {
        Row: {
          id: string
          projet_id: string
          date_debut_chantier: string | null
          date_livraison: string | null
          version: number
          valide_par: string | null
          export_mpp_url: string | null
          created_at: string
        }
        Insert: Omit<Database['app']['Tables']['planning_ppe']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['app']['Tables']['planning_ppe']['Insert']>
      }
      interventions_st: {
        Row: {
          id: string
          planning_id: string
          lot_id: string
          st_id: string | null
          date_debut: string | null
          date_fin: string | null
          semaine_debut: number | null
          semaine_fin: number | null
          planning_accepte: boolean | null
          statut: 'planifie' | 'confirme' | 'en_cours' | 'termine' | 'decale'
          remarque: string | null
        }
        Insert: Omit<Database['app']['Tables']['interventions_st']['Row'], 'id'>
        Update: Partial<Database['app']['Tables']['interventions_st']['Insert']>
      }
      reserves: {
        Row: {
          id: string
          projet_id: string
          lot_id: string | null
          st_id: string | null
          description: string
          localisation: string | null
          photo_signalement_url: string | null
          photo_levee_url: string | null
          statut: 'ouvert' | 'en_cours' | 'leve' | 'conteste'
          date_signalement: string
          delai_levee_jours: number
          date_echeance: string | null
          date_levee: string | null
          valide_co: boolean
          remarque: string | null
          created_at: string
        }
        Insert: Omit<Database['app']['Tables']['reserves']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['app']['Tables']['reserves']['Insert']>
      }
      prorata: {
        Row: {
          id: string
          projet_id: string
          gestionnaire: 'api' | 'st'
          gestionnaire_st_id: string | null
          taux_pct: number
          budget_estime: number
          depenses_reelles: number
          statut: 'actif' | 'cloture'
          created_at: string
        }
        Insert: Omit<Database['app']['Tables']['prorata']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['app']['Tables']['prorata']['Insert']>
      }
      depenses_dic: {
        Row: {
          id: string
          prorata_id: string
          poste: 'eau' | 'electricite' | 'nettoyage' | 'gardiennage' | 'bungalow' | 'sanitaire' | 'autre' | null
          montant: number
          date_facture: string | null
          facture_url: string | null
          source: 'email_auto' | 'manuel'
          created_at: string
        }
        Insert: Omit<Database['app']['Tables']['depenses_dic']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['app']['Tables']['depenses_dic']['Insert']>
      }
      doe: {
        Row: {
          id: string
          projet_id: string
          completude_pct: number
          statut: 'en_cours' | 'complet' | 'envoye'
          envoye_le: string | null
          created_at: string
        }
        Insert: Omit<Database['app']['Tables']['doe']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['app']['Tables']['doe']['Insert']>
      }
      sous_traitants: {
        Row: {
          id: string
          raison_sociale: string
          corps_etat: string[] | null
          specialites: string[]
          contact_nom: string | null
          contact_tel: string | null
          contact_email: string | null
          email: string | null
          telephone: string | null
          adresse: string | null
          ville: string | null
          departement: string | null
          region: string | null
          zone_geo: string[] | null
          note_globale: number | null
          note_google: number | null
          nb_avis_google: number | null
          site_web: string | null
          place_id: string | null
          nb_projets: number
          statut: 'actif' | 'inactif' | 'blackliste'
          actif: boolean
          agrement: 'agree' | 'non_agree' | 'en_cours'
          motif_blacklist: string | null
          source: 'bd_api' | 'scraping' | 'manuel'
          kbis_valide_jusqu: string | null
          urssaf_valide_jusqu: string | null
          assurance_rc_valide_jusqu: string | null
          assurance_decennale_valide_jusqu: string | null
          points_forts: string | null
          points_faibles: string | null
          remarque: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['app']['Tables']['sous_traitants']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['app']['Tables']['sous_traitants']['Insert']>
      }
      evaluations_st: {
        Row: {
          id: string
          st_id: string
          projet_id: string
          co_id: string
          note_qualite: number
          note_delai: number
          note_communication: number
          note_globale: number
          commentaire: string | null
          created_at: string
        }
        Insert: Omit<Database['app']['Tables']['evaluations_st']['Row'], 'id' | 'created_at' | 'note_globale'>
        Update: Partial<Database['app']['Tables']['evaluations_st']['Insert']>
      }
      consultations_st: {
        Row: {
          id: string
          projet_id: string
          lot_id: string
          st_id: string
          statut: 'a_contacter' | 'contacte' | 'devis_demande' | 'devis_recu' | 'refuse' | 'attribue'
          note_contact: string | null
          email_envoye_at: string | null
          devis_recu_at: string | null
          montant_devis: number | null
          delai_propose: number | null
          note_negociation: string | null
          score_ia: number | null
          attribue: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['app']['Tables']['consultations_st']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['app']['Tables']['consultations_st']['Insert']>
      }
      st_potentiels: {
        Row: {
          id: string
          projet_id: string | null
          lot_id: string | null
          co_id: string | null
          raison_sociale: string
          adresse: string | null
          contact_tel: string | null
          contact_email: string | null
          site_web: string | null
          note_google: number | null
          nb_avis_google: number | null
          lot_corps_etat: string | null
          st_id: string | null
          confirmed: boolean
          created_at: string
        }
        Insert: Omit<Database['app']['Tables']['st_potentiels']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['app']['Tables']['st_potentiels']['Insert']>
      }
      sts_prospection: {
        Row: {
          id: string
          raison_sociale: string
          adresse: string | null
          contact_tel: string | null
          contact_email: string | null
          site_web: string | null
          place_id: string | null
          note_google: number | null
          nb_avis_google: number | null
          statut: 'suggestion' | 'validé' | 'ignoré'
          lot_id: string | null
          projet_id: string | null
          co_id: string | null
          st_id: string | null
          lot_corps_etat: string | null
          ville_recherche: string | null
          created_at: string
        }
        Insert: Omit<Database['app']['Tables']['sts_prospection']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['app']['Tables']['sts_prospection']['Insert']>
      }
      utilisateurs: {
        Row: {
          id: string
          email: string
          nom: string
          prenom: string
          role: 'admin' | 'co' | 'gerant' | 'commercial' | 'economiste' | 'dessinatrice' | 'assistant_travaux' | 'comptable' | 'rh' | 'cho' | 'st' | 'controle' | 'client'
          actif: boolean
          categorie: 'interne' | 'st' | 'controle' | 'client'
          created_at: string
        }
        Insert: Omit<Database['app']['Tables']['utilisateurs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['app']['Tables']['utilisateurs']['Insert']>
      }
      alertes: {
        Row: {
          id: string
          projet_id: string | null
          utilisateur_id: string | null
          type: string
          titre: string
          message: string | null
          priorite: 'low' | 'normal' | 'high' | 'urgent'
          lue: boolean
          metadata: Record<string, unknown> | null
          declenchement_at: string | null
          created_at: string
        }
        Insert: Omit<Database['app']['Tables']['alertes']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['app']['Tables']['alertes']['Insert']>
      }
      propositions: {
        Row: {
          id: string
          projet_id: string
          numero: number
          montant_ht: number | null
          statut: 'brouillon' | 'valide_eco' | 'envoye_client' | 'accepte' | 'refuse'
          date_envoi: string | null
          valide_par: string | null
          valide_le: string | null
          remarque: string | null
          created_at: string
        }
        Insert: Omit<Database['app']['Tables']['propositions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['app']['Tables']['propositions']['Insert']>
      }
      checklist_contractuelle: {
        Row: {
          id: string
          projet_id: string
          etape: string
          fait: boolean
          fait_par: string | null
          fait_le: string | null
          ordre: number | null
        }
        Insert: Omit<Database['app']['Tables']['checklist_contractuelle']['Row'], 'id'>
        Update: Partial<Database['app']['Tables']['checklist_contractuelle']['Insert']>
      }
      chiffrage_versions: {
        Row: {
          id: string
          projet_id: string
          version: number
          montant_total: number
          motif_revision: string
          statut: 'actif' | 'archive'
          cree_par: string | null
          created_at: string
        }
        Insert: Omit<Database['app']['Tables']['chiffrage_versions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['app']['Tables']['chiffrage_versions']['Insert']>
      }
      echanges_st: {
        Row: {
          id: string
          projet_id: string
          lot_id: string | null
          st_id: string | null
          type: 'clarification' | 'variante' | 'relance' | 'autre' | null
          contenu: string
          decision: 'accepte' | 'refuse' | 'en_attente'
          motif_decision: string | null
          created_at: string
        }
        Insert: Omit<Database['app']['Tables']['echanges_st']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['app']['Tables']['echanges_st']['Insert']>
      }
      avenants: {
        Row: {
          id: string
          projet_id: string
          numero: number
          description: string
          montant_ht: number | null
          statut: 'ouvert' | 'chiffre' | 'valide_co' | 'valide_client' | 'refuse'
          demande_par: string | null
          created_at: string
        }
        Insert: Omit<Database['app']['Tables']['avenants']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['app']['Tables']['avenants']['Insert']>
      }
      devis_recus: {
        Row: {
          id: string
          projet_id: string
          lot_id: string | null
          st_id: string | null
          montant_ht: number | null
          delai_semaines: number | null
          statut: 'recu' | 'analyse' | 'retenu' | 'refuse'
          score_ia: number | null
          note_eco: string | null
          devis_url: string | null
          created_at: string
        }
        Insert: Omit<Database['app']['Tables']['devis_recus']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['app']['Tables']['devis_recus']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
  historique: {
    Tables: {
      hist_projets: {
        Row: {
          id: string
          nom: string
          reference: string | null
          type_chantier: string | null
          surface_m2: number | null
          budget_total: number | null
          budget_reel: number | null
          duree_prevue_jours: number | null
          duree_reelle_jours: number | null
          nb_lots: number | null
          zone_geo: string | null
          nb_reserves_total: number
          source_doc: string | null
          ocr_brut: string | null
          extraction_ia: Json | null
          remarque: string | null
          date_livraison: string | null
          created_at: string
        }
        Insert: Omit<Database['historique']['Tables']['hist_projets']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['historique']['Tables']['hist_projets']['Insert']>
      }
      hist_lots: {
        Row: {
          id: string
          hist_projet_id: string
          corps_etat: string
          budget_prevu: number | null
          budget_reel: number | null
          duree_prevue_jours: number | null
          duree_reelle_jours: number | null
          nb_reserves: number
          ecart_budget_pct: number | null
          remarque: string | null
        }
        Insert: Omit<Database['historique']['Tables']['hist_lots']['Row'], 'id'>
        Update: Partial<Database['historique']['Tables']['hist_lots']['Insert']>
      }
      hist_st: {
        Row: {
          id: string
          app_st_id: string | null
          raison_sociale: string
          corps_etat: string[] | null
          contact_tel: string | null
          zone_geo: string[] | null
          note_gerant: number | null
          note_calculee: number | null
          nb_projets: number
          points_forts: string | null
          points_faibles: string | null
          blackliste: boolean
          motif_blacklist: string | null
          remarque: string | null
          created_at: string
        }
        Insert: Omit<Database['historique']['Tables']['hist_st']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['historique']['Tables']['hist_st']['Insert']>
      }
      hist_performance_st: {
        Row: {
          id: string
          hist_st_id: string
          hist_projet_id: string
          corps_etat: string | null
          delai_respecte: boolean | null
          ecart_delai_jours: number | null
          nb_reserves: number
          ecart_budget_pct: number | null
          note_co: number | null
          remarque: string | null
        }
        Insert: Omit<Database['historique']['Tables']['hist_performance_st']['Row'], 'id'>
        Update: Partial<Database['historique']['Tables']['hist_performance_st']['Insert']>
      }
      hist_regles_metier: {
        Row: {
          id: string
          categorie: 'lotissement' | 'st' | 'budget' | 'planning' | 'alerte' | 'autre' | null
          contexte: string | null
          regle: string
          source: 'session_gerant' | 'extraction_cr' | 'extraction_doc' | 'auto' | null
          confiance: number
          nb_confirmations: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['historique']['Tables']['hist_regles_metier']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['historique']['Tables']['hist_regles_metier']['Insert']>
      }
      hist_documents: {
        Row: {
          id: string
          hist_projet_id: string | null
          type_doc: 'devis' | 'contrat' | 'cr' | 'plan' | 'excel' | 'autre' | null
          nom_fichier: string | null
          source_url: string | null
          storage_url: string | null
          ocr_brut: string | null
          embedding: number[] | null
          date_ocr: string
          created_at: string
        }
        Insert: Omit<Database['historique']['Tables']['hist_documents']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['historique']['Tables']['hist_documents']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
export type Projet = Database['app']['Tables']['projets']['Row']
export type Lot = Database['app']['Tables']['lots']['Row']
export type CompteRendu = Database['app']['Tables']['comptes_rendus']['Row']
export type RemarqueCR = Database['app']['Tables']['remarques_cr']['Row']
export type CRVersion = Database['app']['Tables']['cr_versions']['Row']
export type Checklist = Database['app']['Tables']['checklists']['Row']
export type ChecklistTemplate = Database['app']['Tables']['checklists_templates']['Row']
export type PlanningPPE = Database['app']['Tables']['planning_ppe']['Row']
export type InterventionST = Database['app']['Tables']['interventions_st']['Row']
export type Reserve = Database['app']['Tables']['reserves']['Row']
export type Prorata = Database['app']['Tables']['prorata']['Row']
export type DepenseDIC = Database['app']['Tables']['depenses_dic']['Row']
export type DOE = Database['app']['Tables']['doe']['Row']
export type SousTraitant = Database['app']['Tables']['sous_traitants']['Row']
export type EvaluationST = Database['app']['Tables']['evaluations_st']['Row']
export type ConsultationST = Database['app']['Tables']['consultations_st']['Row']
export type STProspection = Database['app']['Tables']['sts_prospection']['Row']
export type Utilisateur = Database['app']['Tables']['utilisateurs']['Row']
export type Alerte = Database['app']['Tables']['alertes']['Row']

export type Proposition            = Database['app']['Tables']['propositions']['Row']
export type ChecklistContractuelle = Database['app']['Tables']['checklist_contractuelle']['Row']
export type ChiffrageVersion       = Database['app']['Tables']['chiffrage_versions']['Row']
export type EchangeST              = Database['app']['Tables']['echanges_st']['Row']
export type Avenant                = Database['app']['Tables']['avenants']['Row']
export type DevisRecu              = Database['app']['Tables']['devis_recus']['Row']

export type StatutProjet = Projet['statut']
export type StatutReserve = Reserve['statut']
export type StatutLot = Lot['statut']
export type RoleUtilisateur = Utilisateur['role']
