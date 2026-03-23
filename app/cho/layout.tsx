import { CHOSidebar } from '@/components/cho/Sidebar'

export default function CHOLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <CHOSidebar />
      <div className="pl-64 flex flex-col min-h-screen">
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
