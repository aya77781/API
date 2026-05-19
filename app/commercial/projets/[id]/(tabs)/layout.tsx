import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjetHeader } from './ProjetHeader'
import { ProjetTabNav } from './ProjetTabNav'

export const dynamic = 'force-dynamic'

interface LayoutProps {
  children: React.ReactNode
  params: { id: string }
}

export default async function CommercialProjetLayout({ children, params }: LayoutProps) {
  const supabase = createClient()
  const { data: projet } = await supabase
    .schema('app')
    .from('projets')
    .select('id, nom, reference, client_nom, statut, statut_commercial')
    .eq('id', params.id)
    .single()

  if (!projet) notFound()

  return (
    <div className="min-h-screen bg-gray-50">
      <ProjetHeader projet={projet} />
      <ProjetTabNav projetId={projet.id} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </div>
    </div>
  )
}
