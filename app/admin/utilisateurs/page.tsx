import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UtilisateursClient, { type UserRow } from './UtilisateursClient'

async function getUtilisateurs(): Promise<UserRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .schema('app')
    .from('utilisateurs')
    .select('id, email, nom, prenom, role, actif, created_at')
    .order('nom')
  return (data ?? []) as UserRow[]
}

export default async function UtilisateursPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.user_metadata?.role !== 'admin') {
    redirect('/login')
  }

  const utilisateurs = await getUtilisateurs()
  return <UtilisateursClient initialUsers={utilisateurs} />
}
