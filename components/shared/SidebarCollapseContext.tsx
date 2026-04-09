'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { Menu } from 'lucide-react'

interface SidebarCtx {
  mobileOpen: boolean
  openMobile: () => void
  closeMobile: () => void
  desktopCollapsed: boolean
  toggleDesktop: () => void
}

const Ctx = createContext<SidebarCtx>({
  mobileOpen: false,
  openMobile: () => {},
  closeMobile: () => {},
  desktopCollapsed: false,
  toggleDesktop: () => {},
})

export function SidebarCollapseProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)

  // Restore from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setDesktopCollapsed(true)
  }, [])

  const openMobile = useCallback(() => setMobileOpen(true), [])
  const closeMobile = useCallback(() => setMobileOpen(false), [])
  const toggleDesktop = useCallback(() => {
    setDesktopCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }, [])

  return (
    <Ctx.Provider value={{ mobileOpen, openMobile, closeMobile, desktopCollapsed, toggleDesktop }}>
      {children}
    </Ctx.Provider>
  )
}

export function useSidebarCollapse() {
  return useContext(Ctx)
}

export function SidebarContent({ children }: { children: React.ReactNode }) {
  const { desktopCollapsed, openMobile, toggleDesktop } = useSidebarCollapse()

  function handleToggle() {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) toggleDesktop()
    else openMobile()
  }

  return (
    <div className={`flex flex-col min-h-screen pl-0 ${desktopCollapsed ? 'lg:pl-0' : 'lg:pl-64'} transition-[padding] duration-200`}>
      {/* Bouton hamburger flottant - visible sur mobile toujours, sur desktop seulement si sidebar fermee */}
      <button
        onClick={handleToggle}
        className={
          desktopCollapsed
            ? 'fixed top-3 left-3 z-40 p-2 bg-white border border-gray-200 rounded-lg shadow-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors'
            : 'fixed top-3 left-3 z-40 p-2 bg-white border border-gray-200 rounded-lg shadow-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors lg:hidden'
        }
        aria-label="Ouvrir le menu"
      >
        <Menu className="w-4 h-4" />
      </button>
      <main className="flex-1">{children}</main>
    </div>
  )
}
