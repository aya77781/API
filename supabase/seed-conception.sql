-- Seed Phase Conception
-- 3 projets de test avec brief, notices, propositions et demandes :
--   • Villa Prado (VLP-001)  — V1 refusée (cuisine à repenser)
--   • Bureaux Atlas (BAT-002) — V2 livrée, en attente retour client (312 000 € HT)
--   • Loft République (LRP-003) — V2 acceptée, prête à passer en APD
--
-- Pré-requis : utilisateurs commercial / dessinatrice / economiste actifs dans app.utilisateurs.
-- Adapter les UUID ci-dessous au besoin (ou relancer avec d'autres comptes).

DO $$
DECLARE
  v_commercial UUID;
  v_dessin     UUID;
  v_eco        UUID;
  v_proj1 UUID; v_proj2 UUID; v_proj3 UUID;
  v_prop_v1_proj1 UUID; v_prop_v2_proj2 UUID; v_prop_v2_proj3 UUID;
BEGIN
  SELECT id INTO v_commercial FROM app.utilisateurs WHERE role = 'commercial'   AND actif LIMIT 1;
  SELECT id INTO v_dessin     FROM app.utilisateurs WHERE role = 'dessinatrice' AND actif LIMIT 1;
  SELECT id INTO v_eco        FROM app.utilisateurs WHERE role = 'economiste'   AND actif LIMIT 1;

  IF v_commercial IS NULL OR v_dessin IS NULL OR v_eco IS NULL THEN
    RAISE EXCEPTION 'Pré-requis manquant : un utilisateur commercial / dessinatrice / economiste actif.';
  END IF;

  -- Villa Prado --------------------------------------------------------------
  INSERT INTO app.projets (nom, reference, type_chantier, adresse, surface_m2, budget_total,
    client_nom, client_email, statut, phase, phase_active,
    commercial_id, dessinatrice_id, economiste_id)
  VALUES ('Villa Prado', 'VLP-001', 'Renovation', '12 rue Prado, 69006 Lyon', 180, 280000,
    'Famille Prado', 'prado@example.com', 'analyse', 'aps', 'conception',
    v_commercial, v_dessin, v_eco)
  RETURNING id INTO v_proj1;

  INSERT INTO app.brief_client (projet_id, besoin_exprime, contraintes, style_inspiration,
    budget_evoque, delais_souhaites, auteur_id)
  VALUES (v_proj1,
    'Rénovation complète d''une villa familiale, ouverture des espaces de vie, création d''une suite parentale.',
    'Murs porteurs à conserver, copropriété (ravalement à coordonner).',
    'Contemporain chaleureux, matières naturelles (bois clair, pierre).',
    280000, '2026-09-30', v_commercial);

  INSERT INTO app.notices_commerciales (projet_id, lot_nom, contenu_texte, ordre, auteur_id) VALUES
    (v_proj1, 'Démolitions',     'Dépose cloisons salon/cuisine, sols existants conservés en partie nuit.', 0, v_commercial),
    (v_proj1, 'Cuisine',         'Cuisine ouverte sur séjour, îlot central avec évier + plaques.',          1, v_commercial),
    (v_proj1, 'Suite parentale', 'Création d''une chambre + dressing + salle d''eau privative.',             2, v_commercial),
    (v_proj1, 'Menuiseries ext.','Remplacement complet en alu noir, double vitrage thermique.',             3, v_commercial);

  INSERT INTO app.propositions (projet_id, numero, type, statut,
    plan_url, plan_valide, montant_total_ht, montant_ht,
    commentaire_client, retours_client,
    date_envoi, date_soumission, date_reponse_client, date_retour_client, is_archived)
  VALUES (v_proj1, 1, 'premiere', 'refusee',
    'https://example.com/plans/villa-prado-v1.pdf', true, 295000, 295000,
    'Trop petit pour la cuisine — il faut repenser cette zone.',
    'Trop petit pour la cuisine — il faut repenser cette zone.',
    '2026-04-22', '2026-04-22', '2026-05-02', '2026-05-02', false)
  RETURNING id INTO v_prop_v1_proj1;

  INSERT INTO app.demandes_travail (projet_id, proposition_id, version, type, statut,
    demandeur_id, destinataire_id, message_demandeur,
    date_demande, date_livraison_souhaitee, date_livraison_prevue,
    date_livraison_effective, date_livraison_reelle,
    livrable_url, notes_livreur)
  VALUES (v_proj1, v_prop_v1_proj1, 1, 'plan_intention', 'livree',
    v_commercial, v_dessin, 'Plan d''intention V1, ouverture sur séjour.',
    '2026-04-05', '2026-04-15', '2026-04-15', '2026-04-18', '2026-04-18',
    'https://example.com/plans/villa-prado-v1.pdf',
    'Plan d''intention basé sur RDV client du 02/04.');

  INSERT INTO app.demandes_travail (projet_id, proposition_id, version, type, statut,
    demandeur_id, destinataire_id, message_demandeur,
    date_demande, date_livraison_souhaitee, date_livraison_prevue,
    date_livraison_effective, date_livraison_reelle,
    livrable_montant, notes_livreur)
  VALUES (v_proj1, v_prop_v1_proj1, 1, 'estimation_initiale', 'livree',
    v_commercial, v_eco, 'Estimation macro V1.',
    '2026-04-05', '2026-04-19', '2026-04-19', '2026-04-21', '2026-04-21',
    295000, 'Macro 1 600 €/m². Prévoir aléas de 10% sur la suite parentale.');

  -- Bureaux Atlas ------------------------------------------------------------
  INSERT INTO app.projets (nom, reference, type_chantier, adresse, surface_m2, budget_total,
    client_nom, client_email, statut, phase, phase_active,
    commercial_id, dessinatrice_id, economiste_id)
  VALUES ('Bureaux Atlas', 'BAT-002', 'Amenagement tertiaire', '8 cours Atlas, 75008 Paris', 320, 320000,
    'Atlas Holding', 'contact@atlas.com', 'analyse', 'aps', 'conception',
    v_commercial, v_dessin, v_eco)
  RETURNING id INTO v_proj2;

  INSERT INTO app.brief_client (projet_id, besoin_exprime, contraintes, style_inspiration,
    budget_evoque, delais_souhaites, auteur_id)
  VALUES (v_proj2,
    'Réaménagement de plateaux de bureaux : open-space, salles de réunion, cafétéria.',
    'Bâtiment classé, maintien de la fluidité de circulation, normes ERP.',
    'Tertiaire haut de gamme, biophilie, mobilier sur-mesure.',
    320000, '2026-12-15', v_commercial);

  INSERT INTO app.notices_commerciales (projet_id, lot_nom, contenu_texte, ordre, auteur_id) VALUES
    (v_proj2, 'Cloisonnement', 'Cloisons vitrées toute hauteur, panneaux acoustiques.',                       0, v_commercial),
    (v_proj2, 'Mobilier',      'Postes de travail, salles de réunion 4-12 places, espaces café.',             1, v_commercial),
    (v_proj2, 'Éclairage',     'LED gradable + détection présence + biophilie (parois végétales).',           2, v_commercial);

  INSERT INTO app.propositions (projet_id, numero, type, statut, plan_url, montant_total_ht, montant_ht,
    is_archived, date_envoi, date_soumission, date_reponse_client, commentaire_client)
  VALUES (v_proj2, 1, 'premiere', 'acceptee',
    'https://example.com/plans/atlas-v1.pdf', 290000, 290000, true,
    '2026-03-15', '2026-03-15', '2026-03-25',
    'OK pour le principe, on monte en gamme sur les espaces communs.');

  INSERT INTO app.propositions (projet_id, numero, type, statut, plan_url, plan_3d_url,
    montant_total_ht, montant_ht, is_archived, date_envoi, date_soumission)
  VALUES (v_proj2, 2, 'affinee', 'envoyee',
    'https://example.com/plans/atlas-v2.pdf', 'https://example.com/3d/atlas-v2.glb',
    312000, 312000, false, '2026-04-26', '2026-04-26')
  RETURNING id INTO v_prop_v2_proj2;

  INSERT INTO app.demandes_travail (projet_id, proposition_id, version, type, statut,
    demandeur_id, destinataire_id, message_demandeur,
    date_demande, date_livraison_souhaitee, date_livraison_prevue,
    date_livraison_effective, date_livraison_reelle,
    livrable_url, livrable_3d_url, notes_livreur)
  VALUES (v_proj2, v_prop_v2_proj2, 2, 'plan_proposition', 'livree',
    v_commercial, v_dessin, 'Affinage V2 : montée en gamme espaces communs, biophilie renforcée.',
    '2026-04-08', '2026-04-22', '2026-04-22', '2026-04-23', '2026-04-23',
    'https://example.com/plans/atlas-v2.pdf', 'https://example.com/3d/atlas-v2.glb',
    'Ajout parois végétales, salle visio premium, café espace client.');

  INSERT INTO app.demandes_travail (projet_id, proposition_id, version, type, statut,
    demandeur_id, destinataire_id, message_demandeur,
    date_demande, date_livraison_souhaitee, date_livraison_prevue,
    date_livraison_effective, date_livraison_reelle,
    livrable_montant, notes_livreur)
  VALUES (v_proj2, v_prop_v2_proj2, 2, 'chiffrage_proposition', 'livree',
    v_commercial, v_eco, 'Chiffrage affiné V2 cohérent avec le plan.',
    '2026-04-08', '2026-04-25', '2026-04-25', '2026-04-25', '2026-04-25',
    312000, 'Chiffrage V2 incl. parois végétales + acoustique haute perf. Aléas 8%.');

  -- Loft République ----------------------------------------------------------
  INSERT INTO app.projets (nom, reference, type_chantier, adresse, surface_m2, budget_total,
    client_nom, client_email, statut, phase, phase_active,
    commercial_id, dessinatrice_id, economiste_id)
  VALUES ('Loft République', 'LRP-003', 'Renovation', '34 bd Magenta, 75010 Paris', 130, 200000,
    'M. et Mme Dubois', 'dubois@example.com', 'analyse', 'aps', 'conception',
    v_commercial, v_dessin, v_eco)
  RETURNING id INTO v_proj3;

  INSERT INTO app.brief_client (projet_id, besoin_exprime, contraintes, style_inspiration,
    budget_evoque, delais_souhaites, auteur_id)
  VALUES (v_proj3,
    'Transformation d''un plateau brut en loft familial : 3 chambres, 2 SDB, grande cuisine ouverte.',
    'Hauteur sous plafond 4m à conserver, poutres apparentes.',
    'Loft new-yorkais, métal noir et bois, briques apparentes.',
    200000, '2026-08-30', v_commercial);

  INSERT INTO app.notices_commerciales (projet_id, lot_nom, contenu_texte, ordre, auteur_id) VALUES
    (v_proj3, 'Cuisine ouverte',     'Plan de travail béton ciré 4m, hotte centrale design.',                  0, v_commercial),
    (v_proj3, 'Verrières',           'Verrières atelier sur les chambres pour conserver la luminosité.',        1, v_commercial),
    (v_proj3, 'Salles de bains',     'Douche italienne en pierre naturelle, vasque double maître.',             2, v_commercial),
    (v_proj3, 'Sols',                'Parquet contrecollé chêne brut + béton ciré dans les pièces d''eau.',     3, v_commercial),
    (v_proj3, 'Briques apparentes',  'Décapage et patine d''un mur de briques structurel dans le séjour.',      4, v_commercial);

  INSERT INTO app.propositions (projet_id, numero, type, statut, plan_url, montant_total_ht, montant_ht,
    is_archived, date_envoi, date_soumission, date_reponse_client, commentaire_client)
  VALUES (v_proj3, 1, 'premiere', 'acceptee',
    'https://example.com/plans/loft-v1.pdf', 188000, 188000, true,
    '2026-02-15', '2026-02-15', '2026-02-28', 'On va plus loin sur les finitions, prix OK.');

  INSERT INTO app.propositions (projet_id, numero, type, statut, plan_url, plan_3d_url,
    montant_total_ht, montant_ht, is_archived, date_envoi, date_soumission, date_reponse_client, commentaire_client)
  VALUES (v_proj3, 2, 'affinee', 'acceptee',
    'https://example.com/plans/loft-v2.pdf', 'https://example.com/3d/loft-v2.glb',
    198000, 198000, false, '2026-04-10', '2026-04-10', '2026-04-20',
    'Parfait — on signe l''APD.')
  RETURNING id INTO v_prop_v2_proj3;

  INSERT INTO app.demandes_travail (projet_id, proposition_id, version, type, statut,
    demandeur_id, destinataire_id,
    date_demande, date_livraison_souhaitee, date_livraison_prevue,
    date_livraison_effective, date_livraison_reelle,
    livrable_url, livrable_3d_url, notes_livreur)
  VALUES (v_proj3, v_prop_v2_proj3, 2, 'plan_proposition', 'livree',
    v_commercial, v_dessin,
    '2026-03-10', '2026-03-22', '2026-03-22', '2026-03-25', '2026-03-25',
    'https://example.com/plans/loft-v2.pdf', 'https://example.com/3d/loft-v2.glb',
    'V2 avec verrières et finitions affinées.');

  INSERT INTO app.demandes_travail (projet_id, proposition_id, version, type, statut,
    demandeur_id, destinataire_id,
    date_demande, date_livraison_souhaitee, date_livraison_prevue,
    date_livraison_effective, date_livraison_reelle,
    livrable_montant, notes_livreur)
  VALUES (v_proj3, v_prop_v2_proj3, 2, 'chiffrage_proposition', 'livree',
    v_commercial, v_eco,
    '2026-03-10', '2026-03-26', '2026-03-26', '2026-03-28', '2026-03-28',
    198000, 'Chiffrage V2 affiné. Marge confortable sur les finitions.');
END $$;
