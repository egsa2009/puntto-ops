import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [operator, setOperator] = useState(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) await loadOperator(session.user.id)
      } catch (err) {
        console.error('Auth load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) await loadOperator(session.user.id)
      else setOperator(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadOperator(userId) {
    const { data, error } = await supabase
      .from('operator_profiles')
      .select('*')
      .eq('id', userId)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      await supabase.auth.signOut()
      setOperator(null)
    } else {
      setOperator(data)
    }
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setOperator(null)
  }

  return (
    <AuthContext.Provider value={{ operator, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
