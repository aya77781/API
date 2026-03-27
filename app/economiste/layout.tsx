import { EconomisteSidebar } from '@/components/economiste/Sidebar'
import { SidebarCollapseProvider, SidebarContent } from '@/components/shared/SidebarCollapseContext'

export default function EconomisteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarCollapseProvider>
      <div className="min-h-screen bg-gray-50">
        <EconomisteSidebar />
        <SidebarContent>{children}</SidebarContent>
      </div>
    </SidebarCollapseProvider>
  )
}
