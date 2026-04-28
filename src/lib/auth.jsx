import { createContext, useContext, useEffect, useState } from 'react'
import { auth, isTestMode } from './storage'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [testMode] = useState(isTestMode())

  useEffect(() => {
    const authClient = auth()

    // Get initial session
    authClient.getSession().then(({ data }) => {
      setSession(data.session)
    })

    // Listen for changes
    const { data: { subscription } } = authClient.onAuthStateChange((event, session) => {
      setSession(session)
    })

    return () => subscription?.unsubscribe()
  }, [])

  const signIn = () => auth().signInWithOAuth({ provider: 'google' })
  const signOut = () => auth().signOut()

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, signIn, signOut, testMode, loading: session === undefined }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
