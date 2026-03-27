import { CommercialSidebar } from '@/components/commercial/Sidebar'
import { SidebarCollapseProvider, SidebarContent } from '@/components/shared/SidebarCollapseContext'

export default function CommercialLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarCollapseProvider>
      <div className="min-h-screen bg-gray-50">
        <CommercialSidebar />
        <SidebarContent>{children}</SidebarContent>
      </div>
    </SidebarCollapseProvider>
  )
}
