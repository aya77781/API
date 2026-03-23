import { DessinSidebar } from '@/components/dessin/Sidebar'

export default function DessinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <DessinSidebar />
      <div className="pl-64 flex flex-col min-h-screen">
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
