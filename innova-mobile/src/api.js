// INNOVA Mobile — Service API
// IMPORTANT: Change SERVER_IP to your computer's local IP address
// Run "ipconfig" (Windows) or "ifconfig" (Mac/Linux) to find it
// Look for IPv4 Address under your WiFi adapter

const API_BASE = 'https://innova-app.onrender.com/api'

let sessionCookie = null

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (sessionCookie) headers['Cookie'] = sessionCookie

  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)

  const res = await fetch(API_BASE + path, opts)
    .catch(err => {
      throw new Error('Network error: ' + err.message)
    })

  const setCookie = res.headers.get('set-cookie')
  if (setCookie) sessionCookie = setCookie.split(';')[0]

  const data = await res.json()
    .catch(() => {
      throw new Error('Invalid response from server')
    })
  
  if (!res.ok) throw new Error(data.message || data.erreur || 'Erreur serveur')
  return data
}

export const clearSession = () => { sessionCookie = null }

const get  = (path)       => request('GET',    path)
const post = (path, body) => request('POST',   path, body)

export const Auth = {
  connexion:   (email, mot_de_passe) => post('/auth/connexion', { email, mot_de_passe }),
  inscription: (data)                => post('/auth/inscription', data),
  deconnexion: ()                    => { clearSession(); return post('/auth/deconnexion') },
}

export const Charges = {
  lister:       (resident_id)         => get(`/charges?resident_id=${resident_id}`),
  payerEnLigne: (charge_id, montant)  => post(`/charges/${charge_id}/payer-en-ligne`, { montant }),
  paiements:    (charge_id)           => get(`/charges/${charge_id}/paiements`),
}

export const Messages = {
  prives:            ()        => get('/messages/prive'),
  communaute:        ()        => get('/messages/communaute'),
  envoyerPrive:      (contenu) => post('/messages/envoyer-prive', { contenu }),
  envoyerCommunaute: (contenu) => post('/messages/envoyer-communaute', { contenu }),
  nonLus:           ()        => get('/messages/non-lus'),
}

export const Alertes = {
  lister: (residence_id) => get(`/alertes${residence_id ? '?residence_id=' + residence_id : ''}`),
  nonLues: () => get('/alertes/non-lus'),
  marquerLues: () => post('/alertes/lues'),
}

export const Residences = {
  lister: () => get('/residences'),
}

export const Requetes = {
  lister: () => get('/requetes'),
  creer:  (sujet, contenu) => post('/requetes', { sujet, contenu }),
}

export const Notifications = {
  lister:   () => get('/notifications'),
  count:    () => get('/notifications/count'),
  lireTout: () => post('/notifications/lire-tout'),
  registerDevice: (token) => post('/notifications/register-device', { expo_token: token }),
}
