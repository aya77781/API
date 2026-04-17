'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff, KeyRound, ArrowRight } from 'lucide-react'

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

const ROLE_DASHBOARDS: Record<string, string> = {
  admin: '/admin/dashboard',
  co: '/co/dashboard',
  gerant: '/gerant/dashboard',
  commercial: '/commercial/dashboard',
  economiste: '/economiste/dashboard',
  dessinatrice: '/dessin/dashboard',
  assistant_travaux: '/at/dashboard',
  comptable: '/compta/dashboard',
  rh: '/rh/dashboard',
  cho: '/cho/dashboard',
}

const AUTH_ERRORS: Record<string, string> = {
  compte_desactive: 'Votre compte est désactivé. Contactez un administrateur.',
  auth_failed: 'Échec de l\'authentification Google. Veuillez réessayer.',
  no_code: 'Connexion Google annulée.',
}

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { confirmed?: string; error?: string }
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setError(null)
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (authError) {
      setError('Erreur lors de la connexion Google. Veuillez réessayer.')
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      if (authError.message.toLowerCase().includes('invalid')) {
        setError('Email ou mot de passe incorrect.')
      } else {
        setError('Une erreur est survenue. Veuillez réessayer.')
      }
      setLoading(false)
      return
    }

    // Vérifier que le compte est actif
    const { data: profil } = await supabase
      .schema('app')
      .from('utilisateurs')
      .select('actif, role')
      .eq('id', data.user.id)
      .single()

    if (profil && profil.actif === false) {
      await supabase.auth.signOut()
      setError('Votre compte est désactivé. Contactez un administrateur.')
      setLoading(false)
      return
    }

    const role = profil?.role ?? data.user.user_metadata?.role
    const dashboard = (role && ROLE_DASHBOARDS[role]) || '/co/dashboard'
    router.push(dashboard)
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

      {/* Erreur OAuth */}
      {searchParams?.error && AUTH_ERRORS[searchParams.error] && (
        <div className="mb-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
          {AUTH_ERRORS[searchParams.error]}
        </div>
      )}

      {/* Confirmation inscription */}
      {searchParams?.confirmed && (
        <div className="mb-4 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-center">
          Compte créé avec succès. Vous pouvez vous connecter.
        </div>
      )}

      {/* Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-card p-8">
        <h2 className="text-base font-semibold text-gray-900 mb-6">Connexion</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400">ou</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GoogleIcon />
          {googleLoading ? 'Redirection...' : 'Continuer avec Google'}
        </button>
      </div>

      <p className="text-center text-xs text-gray-400 mt-4">
        Pas encore de compte ?{' '}
        <Link href="/signup" className="text-gray-700 font-medium hover:text-gray-900 transition-colors">
          Créer un compte
        </Link>
      </p>
      <p className="text-center text-xs text-gray-400 mt-2">
        Sous-traitant ?{' '}
        <Link href="/inscription-st" className="text-amber-600 font-medium hover:text-amber-700 transition-colors">
          Inscription ST
        </Link>
      </p>

      {/* Accès ST via code DCE (pas de compte requis) */}
      <DceCodeAccess />

      <p className="text-center text-xs text-gray-300 mt-4">
        L&apos;IA prépare · le CO valide · le système envoie
      </p>
    </div>
  )
}

// ─── Bloc accès par code DCE ─────────────────────────────────────────────

function DceCodeAccess() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function go() {
    const clean = code.trim().toUpperCase().replace(/\s+/g, '')
    if (clean.length < 4) return
    setSubmitting(true)
    router.push(`/dce/${clean}`)
  }

  return (
    <div className="mt-5 bg-white rounded-xl border border-gray-200 shadow-card p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Répondre à un appel d&apos;offre</p>
            <p className="text-[11px] text-gray-500">Vous avez reçu un code d&apos;accès DCE ?</p>
          </div>
        </div>
        <ArrowRight className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Code d&apos;accès</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') go() }}
              placeholder="ex : KNHNYB9S"
              maxLength={12}
              className="w-full px-3 py-2 text-sm font-mono tracking-wider bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder:text-gray-300"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Saisissez le code reçu par email ou WhatsApp pour accéder au dossier de consultation.
            </p>
          </div>
          <button
            type="button"
            onClick={go}
            disabled={submitting || code.trim().length < 4}
            className="w-full bg-amber-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? 'Redirection…' : 'Accéder au dossier'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
