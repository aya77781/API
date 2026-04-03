'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface SidebarCtx {
  mobileOpen: boolean
  openMobile: () => void
  closeMobile: () => void
}

const Ctx = createContext<SidebarCtx>({
  mobileOpen: false,
  openMobile: () => {},
  closeMobile: () => {},
})

export function SidebarCollapseProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const openMobile = useCallback(() => setMobileOpen(true), [])
  const closeMobile = useCallback(() => setMobileOpen(false), [])
  return (
    <Ctx.Provider value={{ mobileOpen, openMobile, closeMobile }}>
      {children}
    </Ctx.Provider>
  )
}

export function useSidebarCollapse() {
  return useContext(Ctx)
}

export function SidebarContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen pl-0 lg:pl-64">
      <main className="flex-1">{children}</main>
    </div>
  )
}
