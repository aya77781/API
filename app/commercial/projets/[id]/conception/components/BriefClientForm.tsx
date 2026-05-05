'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { Save, Loader2, Check } from 'lucide-react'
import { upsertBriefClient } from '@/app/_actions/conception'
import type { BriefClient } from '@/lib/conception/types'

export function BriefClientForm({ projetId, brief }: { projetId: string; brief: BriefClient | null }) {
  const [form, setForm] = useState({
    besoin_exprime: brief?.besoin_exprime ?? '',
    contraintes: brief?.contraintes ?? '',
    style_inspiration: brief?.style_inspiration ?? '',
    budget_evoque: brief?.budget_evoque ?? '',
    delais_souhaites: brief?.delais_souhaites ?? '',
  })
  const [saving, startSaving] = useTransition()
  const [savedAt, setSavedAt] = useState<Date | null>(brief?.updated_at ? new Date(brief.updated_at) : null)
  const timer = useRef<NodeJS.Timeout | null>(null)
  const dirtyRef = useRef(false)

  function save() {
    startSaving(async () => {
      await upsertBriefClient({
        projet_id: projetId,
        besoin_exprime: form.besoin_exprime || null,
        contraintes: form.contraintes || null,
        style_inspiration: form.style_inspiration || null,
        budget_evoque: form.budget_evoque === '' ? null : Number(form.budget_evoque),
        delais_souhaites: form.delais_souhaites || null,
      })
      setSavedAt(new Date())
      dirtyRef.current = false
    })
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    dirtyRef.current = true
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { if (dirtyRef.current) save() }, 1500)
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-300'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-end gap-2 text-xs">
        {saving ? (
          <span className="flex items-center gap-1.5 text-gray-500">
            <Loader2 className="w-3 h-3 animate-spin" /> Enregistrement…
          </span>
        ) : savedAt ? (
          <span className="flex items-center gap-1.5 text-green-600">
            <Check className="w-3 h-3" /> Enregistré {savedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : (
          <span className="text-gray-400">Auto-sauvegarde activée</span>
        )}
        <button onClick={save} className="px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 inline-flex items-center gap-1">
          <Save className="w-3 h-3" /> Forcer
        </button>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Besoin exprimé par le client</label>
        <textarea rows={3} className={inputCls}
          value={form.besoin_exprime}
          placeholder="Ce que le client veut, en ses mots…"
          onChange={e => update('besoin_exprime', e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Contraintes</label>
          <textarea rows={3} className={inputCls}
            value={form.contraintes}
            placeholder="Techniques, légales, planning…"
            onChange={e => update('contraintes', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Style / inspiration</label>
          <textarea rows={3} className={inputCls}
            value={form.style_inspiration}
            placeholder="Références, ambiance…"
            onChange={e => update('style_inspiration', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Budget évoqué (€ HT)</label>
          <input type="number" className={inputCls}
            value={form.budget_evoque}
            placeholder="Ex : 250000"
            onChange={e => update('budget_evoque', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Délais souhaités</label>
          <input type="date" className={inputCls}
            value={form.delais_souhaites ?? ''}
            onChange={e => update('delais_souhaites', e.target.value)} />
        </div>
      </div>
    </div>
  )
}
