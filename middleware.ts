import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

const ROLE_PREFIXES: Record<string, string> = {
  co: '/co',
  gerant: '/gerant',
  commercial: '/commercial',
  economiste: '/economiste',
  dessinatrice: '/dessinatrice',
  assistant_travaux: '/assistant',
  comptable: '/comptable',
  rh: '/rh',
  cho: '/cho',
}

const PUBLIC_PATHS = ['/login', '/signup']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.includes(pathname)

  // Non authentifié → /login
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authentifié sur page publique → dashboard de son rôle
  if (user && isPublic) {
    const role = user.user_metadata?.role as string | undefined
    const dashboard = (role && ROLE_DASHBOARDS[role]) || '/login'
    return NextResponse.redirect(new URL(dashboard, request.url))
  }

  // Authentifié sur mauvaise route
  if (user && !isPublic) {
    const role = user.user_metadata?.role as string | undefined
    const rolePrefix = role ? ROLE_PREFIXES[role] : null

    if (rolePrefix && !pathname.startsWith(rolePrefix) && pathname !== '/') {
      const dashboard = ROLE_DASHBOARDS[role!]
      return NextResponse.redirect(new URL(dashboard, request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
