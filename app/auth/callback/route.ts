import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/login'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // Fetch role from app.utilisateurs
  const { data: profil } = await supabase
    .schema('app')
    .from('utilisateurs')
    .select('role, actif')
    .eq('id', data.user.id)
    .single()

  // New Google user — no active account yet → onboarding
  if (!profil || profil.actif === false) {
    return NextResponse.redirect(`${origin}/onboarding`)
  }

  const role = profil.role ?? data.user.user_metadata?.role
  const dashboard = (role && ROLE_DASHBOARDS[role]) || next

  return NextResponse.redirect(`${origin}${dashboard}`)
}
