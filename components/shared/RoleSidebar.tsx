'use client'

import Link from 'next/link'
import { ResponsiveSidebar } from '@/components/shared/ResponsiveSidebar'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { LogOut, Menu, X, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'

export interface RoleNavLink {
  label: string
  href: string
  icon: LucideIcon
  badge?: number
}

export interface RoleSidebarProps {
  navLinks: RoleNavLink[]
  roleLabel: string
  // Fonction optionnelle pour determiner l etat actif (ex: pour gerer le cas /role/projets vs /role/projets/nouveau)
  isActiveOverride?: (href: string, pathname: string) => boolean | undefined
}

/* ── Palette anti-IA : gris-bleutes au lieu de gris purs ── */
const COLORS = {
  bg: '#FFFFFF',
  border: '#E8ECF0',
  textIdle: '#6B7385',
  textHover: '#1B2A4A',
  textActive: '#1B2A4A',
  bgHover: '#F5F7FA',
  bgActive: '#F0F4F9',
  accent: '#1B2A4A',
  sectionLabel: '#94A3B8',
  badge: '#E53E3E',
  divider: '#EEF1F5',
  avatarBg: '#6B7A8D',
}

export function RoleSidebar({ navLinks, roleLabel, isActiveOverride }: RoleSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, profil } = useUser()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initiales = profil
    ? `${profil.prenom?.[0] ?? ''}${profil.nom?.[0] ?? ''}`.toUpperCase()
    : roleLabel.slice(0, 2).toUpperCase()

  function defaultIsActive(href: string): boolean {
    return pathname === href || pathname.startsWith(href + '/')
  }

  function NavItem({ item, onNav }: { item: RoleNavLink; onNav?: () => void }) {
    const Icon = item.icon
    const overrideResult = isActiveOverride?.(item.href, pathname)
    const isActive = overrideResult !== undefined ? overrideResult : defaultIsActive(item.href)
    const badge = item.badge ?? 0

    return (
      <Link
        href={item.href}
        onClick={onNav}
        className="relative flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors"
        style={{
          color: isActive ? COLORS.textActive : COLORS.textIdle,
          backgroundColor: isActive ? COLORS.bgActive : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = COLORS.bgHover
            e.currentTarget.style.color = COLORS.textHover
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = COLORS.textIdle
          }
        }}
      >
        {isActive && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
            style={{ backgroundColor: COLORS.accent }}
          />
        )}
        <Icon width={18} height={18} strokeWidth={1.5} className="flex-shrink-0" />
        <span className="flex-1 truncate">{item.label}</span>
        {badge > 0 && (
          <span
            className="min-w-[18px] h-[18px] text-[10px] font-semibold text-white rounded-full flex items-center justify-center px-1"
            style={{ backgroundColor: COLORS.badge }}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </Link>
    )
  }

  function NavContent({ onNav }: { onNav?: () => void }) {
    return (
      <>
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b" style={{ borderColor: COLORS.divider }}>
          <Image src="/logo.png" alt="API" width={48} height={48} className="w-8 h-8 object-contain flex-shrink-0" priority />
          <span className="ml-2.5 text-base font-semibold tracking-tight" style={{ color: COLORS.textActive }}>API</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p
            className="px-3 mb-2 text-[11px] font-semibold uppercase"
            style={{ color: COLORS.sectionLabel, letterSpacing: '0.08em' }}
          >
            Navigation
          </p>
          <div className="space-y-px">
            {navLinks.map((item) => (
              <NavItem key={item.href} item={item} onNav={onNav} />
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t" style={{ borderColor: COLORS.divider }}>
          {profil && (
            <div className="flex items-center gap-2.5 px-2 py-2">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                style={{ backgroundColor: COLORS.avatarBg }}
              >
                {initiales}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: COLORS.textActive }}>
                  {profil.prenom} {profil.nom}
                </p>
                <p className="text-xs truncate" style={{ color: COLORS.sectionLabel }}>
                  {roleLabel}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 mt-1 rounded-md text-sm font-medium transition-colors"
            style={{ color: COLORS.textIdle }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.bgHover
              e.currentTarget.style.color = COLORS.textHover
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = COLORS.textIdle
            }}
          >
            <LogOut width={18} height={18} strokeWidth={1.5} />
            Se deconnecter
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="hidden lg:block">
        <ResponsiveSidebar bgClassName="bg-white border-r">
          <NavContent />
        </ResponsiveSidebar>
      </div>

      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-sm"
        style={{ borderWidth: 1, borderColor: COLORS.border, color: COLORS.textActive }}
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Menu"
      >
        {mobileOpen
          ? <X width={18} height={18} strokeWidth={1.5} />
          : <Menu width={18} height={18} strokeWidth={1.5} />}
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside
            className="absolute inset-y-0 left-0 w-[280px] flex flex-col bg-white border-r"
            style={{ borderColor: COLORS.border }}
          >
            <NavContent onNav={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  )
}
