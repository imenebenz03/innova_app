import { createContext, useContext, useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { Auth } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [resident, setResident] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  useEffect(() => {
    const loadSavedUser = async () => {
      try {
        const saved = await SecureStore.getItemAsync('resident')
        if (saved) {
          setResident(JSON.parse(saved))
        }
      } catch (e) {
        console.log('Error loading saved user:', e)
      } finally {
        setLoadingAuth(false)
      }
    }

    loadSavedUser()
  }, [])

  const connexion = async (email, mot_de_passe) => {
    const data = await Auth.connexion(email, mot_de_passe)
    setResident(data.resident)
    await SecureStore.setItemAsync('resident', JSON.stringify(data.resident))
    return data.resident
  }

  const deconnexion = async () => {
    try { await Auth.deconnexion() } catch {}
    await SecureStore.deleteItemAsync('resident')
    setResident(null)
  }

  const inscrircre = async (form) => {
    const res = await Auth.inscription(form)
    return res
  }

  if (loadingAuth) return null

  return (
    <AuthContext.Provider value={{ resident, connexion, deconnexion, inscrircre }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)