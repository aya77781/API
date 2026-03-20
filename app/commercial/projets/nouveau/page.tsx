'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, Upload, X, Paperclip, Star } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { createProject, uploadProjectFile } from '@/hooks/useProjects'
import { fetchUsersByRole } from '@/hooks/useUsers'
import { cn } from '@/lib/utils'
import type { Utilisateur } from '@/types/database'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FormStep1 {
  nom: string
  client_nom: string
  client_email: string
  client_tel: string
  client_type: string
  adresse: string
  type_chantier: string
  budget: string
}

interface UploadedFile {
  file: File
  slot: string
}

interface Questionnaire {
  q1: string; q1_autre: string
  q2: string; q2_autre: string
  q3: string[]; q3_autre: string
  q4: string; q4_autre: string
  q5: string[]; q5_autre: string
  q6: string; q6_autre: string
  q7: string; q7_autre: string
  q8: string
}

interface FormStep4 {
  co_id: string
  economiste_id: string
  dessinatrice_id: string
  date_passation: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const TYPES_CLIENT = ['Particulier', 'SCI', 'SARL', 'SAS', 'SA', 'Association', 'Collectivité', 'Autre']
const TYPES_CHANTIER = ['Bureaux', 'ERP', 'Entrepôt', 'Commerce', 'Industrie', 'Logements', 'Équipement sportif', 'Autre']

const SLOTS = [
  { id: 'cahier-des-charges', label: 'Cahier des charges client', prioritaire: false },
  { id: 'devis', label: 'Devis / proposition initiale', prioritaire: false },
  { id: 'plan-apd', label: 'Plan de départ APD', prioritaire: false },
  { id: 'contrat', label: 'Contrat signé', prioritaire: true },
  { id: 'autres', label: 'Autres documents', prioritaire: false, multiple: true },
]

const STEPS = ['Dossier', 'Documents', 'Questionnaire', 'Validation']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatQuestionnaire(q: Questionnaire): { psychologie: string; alertes: string } {
  const comm = q.q1 === 'Autre (préciser)' ? q.q1_autre : q.q1
  const exigence = q.q2 === 'Autre (préciser)' ? q.q2_autre : q.q2

  const psychologie = [
    comm && `Communication : ${comm}`,
    exigence && `Niveau d'exigence : ${exigence}`,
    q.q4 && `Origine : ${q.q4 === 'Autre (préciser)' ? q.q4_autre : q.q4}`,
    q.q6 && `Bâtiment occupé : ${q.q6 === 'Autre (préciser)' ? q.q6_autre : q.q6}`,
  ]
    .filter(Boolean)
    .join('\n')

  const contraintesPlanning = q.q3
    .map((v) => (v === 'Autre (préciser)' ? q.q3_autre : v))
    .join(', ')

  const vigilances = q.q5
    .map((v) => (v === 'Autre (préciser)' ? q.q5_autre : v))
    .join(', ')

  const maturite = q.q7 === 'Autre (préciser)' ? q.q7_autre : q.q7

  const alertes = [
    contraintesPlanning && `Contraintes planning : ${contraintesPlanning}`,
    vigilances && `Points de vigilance : ${vigilances}`,
    maturite && `Maturité projet : ${maturite}`,
  ]
    .filter(Boolean)
    .join('\n')

  return { psychologie, alertes }
}

// ─── Composant Stepper ───────────────────────────────────────────────────────

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                  done
                    ? 'bg-emerald-500 text-white'
                    : active
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-400'
                )}
              >
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  'mt-1.5 text-xs font-medium',
                  active ? 'text-gray-900' : 'text-gray-400'
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'w-16 h-px mb-4 mx-2',
                  i < current ? 'bg-emerald-400' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Étape 1 ─────────────────────────────────────────────────────────────────

function Step1({
  data,
  onChange,
  onNext,
}: {
  data: FormStep1
  onChange: (d: Partial<FormStep1>) => void
  onNext: () => void
}) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-sm font-semibold text-gray-900">Nommer le dossier</h2>

      <Field label="Nom du projet" required>
        <input
          type="text"
          required
          value={data.nom}
          onChange={(e) => onChange({ nom: e.target.value })}
          placeholder="Ex : Rénovation bureaux Zone Industrielle"
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Nom / Raison sociale du client" required>
          <input
            type="text"
            required
            value={data.client_nom}
            onChange={(e) => onChange({ client_nom: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Type de client">
          <select
            value={data.client_type}
            onChange={(e) => onChange({ client_type: e.target.value })}
            className={inputClass}
          >
            <option value="">— Sélectionner —</option>
            {TYPES_CLIENT.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Email client">
          <input
            type="email"
            value={data.client_email}
            onChange={(e) => onChange({ client_email: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Téléphone client">
          <input
            type="tel"
            value={data.client_tel}
            onChange={(e) => onChange({ client_tel: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Adresse du chantier" required>
        <input
          type="text"
          required
          value={data.adresse}
          onChange={(e) => onChange({ adresse: e.target.value })}
          placeholder="Ex : 12 rue de la Paix, 75001 Paris"
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Type de chantier">
          <select
            value={data.type_chantier}
            onChange={(e) => onChange({ type_chantier: e.target.value })}
            className={inputClass}
          >
            <option value="">— Sélectionner —</option>
            {TYPES_CHANTIER.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Budget estimé client (€)">
          <input
            type="number"
            min={0}
            value={data.budget}
            onChange={(e) => onChange({ budget: e.target.value })}
            placeholder="Ex : 250000"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" className={btnPrimary}>
          Suivant <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  )
}

// ─── Étape 2 ─────────────────────────────────────────────────────────────────

function Step2({
  files,
  onAdd,
  onRemove,
  onNext,
  onBack,
}: {
  files: UploadedFile[]
  onAdd: (slot: string, file: File) => void
  onRemove: (idx: number) => void
  onNext: () => void
  onBack: () => void
}) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold text-gray-900">Upload des documents</h2>
      <p className="text-xs text-gray-400">
        Tous les slots sont optionnels. Les fichiers seront accessibles après la passation.
      </p>

      <div className="space-y-3">
        {SLOTS.map((slot) => {
          const slotFiles = files.filter((f) => f.slot === slot.id)
          return (
            <div key={slot.id} className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">{slot.label}</span>
                {slot.prioritaire && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                    <Star className="w-3 h-3" /> Prioritaire
                  </span>
                )}
              </div>

              {slotFiles.map((f, globalIdx) => {
                const idx = files.indexOf(f)
                return (
                  <div
                    key={globalIdx}
                    className="flex items-center justify-between bg-white rounded border border-gray-200 px-3 py-2 mb-2 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-700 truncate">{f.file.name}</p>
                      <p className="text-gray-400">
                        {(f.file.size / 1024).toFixed(0)} Ko
                      </p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs font-medium">
                        À traiter par l&apos;IA
                      </span>
                    </div>
                    <button
                      onClick={() => onRemove(idx)}
                      className="ml-3 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}

              <input
                ref={(el) => { inputRefs.current[slot.id] = el }}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                multiple={slot.multiple}
                onChange={(e) => {
                  const fileList = e.target.files
                  if (!fileList) return
                  Array.from(fileList).forEach((file) => onAdd(slot.id, file))
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => inputRefs.current[slot.id]?.click()}
                className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-900 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                {slotFiles.length === 0 ? 'Ajouter un fichier' : 'Ajouter un autre fichier'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className={btnSecondary}>
          Retour
        </button>
        <button type="button" onClick={onNext} className={btnPrimary}>
          Suivant <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Étape 3 ─────────────────────────────────────────────────────────────────

function RadioGroup({
  options,
  value,
  onChange,
  autreValue,
  onAutreChange,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  autreValue: string
  onAutreChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label key={opt} className="flex items-start gap-2.5 cursor-pointer group">
          <input
            type="radio"
            name={Math.random().toString()}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="mt-0.5 accent-gray-900"
          />
          <span className="text-sm text-gray-700">{opt}</span>
        </label>
      ))}
      {value === 'Autre (préciser)' && (
        <input
          type="text"
          value={autreValue}
          onChange={(e) => onAutreChange(e.target.value)}
          placeholder="Préciser..."
          className={cn(inputClass, 'ml-5 mt-1')}
        />
      )}
    </div>
  )
}

function CheckboxGroup({
  options,
  values,
  onChange,
  autreValue,
  onAutreChange,
}: {
  options: string[]
  values: string[]
  onChange: (v: string[]) => void
  autreValue: string
  onAutreChange: (v: string) => void
}) {
  function toggle(opt: string) {
    onChange(
      values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]
    )
  }
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label key={opt} className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={values.includes(opt)}
            onChange={() => toggle(opt)}
            className="mt-0.5 accent-gray-900"
          />
          <span className="text-sm text-gray-700">{opt}</span>
        </label>
      ))}
      {values.includes('Autre (préciser)') && (
        <input
          type="text"
          value={autreValue}
          onChange={(e) => onAutreChange(e.target.value)}
          placeholder="Préciser..."
          className={cn(inputClass, 'ml-5 mt-1')}
        />
      )}
    </div>
  )
}

function Step3({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: Questionnaire
  onChange: (d: Partial<Questionnaire>) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-gray-900">Questionnaire guidé</h2>

      <QuestionBlock label="Q1 — Comment le client communique-t-il ?">
        <RadioGroup
          options={['Très réactif', 'Peu disponible', 'Décide vite', 'Indécis (beaucoup de retours)', 'Passe par un intermédiaire', 'Autre (préciser)']}
          value={data.q1}
          onChange={(v) => onChange({ q1: v })}
          autreValue={data.q1_autre}
          onAutreChange={(v) => onChange({ q1_autre: v })}
        />
      </QuestionBlock>

      <QuestionBlock label="Q2 — Niveau d'exigence du client ?">
        <RadioGroup
          options={["Standard", "Élevé (attentif aux détails)", "Très élevé (perfectionniste)", "Focalisé uniquement sur le budget", "Autre (préciser)"]}
          value={data.q2}
          onChange={(v) => onChange({ q2: v })}
          autreValue={data.q2_autre}
          onAutreChange={(v) => onChange({ q2_autre: v })}
        />
      </QuestionBlock>

      <QuestionBlock label="Q3 — Contraintes de planning particulières ?">
        <CheckboxGroup
          options={["Date de livraison impérative", "Travaux hors heures d'ouverture", "Bâtiment occupé pendant les travaux", "Contrainte saisonnière", "Aucune contrainte", "Autre (préciser)"]}
          values={data.q3}
          onChange={(v) => onChange({ q3: v })}
          autreValue={data.q3_autre}
          onAutreChange={(v) => onChange({ q3_autre: v })}
        />
      </QuestionBlock>

      <QuestionBlock label="Q4 — Comment le client a-t-il connu API ?">
        <RadioGroup
          options={["Recommandation", "Ancien client", "Prospection commerciale", "Appel d'offres", "Site web / réseaux", "Autre (préciser)"]}
          value={data.q4}
          onChange={(v) => onChange({ q4: v })}
          autreValue={data.q4_autre}
          onAutreChange={(v) => onChange({ q4_autre: v })}
        />
      </QuestionBlock>

      <QuestionBlock label="Q5 — Points de vigilance ?">
        <CheckboxGroup
          options={["Client a eu des pb avec d'autres entreprises", "Budget serré (risque d'avenants)", "Décisions collectives (plusieurs interlocuteurs)", "Délais très courts", "Contraintes techniques complexes", "Riverains / voisinage sensible", "Autre (préciser)"]}
          values={data.q5}
          onChange={(v) => onChange({ q5: v })}
          autreValue={data.q5_autre}
          onAutreChange={(v) => onChange({ q5_autre: v })}
        />
      </QuestionBlock>

      <QuestionBlock label="Q6 — Le bâtiment sera-t-il occupé pendant les travaux ?">
        <RadioGroup
          options={["Non — bâtiment vide", "Partiellement (certaines zones occupées)", "Oui — activité continue", "Autre (préciser)"]}
          value={data.q6}
          onChange={(v) => onChange({ q6: v })}
          autreValue={data.q6_autre}
          onAutreChange={(v) => onChange({ q6_autre: v })}
        />
      </QuestionBlock>

      <QuestionBlock label="Q7 — Maturité du projet à la signature ?">
        <RadioGroup
          options={["Projet très clair (peu de modifs attendues)", "Projet défini mais ajustements probables", "Projet encore flou (risque d'avenants élevé)", "Autre (préciser)"]}
          value={data.q7}
          onChange={(v) => onChange({ q7: v })}
          autreValue={data.q7_autre}
          onAutreChange={(v) => onChange({ q7_autre: v })}
        />
      </QuestionBlock>

      <QuestionBlock label="Q8 — Informations hors-contrat importantes pour le CO">
        <textarea
          value={data.q8}
          onChange={(e) => onChange({ q8: e.target.value })}
          placeholder="Tout ce que vous savez sur ce projet et qui n'est pas écrit dans le contrat..."
          rows={4}
          className={cn(inputClass, 'resize-none')}
        />
      </QuestionBlock>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className={btnSecondary}>
          Retour
        </button>
        <button type="button" onClick={onNext} className={btnPrimary}>
          Suivant <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function QuestionBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-sm font-medium text-gray-800">{label}</p>
      {children}
    </div>
  )
}

// ─── Étape 4 ─────────────────────────────────────────────────────────────────

function Step4({
  step1,
  questionnaire,
  step4,
  onChange4,
  onSubmit,
  onBack,
  loading,
}: {
  step1: FormStep1
  questionnaire: Questionnaire
  step4: FormStep4
  onChange4: (d: Partial<FormStep4>) => void
  onSubmit: () => void
  onBack: () => void
  loading: boolean
}) {
  const [cos, setCos] = useState<Utilisateur[]>([])
  const [economistes, setEconomistes] = useState<Utilisateur[]>([])
  const [dessinatrices, setDessinatrices] = useState<Utilisateur[]>([])

  useEffect(() => {
    fetchUsersByRole('co').then(setCos).catch(console.error)
    fetchUsersByRole('economiste').then(setEconomistes).catch(console.error)
    fetchUsersByRole('dessinatrice').then(setDessinatrices).catch(console.error)
  }, [])

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-gray-900">Validation & Assignation</h2>

      {/* Récap */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Récapitulatif
        </p>
        <RecapRow label="Projet" value={step1.nom} />
        <RecapRow label="Client" value={step1.client_nom} />
        {step1.client_type && <RecapRow label="Type client" value={step1.client_type} />}
        <RecapRow label="Adresse" value={step1.adresse} />
        {step1.type_chantier && <RecapRow label="Type chantier" value={step1.type_chantier} />}
        {step1.budget && <RecapRow label="Budget estimé" value={`${Number(step1.budget).toLocaleString('fr-FR')} €`} />}
        {questionnaire.q1 && <RecapRow label="Profil client" value={questionnaire.q1 === 'Autre (préciser)' ? questionnaire.q1_autre : questionnaire.q1} />}
      </div>

      {/* Assignation */}
      <div className="space-y-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Assignation de l&apos;équipe
        </p>

        <Field label="CO (Chargé d'Opérations)" required>
          <select
            required
            value={step4.co_id}
            onChange={(e) => onChange4({ co_id: e.target.value })}
            className={inputClass}
          >
            <option value="">— Sélectionner un CO —</option>
            {cos.map((u) => (
              <option key={u.id} value={u.id}>
                {u.prenom} {u.nom}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Économiste">
          <select
            value={step4.economiste_id}
            onChange={(e) => onChange4({ economiste_id: e.target.value })}
            className={inputClass}
          >
            <option value="">— Sélectionner un économiste —</option>
            {economistes.map((u) => (
              <option key={u.id} value={u.id}>
                {u.prenom} {u.nom}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Dessinatrice">
          <select
            value={step4.dessinatrice_id}
            onChange={(e) => onChange4({ dessinatrice_id: e.target.value })}
            className={inputClass}
          >
            <option value="">— Sélectionner une dessinatrice —</option>
            {dessinatrices.map((u) => (
              <option key={u.id} value={u.id}>
                {u.prenom} {u.nom}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Date souhaitée — réunion de passation">
          <input
            type="date"
            value={step4.date_passation}
            onChange={(e) => onChange4({ date_passation: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className={btnSecondary} disabled={loading}>
          Retour
        </button>
        <button type="button" onClick={onSubmit} disabled={loading} className={btnPrimary}>
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Création en cours…
            </>
          ) : (
            'Créer le dossier et notifier l\'équipe'
          )}
        </button>
      </div>
    </div>
  )
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-gray-400 w-28 flex-shrink-0">{label}</span>
      <span className="text-gray-900 font-medium">{value || '—'}</span>
    </div>
  )
}

// ─── Composant Field ─────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Styles partagés ─────────────────────────────────────────────────────────

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder-gray-300'

const btnPrimary =
  'inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

const btnSecondary =
  'inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50'

// ─── Page principale ──────────────────────────────────────────────────────────

export default function NouveauDossierPage() {
  const router = useRouter()
  const { user } = useUser()

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [step1, setStep1] = useState<FormStep1>({
    nom: '', client_nom: '', client_email: '', client_tel: '',
    client_type: '', adresse: '', type_chantier: '', budget: '',
  })

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])

  const [questionnaire, setQuestionnaire] = useState<Questionnaire>({
    q1: '', q1_autre: '', q2: '', q2_autre: '',
    q3: [], q3_autre: '', q4: '', q4_autre: '',
    q5: [], q5_autre: '', q6: '', q6_autre: '',
    q7: '', q7_autre: '', q8: '',
  })

  const [step4, setStep4] = useState<FormStep4>({
    co_id: '', economiste_id: '', dessinatrice_id: '', date_passation: '',
  })

  async function handleSubmit() {
    if (!user) return
    if (!step4.co_id) {
      setError('Veuillez assigner un CO avant de continuer.')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      const { psychologie, alertes } = formatQuestionnaire(questionnaire)

      const projet = await createProject({
        nom: step1.nom,
        type_chantier: step1.type_chantier || null,
        adresse: step1.adresse,
        budget_total: step1.budget ? parseFloat(step1.budget) : null,
        co_id: step4.co_id || null,
        economiste_id: step4.economiste_id || null,
        commercial_id: user.id,
        client_nom: step1.client_nom,
        client_email: step1.client_email || null,
        client_tel: step1.client_tel || null,
        psychologie_client: psychologie || null,
        infos_hors_contrat: questionnaire.q8 || null,
        alertes_cles: alertes || null,
        remarque: JSON.stringify({
          client_type: step1.client_type,
          dessinatrice_id: step4.dessinatrice_id,
          date_passation: step4.date_passation,
        }),
      })

      // Upload des fichiers
      for (const { file, slot } of uploadedFiles) {
        try {
          await uploadProjectFile(projet.id, slot, file)
        } catch {
          // Upload non bloquant
        }
      }

      // Alerte pour le CO
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const datePassation = step4.date_passation
          ? new Date(step4.date_passation).toLocaleDateString('fr-FR')
          : 'à définir'
        await supabase.schema('app').from('alertes').insert({
          projet_id: projet.id,
          utilisateur_id: step4.co_id,
          type: 'passation',
          titre: 'Nouveau projet à prendre en charge',
          message: `${projet.nom} — Réunion de passation prévue le ${datePassation}`,
          priorite: 'high',
          lue: false,
        })
      } catch {
        // Alerte non bloquante
      }

      router.push(
        `/commercial/projets/${projet.id}?success=true&ref=${encodeURIComponent(projet.reference ?? '')}`
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fafaf8] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-lg font-semibold text-gray-900">Nouveau dossier</h1>
          <p className="text-sm text-gray-400 mt-1">
            Créez un dossier projet en 4 étapes
          </p>
        </div>

        <Stepper current={step} />

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {step === 0 && (
            <Step1
              data={step1}
              onChange={(d) => setStep1((s) => ({ ...s, ...d }))}
              onNext={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <Step2
              files={uploadedFiles}
              onAdd={(slot, file) => setUploadedFiles((f) => [...f, { slot, file }])}
              onRemove={(idx) => setUploadedFiles((f) => f.filter((_, i) => i !== idx))}
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <Step3
              data={questionnaire}
              onChange={(d) => setQuestionnaire((s) => ({ ...s, ...d }))}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step4
              step1={step1}
              questionnaire={questionnaire}
              step4={step4}
              onChange4={(d) => setStep4((s) => ({ ...s, ...d }))}
              onSubmit={handleSubmit}
              onBack={() => setStep(2)}
              loading={submitting}
            />
          )}
        </div>
      </div>
    </div>
  )
}
