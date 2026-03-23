'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const ROLES = [
  { value: 'co', label: 'Chargé d\'opérations' },
  { value: 'gerant', label: 'Gérant' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'economiste', label: 'Économiste' },
  { value: 'dessinatrice', label: 'Dessinatrice' },
  { value: 'assistant_travaux', label: 'Assistant travaux' },
  { value: 'comptable', label: 'Comptable' },
  { value: 'rh', label: 'RH' },
  { value: 'cho', label: 'CHO' },
]

const ROLE_DASHBOARDS: Record<string, string> = {
  co: '/co/dashboard',
  gerant: '/gerant/dashboard',
  commercial: '/commercial/dashboard',
  economiste: '/economiste/dashboard',
  dessinatrice: '/dessinatrice/dashboard',
  assistant_travaux: '/assistant/dashboard',
  comptable: '/comptable/dashboard',
  rh: '/rh/dashboard',
  cho: '/cho/dashboard',
}

export default function OnboardingPage() {
  const [selectedRole, setSelectedRole] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRole) return

    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { error: updateError } = await supabase
      .schema('app')
      .from('utilisateurs')
      .update({ role: selectedRole, actif: true })
      .eq('id', user.id)

    if (updateError) {
      setError('Une erreur est survenue. Veuillez réessayer.')
      setLoading(false)
      return
    }

    router.push(ROLE_DASHBOARDS[selectedRole])
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="API" width={80} height={80} className="mx-auto" priority />
          <p className="text-sm text-gray-400 mt-3">Gestion de chantier</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-card p-8">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Bienvenue !</h2>
          <p className="text-xs text-gray-400 mb-6">Sélectionnez votre rôle pour continuer.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Votre rôle
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-700"
              >
                <option value="" disabled>Choisir un rôle...</option>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !selectedRole}
              className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Enregistrement...' : 'Accéder à la plateforme'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Mauvais compte ?{' '}
          <button onClick={handleSignOut} className="text-gray-700 font-medium hover:text-gray-900 transition-colors">
            Se déconnecter
          </button>
        </p>

        <p className="text-center text-xs text-gray-300 mt-4">
          L&apos;IA prépare · le CO valide · le système envoie
        </p>
      </div>
    </div>
  )
}
