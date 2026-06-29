import { useState, useEffect, useRef, useCallback } from 'react'

const API = 'https://innova-app.onrender.com/api'
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(API + path, opts)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || data.erreur || 'Erreur')
  return data
}
const get = p => api('GET', p)
const post = (p, b) => api('POST', p, b)
const del = p => api('DELETE', p)

function LogoBatiments({ size = 24, stroke = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="2" y="28" width="12" height="32" rx="1" fill={stroke} opacity="0.9" />
      <rect x="16" y="20" width="12" height="40" rx="1" fill={stroke} opacity="0.8" />
      <rect x="30" y="12" width="12" height="48" rx="1" fill={stroke} opacity="0.7" />
      <rect x="44" y="24" width="12" height="36" rx="1" fill={stroke} opacity="0.85" />
      <rect x="58" y="30" width="4" height="30" rx="1" fill={stroke} opacity="0.6" />
    </svg>
  )
}

const fmtDate = str => {
  if (!str) return '—'
  const d = new Date(str)
  if (isNaN(d)) return str
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'À l\'instant'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min`
  if (diff < 86400000) return d.toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-DZ', { day: 'numeric', month: 'short' })
}
const fmtFull = str => {
  if (!str) return '—'
  const d = new Date(str)
  return isNaN(d) ? str : d.toLocaleDateString('fr-DZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const fmtShort = str => {
  if (!str) return '—'
  const d = new Date(str)
  return isNaN(d) ? str : d.toLocaleDateString('fr-DZ', { day: 'numeric', month: 'short' })
}
const fmtDA = n => `${Number(n || 0).toLocaleString('fr-DZ')} DA`

const inits = (a, b) => (!a || !b) ? '?' : (a[0] + b[0]).toUpperCase()

function Modal({ titre, icone, onFermer, children, maxWidth = 480 }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(10,14,26,0.55)', backdropFilter: 'blur(3px)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={e => e.target === e.currentTarget && onFermer()}
    >
      <div style={{
        background: '#fff', borderRadius: 20, padding: '28px 28px 24px',
        width: '100%', maxWidth, boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {icone && <span style={{ fontSize: 20 }}>{icone}</span>}
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{titre}</span>
          </div>
          <button
            onClick={onFermer}
            style={{ background: 'var(--bg)', border: 'none', cursor: 'pointer', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 16, fontWeight: 700 }}
          >✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function AlerteCard({ a, onDel, onDelete }) {
  const cfg = {
    danger:    { l: 'Urgence',      bg: '#FFF0F0', border: '#F49090', color: '#C41E1E', dot: '#E53E3E' },
    attention: { l: 'Attention',    bg: '#FFF8E6', border: '#F5C842', color: '#B07D00', dot: '#D97706' },
    info:      { l: 'Information',  bg: '#EBF3FF', border: '#90BBF3', color: '#1A5FB4', dot: '#3B82F6' },
    succes:    { l: 'Résolu',       bg: '#E6F9F0', border: '#6DD6A2', color: '#1A7E53', dot: '#10B981' },
  }
  const c = cfg[a.type_alerte] || cfg.info
  return (
    <div style={{
      background: c.bg, borderLeft: `4px solid ${c.color}`, borderRadius: 12, padding: 16, marginBottom: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: c.dot, marginTop: 6 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: c.color, marginBottom: 4 }}>{a.titre}</div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{a.contenu}</div>
            <div style={{ fontSize: 11.5, color: 'var(--hint)', marginTop: 8 }}>{fmtFull(a.date_creation)} · {a.auteur_nom}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onDel && (
            <button onClick={onDel} title="Archiver" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4 }}>✓</button>
          )}
          {onDelete && (
            <button onClick={onDelete} title="Supprimer définitivement" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4, color: 'var(--red)' }}>✕</button>
          )}
        </div>
      </div>
    </div>
  )
}

function ToastBar({ msg, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        background: 'linear-gradient(135deg,#1C1F2E,#2D3148)', color: '#fff',
        padding: '12px 22px', borderRadius: 40, fontSize: 13, fontWeight: 500,
        zIndex: 9998, boxShadow: '0 10px 36px rgba(0,0,0,0.28)', cursor: 'pointer',
        animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <span style={{ fontSize: 15 }}>ℹ️</span> {msg}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{
        width: 36, height: 36, border: '3px solid var(--border)',
        borderTopColor: 'var(--red)', borderRadius: '50%', margin: '0 auto 16px',
        animation: 'spin 0.8s linear infinite',
      }} />
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>Chargement...</div>
    </div>
  )
}

function PageAccueil({ setPage }) {
  const [stats, setStats] = useState({ residents: 0, charges_en_attente: 0, alertes: 0, requetes: 0, total_du: 0 })
  const [loading, setLoading] = useState(true)
  const [alertes, setAlertes] = useState([])
  const [requetes, setRequetes] = useState([])
  
  useEffect(() => {
    Promise.all([get('/residents'), get('/charges/toutes'), get('/alertes'), get('/requetes')])
      .then(([res, ch, al, rq]) => {
        const ea = ch?.filter?.(c => c.statut !== 'paye' && c.statut !== 'payé') || []
        setStats({
          residents: res?.length || 0,
          charges_en_attente: ea.length,
          alertes: al?.length || 0,
          requetes: rq?.filter?.(r => r.statut === 'en_attente')?.length || 0,
          total_du: ea.reduce((s, c) => s + c.montant_restant, 0),
        })
        const sortedAlertes = [...(al || [])].sort((a, b) => new Date(b.date_creation) - new Date(a.date_creation)).slice(0, 3)
        const sortedRequetes = [...(rq || [])].filter(r => r.statut === 'en_attente').sort((a, b) => new Date(b.date_creation) - new Date(a.date_creation)).slice(0, 3)
        setAlertes(sortedAlertes)
        setRequetes(sortedRequetes)
      }).catch(() => { }).finally(() => setLoading(false))
  }, [])
  
  const alertCfg = {
    danger:    { l: 'Urgence',      bg: '#FFF0F0', border: '#F49090', color: '#C41E1E' },
    attention: { l: 'Attention',    bg: '#FFF8E6', border: '#F5C842', color: '#B07D00' },
    info:      { l: 'Information',  bg: '#EBF3FF', border: '#90BBF3', color: '#1A5FB4' },
    succes:    { l: 'Résolu',       bg: '#E6F9F0', border: '#6DD6A2', color: '#1A7E53' },
  }
  
  if (loading) return <Spinner />
  return (
    <div>
      <div className="page-title">Tableau de bord</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Résidents', val: stats.residents, color: '#1A6BB5', bg: '#EBF3FF', icon: '👥' },
          { label: 'Charges en attente', val: stats.charges_en_attente, color: '#B07D00', bg: '#FFF8E6', icon: '📋' },
          { label: 'Total dû', val: fmtDA(stats.total_du), color: '#C41E1E', bg: '#FFECEC', icon: '💰' },
          { label: 'Requêtes à traiter', val: stats.requetes, color: '#7B5EA7', bg: '#F5F0FF', icon: '📬' },
        ].map(({ label, val, color, bg, icon }) => (
          <div style={{
            background: '#fff', borderRadius: 16, padding: '20px 22px',
            border: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: 0.3, textTransform: 'uppercase' }}>{label}</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{icon}</div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: -0.5 }}>{val}</div>
          </div>
        ))}
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>⚠️ Dernières alertes</span>
            <button onClick={() => setPage('alertes')} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Voir tout →</button>
          </div>
          {alertes.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Aucune alerte</div>
          ) : (
            <div style={{ padding: 8 }}>
              {alertes.map(a => {
                const c = alertCfg[a.type_alerte] || alertCfg.info
                return (
                  <div key={a.id} style={{ padding: 12, borderRadius: 10, background: c.bg, borderLeft: `3px solid ${c.color}`, marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: c.color, marginBottom: 4 }}>{a.titre}</div>
                    <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{a.contenu}</div>
                    <div style={{ fontSize: 11, color: 'var(--hint)', marginTop: 6 }}>{fmtFull(a.date_creation)}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>📬 Requêtes en attente</span>
            <button onClick={() => setPage('requetes')} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Voir tout →</button>
          </div>
          {requetes.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Aucune requête</div>
          ) : (
            <div style={{ padding: 8 }}>
              {requetes.map(q => (
                <div key={q.id} style={{ padding: 12, background: '#F8FAFC', borderRadius: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{q.sujet}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 6 }}>{q.contenu}</div>
                  <div style={{ fontSize: 11, color: 'var(--hint)' }}>{q.resident_nom} · Unité {q.unite} · {fmtShort(q.date_creation)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PageResidents({ toast, onOuvrirChat }) {
  const [residents, setResidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [selectedResident, setSelectedResident] = useState(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ residence_id: '', nom: '', prenom: '', email: '', mot_de_passe: '', unite: '', etage: '', telephone: '' })
  const [envoi, setEnvoi] = useState(false)
  const champ = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const charger = async () => { setLoading(true); try { setResidents(await get('/residents')) } finally { setLoading(false) } }
  useEffect(() => { charger() }, [])
  const q = search.toLowerCase().trim()
  const filtered = q
    ? residents.filter(r => (r.nom + ' ' + r.prenom).toLowerCase().includes(q) || r.prenom.toLowerCase().includes(q) || r.nom.toLowerCase().includes(q))
    : residents
  const creer = async e => {
    e.preventDefault(); setEnvoi(true)
    try {
      if (!form.residence_id) { toast('Veuillez sélectionner une résidence'); setEnvoi(false); return }
      const r = await post('/residents', { ...form, etage: parseInt(form.etage) || 0 })
      if (r.succes) { setModal(false); setForm({ residence_id: '', nom: '', prenom: '', email: '', mot_de_passe: '', unite: '', etage: '', telephone: '' }); charger(); toast('Résident créé avec succès !') }
      else toast(r.message)
    } catch (err) { toast(err.message) } finally { setEnvoi(false) }
  }
  const avatarColors = [
    { bg: '#EBF3FF', color: '#1A6BB5' }, { bg: '#E6F9F0', color: '#1A7E53' },
    { bg: '#FFF8E6', color: '#B07D00' }, { bg: '#F5F0FF', color: '#7B5EA7' },
    { bg: '#FFECEC', color: '#C41E1E' }, { bg: '#E0F7FA', color: '#006B7D' },
  ]
  if (loading) return <Spinner />
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div className="page-title">Résidents</div>
        <button className="btn btn-red" onClick={() => setModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Ajouter un résident
        </button>
      </div>
      <div className="card" style={{ padding: 0, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <input
            className="form-input"
            placeholder="Rechercher par nom ou prénom…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 320, fontSize: 13 }}
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Résident</th><th>Résidence</th><th>Unité</th><th>Étage</th><th>Email</th><th>Téléphone</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>Aucun résident trouvé</td></tr>
              ) : (
                filtered.map((r, i) => {
                const av = avatarColors[i % avatarColors.length]
                return (
                  <tr key={r.id}>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <div 
                        onClick={() => setSelectedResident(r)}
                        style={{ width: 36, height: 36, borderRadius: '50%', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, cursor: 'pointer', transition: 'transform 0.15s' }}
                        title="Cliquer pour ouvrir le chat"
                      >{inits(r.prenom, r.nom)}</div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r.prenom} {r.nom}</div>
                    </div></td>
                    <td><span style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{r.residence_nom || 'INNOVIM'}</span></td>
                    <td><strong>{r.unite}</strong></td>
                    <td>{r.etage}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{r.email}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{r.telephone || '—'}</td>
                  </tr>
                )
              })}
              )}
            </tbody>
          </table>
        </div>
      </div>
      {modal && (
        <Modal titre="Ajouter un résident" icone="👤" onFermer={() => setModal(false)}>
          <form onSubmit={creer}>
            <div className="form-group"><label className="form-label">Résidence *</label>
              <select className="form-select" value={form.residence_id} onChange={champ('residence_id')} required>
                <option value="">Sélectionner une résidence</option>
                <option value="1">Baitek</option>
                <option value="2">Baitek 2</option>
                <option value="3">INNOVIM</option>
                <option value="4">INNOVIM 2</option>
              </select>
            </div>
            <div className="form-row-2">
              <div className="form-group"><label className="form-label">Prénom *</label><input className="form-input" value={form.prenom} onChange={champ('prenom')} required /></div>
              <div className="form-group"><label className="form-label">Nom *</label><input className="form-input" value={form.nom} onChange={champ('nom')} required /></div>
            </div>
            <div className="form-group"><label className="form-label">Email *</label><input className="form-input" type="email" value={form.email} onChange={champ('email')} required /></div>
            <div className="form-group"><label className="form-label">Téléphone</label><input className="form-input" value={form.telephone} onChange={champ('telephone')} placeholder="+213 6XX XXX XXX" /></div>
            <div className="form-row-2">
              <div className="form-group"><label className="form-label">Unité *</label><input className="form-input" value={form.unite} onChange={champ('unite')} placeholder="ex: 7C" required /></div>
              <div className="form-group"><label className="form-label">Étage</label><input className="form-input" type="number" value={form.etage} onChange={champ('etage')} placeholder="0" /></div>
            </div>
            <div className="form-group"><label className="form-label">Mot de passe *</label><input className="form-input" type="password" value={form.mot_de_passe} onChange={champ('mot_de_passe')} required /></div>
            <div className="modal-btns">
              <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Annuler</button>
              <button type="submit" className="btn btn-red" style={{ flex: 2 }} disabled={envoi}>{envoi ? 'Création…' : 'Créer le compte'}</button>
            </div>
          </form>
        </Modal>
      )}
      {selectedResident && (
        <Modal titre="Ouvrir le chat" icone="💬" onFermer={() => setSelectedResident(null)} maxWidth={380}>
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: avatarColors[selectedResident.id % avatarColors.length].bg, color: avatarColors[selectedResident.id % avatarColors.length].color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, margin: '0 auto 16px' }}>
              {inits(selectedResident.prenom, selectedResident.nom)}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selectedResident.prenom} {selectedResident.nom}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>{selectedResident.unite} · {selectedResident.residence_nom || 'INNOVIM'}</div>
            <div className="modal-btns">
              <button type="button" className="btn btn-outline" onClick={() => setSelectedResident(null)}>Annuler</button>
              <button type="button" className="btn btn-red" style={{ flex: 2 }} onClick={() => { setSelectedResident(null); onOuvrirChat(selectedResident) }}>
                <span style={{ marginRight: 6 }}>💬</span> Ouvrir le chat
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function PageCharges({ toast }) {
  const [charges, setCharges] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [settingsModal, setSettingsModal] = useState(false)
  const [paiementForm, setPaiementForm] = useState({ montant: '', note: '' })
  const [settingsForm, setSettingsForm] = useState({ montant: '15000' })
  const [activeTab, setActiveTab] = useState('actives')
  const [envoi, setEnvoi] = useState(false)
  
  useEffect(() => { charger(); chargerSettings() }, [])
  
  const charger = () => {
    get('/charges/toutes').then(c => setCharges(c || [])).catch(() => setCharges([])).finally(() => setLoading(false))
  }
  
  const chargerSettings = () => {
    get('/settings/montant-mensuel').then(s => {
      if (s?.montant) setSettingsForm({ montant: s.montant.toString() })
    }).catch(() => {})
  }
  
  const sauvegarderSettings = async e => {
    e.preventDefault()
    try {
      await post('/settings/montant-mensuel', { montant: parseFloat(settingsForm.montant) })
      toast('Paramètres sauvegardés !')
      setSettingsModal(false)
    } catch (err) { toast(err.message) }
  }
  
  const genererCharges = async () => {
    if (!confirm('Générer les charges mensuelles pour tous les résidents ?')) return
    try {
      const res = await post('/charges/generer-mensuelles', {})
      toast(res.message)
      charger()
    } catch (err) { toast(err.message) }
  }
  
  const statuts = { en_attente: { l: 'En attente', c: '#F59E0B' }, paye: { l: 'Payé', c: '#10B981' }, partiel: { l: 'Partiel', c: '#6366F1' }, }
  const getStatut = s => statuts[s] || statuts.en_attente
  
  const chargesActives = charges.filter(c => c.statut !== 'paye')
  const chargesHistory = charges.filter(c => c.statut === 'paye')
  
  const enregistrerPaiement = async e => {
    e.preventDefault()
    if (!paiementForm.montant || parseFloat(paiementForm.montant) <= 0) {
      toast('Veuillez entrer un montant valide')
      return
    }
    setEnvoi(true)
    try {
      await post(`/charges/${modal.id}/payer-admin`, {
        montant: parseFloat(paiementForm.montant),
        note: paiementForm.note
      })
      toast('Paiement enregistré avec succès !')
      setModal(null)
      setPaiementForm({ montant: '', note: '' })
      charger()
    } catch (err) { toast(err.message) } finally { setEnvoi(false) }
  }
  
  if (loading) return <Spinner />
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div className="page-title">Charges</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={() => setSettingsModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            ⚙️ Montant mensuel
          </button>
          <button className="btn btn-red" onClick={genererCharges} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Générer charges mensuelles
          </button>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button 
          onClick={() => setActiveTab('actives')}
          style={{ 
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: activeTab === 'actives' ? 'var(--red)' : 'var(--bg)',
            color: activeTab === 'actives' ? '#fff' : 'var(--muted)',
            fontWeight: 600, fontSize: 13,
          }}
        >
          💰 Charges actives ({chargesActives.length})
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          style={{ 
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: activeTab === 'history' ? 'var(--red)' : 'var(--bg)',
            color: activeTab === 'history' ? '#fff' : 'var(--muted)',
            fontWeight: 600, fontSize: 13,
          }}
        >
          📁 Historique ({chargesHistory.length})
        </button>
      </div>
      
{activeTab === 'actives' && (
        chargesActives.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Aucune charge active</div> : (
          <div className="card" style={{ padding: 0, borderRadius: 16, overflow: 'hidden' }}>
            <table>
              <thead><tr><th>Désignation</th><th>Résident</th><th>Montant</th><th>Échéance</th><th>Statut</th><th>Action</th></tr></thead>
              <tbody>
                {chargesActives.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.designation}</td>
                    <td>{c.resident_nom}</td>
                    <td style={{ fontWeight: 700, color: 'var(--red)' }}>{fmtDA(c.montant_restant)} <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12 }}>/ {fmtDA(c.montant_total)}</span></td>
                    <td>{fmtDate(c.echeance)}</td>
                    <td><span style={{ background: getStatut(c.statut).c + '20', color: getStatut(c.statut).c, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{getStatut(c.statut).l}</span></td>
                    <td>
                      {c.statut !== 'paye' && (
                        <button className="btn btn-green" style={{ padding: '6px 12px', fontSize: 11 }} onClick={() => { setModal(c); setPaiementForm({ montant: c.montant_restant.toString(), note: '' }) }}>
                          💳 Enregistrer paiement
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {modal && (
        <Modal titre="Enregistrer un paiement" icone="💳" onFermer={() => setModal(null)}>
          <form onSubmit={enregistrerPaiement}>
            <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 14, marginBottom: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{modal.designation}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{modal.resident_nom} · Montant total: {fmtDA(modal.montant_total)}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Reste à payer: <span style={{ color: 'var(--red)', fontWeight: 700 }}>{fmtDA(modal.montant_restant)}</span></div>
            </div>
            <div className="form-group">
              <label className="form-label">Montant à payer (DA) *</label>
              <input 
                className="form-input" 
                type="number" 
                value={paiementForm.montant}
                onChange={e => setPaiementForm(f => ({ ...f, montant: e.target.value }))}
                placeholder="Ex: 15000"
                min="1"
                max={modal.montant_restant}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Note (optionnelle)</label>
              <input 
                className="form-input" 
                value={paiementForm.note}
                onChange={e => setPaiementForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Ex: Paiement en espèces"
              />
            </div>
            <div className="modal-btns">
              <button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Annuler</button>
              <button type="submit" className="btn btn-green" style={{ flex: 2 }} disabled={envoi}>
                {envoi ? 'Enregistrement...' : '✅ Confirmer le paiement'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {settingsModal && (
        <Modal titre="Paramètres des charges" icone="⚙️" onFermer={() => setSettingsModal(false)}>
          <form onSubmit={sauvegarderSettings}>
            <div className="form-group">
              <label className="form-label">Montant mensuel par résident (DA) *</label>
              <input 
                className="form-input" 
                type="number"
                value={settingsForm.montant}
                onChange={e => setSettingsForm(f => ({ ...f, montant: e.target.value }))}
                placeholder="Ex: 15000"
                min="1"
                required
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Ce montant sera appliqué à chaque résident lors de la génération mensuelle</div>
            </div>
            <div className="modal-btns">
              <button type="button" className="btn btn-outline" onClick={() => setSettingsModal(false)}>Annuler</button>
              <button type="submit" className="btn btn-red" style={{ flex: 2 }}>Sauvegarder</button>
            </div>
          </form>
        </Modal>
      )}
      
      {activeTab === 'history' && (
        chargesHistory.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Aucun historique</div> : (
          <div className="card" style={{ padding: 0, borderRadius: 16, overflow: 'hidden', opacity: 0.85 }}>
            <table>
              <thead><tr><th>Désignation</th><th>Résident</th><th>Montant payé</th><th>Date paiement</th><th>Statut</th></tr></thead>
              <tbody>
                {chargesHistory.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.designation}</td>
                    <td>{c.resident_nom}</td>
                    <td style={{ fontWeight: 700, color: '#10B981' }}>{fmtDA(c.montant_total)}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtFull(c.date_paiement)}</td>
                    <td><span style={{ background: '#10B98120', color: '#10B981', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>Payé</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

function PageMessagerie({ resident, toast, residentInitial, onCloseInitial }) {
  const [convs, setConvs] = useState([])
  const [actif, setActif] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [texte, setTexte] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const msgsRef = useRef(null)
  const pollingRef = useRef(null)

  useEffect(() => {
    if (residentInitial) {
      setActif(residentInitial)
      onCloseInitial?.()
    }
  }, [residentInitial, onCloseInitial])

  const chargerConvs = useCallback(async (silent = false) => {
    try {
      const data = await get('/messages/conversations')
      const sortedData = [...data].sort((a, b) => {
        if (!a.dernier_message_time && !b.dernier_message_time) return 0
        if (!a.dernier_message_time) return 1
        if (!b.dernier_message_time) return -1
        return new Date(b.dernier_message_time) - new Date(a.dernier_message_time)
      })
      setConvs(prev => {
        sortedData.forEach(c => {
          const old = prev.find(p => p.id === c.id)
          if (old && c.non_lus > 0 && (old.non_lus || 0) === 0 && c.dernier_message) {
            toast(`Nouveau message de ${c.prenom}`)
          }
        })
        return sortedData
      })
    } catch { }
  }, [toast])

  useEffect(() => {
    chargerConvs()
    pollingRef.current = setInterval(() => chargerConvs(true), 5000)
    return () => clearInterval(pollingRef.current)
  }, [chargerConvs])

  useEffect(() => { if (actif) chargerMsgs() }, [actif])

  const chargerMsgs = async () => {
    setLoading(true)
    try { setMsgs(await get(`/messages/prive?avec=${actif.id}`)) }
    catch { setMsgs([]) } finally { setLoading(false) }
  }

  useEffect(() => {
    if (!actif) return
    const t = setInterval(chargerMsgs, 4000)
    return () => clearInterval(t)
  }, [actif])

  const envoyer = async () => {
    const t = texte.trim(); if (!t || sending || !actif) return
    setSending(true)
    try {
      await post('/messages/envoyer-prive', { contenu: t, destinataire_id: actif.id })
      setTexte(''); chargerMsgs()
    } catch (e) { toast(e.message) } finally { setSending(false) }
  }

  const selectConv = r => { setActif(r); setConvs(prev => prev.map(c => c.id === r.id ? { ...c, non_lus: 0 } : c)) }

  const couleurs = ['#E8F5E9', '#E3F2FD', '#FFF3E0', '#F3E5F5', '#FFEBEE', '#E0F7FA', '#F9FBE7']
  const txtCols = ['#2E7D32', '#1565C0', '#E65100', '#7B1FA2', '#C62828', '#00838F', '#827717']

  return (
    <div>
      <div className="page-title">Messagerie</div>
      <div className="page-sub">Conversations privées avec les résidents · actualisation automatique</div>
      <div style={{
        display: 'flex', height: 'calc(100vh - 210px)', minHeight: 500,
        background: '#fff', borderRadius: 20, border: '1px solid var(--border)',
        overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <div style={{ width: 320, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, background: '#FAFAFA' }}>
          <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              Conversations
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
              {convs.reduce((s, c) => s + (c.non_lus || 0), 0) > 0
                ? <span style={{ background: '#fff', color: '#DC2626', padding: '2px 10px', borderRadius: 12, fontWeight: 600, fontSize: 11 }}>
                    {convs.reduce((s, c) => s + (c.non_lus || 0), 0)} nouveau{convs.reduce((s, c) => s + (c.non_lus || 0), 0) > 1 ? 'x' : ''}
                  </span>
                : 'Tout est à jour'}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {convs.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" style={{ marginBottom: 12 }}>
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Aucune conversation</div>
              </div>
            )}
            {convs.map((r, idx) => {
              const hasUnread = r.non_lus > 0
              return (
                <div key={r.id} onClick={() => selectConv(r)} style={{
                  display: 'flex', gap: 12, padding: 16, borderBottom: '1px solid var(--border)',
                  background: actif?.id === r.id ? '#f0f0f0' : 'transparent',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 22,
                    background: '#E8E8E8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: '#64748B', flexShrink: 0,
                  }}>
                    {inits(r.prenom, r.nom)}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <div style={{ fontSize: 14, fontWeight: hasUnread ? 700 : 500, color: hasUnread ? 'var(--text)' : 'var(--muted)' }}>
                        {r.prenom} {r.nom}
                      </div>
                      {hasUnread && (
                        <div style={{
                          background: '#DC2626', color: '#fff', borderRadius: 10,
                          minWidth: 20, height: 20, padding: '0 6px', fontSize: 11, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {r.non_lus}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--hint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.dernier_message || 'Aucun message'}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>🏠 {r.unite}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F5F5F5' }}>
          {!actif ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <div style={{ width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(220,38,38,0.3)' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>Sélectionnez une conversation</div>
                <div style={{ fontSize: 13, color: '#94A3B8' }}>Les conversations avec les résidents apparaissent ici</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 8px rgba(220,38,38,0.3)' }}>
                  {inits(actif.prenom, actif.nom)}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{actif.prenom} {actif.nom}</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>🏠 Unité {actif.unite} · Conversation privée</div>
                </div>
              </div>

              <div ref={msgsRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8, background: '#E8E8E8', backgroundImage: 'radial-gradient(#D4D4D4 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                {loading ? <Spinner /> : msgs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 14 }}>Aucun message. Commencez la conversation !</div>
                ) : msgs.map(m => {
                  const estMoi = m.role === 'admin'
                  return (
                    <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexDirection: estMoi ? 'row-reverse' : 'row' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: estMoi ? '#DC2626' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: estMoi ? '#fff' : '#64748B', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        {estMoi ? 'AD' : inits(actif.prenom, actif.nom)}
                      </div>
                      <div style={{ maxWidth: '70%' }}>
                        <div style={{ padding: '12px 16px', borderRadius: 18, fontSize: 14, lineHeight: 1.55, background: estMoi ? '#DC2626' : '#fff', color: estMoi ? '#fff' : 'var(--text)', borderBottomRightRadius: estMoi ? 4 : 18, borderBottomLeftRadius: estMoi ? 18 : 4, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                          {m.contenu}
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, textAlign: estMoi ? 'right' : 'left' }}>{fmtFull(m.date_envoi)} · {estMoi ? '✓✓' : 'Lu'}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-end', background: '#fff' }}>
                <input
                  className="form-input" value={texte}
                  onChange={e => setTexte(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), envoyer())}
                  placeholder={`Écrire à ${actif.prenom}…`}
                  style={{ flex: 1, borderRadius: 16, background: '#F1F5F9', padding: '12px 16px' }}
                />
                <button
                  className="btn btn-red" onClick={envoyer} disabled={!texte.trim() || sending}
                  style={{ borderRadius: 16, width: 48, height: 48, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: texte.trim() ? 1 : 0.4 }}
                >
                  <span style={{ fontSize: 18 }}>➤</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function PageAlertes({ toast }) {
  const [alertes, setAlertes] = useState([])
  const [alertesHistory, setAlertesHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [activeTab, setActiveTab] = useState('actives')
  const [form, setForm] = useState({ residence_id: '', type_alerte: 'info', titre: '', contenu: '' })
  const [envoi, setEnvoi] = useState(false)
  
  const residences = [
    { id: '1', nom: 'Baitek' },
    { id: '2', nom: 'Baitek 2' },
    { id: '3', nom: 'INNOVIM' },
    { id: '4', nom: 'INNOVIM 2' },
  ]
  
  const alertTypes = [
    { value: 'danger', label: 'Urgence', color: '#C41E1E' },
    { value: 'attention', label: 'Attention', color: '#D97706' },
    { value: 'info', label: 'Information', color: '#1A5FB4' },
  ]

  useEffect(() => { 
    Promise.all([get('/alertes'), get('/alertes/historique')])
      .then(([a, h]) => { setAlertes(a || []); setAlertesHistory(h || []) })
      .catch(() => {})
      .finally(() => setLoading(false)) 
  }, [])
  
  const charger = () => {
    Promise.all([get('/alertes'), get('/alertes/historique')])
      .then(([a, h]) => { setAlertes(a || []); setAlertesHistory(h || []) })
      .catch(() => {})
  }
  
  const creer = async e => {
    e.preventDefault(); setEnvoi(true)
    try {
      await post('/alertes', form)
      toast('Alerte créée avec succès !')
      setModal(false)
      setForm({ residence_id: '', type_alerte: 'info', titre: '', contenu: '' })
      charger()
    } catch (err) { toast(err.message) } finally { setEnvoi(false) }
  }
  
  const supprimer = async id => { 
    if (!confirm('Voulez-vous vraiment supprimer cette alerte définitivement ?')) return
    await del(`/alertes/${id}`); 
    toast('Alerte supprimée définitivement.'); 
    charger() 
  }
  
  const archiver = async id => {
    try {
      await post(`/alertes/${id}/archiver`, {})
      toast('Alerte archivée.')
      charger()
    } catch (err) { toast(err.message) }
  }
  
  if (loading) return <Spinner />
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div className="page-title">Alertes</div>
        <button className="btn btn-red" onClick={() => setModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Créer une alerte
        </button>
      </div>
      
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button 
          onClick={() => setActiveTab('actives')}
          style={{ 
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: activeTab === 'actives' ? 'var(--red)' : 'var(--bg)',
            color: activeTab === 'actives' ? '#fff' : 'var(--muted)',
            fontWeight: 600, fontSize: 13,
          }}
        >
          ⚠️ Alertes actives ({alertes.length})
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          style={{ 
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: activeTab === 'history' ? 'var(--red)' : 'var(--bg)',
            color: activeTab === 'history' ? '#fff' : 'var(--muted)',
            fontWeight: 600, fontSize: 13,
          }}
        >
          📁 Historique ({alertesHistory.length})
        </button>
      </div>
      
      {activeTab === 'actives' ? (
        alertes.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Aucune alerte active</div> : (
          <div style={{ display: 'grid', gap: 12 }}>
            {alertes.map(a => (
              <AlerteCard key={a.id} a={a} onDel={() => archiver(a.id)} onDelete={() => supprimer(a.id)} />
            ))}
          </div>
        )
      ) : (
        alertesHistory.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Aucun historique</div> : (
          <div style={{ display: 'grid', gap: 12, opacity: 0.7 }}>
            {alertesHistory.map(a => (
              <AlerteCard key={a.id} a={a} onDelete={() => supprimer(a.id)} />
            ))}
          </div>
        )
      )}
      {modal && (
        <Modal titre="Créer une alerte" icone="⚠️" onFermer={() => setModal(false)}>
          <form onSubmit={creer}>
            <div className="form-group"><label className="form-label">Résidence *</label>
              <select className="form-select" value={form.residence_id} onChange={e => setForm(f => ({ ...f, residence_id: e.target.value }))} required>
                <option value="">Sélectionner une résidence</option>
                {residences.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Type d'alerte *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {alertTypes.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type_alerte: t.value }))}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 8, border: `2px solid ${form.type_alerte === t.value ? t.color : 'var(--border)'}`,
                      background: form.type_alerte === t.value ? t.color + '15' : 'var(--white)', color: t.color,
                      fontWeight: 600, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group"><label className="form-label">Titre *</label><input className="form-input" value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex: Coupure d'eau" required /></div>
            <div className="form-group"><label className="form-label">Contenu *</label><textarea className="form-textarea" value={form.contenu} onChange={e => setForm(f => ({ ...f, contenu: e.target.value }))} rows={3} placeholder="Décrivez l'alerte..." required /></div>
            <div className="modal-btns">
              <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Annuler</button>
              <button type="submit" className="btn btn-red" style={{ flex: 2 }} disabled={envoi}>{envoi ? 'Création…' : 'Créer l\'alerte'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function PageRequetes({ toast }) {
  const [requetes, setRequetes] = useState([])
  const [requetesHistory, setRequetesHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [activeTab, setActiveTab] = useState('en_attente')
  const [reponse, setReponse] = useState('')
  const [envoi, setEnvoi] = useState(false)
  
  useEffect(() => { 
    Promise.all([get('/requetes'), get('/requetes/historique')])
      .then(([r, h]) => { setRequetes(r || []); setRequetesHistory(h || []) })
      .catch(() => {})
      .finally(() => setLoading(false)) 
  }, [])
  
  const charger = () => {
    Promise.all([get('/requetes'), get('/requetes/historique')])
      .then(([r, h]) => { setRequetes(r || []); setRequetesHistory(h || []) })
      .catch(() => {})
  }
  
  const repondre = async e => {
    e.preventDefault(); if (!reponse.trim()) return; setEnvoi(true)
    try {
      await post(`/requetes/${modal.id}/reply`, { reponse })
      toast('Réponse envoyée !')
      setModal(null); setReponse(''); charger()
    } catch {} finally { setEnvoi(false) }
  }
  
  const supprimer = async id => {
    if (!confirm('Voulez-vous vraiment supprimer cette requête définitivement ?')) return
    try {
      await del(`/requetes/${id}`)
      toast('Requête supprimée.')
      charger()
    } catch (err) { toast(err.message) }
  }
  
  const requetesEnAttente = requetes.filter(r => r.statut === 'en_attente')
  
  if (loading) return <Spinner />
  return (
    <div>
      <div className="page-title">Requêtes</div>
      
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button 
          onClick={() => setActiveTab('en_attente')}
          style={{ 
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: activeTab === 'en_attente' ? 'var(--red)' : 'var(--bg)',
            color: activeTab === 'en_attente' ? '#fff' : 'var(--muted)',
            fontWeight: 600, fontSize: 13,
          }}
        >
          📬 En attente ({requetesEnAttente.length})
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          style={{ 
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: activeTab === 'history' ? 'var(--red)' : 'var(--bg)',
            color: activeTab === 'history' ? '#fff' : 'var(--muted)',
            fontWeight: 600, fontSize: 13,
          }}
        >
          📁 Historique ({requetesHistory.length})
        </button>
      </div>
      
      {activeTab === 'en_attente' ? (
        requetesEnAttente.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Aucune requête en attente</div> : (
          <div style={{ display: 'grid', gap: 12 }}>
            {requetesEnAttente.map(q => (
              <div key={q.id} className="card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{q.sujet}</div>
                <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 12, lineHeight: 1.6 }}>{q.contenu}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--hint)' }}>{q.resident_nom} · Unité {q.unite} · {fmtShort(q.date_creation)}</span>
                  <button className="btn btn-red" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => { setModal(q); setReponse('') }}>Répondre</button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        requetesHistory.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Aucun historique</div> : (
          <div style={{ display: 'grid', gap: 12, opacity: 0.8 }}>
            {requetesHistory.map(q => (
              <div key={q.id} style={{ background: '#F8FAFC', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>{q.sujet}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{q.contenu}</div>
                    <div style={{ fontSize: 11, color: '#10B981', marginBottom: 4 }}>✓ Répondu: {q.reponse}</div>
                    <div style={{ fontSize: 11, color: 'var(--hint)' }}>{q.resident_nom} · Unité {q.unite} · {fmtShort(q.date_creation)}</div>
                  </div>
                  <button 
                    onClick={() => supprimer(q.id)} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 18 }}
                    title="Supprimer définitivement"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
      {modal && (
<Modal titre="Répondre à la requête" icone="✉️" onFermer={() => setModal(null)}>
          <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '12px 14px', marginBottom: 16, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>{modal.sujet}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>{modal.contenu}</div>
          </div>
          <form onSubmit={repondre}>
            <div className="form-group"><label className="form-label">Votre réponse</label><textarea className="form-textarea" value={reponse} onChange={e => setReponse(e.target.value)} rows={4} placeholder="Rédigez votre réponse…" required /></div>
            <div className="modal-btns">
              <button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Annuler</button>
              <button type="submit" className="btn btn-red" style={{ flex: 2 }} disabled={envoi}>{envoi ? 'Envoi…' : 'Envoyer la réponse'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default function AdminApp() {
  const [resident, setResident] = useState(null)
  const [page, setPage] = useState('accueil')
  const [email, setEmail] = useState('admin@innovim.dz')
  const [mdp, setMdp] = useState('admin123')
  const [erreur, setErreur] = useState('')
  const [loading, setLoading] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)
  const [chatResident, setChatResident] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [alertCount, setAlertCount] = useState(0)

  const toast = msg => setToastMsg(msg)

  const ouvrirChatResident = r => {
    setChatResident(r)
    setPage('messagerie')
  }

  const seConnecter = async e => {
    e?.preventDefault(); setErreur(''); setLoading(true)
    try {
      const data = await post('/auth/connexion', { email: email.trim().toLowerCase(), mot_de_passe: mdp })
      if (data.succes && data.resident.role === 'admin') setResident(data.resident)
      else setErreur(data.resident?.role !== 'admin' ? 'Accès réservé à l\'administration' : 'Identifiants incorrects')
    } catch (err) { setErreur(err.message || 'Identifiants incorrects') }
    finally { setLoading(false) }
  }

  const seDeconnecter = async () => {
    try { await post('/auth/deconnexion') } catch { }
    setResident(null); setPage('accueil')
  }

  const fetchBadges = useCallback(async () => {
    try {
      const [convs, al] = await Promise.all([
        get('/messages/conversations'),
        get('/alertes')
      ])
      setUnreadCount((convs || []).reduce((s, c) => s + (c.non_lus || 0), 0))
      setAlertCount((al || []).length)
    } catch { }
  }, [])

  useEffect(() => {
    if (!resident) return
    fetchBadges()
    const t = setInterval(fetchBadges, 15000)
    return () => clearInterval(t)
  }, [resident, fetchBadges])

  // LOGIN
  if (!resident) return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(145deg, #0A0D1A 0%, #0F1628 40%, #1A1035 70%, #0D1520 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ position: 'fixed', top: '15%', left: '20%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(196,30,30,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '20%', right: '15%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(107,62,186,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{
        background: 'rgba(255,255,255,0.98)', borderRadius: 24, padding: '44px 40px 36px',
        width: '100%', maxWidth: 420,
        boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{ width: 54, height: 54, borderRadius: 16, background: 'linear-gradient(135deg,#C41E1E,#8B0F0F)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(196,30,30,0.4)' }}>
            <LogoBatiments size={30} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2.5, color: '#0F1628', lineHeight: 1 }}>BENZAAMIA PROMOTION</div>
            <div style={{ fontSize: 10.5, letterSpacing: 2.5, color: '#6B7280', textTransform: 'uppercase', marginTop: 3, fontWeight: 500 }}>Administration</div>
          </div>
        </div>

        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6, color: '#0F1628', letterSpacing: -0.5 }}>Espace administrateur</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 28, lineHeight: 1.5 }}>Accès réservé à l'administration de la résidence.</div>

        {erreur && (
          <div style={{ background: '#FFECEC', color: '#C41E1E', padding: '11px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16, borderLeft: '3px solid #C41E1E', fontWeight: 500 }}>
            {erreur}
          </div>
        )}

        <form onSubmit={seConnecter}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5, color: '#374151' }}>Email administrateur</label>
            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ height: 44 }} />
          </div>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5, color: '#374151' }}>Mot de passe</label>
            <input className="form-input" type="password" value={mdp} onChange={e => setMdp(e.target.value)} required style={{ height: 44 }} />
          </div>
          <button
            className="btn btn-red" type="submit" disabled={loading}
            style={{ width: '100%', padding: 14, fontSize: 14, fontWeight: 700, borderRadius: 12, background: 'linear-gradient(135deg,#C41E1E,#9B0F0F)', boxShadow: '0 4px 16px rgba(196,30,30,0.35)' }}
          >
            {loading ? 'Connexion…' : 'Accéder au tableau de bord'}
          </button>
        </form>
        <div style={{ fontSize: 11.5, color: '#9CA3AF', textAlign: 'center', marginTop: 18 }}>
          Démo : admin@innovim.dz / admin123
        </div>
      </div>
    </div>
  )

  // MAIN APP
  const navItems = [
    ['accueil',    'Tableau de bord', null,       'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z'],
    ['residents',  'Résidents',       null,       'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z M7 12h2v5H7zm4-3h2v8h-2zm4-3h2v11h-2z'],
    ['charges',    'Charges',         null,       'M1 4h22v16a2 2 0 01-2 2H3a2 2 0 01-2-2V4z M1 10h22'],
    ['messagerie', 'Messagerie',      unreadCount, 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'],
    ['alertes',    'Alertes',         alertCount,   'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01'],
    ['requetes',   'Requêtes',        null,       'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3 M12 17h.01'],
  ]

  const pageMap = {
    accueil:    <PageAccueil setPage={setPage} />,
    residents:  <PageResidents toast={toast} onOuvrirChat={ouvrirChatResident} />,
    charges:    <PageCharges toast={toast} />,
    messagerie: <PageMessagerie resident={resident} toast={toast} residentInitial={chatResident} onCloseInitial={() => setChatResident(null)} />,
    alertes:    <PageAlertes toast={toast} />,
    requetes:   <PageRequetes toast={toast} />,
  }

  const pageTitles = { accueil: 'Tableau de bord', residents: 'Résidents', charges: 'Charges', messagerie: 'Messagerie', alertes: 'Alertes', requetes: 'Requêtes' }

  return (
    <div className="app" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <nav className="sidebar">
        <div className="sidebar-logo">
          <LogoBatiments size={28} />
          <div>
            <div className="logo-name">BENZAAMIA PROMOTION</div>
            <div className="logo-sub">Administration</div>
          </div>
        </div>
        <div className="nav-label">Navigation</div>
        {navItems.map(([id, label, badge, path]) => (
          <button key={id} className={`nav-item${page === id ? ' on' : ''}`} onClick={() => setPage(id)} style={{ position: 'relative' }}>
            <svg viewBox="0 0 24 24"><path d={path} /></svg>
            {label}
            {badge > 0 && (
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'var(--red)', color: '#fff', borderRadius: 10, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, padding: '0 4px' }}>
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </button>
        ))}
        <div className="nav-sep" />
        <div className="nav-bottom">
          <div style={{ padding: '10px 20px', fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
            Connecté :<br />
            <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{resident.prenom} {resident.nom}</span>
          </div>
          <button className="nav-item danger" onClick={seDeconnecter}>
            <svg viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Déconnexion
          </button>
        </div>
      </nav>

      <main className="main">
        <div className="topbar">
          <div className="topbar-title">{pageTitles[page]}</div>
          <div className="topbar-right">
            <span className="topbar-badge">Administration BENZAAMIA PROMOTION</span>
            <div className="topbar-av">{inits(resident.prenom, resident.nom)}</div>
          </div>
        </div>
        <div className="content">{pageMap[page]}</div>
      </main>

      {toastMsg && <ToastBar msg={toastMsg} onClose={() => setToastMsg(null)} />}
    </div>
  )
}