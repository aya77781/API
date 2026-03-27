'use client'

import { createContext, useContext, useState, useEffect } from 'react'

interface SidebarCollapseCtx {
  collapsed: boolean
  toggle: () => void
}

const Ctx = createContext<SidebarCollapseCtx>({ collapsed: false, toggle: () => {} })

export function SidebarCollapseProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored !== null) setCollapsed(stored === 'true')
  }, [])

  function toggle() {
    setCollapsed(v => {
      const next = !v
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  return <Ctx.Provider value={{ collapsed, toggle }}>{children}</Ctx.Provider>
}

export function useSidebarCollapse() {
  return useContext(Ctx)
}

export function SidebarContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarCollapse()
  return (
    <div className={`flex flex-col min-h-screen transition-all duration-300 ${collapsed ? 'pl-16' : 'pl-64'}`}>
      <main className="flex-1">{children}</main>
    </div>
  )
}
