import { GerantSidebar } from '@/components/gerant/Sidebar'
import { SidebarCollapseProvider, SidebarContent } from '@/components/shared/SidebarCollapseContext'

export default function GerantLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarCollapseProvider>
      <div className="min-h-screen bg-gray-50">
        <GerantSidebar />
        <SidebarContent>{children}</SidebarContent>
      </div>
    </SidebarCollapseProvider>
  )
}
