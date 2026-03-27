import { RHSidebar } from '@/components/rh/Sidebar'
import { SidebarCollapseProvider, SidebarContent } from '@/components/shared/SidebarCollapseContext'

export default function RHLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarCollapseProvider>
      <div className="min-h-screen bg-gray-50">
        <RHSidebar />
        <SidebarContent>{children}</SidebarContent>
      </div>
    </SidebarCollapseProvider>
  )
}
