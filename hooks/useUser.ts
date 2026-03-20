'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface Profil {
  id: string
  email: string
  nom: string
  prenom: string
  role: string
  actif: boolean
  created_at: string
}

interface UseUserResult {
  user: User | null
  profil: Profil | null
  loading: boolean
}

export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null)
  const [profil, setProfil] = useState<Profil | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data } = await supabase
          .schema('app')
          .from('utilisateurs')
          .select('id, email, nom, prenom, role, actif, created_at')
          .eq('id', user.id)
          .single()

        setProfil(data ?? null)
      }

      setLoading(false)
    }

    fetchUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setProfil(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, profil, loading }
}
