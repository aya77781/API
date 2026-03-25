'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'

const ROLES = [
  { value: 'admin', label: 'Administrateur' },
  { value: 'co', label: 'CO' },
  { value: 'gerant', label: 'Gérant' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'economiste', label: 'Économiste' },
  { value: 'dessinatrice', label: 'Dessinatrice' },
  { value: 'assistant_travaux', label: 'Assistant Travaux' },
  { value: 'comptable', label: 'Comptable' },
  { value: 'rh', label: 'RH' },
  { value: 'cho', label: 'CHO' },
]

export default function SignupPage() {
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!role) {
      setError('Veuillez sélectionner un rôle.')
      return
    }
    setLoading(true)
    setError(null)

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { prenom, nom, role },
      },
    })

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes('already registered')) {
        setError('Un compte existe déjà avec cet email.')
      } else if (signUpError.message.toLowerCase().includes('password')) {
        setError('Le mot de passe doit contenir au moins 6 caractères.')
      } else {
        setError('Une erreur est survenue. Veuillez réessayer.')
      }
      setLoading(false)
      return
    }

    router.push('/login?confirmed=1')
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="text-center mb-8">
        <Image
          src="/logo.png"
          alt="API"
          width={80}
          height={80}
          className="mx-auto"
          priority
        />
        <p className="text-sm text-gray-400 mt-3">Gestion de chantier</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-card p-8">
        <h2 className="text-base font-semibold text-gray-900 mb-6">Créer un compte</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Prénom
              </label>
              <input
                type="text"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                required
                placeholder="Aïcha"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Nom
              </label>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
                placeholder="Benali"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="vous@api-construction.fr"
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-300"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full px-3 py-2 pr-10 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-300"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Rôle
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 appearance-none"
            >
              <option value="" disabled className="text-gray-300">
                Sélectionner un rôle
              </option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
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
            disabled={loading}
            className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-gray-400 mt-4">
        Déjà un compte ?{' '}
        <Link href="/login" className="text-gray-700 font-medium hover:text-gray-900 transition-colors">
          Se connecter
        </Link>
      </p>

      <p className="text-center text-xs text-gray-300 mt-4">
        L&apos;IA prépare · le CO valide · le système envoie
      </p>
    </div>
  )
}
