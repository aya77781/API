'use client'

import { createClient } from '@/lib/supabase/client'
import type { Utilisateur, RoleUtilisateur } from '@/types/database'

export async function fetchUsersByRole(role: RoleUtilisateur): Promise<Utilisateur[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .schema('app')
    .from('utilisateurs')
    .select('id, email, nom, prenom, role, actif, created_at')
    .eq('role', role)
    .eq('actif', true)
    .order('nom', { ascending: true })

  if (error) throw error
  return (data ?? []) as Utilisateur[]
}
