'use client'

// Simplified: sidebar is always expanded, no collapse logic, no localStorage, no animations.
// The previous collapse feature was causing layout shifts and unnecessary re-renders.

export function SidebarCollapseProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function useSidebarCollapse() {
  return { collapsed: false, canTransition: false, toggle: () => {} }
}

export function SidebarContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen pl-64">
      <main className="flex-1">{children}</main>
    </div>
  )
}
