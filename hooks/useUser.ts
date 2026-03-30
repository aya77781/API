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
    let mounted = true

    async function loadProfil(uid: string) {
      const { data } = await supabase
        .schema('app')
        .from('utilisateurs')
        .select('id, email, nom, prenom, role, actif, created_at')
        .eq('id', uid)
        .single()
      if (mounted) setProfil(data ?? null)
    }

    // Stable setter: only triggers a re-render when the user ID actually changes.
    // This prevents unnecessary re-renders on token refresh (same user, new JWT).
    function applyUser(newUser: User | null) {
      setUser(prev => {
        if (prev?.id === newUser?.id) return prev   // same ID → keep stable reference
        return newUser
      })
    }

    // Initial session fetch
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!mounted) return
      applyUser(u)
      if (u) loadProfil(u.id).finally(() => { if (mounted) setLoading(false) })
      else setLoading(false)
    })

    // Listen for sign-in / sign-out / token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      const newUser = session?.user ?? null
      applyUser(newUser)
      if (!newUser) {
        setProfil(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { user, profil, loading }
}
