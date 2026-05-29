import { createContext, useContext, useState } from 'react'
import { Auth } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [resident, setResident] = useState(null)

  const connexion = async (email, mot_de_passe) => {
    const data = await Auth.connexion(email, mot_de_passe)
    setResident(data.resident)
    return data.resident
  }

  const deconnexion = async () => {
    try { await Auth.deconnexion() } catch {}
    setResident(null)
  }

  const inscrircre = async (form) => {
    const res = await Auth.inscription(form)
    return res
  }

  return (
    <AuthContext.Provider value={{ resident, connexion, deconnexion, inscrircre }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)