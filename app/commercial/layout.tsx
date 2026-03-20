import { CommercialSidebar } from '@/components/commercial/Sidebar'

export default function CommercialLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <CommercialSidebar />
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
