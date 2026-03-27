import { AdminSidebar } from '@/components/admin/Sidebar'
import { SidebarCollapseProvider, SidebarContent } from '@/components/shared/SidebarCollapseContext'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarCollapseProvider>
      <div className="min-h-screen bg-[#fafaf8]">
        <AdminSidebar />
        <SidebarContent>{children}</SidebarContent>
      </div>
    </SidebarCollapseProvider>
  )
}
