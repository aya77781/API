'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Mail, Phone, User, AlertTriangle, Lightbulb, FileText, Save, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ClientInfo {
  client_nom: string | null
  client_email: string | null
  client_tel: string | null
  psychologie_client: string | null
  alertes_cles: string | null
  infos_hors_contrat: string | null
}

export default function SuiviClientPage() {
  const params = useParams()
  const id = params.id as string

  const [info, setInfo] = useState<ClientInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .schema('app')
      .from('projets')
      .select('client_nom, client_email, client_tel, psychologie_client, alertes_cles, infos_hors_contrat')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setInfo((data as ClientInfo) ?? null)
        setLoading(false)
      })
  }, [id])

  async function save(field: keyof ClientInfo, value: string) {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .schema('app')
      .from('projets')
      .update({ [field]: value || null })
      .eq('id', id)
    setSaving(false)
    if (!error) setSavedAt(new Date())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }
  if (!info) return <p className="text-sm text-gray-500">Aucune information client.</p>

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" /> Contact
        </p>
        <div className="space-y-3">
          {info.client_nom && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-gray-900">{info.client_nom}</span>
            </div>
          )}
          {info.client_tel && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <a href={`tel:${info.client_tel}`} className="text-sm text-gray-700 hover:text-gray-900">
                {info.client_tel}
              </a>
            </div>
          )}
          {info.client_email && (
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <a
                href={`mailto:${info.client_email}`}
                className="text-sm text-gray-700 hover:text-gray-900 truncate"
              >
                {info.client_email}
              </a>
            </div>
          )}
          {!info.client_nom && !info.client_email && !info.client_tel && (
            <p className="text-sm text-gray-400">Aucune coordonnée renseignée. Modifie le projet pour les ajouter.</p>
          )}
        </div>
      </section>

      <EditableNote
        icon={Lightbulb}
        title="Psychologie client"
        helper="Style relationnel, ton, attentes, sensibilités à connaître pour la relation long terme."
        value={info.psychologie_client ?? ''}
        onSave={v => {
          setInfo({ ...info, psychologie_client: v || null })
          save('psychologie_client', v)
        }}
      />

      <EditableNote
        icon={AlertTriangle}
        title="Alertes & points de vigilance"
        helper="Difficultés relationnelles, sujets délicats, choses à surveiller."
        value={info.alertes_cles ?? ''}
        accent="amber"
        onSave={v => {
          setInfo({ ...info, alertes_cles: v || null })
          save('alertes_cles', v)
        }}
      />

      <EditableNote
        icon={FileText}
        title="Infos hors contrat"
        helper="Engagements oraux, gestes commerciaux, contexte non écrit dans le contrat."
        value={info.infos_hors_contrat ?? ''}
        onSave={v => {
          setInfo({ ...info, infos_hors_contrat: v || null })
          save('infos_hors_contrat', v)
        }}
      />

      {savedAt && (
        <p className="text-xs text-gray-400 text-right flex items-center justify-end gap-1.5">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Enregistré à {savedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}

function EditableNote({
  icon: Icon,
  title,
  helper,
  value,
  accent,
  onSave,
}: {
  icon: typeof User
  title: string
  helper: string
  value: string
  accent?: 'amber'
  onSave: (v: string) => void
}) {
  const [local, setLocal] = useState(value)
  const [dirty, setDirty] = useState(false)
  const wrapper = accent === 'amber' ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 bg-white'
  const iconWrap = accent === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-600'

  function commit() {
    if (!dirty) return
    onSave(local.trim())
    setDirty(false)
  }

  return (
    <section className={`rounded-xl border p-5 space-y-3 ${wrapper}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconWrap}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{helper}</p>
        </div>
      </div>
      <textarea
        value={local}
        onChange={e => { setLocal(e.target.value); setDirty(true) }}
        onBlur={commit}
        rows={3}
        placeholder="Note libre..."
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
      />
    </section>
  )
}
