'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'
import { Abbr } from '@/components/shared/Abbr'
import { useUser } from '@/hooks/useUser'
import { formatCurrency } from '@/lib/utils'
import {
  FolderOpen, ChevronDown, ChevronRight, User, MapPin, Calendar,
  Building2, Ruler, Banknote, AlertTriangle, Brain, ShieldAlert,
  FileText, Clock, Users, Megaphone, Target, Eye, Info,
  Rocket, ClipboardList, Download, MessageSquare, Calculator, Pencil, Layers, ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

type Projet = {
  id: string; nom: string; reference: string | null; type_chantier: string | null
  adresse: string | null; surface_m2: number | null; budget_total: number | null
  date_debut: string | null; date_livraison: string | null; statut: string
  client_nom: string | null; client_email: string | null; client_tel: string | null
  psychologie_client: string | null; infos_hors_contrat: string | null
  alertes_cles: string | null; remarque: string | null
  maturite_client: string | null; urgence: string | null; source_client: string | null
  phase: string | null; phase_active: string | null
  co_id: string | null; commercial_id: string | null; economiste_id: string | null; dessinatrice_id: string | null
  clients_supplementaires: any | null; date_signature: string | null; apporteur_affaire: string | null
}

type Utilisateur = { id: string; prenom: string; nom: string; role: string; email: string | null }

type Document = {
  id: string; nom_fichier: string; storage_path: string; type_doc: string | null
  categorie: string | null; dossier_ged: string | null; created_at: string
  message_depot: string | null
}

type Proposition = {
  id: string; projet_id: string; numero: number; type: string | null; statut: string | null
  plan_url: string | null; plan_3d_url: string | null
  montant_total_ht: number | null; montant_ht: number | null
  is_archived: boolean | null; verrouillee_apres_signature: boolean | null
  date_envoi: string | null; commentaire_client: string | null
}

type DessinPlan = {
  id: string; projet_nom: string; phase: string; type_plan: string; indice: string | null
  statut: string; lot: string | null; fichier_path: string | null; fichier_nom: string | null
  created_at: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LancementPage() {
  const supabase = useMemo(() => createClient(), [])
  const { user } = useUser()

  const [projets, setProjets]     = useState<Projet[]>([])
  const [users, setUsers]         = useState<Utilisateur[]>([])
  const [loading, setLoading]     = useState(true)
  const [selProjet, setSelProjet] = useState<Projet | null>(null)
  const [crDocs, setCrDocs]       = useState<Document[]>([])
  const [loadingCr, setLoadingCr] = useState(false)
  const [propositions, setPropositions] = useState<Proposition[]>([])
  const [dessinPlans, setDessinPlans]   = useState<DessinPlan[]>([])
  const [allDocs, setAllDocs]           = useState<Document[]>([])
  const [loadingResources, setLoadingResources] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: pData }, { data: uData }] = await Promise.all([
        supabase.schema('app').from('projets').select('*').order('created_at', { ascending: false }),
        supabase.schema('app').from('utilisateurs').select('id, prenom, nom, role, email').eq('actif', true),
      ])
      setProjets((pData ?? []) as Projet[])
      setUsers((uData ?? []) as Utilisateur[])
      setLoading(false)
    }
    load()
  }, [supabase])

  // Charger les CR quand on selectionne un projet
  useEffect(() => {
    if (!selProjet) { setCrDocs([]); setPropositions([]); setDessinPlans([]); setAllDocs([]); return }
    setLoadingCr(true)
    setLoadingResources(true)
    supabase.schema('app').from('documents')
      .select('*')
      .eq('projet_id', selProjet.id)
      .or('type_doc.eq.cr,dossier_ged.eq.comptes-rendus,categorie.eq.reunion')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setCrDocs((data ?? []) as Document[])
        setLoadingCr(false)
      })

    Promise.all([
      supabase.schema('app').from('propositions').select('*').eq('projet_id', selProjet.id).order('numero'),
      supabase.schema('app').from('dessin_plans').select('*').eq('projet_nom', selProjet.nom).order('created_at', { ascending: false }),
      supabase.schema('app').from('documents').select('*').eq('projet_id', selProjet.id).order('created_at', { ascending: false }),
    ]).then(([propRes, plansRes, docsRes]) => {
      setPropositions((propRes.data ?? []) as Proposition[])
      setDessinPlans((plansRes.data ?? []) as DessinPlan[])
      setAllDocs((docsRes.data ?? []) as Document[])
      setLoadingResources(false)
    })
  }, [selProjet?.id])

  function getFileUrl(path: string) {
    return supabase.storage.from('projets').getPublicUrl(path).data.publicUrl
  }

  function findUser(id: string | null) {
    if (!id) return null
    return users.find(u => u.id === id) ?? null
  }

  function parseRemarque(remarque: string | null): Record<string, any> {
    if (!remarque) return {}
    try { return JSON.parse(remarque) } catch { return {} }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Lancement" subtitle="Fiches projet et reunions de lancement" />
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="Lancement" subtitle="Infos commerciales et reunions de lancement pour preparer l'imagination" />

      <div className="px-6 pt-4 pb-8 flex gap-4">
        {/* ── Liste projets ── */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-700">{projets.length} projet{projets.length !== 1 ? 's' : ''}</h3>
          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
            {projets.map(p => {
              const isActive = selProjet?.id === p.id
              return (
                <button key={p.id} onClick={() => setSelProjet(p)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isActive ? 'border-gray-900 bg-gray-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.nom}</p>
                      {p.reference && <p className="text-xs text-gray-400 font-mono">{p.reference}</p>}
                      {p.client_nom && <p className="text-xs text-gray-500 mt-0.5">{p.client_nom}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {p.type_chantier && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{p.type_chantier}</span>
                      )}
                      {p.urgence === 'oui' && (
                        <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">Urgent</span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Detail ── */}
        <div className="flex-1 min-w-0">
          {selProjet ? (
            <ProjetDetail
              projet={selProjet}
              users={users}
              findUser={findUser}
              parseRemarque={parseRemarque}
              crDocs={crDocs}
              loadingCr={loadingCr}
              propositions={propositions}
              dessinPlans={dessinPlans}
              allDocs={allDocs}
              loadingResources={loadingResources}
              getFileUrl={getFileUrl}
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 h-80 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Rocket className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Selectionnez un projet</p>
                <p className="text-xs mt-1">pour voir la fiche commerciale et les notes de reunion</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ProjetDetail ─────────────────────────────────────────────────────────────

function ProjetDetail({ projet, users, findUser, parseRemarque, crDocs, loadingCr, propositions, dessinPlans, allDocs, loadingResources, getFileUrl }: {
  projet: Projet; users: Utilisateur[]
  findUser: (id: string | null) => Utilisateur | null
  parseRemarque: (r: string | null) => Record<string, any>
  crDocs: Document[]; loadingCr: boolean
  propositions: Proposition[]
  dessinPlans: DessinPlan[]
  allDocs: Document[]
  loadingResources: boolean
  getFileUrl: (path: string) => string
}) {
  const [section, setSection] = useState<'fiche' | 'reunion' | 'ressources'>('fiche')
  const remarque = parseRemarque(projet.remarque)

  const co = findUser(projet.co_id)
  const commercial = findUser(projet.commercial_id)
  const economiste = findUser(projet.economiste_id)

  const clientsSupp = Array.isArray(projet.clients_supplementaires) ? projet.clients_supplementaires : []

  return (
    <div className="space-y-4">
      {/* En-tete projet */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {projet.reference && <span className="text-xs text-gray-400 font-mono">{projet.reference}</span>}
              {projet.type_chantier && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{projet.type_chantier}</span>}
              {projet.urgence === 'oui' && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">Urgent</span>}
              {projet.maturite_client && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">{projet.maturite_client}</span>}
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{projet.nom}</h2>
          </div>
          {projet.budget_total && (
            <p className="text-lg font-semibold text-gray-900">{formatCurrency(projet.budget_total)}</p>
          )}
        </div>

        {/* Infos cles en grille */}
        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
          <InfoCell icon={User} label="Client" value={projet.client_nom} />
          <InfoCell icon={MapPin} label="Adresse" value={projet.adresse} />
          <InfoCell icon={Ruler} label="Surface" value={projet.surface_m2 ? `${projet.surface_m2} m2` : null} />
          <InfoCell icon={Calendar} label="Livraison" value={projet.date_livraison ? new Date(projet.date_livraison).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : null} />
        </div>
      </div>

      {/* Tabs fiche / reunion / ressources */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setSection('fiche')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${section === 'fiche' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <ClipboardList className="w-3.5 h-3.5 inline mr-1.5" />Fiche commerciale
        </button>
        <button onClick={() => setSection('reunion')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${section === 'reunion' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Megaphone className="w-3.5 h-3.5 inline mr-1.5" />Reunion de lancement
          {crDocs.length > 0 && <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded-full">{crDocs.length}</span>}
        </button>
        <button onClick={() => setSection('ressources')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${section === 'ressources' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Layers className="w-3.5 h-3.5 inline mr-1.5" />Ressources
          {(propositions.length + dessinPlans.length + allDocs.length) > 0 && (
            <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded-full">
              {propositions.length + dessinPlans.length + allDocs.length}
            </span>
          )}
        </button>
      </div>

      {section === 'fiche' && (
        <div className="space-y-4">
          {/* ── Client & Contact ── */}
          <Section icon={User} title="Client & Contact">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Nom / Raison sociale</p>
                <p className="text-sm text-gray-900 font-medium">{projet.client_nom || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Email</p>
                <p className="text-sm text-gray-700">{projet.client_email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Telephone</p>
                <p className="text-sm text-gray-700">{projet.client_tel || '—'}</p>
              </div>
            </div>
            {clientsSupp.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">Contacts supplementaires</p>
                <div className="space-y-1">
                  {clientsSupp.map((c: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-gray-700 font-medium">{c.nom || '—'}</span>
                      {c.email && <span className="text-gray-500">{c.email}</span>}
                      {c.tel && <span className="text-gray-400">{c.tel}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* ── Projet ── */}
          <Section icon={Building2} title="Details du projet">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Type de chantier</p>
                <p className="text-sm text-gray-900 font-medium">{projet.type_chantier || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Surface</p>
                <p className="text-sm text-gray-700">{projet.surface_m2 ? `${projet.surface_m2} m2` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Adresse chantier</p>
                <p className="text-sm text-gray-700">{projet.adresse || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Source client</p>
                <p className="text-sm text-gray-700">{projet.source_client || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Apporteur d'affaires</p>
                <p className="text-sm text-gray-700">{projet.apporteur_affaire || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Maturite du projet</p>
                <p className="text-sm text-gray-700">{projet.maturite_client || '—'}</p>
              </div>
            </div>
            {/* Foncier & reglementaire depuis remarque */}
            {(remarque.foncier || remarque.surface_fonciere || remarque.contraintes) && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">Foncier & Reglementaire</p>
                <div className="grid grid-cols-3 gap-4">
                  {remarque.foncier && <div><p className="text-xs text-gray-400 mb-0.5">Foncier</p><p className="text-sm text-gray-700">{remarque.foncier}</p></div>}
                  {remarque.surface_fonciere && <div><p className="text-xs text-gray-400 mb-0.5">Surface fonciere</p><p className="text-sm text-gray-700">{remarque.surface_fonciere} m2</p></div>}
                  {remarque.contraintes && <div><p className="text-xs text-gray-400 mb-0.5">Contraintes</p><p className="text-sm text-gray-700">{Array.isArray(remarque.contraintes) ? remarque.contraintes.join(', ') : remarque.contraintes}</p></div>}
                </div>
              </div>
            )}
          </Section>

          {/* ── Budget & Planning ── */}
          <Section icon={Banknote} title="Budget & Planning">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Budget travaux</p>
                <p className="text-sm text-gray-900 font-semibold">{projet.budget_total ? formatCurrency(projet.budget_total) : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Date de debut</p>
                <p className="text-sm text-gray-700">{projet.date_debut ? new Date(projet.date_debut).toLocaleDateString('fr-FR') : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Date de livraison</p>
                <p className="text-sm text-gray-700">{projet.date_livraison ? new Date(projet.date_livraison).toLocaleDateString('fr-FR') : '—'}</p>
              </div>
              {projet.date_signature && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Date signature</p>
                  <p className="text-sm text-gray-700">{new Date(projet.date_signature).toLocaleDateString('fr-FR')}</p>
                </div>
              )}
              {remarque.financement && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Financement</p>
                  <p className="text-sm text-gray-700">{remarque.financement}</p>
                </div>
              )}
              {remarque.honoraires && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Honoraires HT</p>
                  <p className="text-sm text-gray-700">{formatCurrency(Number(remarque.honoraires))}</p>
                </div>
              )}
            </div>
          </Section>

          {/* ── Psychologie client ── */}
          {projet.psychologie_client && (
            <Section icon={Brain} title="Psychologie client" color="violet">
              <p className="text-sm text-violet-800 whitespace-pre-line leading-relaxed">{projet.psychologie_client}</p>
            </Section>
          )}

          {/* ── Alertes & Vigilances ── */}
          {projet.alertes_cles && (
            <Section icon={ShieldAlert} title="Alertes & Points de vigilance" color="amber">
              <p className="text-sm text-amber-800 whitespace-pre-line leading-relaxed">{projet.alertes_cles}</p>
            </Section>
          )}

          {/* ── Infos hors contrat ── */}
          {projet.infos_hors_contrat && (
            <Section icon={Eye} title="Infos hors contrat (confidentiel)" color="red">
              <p className="text-sm text-red-800 whitespace-pre-line leading-relaxed">{projet.infos_hors_contrat}</p>
            </Section>
          )}

          {/* ── Equipe projet ── */}
          <Section icon={Users} title="Equipe projet">
            <div className="grid grid-cols-4 gap-4">
              <TeamMember label="Commercial" user={commercial} />
              <TeamMember label="Charge d'operations" user={co} />
              <TeamMember label="Economiste" user={economiste} />
              <TeamMember label="Dessinatrice" user={findUser(projet.dessinatrice_id)} />
            </div>
          </Section>
        </div>
      )}

      {section === 'reunion' && (
        /* ── Reunion de lancement ── */
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-blue-700">Reunion de lancement</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Le commercial enregistre la reunion de lancement et un <Abbr k="CR" /> est genere automatiquement avec des notes specifiques par pole.
                Consultez les documents ci-dessous pour retrouver le <Abbr k="CR" /> et les elements utiles a l'imagination du projet.
              </p>
            </div>
          </div>

          {/* Points cles pour la dessinatrice */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-gray-500" /> Points cles pour l'imagination
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <KeyPoint label="Type de chantier" value={projet.type_chantier} />
              <KeyPoint label="Surface" value={projet.surface_m2 ? `${projet.surface_m2} m2` : null} />
              <KeyPoint label="Maturite client" value={projet.maturite_client} />
              <KeyPoint label="Urgence" value={projet.urgence === 'oui' ? 'Oui — delais serres' : 'Non'} />
              <KeyPoint label="Budget" value={projet.budget_total ? formatCurrency(projet.budget_total) : null} />
              <KeyPoint label="Livraison" value={projet.date_livraison ? new Date(projet.date_livraison).toLocaleDateString('fr-FR') : null} />
            </div>
            {projet.psychologie_client && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-violet-700 mb-1">Profil client</p>
                <p className="text-xs text-violet-600 whitespace-pre-line">{projet.psychologie_client}</p>
              </div>
            )}
            {projet.alertes_cles && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-amber-700 mb-1">Alertes</p>
                <p className="text-xs text-amber-600 whitespace-pre-line">{projet.alertes_cles}</p>
              </div>
            )}
          </div>

          {/* Comptes-rendus de reunion */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-gray-500" /> Comptes-rendus de reunion
            </h4>

            {loadingCr ? (
              <p className="text-sm text-gray-400 text-center py-6">Chargement...</p>
            ) : crDocs.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Aucun <Abbr k="CR" /> disponible pour le moment</p>
                <p className="text-xs text-gray-300 mt-1">Le commercial deposera le <Abbr k="CR" /> apres la reunion de lancement</p>
              </div>
            ) : (
              <div className="space-y-2">
                {crDocs.map(doc => (
                  <a key={doc.id} href={getFileUrl(doc.storage_path)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                    <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.nom_fichier}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {doc.type_doc && <span className="text-xs text-gray-400">{doc.type_doc}</span>}
                        {doc.message_depot && <span className="text-xs text-gray-400 truncate">— {doc.message_depot}</span>}
                        <span className="text-xs text-gray-300">
                          {new Date(doc.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {section === 'ressources' && (
        <RessourcesPanel
          projet={projet}
          propositions={propositions}
          dessinPlans={dessinPlans}
          allDocs={allDocs}
          loading={loadingResources}
          getFileUrl={getFileUrl}
        />
      )}
    </div>
  )
}

// ─── Panneau Ressources : chiffrage, plans, documents partagés ──────────────

function RessourcesPanel({ projet, propositions, dessinPlans, allDocs, loading, getFileUrl }: {
  projet: Projet
  propositions: Proposition[]
  dessinPlans: DessinPlan[]
  allDocs: Document[]
  loading: boolean
  getFileUrl: (path: string) => string
}) {
  const pathname = usePathname()
  const roleBase = pathname?.split('/')[1] ?? 'dessin'

  const propActive = propositions.find(p => !p.is_archived) ?? propositions[propositions.length - 1] ?? null
  const propAcceptees = propositions.filter(p => p.statut === 'acceptee')
  const propsToShow = propositions.length ? propositions : []

  // Plans groupes par type_plan
  const plansByType: Record<string, DessinPlan[]> = {}
  for (const p of dessinPlans) {
    const k = p.type_plan
    if (!plansByType[k]) plansByType[k] = []
    plansByType[k].push(p)
  }

  // Documents : exclure les CR deja affiches dans l'onglet Reunion
  const docsPartages = allDocs.filter(d => {
    const t = (d.type_doc ?? '').toLowerCase()
    const ged = (d.dossier_ged ?? '').toLowerCase()
    const cat = (d.categorie ?? '').toLowerCase()
    return !(t === 'cr' || ged === 'comptes-rendus' || cat === 'reunion')
  })

  if (loading) {
    return <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">Chargement des ressources...</div>
  }

  return (
    <div className="space-y-4">
      {/* Chiffrage */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-emerald-600" /> Chiffrage
          </h4>
          <Link href={`/${roleBase}/projets/${projet.id}`}
            className="text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">
            Ouvrir la fiche projet <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {propsToShow.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Aucune proposition pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {propsToShow.map(p => {
              const isAPD = p.type === 'finale'
              const labelV = isAPD ? 'APD' : `V${p.numero}`
              const montant = p.montant_total_ht ?? p.montant_ht
              const statutCls = p.statut === 'acceptee' ? 'bg-green-100 text-green-700' :
                p.statut === 'refusee' ? 'bg-red-100 text-red-700' :
                p.statut === 'envoyee' ? 'bg-blue-100 text-blue-700' :
                p.statut === 'en_negociation' ? 'bg-amber-100 text-amber-700' :
                'bg-gray-100 text-gray-600'
              return (
                <div key={p.id} className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                  p.is_archived ? 'border-gray-100 bg-gray-50 opacity-70' : 'border-gray-200 bg-white'
                }`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-gray-900 text-white flex-shrink-0">{labelV}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statutCls}`}>{p.statut ?? '—'}</span>
                    {p.verrouillee_apres_signature && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">Signe</span>
                    )}
                    {p.date_envoi && (
                      <span className="text-xs text-gray-400">envoye le {new Date(p.date_envoi).toLocaleDateString('fr-FR')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {montant != null && (
                      <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(montant)} HT</span>
                    )}
                    {p.plan_url && (
                      <a href={p.plan_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Plan
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
            {propActive?.commentaire_client && (
              <div className="p-2 bg-amber-50 border border-amber-100 rounded text-xs text-amber-800">
                <span className="font-semibold">Retour client : </span>{propActive.commentaire_client}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Plans existants */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Pencil className="w-4 h-4 text-violet-600" /> Plans
            <span className="text-xs text-gray-400">({dessinPlans.length})</span>
          </h4>
          <Link href={`/${roleBase}/projets/${projet.id}`}
            className="text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">
            Gerer les plans <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {dessinPlans.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Aucun plan pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(plansByType).map(([type, items]) => {
              const tab = (['APS','APD','PC','AT','DCE','EXE','DOE','avenant'].includes(type)) ? type : 'APS'
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{type}</span>
                    <span className="text-xs text-gray-400">({items.length})</span>
                    <Link href={`/${roleBase}/projets/${projet.id}?tab=${tab}`} className="ml-auto text-xs text-blue-600 hover:underline">Ouvrir l&apos;onglet</Link>
                  </div>
                  <div className="space-y-1">
                    {items.slice(0, 4).map(p => (
                      <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100 text-sm">
                        <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-700 truncate flex-1">
                          Indice {p.indice ?? '—'}{p.lot ? ` · ${p.lot}` : ''} — {p.fichier_nom ?? 'sans fichier'}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                          p.statut === 'valide' ? 'bg-green-100 text-green-700' :
                          p.statut === 'soumis' ? 'bg-blue-100 text-blue-700' :
                          p.statut === 'refuse' ? 'bg-red-100 text-red-700' :
                          p.statut === 'archive' ? 'bg-gray-100 text-gray-500' :
                          'bg-amber-100 text-amber-700'
                        }`}>{p.statut}</span>
                        {p.fichier_path && (
                          <a href={getFileUrl(p.fichier_path)} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline">Ouvrir</a>
                        )}
                      </div>
                    ))}
                    {items.length > 4 && (
                      <p className="text-xs text-gray-400 italic px-2">+{items.length - 4} autres plans</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Documents partagés */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-blue-600" /> Documents partages
            <span className="text-xs text-gray-400">({docsPartages.length})</span>
          </h4>
          <Link href={`/${roleBase}/documents`} className="text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">
            Toute la GED <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {docsPartages.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Aucun document partage pour le moment.</p>
        ) : (
          <div className="space-y-1.5">
            {docsPartages.slice(0, 12).map(doc => (
              <a key={doc.id} href={getFileUrl(doc.storage_path)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors text-sm">
                <FileText className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <span className="text-gray-800 truncate flex-1">{doc.nom_fichier}</span>
                {doc.type_doc && <span className="text-xs text-gray-400 flex-shrink-0">{doc.type_doc}</span>}
                <span className="text-xs text-gray-300 flex-shrink-0">
                  {new Date(doc.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </span>
                <Download className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              </a>
            ))}
            {docsPartages.length > 12 && (
              <p className="text-xs text-gray-400 italic">+{docsPartages.length - 12} autres documents</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Composants utilitaires ───────────────────────────────────────────────────

function Section({ icon: Icon, title, color, children }: {
  icon: any; title: string; color?: 'violet' | 'amber' | 'red'; children: React.ReactNode
}) {
  const bgColor = color === 'violet' ? 'bg-violet-50 border-violet-100' :
                  color === 'amber'  ? 'bg-amber-50 border-amber-100' :
                  color === 'red'    ? 'bg-red-50 border-red-100' :
                  'bg-white border-gray-200'
  const iconColor = color === 'violet' ? 'text-violet-500' :
                    color === 'amber'  ? 'text-amber-500' :
                    color === 'red'    ? 'text-red-500' :
                    'text-gray-500'
  const titleColor = color === 'violet' ? 'text-violet-800' :
                     color === 'amber'  ? 'text-amber-800' :
                     color === 'red'    ? 'text-red-800' :
                     'text-gray-900'

  return (
    <div className={`rounded-xl border p-5 ${bgColor}`}>
      <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${titleColor}`}>
        <Icon className={`w-4 h-4 ${iconColor}`} /> {title}
      </h4>
      {children}
    </div>
  )
}

function InfoCell({ icon: Icon, label, value }: { icon: any; label: string; value: string | null }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="w-3 h-3 text-gray-400" />
        <p className="text-xs text-gray-400">{label}</p>
      </div>
      <p className="text-sm text-gray-700">{value || '—'}</p>
    </div>
  )
}

function TeamMember({ label, user }: { label: string; user: Utilisateur | null }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      {user ? (
        <div>
          <p className="text-sm font-medium text-gray-900">{user.prenom} {user.nom}</p>
          <p className="text-xs text-gray-400">{user.role}</p>
        </div>
      ) : (
        <p className="text-sm text-gray-300 italic">Non assigne</p>
      )}
    </div>
  )
}

function KeyPoint({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="p-2.5 bg-gray-50 rounded-lg">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value || '—'}</p>
    </div>
  )
}
