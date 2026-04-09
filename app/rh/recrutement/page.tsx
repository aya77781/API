'use client'

import { useEffect, useState } from 'react'
import { Plus, Loader2, X, FileText, Upload, ExternalLink, Briefcase, Users, X as XIcon, Pencil, Trash2, UserPlus } from 'lucide-react'

const TAG_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-rose-100 text-rose-700 border-rose-200',
]
function tagColor(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return TAG_COLORS[Math.abs(h) % TAG_COLORS.length]
}

const POLES = [
  { value: 'CO',           label: 'Conduite de travaux (CO)' },
  { value: 'AT',           label: 'Assistant de travaux (AT)' },
  { value: 'Economiste',   label: 'Économiste' },
  { value: 'Dessinatrice', label: 'Dessin / BIM' },
  { value: 'Commercial',   label: 'Commercial' },
  { value: 'Comptable',    label: 'Comptabilité' },
  { value: 'RH',           label: 'Ressources humaines' },
  { value: 'CHO',          label: 'Happiness Officer (CHO)' },
  { value: 'Gerant',       label: 'Gérance' },
  { value: 'Admin',        label: 'Administration' },
  { value: 'Autre',        label: 'Autre' },
]
const POLE_VALUES = POLES.map(p => p.value)
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/co/TopBar'

type FicheMetier = {
  id: string
  titre: string
  pole: string | null
  description: string | null
  competences_cles: string[] | null
  actif: boolean
}
type Candidat = {
  id: string
  nom: string
  prenom: string
  email: string | null
  telephone: string | null
  pole_cible: string | null
  matching_pct: number | null
  cv_url: string | null
  statut: string | null
  created_at: string
}

const STATUTS_CANDIDAT = [
  { value: 'nouveau',             label: 'Nouveau' },
  { value: 'en_etude',            label: 'En étude' },
  { value: 'entretien_planifie',  label: 'Entretien planifié' },
  { value: 'entretien_fait',      label: 'Entretien fait' },
  { value: 'offre_envoyee',       label: 'Offre envoyée' },
  { value: 'recrute',             label: 'Recruté' },
  { value: 'refuse',              label: 'Refusé' },
]

const CV_WEBHOOK = 'https://apiprojet.app.n8n.cloud/webhook/api-renovation-cv-rh'

function matchingColor(pct: number | null) {
  if (pct == null) return 'bg-gray-100 text-gray-600 border-gray-200'
  if (pct > 70)    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (pct >= 50)   return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-gray-100 text-gray-600 border-gray-200'
}

export default function RecrutementPage() {
  const supabase = createClient()
  const [fiches, setFiches] = useState<FicheMetier[]>([])
  const [candidats, setCandidats] = useState<Candidat[]>([])
  const [loading, setLoading] = useState(true)
  const [showFicheModal, setShowFicheModal] = useState(false)
  const [editFiche, setEditFiche] = useState<FicheMetier | null>(null)
  const [showCvModal, setShowCvModal] = useState(false)
  const [convertCandidat, setConvertCandidat] = useState<Candidat | null>(null)

  async function deleteFiche(id: string) {
    if (!confirm('Supprimer cette fiche de poste ?')) return
    await supabase.from('fiches_metiers').delete().eq('id', id)
    load()
  }

  async function load() {
    setLoading(true)
    const [f, c] = await Promise.all([
      supabase.from('fiches_metiers').select('*').eq('actif', true).order('titre'),
      supabase.from('candidats').select('*').order('created_at', { ascending: false }),
    ])
    setFiches((f.data ?? []) as FicheMetier[])
    setCandidats((c.data ?? []) as Candidat[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function updateStatut(id: string, statut: string) {
    await supabase.from('candidats').update({ statut }).eq('id', id)
    setCandidats(cs => cs.map(c => c.id === id ? { ...c, statut } : c))
    if (statut === 'recrute') {
      const c = candidats.find(x => x.id === id)
      if (c) setConvertCandidat({ ...c, statut: 'recrute' })
    }
  }

  return (
    <div>
      <TopBar title="Recrutement" subtitle="Identification, sourcing et présélection" />
      <div className="p-6 space-y-8">
        {/* Fiches de postes */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">Fiches de postes</h2>
              <span className="text-xs text-gray-400">{fiches.length}</span>
            </div>
            <button
              onClick={() => setShowFicheModal(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
            >
              <Plus className="w-4 h-4" /> Nouveau poste
            </button>
          </div>

          {loading ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <Loader2 className="w-5 h-5 text-gray-400 mx-auto animate-spin" />
            </div>
          ) : fiches.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
              Aucune fiche de poste active
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {fiches.map(f => (
                <div key={f.id} className="group bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition relative">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 flex-1">{f.titre}</h3>
                    {f.pole && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded flex-shrink-0">{f.pole}</span>
                    )}
                  </div>
                  {f.description && (
                    <p className="text-xs text-gray-500 line-clamp-3 whitespace-pre-line">{f.description}</p>
                  )}
                  {f.competences_cles && f.competences_cles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {f.competences_cles.map(c => (
                        <span key={c} className={`text-xs px-2 py-0.5 rounded border font-medium ${tagColor(c)}`}>
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => setEditFiche(f)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                    >
                      <Pencil className="w-3 h-3" /> Modifier
                    </button>
                    <button
                      onClick={() => deleteFiche(f.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-3 h-3" /> Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Candidats */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">Candidats reçus</h2>
              <span className="text-xs text-gray-400">{candidats.length}</span>
            </div>
            <button
              onClick={() => setShowCvModal(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
            >
              <Upload className="w-4 h-4" /> Importer un CV
            </button>
          </div>

          {loading ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <Loader2 className="w-5 h-5 text-gray-400 mx-auto animate-spin" />
            </div>
          ) : candidats.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Les CV reçus par mail apparaîtront automatiquement ici</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-left text-xs font-medium text-gray-500">
                    <th className="px-4 py-3">Nom</th>
                    <th className="px-4 py-3">Prénom</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Téléphone</th>
                    <th className="px-4 py-3">Pôle ciblé</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3"></th>
                    <th className="px-4 py-3">CV</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {candidats.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.nom}</td>
                      <td className="px-4 py-3 text-gray-700">{c.prenom}</td>
                      <td className="px-4 py-3 text-gray-600">{c.email ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.telephone ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.pole_cible ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${matchingColor(c.matching_pct)}`}>
                          {c.matching_pct != null ? `${c.matching_pct}%` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={c.statut ?? 'nouveau'}
                          onChange={(e) => updateStatut(c.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
                        >
                          {STATUTS_CANDIDAT.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {c.statut === 'recrute' && (
                          <button
                            onClick={() => setConvertCandidat(c)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-600 text-white hover:bg-emerald-700 rounded font-medium"
                            title="Convertir en employé"
                          >
                            <UserPlus className="w-3 h-3" /> Convertir
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.cv_url ? (
                          <button
                            onClick={() => window.open(c.cv_url!, '_blank')}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            Voir <ExternalLink className="w-3 h-3" />
                          </button>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(c.created_at).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showFicheModal && (
        <FicheModal
          onClose={() => setShowFicheModal(false)}
          onSaved={() => { setShowFicheModal(false); load() }}
        />
      )}
      {editFiche && (
        <FicheModal
          fiche={editFiche}
          onClose={() => setEditFiche(null)}
          onSaved={() => { setEditFiche(null); load() }}
        />
      )}
      {showCvModal && (
        <CvImportModal
          onClose={() => setShowCvModal(false)}
          onSaved={() => { setShowCvModal(false); load() }}
        />
      )}
      {convertCandidat && (
        <ConvertModal
          candidat={convertCandidat}
          onClose={() => setConvertCandidat(null)}
          onSaved={() => { setConvertCandidat(null); load() }}
        />
      )}
    </div>
  )
}

function ConvertModal({ candidat, onClose, onSaved }: { candidat: Candidat; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [poste, setPoste] = useState(candidat.pole_cible ?? '')
  const [dateEntree, setDateEntree] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function convert() {
    setError(null)
    if (!poste.trim()) { setError('Poste requis'); return }
    if (!dateEntree)   { setError('Date d\'entrée requise'); return }
    setSaving(true)
    const { error: err } = await supabase.from('employes').insert({
      nom:         candidat.nom,
      prenom:      candidat.prenom,
      email:       candidat.email,
      poste:       poste.trim(),
      date_entree: dateEntree,
      actif:       true,
    })
    if (err) { setError(err.message); setSaving(false); return }
    // Marque le candidat comme recruté (au cas où on a cliqué le bouton sans changer le select)
    await supabase.from('candidats').update({ statut: 'recrute' }).eq('id', candidat.id)
    setSaving(false)
    setSuccess(true)
    setTimeout(onSaved, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Convertir en employé</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {success ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                <UserPlus className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-gray-900">{candidat.prenom} {candidat.nom} a été ajouté(e) à l'équipe</p>
              <p className="text-xs text-gray-500 mt-1">Visible dans Onboarding pendant 3 mois</p>
            </div>
          ) : (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1">
                <p><span className="text-gray-500">Nom :</span> <span className="font-medium text-gray-900">{candidat.prenom} {candidat.nom}</span></p>
                {candidat.email && <p><span className="text-gray-500">Email :</span> <span className="text-gray-700">{candidat.email}</span></p>}
                {candidat.pole_cible && <p><span className="text-gray-500">Pôle ciblé :</span> <span className="text-gray-700">{candidat.pole_cible}</span></p>}
              </div>
              <Field label="Poste">
                <input value={poste} onChange={e => setPoste(e.target.value)} className="rh-input" />
              </Field>
              <Field label="Date d'entrée">
                <input type="date" value={dateEntree} onChange={e => setDateEntree(e.target.value)} className="rh-input" />
              </Field>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <p className="text-xs text-gray-500">L'employé sera créé dans la table <code className="px-1 py-0.5 bg-gray-100 rounded">employes</code> et apparaîtra automatiquement dans <code className="px-1 py-0.5 bg-gray-100 rounded">/rh/onboarding</code>.</p>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
                <button onClick={convert} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <UserPlus className="w-4 h-4" /> Créer l'employé
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <style jsx global>{`
        .rh-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          border: 1px solid rgb(229 231 235);
          border-radius: 0.5rem;
          background: white;
        }
        .rh-input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgb(17 24 39 / 0.1);
        }
      `}</style>
    </div>
  )
}

function FicheModal({ fiche, onClose, onSaved }: { fiche?: FicheMetier; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!fiche
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [titre, setTitre] = useState(fiche?.titre ?? '')
  const initialPoleKnown = fiche?.pole && POLE_VALUES.includes(fiche.pole)
  const [poleSelect, setPoleSelect] = useState(
    fiche?.pole ? (initialPoleKnown ? fiche.pole : 'Autre') : ''
  )
  const [poleAutre, setPoleAutre] = useState('')
  const [description, setDescription] = useState(fiche?.description ?? '')
  const [competences, setCompetences] = useState<string[]>(fiche?.competences_cles ?? [])
  const [tagInput, setTagInput] = useState('')

  function addTag() {
    const v = tagInput.trim()
    if (!v) return
    if (!competences.includes(v)) setCompetences([...competences, v])
    setTagInput('')
  }
  function removeTag(t: string) {
    setCompetences(competences.filter(x => x !== t))
  }

  async function save() {
    setError(null)
    if (!titre.trim()) { setError('Titre requis'); return }
    setSaving(true)
    const descFinal = poleSelect === 'Autre' && poleAutre.trim()
      ? `Pôle : ${poleAutre.trim()}\n\n${description}`.trim()
      : description.trim()
    const payload = {
      titre: titre.trim(),
      pole: poleSelect || null,
      description: descFinal || null,
      competences_cles: competences.length ? competences : null,
      actif: true,
    }
    const { error: err } = isEdit
      ? await supabase.from('fiches_metiers').update(payload).eq('id', fiche!.id)
      : await supabase.from('fiches_metiers').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Modifier la fiche de poste' : 'Nouvelle fiche de poste'} onClose={onClose}>
      <Field label="Titre">
        <input value={titre} onChange={e => setTitre(e.target.value)} className="rh-input" />
      </Field>
      <Field label="Pôle">
        <select value={poleSelect} onChange={e => setPoleSelect(e.target.value)} className="rh-input">
          <option value="">— Sélectionner —</option>
          {POLES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Field>
      {poleSelect === 'Autre' && (
        <Field label="Préciser le pôle (ajouté à la description)">
          <input
            value={poleAutre}
            onChange={e => setPoleAutre(e.target.value)}
            className="rh-input"
            placeholder="Nom du pôle..."
          />
        </Field>
      )}
      <Field label="Description">
        <textarea value={description} onChange={e => setDescription(e.target.value)} className="rh-input" rows={3} />
      </Field>
      <Field label="Compétences clés">
        <div className="rh-input min-h-[2.5rem] flex flex-wrap items-center gap-1.5 py-1.5">
          {competences.map(t => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-900 text-white text-xs font-medium rounded"
            >
              {t}
              <button
                type="button"
                onClick={() => removeTag(t)}
                className="hover:text-gray-300"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); addTag() }
              else if (e.key === 'Backspace' && !tagInput && competences.length) {
                setCompetences(competences.slice(0, -1))
              }
            }}
            placeholder={competences.length ? '' : 'Tapez un mot-clé puis Entrée...'}
            className="flex-1 min-w-[8rem] outline-none border-0 p-0 text-sm bg-transparent"
          />
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Appuyez sur Entrée pour ajouter, Backspace pour supprimer le dernier</p>
      </Field>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Enregistrer
        </button>
      </div>
    </Modal>
  )
}

function CvImportModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [emailFrom, setEmailFrom] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    setError(null)
    if (!file) { setError('Fichier requis'); return }
    setSending(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('emailFrom', emailFrom)
      fd.append('emailSubject', emailSubject)
      const res = await fetch(CV_WEBHOOK, { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`Webhook a renvoyé ${res.status}`)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal title="Importer un CV" onClose={onClose}>
      <Field label="Fichier (PDF/DOCX)">
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="rh-input"
        />
      </Field>
      <Field label="Email expéditeur">
        <input value={emailFrom} onChange={e => setEmailFrom(e.target.value)} className="rh-input" />
      </Field>
      <Field label="Sujet">
        <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="rh-input" />
      </Field>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
        <button onClick={send} disabled={sending} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
          {sending && <Loader2 className="w-4 h-4 animate-spin" />} Envoyer
        </button>
      </div>
    </Modal>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {children}
        </div>
      </div>
      <style jsx global>{`
        .rh-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          border: 1px solid rgb(229 231 235);
          border-radius: 0.5rem;
          background: white;
        }
        .rh-input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgb(17 24 39 / 0.1);
        }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
