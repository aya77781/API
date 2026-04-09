'use client'

import { X } from 'lucide-react'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useSidebarCollapse } from './SidebarCollapseContext'

/**
 * Wrapper qui rend une sidebar responsive :
 * - Sur desktop (lg+) : visible par defaut, masquee si desktopCollapsed
 * - Sur mobile (<lg)  : masquee par defaut, overlay quand mobileOpen
 *
 * Inclut un bouton X de fermeture visible uniquement sur mobile.
 */
interface Props {
  children: React.ReactNode
  /** Classes pour le fond/bordure (ex: 'bg-white border-r border-gray-200' ou dark style) */
  bgClassName?: string
  /** Couleur du bouton X (defaut adapte au fond clair) */
  closeBtnClassName?: string
}

export function ResponsiveSidebar({
  children,
  bgClassName = 'bg-white border-r border-gray-200',
  closeBtnClassName = 'text-gray-400 hover:text-gray-600',
}: Props) {
  const { mobileOpen, closeMobile, desktopCollapsed } = useSidebarCollapse()
  const pathname = usePathname()

  // Ferme la sidebar mobile au changement de route
  useEffect(() => {
    closeMobile()
  }, [pathname, closeMobile])

  return (
    <>
      {/* Desktop : visible si non collapsed */}
      {!desktopCollapsed && (
        <aside className={`hidden lg:flex fixed inset-y-0 left-0 z-50 w-64 flex-col ${bgClassName}`}>
          {children}
        </aside>
      )}

      {/* Mobile : overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30 lg:hidden" onClick={closeMobile} />
          <aside className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col lg:hidden animate-in slide-in-from-left duration-200 ${bgClassName}`}>
            <button
              onClick={closeMobile}
              className={`absolute top-4 right-4 p-1.5 z-10 ${closeBtnClassName}`}
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
            {children}
          </aside>
        </>
      )}
    </>
  )
}
