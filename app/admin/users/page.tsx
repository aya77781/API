import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UsersClient, { type UserRow } from './UsersClient'

async function getUsers(): Promise<UserRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .schema('app')
    .from('utilisateurs')
    .select('id, email, nom, prenom, role, actif, categorie, created_at')
    .order('nom')
  return (data ?? []) as UserRow[]
}

export default async function AdminUsersPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.user_metadata?.role !== 'admin') redirect('/login')

  const users = await getUsers()
  return <UsersClient initialUsers={users} />
}
