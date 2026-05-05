'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  type Version,
  type BriefClientInput,
  type CreerDemandeInput,
  type LivrerDemandeInput,
  type RetourClientInput,
  planTypeForVersion,
  chiffrageTypeForVersion,
  propositionTypeForVersion,
  labelType,
  isPlanType,
  isChiffrageType,
  formatEuros,
} from '@/lib/conception/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getCurrentAppUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  const { data: profil } = await supabase.schema('app').from('utilisateurs')
    .select('id, role, email, prenom, nom').eq('email', user.email!).single()
  if (!profil) throw new Error('Profil applicatif introuvable')
  return profil
}

async function getProjet(projetId: string) {
  const supabase = createClient()
  const { data } = await supabase.schema('app').from('projets')
    .select('id, nom, commercial_id, dessinatrice_id, economiste_id, phase, statut')
    .eq('id', projetId).single()
  if (!data) throw new Error('Projet introuvable')
  return data
}

async function alerter(opts: {
  utilisateur_id: string
  projet_id?: string | null
  type: string
  titre: string
  message?: string
  priorite?: 'low' | 'normal' | 'high'
  metadata?: Record<string, unknown>
}) {
  const supabase = createClient()
  await supabase.schema('app').from('alertes').insert([{
    utilisateur_id: opts.utilisateur_id,
    projet_id: opts.projet_id ?? null,
    type: opts.type,
    titre: opts.titre,
    message: opts.message ?? null,
    priorite: opts.priorite ?? 'normal',
    lue: false,
    metadata: opts.metadata ?? {},
  }])
}

// ─── Brief client ───────────────────────────────────────────────────────────

export async function upsertBriefClient(input: BriefClientInput) {
  const me = await getCurrentAppUser()
  const supabase = createClient()
  const { data, error } = await supabase.schema('app').from('brief_client')
    .upsert(
      [{
        projet_id: input.projet_id,
        besoin_exprime: input.besoin_exprime ?? null,
        contraintes: input.contraintes ?? null,
        style_inspiration: input.style_inspiration ?? null,
        budget_evoque: input.budget_evoque ?? null,
        delais_souhaites: input.delais_souhaites ?? null,
        documents_urls: input.documents_urls ?? [],
        auteur_id: me.id,
      }],
      { onConflict: 'projet_id' }
    )
    .select()
    .single()
  if (error) throw error
  revalidatePath(`/commercial/projets/${input.projet_id}/conception`)
  return data
}

// ─── Notices commerciales ───────────────────────────────────────────────────

export async function addNotice(projetId: string, lotNom = 'Nouveau lot') {
  const me = await getCurrentAppUser()
  const supabase = createClient()
  const { data: existing } = await supabase.schema('app').from('notices_commerciales')
    .select('ordre').eq('projet_id', projetId)
    .order('ordre', { ascending: false }).limit(1)
  const nextOrdre = existing && existing[0] ? (existing[0].ordre ?? 0) + 1 : 0
  const { data, error } = await supabase.schema('app').from('notices_commerciales')
    .insert([{
      projet_id: projetId,
      lot_nom: lotNom,
      contenu_texte: '',
      ordre: nextOrdre,
      auteur_id: me.id,
    }]).select().single()
  if (error) throw error
  revalidatePath(`/commercial/projets/${projetId}/conception`)
  return data
}

export async function updateNotice(noticeId: string, projetId: string, patch: { lot_nom?: string; contenu_texte?: string }) {
  const supabase = createClient()
  const { error } = await supabase.schema('app').from('notices_commerciales')
    .update(patch).eq('id', noticeId)
  if (error) throw error
  revalidatePath(`/commercial/projets/${projetId}/conception`)
}

export async function deleteNotice(noticeId: string, projetId: string) {
  const supabase = createClient()
  const { error } = await supabase.schema('app').from('notices_commerciales')
    .delete().eq('id', noticeId)
  if (error) throw error
  revalidatePath(`/commercial/projets/${projetId}/conception`)
}

export async function reorderNotices(projetId: string, orderedIds: string[]) {
  const supabase = createClient()
  await Promise.all(orderedIds.map((id, idx) =>
    supabase.schema('app').from('notices_commerciales')
      .update({ ordre: idx }).eq('id', id)
  ))
  revalidatePath(`/commercial/projets/${projetId}/conception`)
}

// ─── Propositions (helpers) ─────────────────────────────────────────────────

async function getOrCreateProposition(projetId: string, version: Version, isAPD: boolean) {
  const supabase = createClient()
  const { data: existing } = await supabase.schema('app').from('propositions')
    .select('*').eq('projet_id', projetId).eq('numero', version)
    .eq('is_archived', false).maybeSingle()
  if (existing) {
    // Si on demande l'APD pour cette version, on s'assure que le type est 'finale'.
    if (isAPD && existing.type !== 'finale') {
      const { data: updated } = await supabase.schema('app').from('propositions')
        .update({ type: 'finale' }).eq('id', existing.id).select().single()
      return updated ?? existing
    }
    return existing
  }
  const { data: created, error } = await supabase.schema('app').from('propositions')
    .insert([{
      projet_id: projetId,
      numero: version,
      type: propositionTypeForVersion(version, isAPD),
      statut: 'en_preparation',
      is_archived: false,
    }]).select().single()
  if (error) throw error
  return created
}

// ─── Snapshots (figés à la création de la demande) ──────────────────────────

async function buildSnapshots(projetId: string) {
  const supabase = createClient()
  const [{ data: brief }, { data: notices }] = await Promise.all([
    supabase.schema('app').from('brief_client').select('*').eq('projet_id', projetId).maybeSingle(),
    supabase.schema('app').from('notices_commerciales').select('*').eq('projet_id', projetId).order('ordre'),
  ])
  return {
    brief_snapshot: brief ?? null,
    notices_snapshot: notices ?? [],
  }
}

// ─── Créer une demande ──────────────────────────────────────────────────────

export async function creerDemande(input: CreerDemandeInput) {
  const me = await getCurrentAppUser()
  const supabase = createClient()
  const projet = await getProjet(input.projetId)

  // 1 seule demande active par type/version
  const { data: enCours } = await supabase.schema('app').from('demandes_travail')
    .select('id, statut')
    .eq('projet_id', input.projetId)
    .eq('type', input.type)
    .eq('version', input.version)
    .in('statut', ['en_attente', 'en_cours'])
    .limit(1)
  if (enCours && enCours.length) {
    throw new Error('Une demande de ce type est déjà en cours pour cette version')
  }

  const isAPD = !!input.isAPD || input.type === 'plan_apd' || input.type === 'chiffrage_apd'
  const proposition = await getOrCreateProposition(input.projetId, input.version, isAPD)
  const snapshots = await buildSnapshots(input.projetId)

  const { data: demande, error } = await supabase.schema('app').from('demandes_travail')
    .insert([{
      projet_id: input.projetId,
      proposition_id: proposition.id,
      version: input.version,
      type: input.type,
      statut: 'en_attente',
      demandeur_id: me.id,
      destinataire_id: input.destinataireId,
      message_demandeur: input.message ?? null,
      brief_snapshot: snapshots.brief_snapshot,
      notices_snapshot: snapshots.notices_snapshot,
      fichiers_joints: input.fichiersJoints ?? [],
      date_livraison_souhaitee: input.dateLimite ?? null,
      date_livraison_prevue: input.dateLimite ?? null,
      date_demande: new Date().toISOString(),
    }]).select().single()
  if (error) throw error

  // Notification — lien vers la fiche projet, sur l'onglet correspondant
  const role = isPlanType(input.type) ? 'dessin' : 'economiste'
  const TAB_FOR_TYPE: Record<string, string> = {
    plan_intention: 'APS', plan_proposition: 'APD', plan_apd: 'AT',
    estimation_initiale: 'chiffrage', chiffrage_proposition: 'chiffrage', chiffrage_apd: 'chiffrage',
  }
  const tab = TAB_FOR_TYPE[input.type] ?? ''
  const link = `/${role}/projets/${input.projetId}${tab ? `?tab=${tab}` : ''}`
  await alerter({
    utilisateur_id: input.destinataireId,
    projet_id: input.projetId,
    type: 'demande_conception',
    titre: `Nouvelle demande : ${labelType(input.type)}`,
    message: `Projet ${projet.nom}${input.dateLimite ? ` — à livrer pour le ${input.dateLimite}` : ''}`,
    priorite: 'high',
    metadata: { demande_id: demande.id, role_destinataire: role, link },
  })

  revalidatePath(`/commercial/projets/${input.projetId}/conception`)
  revalidatePath(`/dessin/conception`)
  revalidatePath(`/economiste/conception`)
  return demande
}

// ─── Marquer "en cours" ─────────────────────────────────────────────────────

export async function marquerEnCours(demandeId: string) {
  const supabase = createClient()
  const { data, error } = await supabase.schema('app').from('demandes_travail')
    .update({ statut: 'en_cours' }).eq('id', demandeId).select().single()
  if (error) throw error
  revalidatePath('/dessin/conception')
  revalidatePath('/economiste/conception')
  return data
}

// ─── Livrer une demande ─────────────────────────────────────────────────────

export async function livrerDemande(input: LivrerDemandeInput) {
  const supabase = createClient()
  const { data: demande, error: e1 } = await supabase.schema('app').from('demandes_travail')
    .select('*').eq('id', input.demandeId).single()
  if (e1 || !demande) throw e1 ?? new Error('Demande introuvable')

  const projet = await getProjet(demande.projet_id)
  const now = new Date().toISOString()

  const { error: e2 } = await supabase.schema('app').from('demandes_travail')
    .update({
      statut: 'livree',
      livrable_url: input.livrableUrl ?? null,
      livrable_3d_url: input.livrable3dUrl ?? null,
      livrable_montant: input.montant ?? null,
      notes_livreur: input.notes ?? null,
      date_livraison_effective: now,
      date_livraison_reelle: now,
    }).eq('id', input.demandeId)
  if (e2) throw e2

  // Update proposition selon le type
  if (isPlanType(demande.type) && demande.proposition_id) {
    await supabase.schema('app').from('propositions').update({
      plan_url: input.livrableUrl ?? null,
      plan_3d_url: input.livrable3dUrl ?? null,
      plan_valide: false,
    }).eq('id', demande.proposition_id)
  }

  if (isChiffrageType(demande.type) && demande.proposition_id) {
    await supabase.schema('app').from('propositions').update({
      montant_total_ht: input.montant ?? null,
      montant_ht: input.montant ?? null,
      chiffrage_valide: false,
    }).eq('id', demande.proposition_id)

    // Insérer les lignes d'estimation
    if (input.lignesEstimation?.length) {
      // chiffrage_lignes vit dans public, lié au lot/projet. On référence projet_id et lot_id.
      // Un lot factice "Estimation macro" peut être nécessaire si pas de lots (V1).
      const projetId = demande.projet_id
      type LotRow = { id: string; nom: string | null }
      const { data: lotsData } = await supabase.from('lots' as never)
        .select('id, nom').eq('projet_id', projetId)
      const lots = (lotsData ?? []) as unknown as LotRow[]
      const lotsByName = new Map<string, string>()
      for (const l of lots) {
        if (l.nom) lotsByName.set(l.nom.toLowerCase(), l.id)
      }

      const lignesPayload: Array<Record<string, unknown>> = []
      for (let i = 0; i < input.lignesEstimation.length; i++) {
        const l = input.lignesEstimation[i]
        let lotId = l.lot_id ?? null
        if (!lotId) {
          const key = (l.designation || 'Estimation macro').toLowerCase()
          lotId = lotsByName.get(key) ?? null
        }
        if (!lotId) {
          const { data: nlot } = await supabase.from('lots' as never)
            .insert([{ projet_id: projetId, nom: l.designation || `Lot estimation ${i + 1}`, ordre: i }] as never)
            .select('id').single()
          const created = nlot as unknown as { id: string } | null
          lotId = created?.id ?? null
          if (lotId && l.designation) lotsByName.set(l.designation.toLowerCase(), lotId)
        }
        if (!lotId) continue
        lignesPayload.push({
          lot_id: lotId,
          projet_id: projetId,
          designation: l.designation,
          quantite: l.quantite ?? null,
          unite: l.unite ?? null,
          prix_unitaire: l.prix_unitaire ?? null,
          total_ht: l.total_ht ?? null,
          ordre: l.ordre ?? i,
        })
      }
      if (lignesPayload.length) {
        await supabase.from('chiffrage_lignes' as never).insert(lignesPayload as never)
      }
    }
  }

  // Notification au demandeur
  const labelMontant = input.montant ? ` — ${formatEuros(input.montant)} HT` : ''
  await alerter({
    utilisateur_id: demande.demandeur_id!,
    projet_id: demande.projet_id,
    type: 'livraison_conception',
    titre: `${labelType(demande.type)} livré`,
    message: `Pour ${projet.nom}${labelMontant}`,
    priorite: 'high',
    metadata: {
      demande_id: demande.id,
      link: `/commercial/projets/${demande.projet_id}/conception`,
    },
  })

  // Cross-notif Eco si plan v2+ livré pendant qu'une demande chiffrage est en cours
  if (isPlanType(demande.type) && (demande.version ?? 1) > 1) {
    const { data: demandeEco } = await supabase.schema('app').from('demandes_travail')
      .select('id, destinataire_id, type, version')
      .eq('projet_id', demande.projet_id)
      .eq('version', demande.version)
      .in('type', ['chiffrage_proposition', 'chiffrage_apd'])
      .in('statut', ['en_attente', 'en_cours'])
      .maybeSingle()
    if (demandeEco?.destinataire_id) {
      const labelV = demande.type === 'plan_apd' ? 'APD' : `V${demande.version}`
      await alerter({
        utilisateur_id: demandeEco.destinataire_id,
        projet_id: demande.projet_id,
        type: 'plan_mis_a_jour',
        titre: `Plan ${labelV} disponible`,
        message: `Votre chiffrage doit peut-être être mis à jour`,
        priorite: 'normal',
        metadata: { plan_demande_id: demande.id, link: `/economiste/projets/${demande.projet_id}?tab=chiffrage` },
      })
    }
  }

  revalidatePath(`/commercial/projets/${demande.projet_id}/conception`)
  revalidatePath('/dessin/conception')
  revalidatePath('/economiste/conception')
}

// ─── Retour client ──────────────────────────────────────────────────────────

export async function enregistrerRetourClient(input: RetourClientInput) {
  const supabase = createClient()
  const { data: prop, error: e1 } = await supabase.schema('app').from('propositions')
    .select('*').eq('id', input.propositionId).single()
  if (e1 || !prop) throw e1 ?? new Error('Proposition introuvable')

  const today = new Date().toISOString().slice(0, 10)
  await supabase.schema('app').from('propositions').update({
    statut: input.statut,
    commentaire_client: input.commentaire ?? null,
    retours_client: input.commentaire ?? null,
    date_reponse_client: today,
    date_retour_client: today,
    date_retour: today,
  }).eq('id', input.propositionId)

  // APD acceptée => Passation (détection via type='finale', plus de hardcode sur numero)
  if (prop.type === 'finale' && input.statut === 'acceptee') {
    await supabase.schema('app').from('propositions').update({
      verrouillee_apres_signature: true,
    }).eq('id', input.propositionId)

    await supabase.schema('app').from('projets').update({
      phase: 'passation',
      phase_active: 'passation',
      statut: 'passation',
      date_signature: today,
    }).eq('id', prop.projet_id)

    const projet = await getProjet(prop.projet_id)
    if (projet.commercial_id) {
      await alerter({
        utilisateur_id: projet.commercial_id,
        projet_id: prop.projet_id,
        type: 'proposition_acceptee',
        titre: `APD accepté — ${projet.nom}`,
        message: 'Le projet bascule en phase Passation. Le contrat APD peut être généré.',
        priorite: 'high',
      })
    }
    revalidatePath(`/commercial/projets/${prop.projet_id}/conception`)
    return { passationDeclenchee: true }
  }

  // Demande de modifs => V suivante (jamais APD ici : on continue d'affiner)
  if (input.statut === 'en_negociation' && (input.modifsPlan || input.modifsBudget)) {
    if (prop.type === 'finale') {
      throw new Error('Impossible d\'affiner après l\'APD — créer un avenant à la place.')
    }
    const versionSuivante = (prop.numero + 1) as Version

    await supabase.schema('app').from('propositions')
      .update({ is_archived: true })
      .eq('id', input.propositionId)

    const projet = await getProjet(prop.projet_id)

    if (input.modifsPlan && projet.dessinatrice_id) {
      await creerDemande({
        projetId: prop.projet_id,
        type: planTypeForVersion(versionSuivante, false),
        version: versionSuivante,
        destinataireId: projet.dessinatrice_id,
        message: `Affinage suite retour client : ${input.commentaire ?? '—'}`,
      })
    }
    if (input.modifsBudget && projet.economiste_id) {
      await creerDemande({
        projetId: prop.projet_id,
        type: chiffrageTypeForVersion(versionSuivante, false),
        version: versionSuivante,
        destinataireId: projet.economiste_id,
        message: `Affinage suite retour client : ${input.commentaire ?? '—'}`,
      })
    }
  }

  revalidatePath(`/commercial/projets/${prop.projet_id}/conception`)
  return { passationDeclenchee: false }
}

// ─── Lancer la phase suivante (V+1 ou APD selon le flag) ─────────────────────

export async function lancerPhaseSuivante(projetId: string, versionCourante: number, nextIsAPD: boolean = false) {
  const supabase = createClient()
  // Vérifier qu'on n'a pas déjà une APD acceptée (verrouillée)
  const { data: apdExistante } = await supabase.schema('app').from('propositions')
    .select('id, statut, verrouillee_apres_signature')
    .eq('projet_id', projetId)
    .eq('type', 'finale')
    .maybeSingle()
  if (apdExistante?.verrouillee_apres_signature) {
    throw new Error('APD déjà signé — passer par un avenant')
  }

  const versionSuivante = (versionCourante + 1) as Version
  const projet = await getProjet(projetId)

  // Archive l'ancienne version active
  await supabase.schema('app').from('propositions')
    .update({ is_archived: true })
    .eq('projet_id', projetId)
    .eq('numero', versionCourante)
    .eq('is_archived', false)

  const labelSuivante = nextIsAPD ? 'APD' : `V${versionSuivante}`
  if (projet.dessinatrice_id) {
    await creerDemande({
      projetId,
      type: planTypeForVersion(versionSuivante, nextIsAPD),
      version: versionSuivante,
      isAPD: nextIsAPD,
      destinataireId: projet.dessinatrice_id,
      message: `Lancement ${labelSuivante}`,
    })
  }
  if (projet.economiste_id) {
    await creerDemande({
      projetId,
      type: chiffrageTypeForVersion(versionSuivante, nextIsAPD),
      version: versionSuivante,
      isAPD: nextIsAPD,
      destinataireId: projet.economiste_id,
      message: `Lancement ${labelSuivante}`,
    })
  }
  revalidatePath(`/commercial/projets/${projetId}/conception`)
}

// ─── Marquer proposition envoyée au client ──────────────────────────────────

export async function marquerPropositionEnvoyee(propositionId: string, projetId: string) {
  const supabase = createClient()
  await supabase.schema('app').from('propositions').update({
    statut: 'envoyee',
    date_envoi: new Date().toISOString().slice(0, 10),
    date_soumission: new Date().toISOString().slice(0, 10),
  }).eq('id', propositionId)
  revalidatePath(`/commercial/projets/${projetId}/conception`)
}
