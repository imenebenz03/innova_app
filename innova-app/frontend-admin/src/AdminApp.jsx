import { useState, useEffect, useRef, useCallback } from 'react'
import html2pdf from 'html2pdf.js'
import * as XLSX from 'xlsx'

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

function IconShield({ size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#C41E1E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l7 4v5c0 5-3.5 9.7-7 11-3.5-1.3-7-6-7-11V6l7-4z"/><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.2"/></svg>
}

function IconCoins({ size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#B07D00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v8"/><path d="M9 10h4.5a1.5 1.5 0 0 1 0 3H11"/><path d="M9 13.5h4.5a1.5 1.5 0 0 1 0 3H9"/></svg>
}

function IconMessageSquare({ size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#7B5EA7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v14H6l-3 3V3z"/><path d="M8 9h8"/><path d="M8 13h6"/></svg>
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
const fmtDA = val => {
  if (val == null || isNaN(val)) return '—'
  return Number(val).toLocaleString('fr-DZ', { style: 'currency', currency: 'DZD', maximumFractionDigits: 0 })
}
const STAFF_ROLES = ['super_admin', 'operations', 'finance', 'admin']

const PDF_STYLE = `
  @page { margin: 15mm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1a1a1a; line-height: 1.6; padding: 20px; }
  .header { text-align: center; border-bottom: 2px solid #C41E1E; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 22px; color: #C41E1E; margin-bottom: 4px; }
  .header p { font-size: 12px; color: #666; }
  .meta { display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 20px; }
  .content { font-size: 14px; margin-bottom: 24px; white-space: pre-wrap; }
  .footer { text-align: center; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 12px; margin-top: 32px; }
  .stamp { text-align: right; margin-top: 40px; font-size: 12px; color: #333; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  td, th { padding: 8px 12px; border: 1px solid #ddd; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  .label { color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .value { font-weight: 600; font-size: 14px; }
  .receipt-box { border: 2px solid #C41E1E; border-radius: 8px; padding: 20px; margin: 16px 0; }
  .receipt-box h2 { color: #C41E1E; font-size: 18px; margin-bottom: 12px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 12px 0; }
`

function downloadPDF(htmlContent, filename) {
  const div = document.createElement('div')
  div.innerHTML = `<style>${PDF_STYLE}</style>${htmlContent}`
  div.style.position = 'fixed'
  div.style.left = '-9999px'
  div.style.top = '0'
  div.style.width = '210mm'
  div.style.background = '#fff'
  document.body.appendChild(div)
  html2pdf().from(div).set({
    margin: [15, 15, 15, 15],
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).save().then(() => {
    document.body.removeChild(div)
  }).catch(() => {
    document.body.removeChild(div)
  })
}

function printAlert(a) {
  const typeLabel = { danger: 'Urgence', attention: 'Attention', info: 'Information', succes: 'Résolu' }[a.type_alerte] || 'Information'
  const html = `
    <div class="header">
      <h1>AVIS ${typeLabel.toUpperCase()}</h1>
      <p>${fmtFull(a.date_creation)}</p>
    </div>
    <div class="meta">
      <span>Réf: AL-${String(a.id).padStart(4, '0')}</span>
      <span>Publié par: ${a.auteur_nom}</span>
    </div>
    <h2 style="font-size:18px;margin-bottom:12px">${a.titre}</h2>
    <div class="content">${a.contenu}</div>
    ${a.date_publication ? `<div class="meta"><span>Publiée le: ${fmtFull(a.date_publication)}</span></div>` : ''}
    <div class="footer">Document généré par INNOVA — Administration BENZAAMIA PROMOTION</div>
  `
  downloadPDF(html, `avis-AL-${String(a.id).padStart(4, '0')}.pdf`)
}

function printReceipt(p) {
  const html = `
    <div class="header">
      <h1>REÇU DE PAIEMENT</h1>
      <p>N° ${p.reference}</p>
    </div>
    <div class="receipt-box">
      <h2>BENZAAMIA PROMOTION</h2>
      <div class="grid-2">
        <div><div class="label">Résident</div><div class="value">${p.resident_nom}</div></div>
        <div><div class="label">Unité</div><div class="value">${p.resident_unite}</div></div>
        <div><div class="label">Résidence</div><div class="value">${p.residence_nom}</div></div>
        <div><div class="label">Date de paiement</div><div class="value">${fmtFull(p.date_paiement)}</div></div>
      </div>
      <table>
        <tr><th>Désignation</th><th>Montant</th></tr>
        <tr><td>${p.charge_designation}</td><td style="text-align:right;font-weight:700">${fmtDA(p.montant)}</td></tr>
      </table>
      <div style="text-align:right;font-size:16px;font-weight:700;margin-top:8px">Total: ${fmtDA(p.montant)}</div>
      ${p.note ? `<div style="margin-top:12px"><span class="label">Note:</span> ${p.note}</div>` : ''}
    </div>
    <div class="stamp">Cachet & signature</div>
    <div class="footer">Document généré par INNOVA — Administration BENZAAMIA PROMOTION</div>
  `
  downloadPDF(html, `recu-${p.reference || 'paiement'}.pdf`)
}

async function exportPaymentsExcel(toast) {
  try {
    const rows = await get('/paiements/export')
    if (!rows.length) { toast('Aucun paiement à exporter'); return }
    const data = rows.map(r => ({
      'Résident': r.resident_nom || '',
      'Appartement': r.unite || '',
      'Résidence': r.residence_nom || '',
      'Montant': r.montant || 0,
      'Date': r.date_paiement ? new Date(r.date_paiement).toLocaleDateString('fr-DZ') : '',
      'Méthode': r.methode === 'administration' ? 'Administration' : r.methode || '',
      'Solde restant': r.montant_restant || 0,
      'Statut': r.statut === 'paye' ? 'Payé' : r.statut === 'partiel' ? 'Partiel' : r.statut || ''
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Paiements')
    ws['!cols'] = [
      { wch: 25 }, { wch: 14 }, { wch: 20 },
      { wch: 14 }, { wch: 14 }, { wch: 18 },
      { wch: 14 }, { wch: 12 }
    ]
    XLSX.writeFile(wb, 'paiements.xlsx')
    toast('Export réussi !')
  } catch (e) {
    toast('Erreur export: ' + e.message)
  }
}

const rolePermissions = {
  super_admin: ['accueil', 'residents', 'charges', 'messagerie', 'alertes', 'requetes', 'analytiques', 'profil'],
  operations:  ['accueil', 'residents', 'messagerie', 'alertes', 'requetes', 'profil'],
  finance:     ['accueil', 'charges', 'profil'],
}
const defaultPage = { super_admin: 'accueil', operations: 'accueil', finance: 'accueil' }

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
  const isPinned = a.epingle
  const isScheduled = a.date_publication && new Date(a.date_publication) > new Date()
  return (
    <div style={{
      background: c.bg, borderLeft: `4px solid ${c.color}`, borderRadius: 12, padding: 16, marginBottom: 12,
      outline: isPinned ? `1.5px solid ${c.color}` : 'none', outlineOffset: -1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: c.dot, marginTop: 6 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: c.color }}>{a.titre}</div>
              {isPinned && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 4, background: c.color + '20', color: c.color, fontSize: 10, fontWeight: 700 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                  Épinglé
                </span>
              )}
              {isScheduled && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 4, background: 'rgba(100,116,139,0.15)', color: 'var(--muted)', fontSize: 10, fontWeight: 700 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Programmée
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, marginTop: 4 }}>{a.contenu}</div>
            <div style={{ fontSize: 11.5, color: 'var(--hint)', marginTop: 8 }}>
              {fmtFull(a.date_creation)} · {a.auteur_nom}
              {isScheduled && <> · Publiée le {fmtFull(a.date_publication)}</>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 12, flexShrink: 0 }}>
          <button onClick={() => printAlert(a)} title="Generate Printable Notice" style={{ background: 'none', border: '1px solid '+c.color+'40', borderRadius: 8, cursor: 'pointer', padding: '6px 10px', fontSize: 11, fontWeight: 600, color: c.color, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Generate Printable Notice
          </button>
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

function PageOperations({ setPage }) {
  const [data, setData] = useState(null)
  const [alertes, setAlertes] = useState([])
  const [requetes, setRequetes] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    Promise.all([get('/dashboard/operations'), get('/alertes'), get('/requetes')])
      .then(([d, al, rq]) => {
        setData(d)
        const sortedAlertes = [...(al || [])].sort((a, b) => new Date(b.date_creation) - new Date(a.date_creation)).slice(0, 3)
        const sortedRequetes = [...(rq || [])].filter(r => r.statut === 'en_attente').sort((a, b) => new Date(b.date_creation) - new Date(a.date_creation)).slice(0, 3)
        setAlertes(sortedAlertes)
        setRequetes(sortedRequetes)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  if (loading) return <Spinner />
  if (!data) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Erreur de chargement</div>
  const alertCfg = {
    danger:    { l: 'Urgence',      bg: '#FFF0F0', border: '#F49090', color: '#C41E1E' },
    attention: { l: 'Attention',    bg: '#FFF8E6', border: '#F5C842', color: '#B07D00' },
    info:      { l: 'Information',  bg: '#EBF3FF', border: '#90BBF3', color: '#1A5FB4' },
    succes:    { l: 'Résolu',       bg: '#E6F9F0', border: '#6DD6A2', color: '#1A7E53' },
  }
  return (
    <div>
      <div className="page-title">Tableau de bord — Gestion</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Requêtes ouvertes', val: data.requetes_ouvertes || 0, color: '#C41E1E', bg: '#FFECEC' },
          { label: 'En cours', val: data.requetes_en_cours || 0, color: '#1A6BB5', bg: '#EBF3FF' },
          { label: 'Résolues', val: data.requetes_resolues || 0, color: '#1A7E53', bg: '#E6F9F0' },
          { label: 'Taux occupation', val: `${data.taux_occupation || 0}%`, color: '#7B5EA7', bg: '#F5F0FF' },
        ].map(({ label, val, color, bg }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: -0.5 }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Dernières alertes</span>
            <button onClick={() => setPage('alertes')} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Voir tout →</button>
          </div>
          {(alertes || []).length === 0 ? (
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
            <span style={{ fontSize: 15, fontWeight: 700 }}>Requêtes en attente</span>
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

function PageFinance() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { get('/dashboard/finance').then(setData).catch(() => {}).finally(() => setLoading(false)) }, [])
  if (loading) return <Spinner />
  if (!data) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Erreur de chargement</div>
  const maxChart = Math.max(...(data.mensuel || []).map(m => m.total || 0), 1)
  return (
    <div>
      <div className="page-title">Tableau de bord — Finance</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total facturé', val: data.total_facture ? fmtDA(data.total_facture) : '—', color: '#1A6BB5', bg: '#EBF3FF' },
          { label: 'Total collecté', val: data.total_collecte ? fmtDA(data.total_collecte) : '—', color: '#1A7E53', bg: '#E6F9F0' },
          { label: 'Taux de collecte', val: `${data.taux_collecte || 0}%`, color: '#B07D00', bg: '#FFF8E6' },
          { label: 'Impayés (total)', val: data.impayes_total ? fmtDA(data.impayes_total) : '—', color: '#C41E1E', bg: '#FFECEC' },
        ].map(({ label, val, color, bg }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: -0.5 }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Paiements mensuels (6 mois)</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 120 }}>
            {(data.mensuel || []).map(m => (
              <div key={m.mois} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', background: '#1A6BB5', borderRadius: '4px 4px 0 0', height: Math.max((m.total / maxChart) * 100, 4), minHeight: 4 }} />
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{m.mois?.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Derniers paiements</h3>
          {(data.derniers_paiements || []).length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Aucun paiement récent</div>
          ) : (
            <table style={{ width: '100%', fontSize: 12 }}>
              <thead><tr><th style={{ textAlign: 'left' }}>Résident</th><th style={{ textAlign: 'right' }}>Montant</th></tr></thead>
              <tbody>
                {data.derniers_paiements.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 0' }}>{p.resident_nom}</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: '#1A7E53' }}>{fmtDA(p.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div style={{ marginTop: 18 }}>
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Charges en retard</h3>
          {(data.impayes || []).length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Aucune charge en retard</div>
          ) : (
            <table style={{ width: '100%', fontSize: 12 }}>
              <thead><tr><th style={{ textAlign: 'left' }}>Résident</th><th style={{ textAlign: 'left' }}>Unité</th><th style={{ textAlign: 'right' }}>Dû</th></tr></thead>
              <tbody>
                {data.impayes.map(i => (
                  <tr key={i.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 0' }}>{i.resident_nom}</td>
                    <td style={{ padding: '6px 0' }}>{i.unite}</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: '#C41E1E' }}>{fmtDA(i.montant_restant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function PageResidents({ toast, onOuvrirChat, onViewProfil }) {
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
    ? residents.filter(r => (r.nom + ' ' + r.prenom).toLowerCase().includes(q) || r.prenom.toLowerCase().includes(q) || r.nom.toLowerCase().includes(q) || (r.unite || '').toLowerCase().includes(q))
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
            placeholder="Rechercher par nom, prénom ou appartement…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 320, fontSize: 13 }}
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Résident</th><th>Résidence</th><th>Unité</th><th>Étage</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>Aucun résident trouvé</td></tr>
              ) : filtered.map((r, i) => {
                const av = avatarColors[i % avatarColors.length]
                return (
                  <tr key={r.id}>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <div 
                        onClick={() => setSelectedResident(r)}
                        style={{ width: 36, height: 36, borderRadius: '50%', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, cursor: 'pointer', transition: 'transform 0.15s' }}
                        title="Cliquer pour ouvrir"
                      >{inits(r.prenom, r.nom)}</div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r.prenom} {r.nom}</div>
                    </div></td>
                    <td><span style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{r.residence_nom || 'INNOVIM'}</span></td>
                    <td><strong>{r.unite}</strong></td>
                    <td>{r.etage}</td>
                  </tr>
                )
              })}
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
        <Modal titre={selectedResident.prenom + ' ' + selectedResident.nom} icone="👤" onFermer={() => setSelectedResident(null)} maxWidth={440}>
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: avatarColors[selectedResident.id % avatarColors.length].bg, color: avatarColors[selectedResident.id % avatarColors.length].color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, margin: '0 auto 16px' }}>
              {inits(selectedResident.prenom, selectedResident.nom)}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selectedResident.prenom} {selectedResident.nom}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>{selectedResident.unite} · {selectedResident.residence_nom || 'INNOVIM'}</div>
            <div className="modal-btns" style={{ flexDirection: 'column', gap: 8 }}>
              <button type="button" className="btn btn-red" style={{ width: '100%' }} onClick={() => { setSelectedResident(null); onOuvrirChat(selectedResident) }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> Ouvrir le chat
              </button>
              <button type="button" className="btn btn-outline" style={{ width: '100%' }} onClick={() => { const r = selectedResident; setSelectedResident(null); onViewProfil(r.id) }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Voir le profil
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
  const [chargeSearch, setChargeSearch] = useState('')
  const [settingsForm, setSettingsForm] = useState({ montant: '15000' })
  const [activeTab, setActiveTab] = useState('actives')
  const [envoi, setEnvoi] = useState(false)
  const [lastReceipt, setLastReceipt] = useState(null)
  
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
  const cq = chargeSearch.toLowerCase().trim()
  const filteredActives = cq ? chargesActives.filter(c => (c.resident_nom || '').toLowerCase().includes(cq)) : chargesActives
  const filteredHistory = cq ? chargesHistory.filter(c => (c.resident_nom || '').toLowerCase().includes(cq)) : chargesHistory
  
  const enregistrerPaiement = async e => {
    e.preventDefault()
    if (!paiementForm.montant || parseFloat(paiementForm.montant) <= 0) {
      toast('Veuillez entrer un montant valide')
      return
    }
    setEnvoi(true)
    try {
      const r = await post(`/charges/${modal.id}/payer-admin`, {
        montant: parseFloat(paiementForm.montant),
        note: paiementForm.note
      })
      toast('Paiement enregistré avec succès !')
      if (r.paiement_id) {
        const p = await get(`/paiements/${r.paiement_id}`)
        setLastReceipt(p)
        setTimeout(() => { try { printReceipt(p) } catch (e) { toast('Erreur génération PDF: '+e.message) } }, 500)
      }
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
          {lastReceipt && (
            <button className="btn btn-green" onClick={() => { printReceipt(lastReceipt); setLastReceipt(null) }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Télécharger le reçu (PDF)
            </button>
          )}
          <button className="btn btn-outline" onClick={() => setSettingsModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            ⚙️ Montant mensuel
          </button>
          <button className="btn btn-red" onClick={genererCharges} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Générer charges mensuelles
          </button>
          <button className="btn btn-outline" onClick={() => exportPaymentsExcel(toast)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Export Excel
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
      
      <div style={{ marginBottom: 16 }}>
        <input
          className="form-input"
          placeholder="Rechercher par nom du résident…"
          value={chargeSearch}
          onChange={e => setChargeSearch(e.target.value)}
          style={{ maxWidth: 320, fontSize: 13 }}
        />
      </div>

{activeTab === 'actives' && (
        chargesActives.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Aucune charge active</div> : (
          <div className="card" style={{ padding: 0, borderRadius: 16, overflow: 'hidden' }}>
            <table>
              <thead><tr><th>Désignation</th><th>Résident</th><th>Montant</th><th>Échéance</th><th>Statut</th><th>Action</th></tr></thead>
              <tbody>
                {filteredActives.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>Aucun résultat</td></tr>
                ) : filteredActives.map(c => (
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
                  <thead><tr><th>Désignation</th><th>Résident</th><th>Montant payé</th><th>Date paiement</th><th>Statut</th><th></th></tr></thead>
                  <tbody>
                    {filteredHistory.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>Aucun résultat</td></tr>
                    ) : filteredHistory.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.designation}</td>
                        <td>{c.resident_nom}</td>
                        <td style={{ fontWeight: 700, color: '#10B981' }}>{fmtDA(c.montant_total)}</td>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtFull(c.date_paiement)}</td>
                        <td><span style={{ background: '#10B98120', color: '#10B981', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>Payé</span></td>
                        <td>
                          <button onClick={async () => { try { const ps = await get(`/charges/${c.id}/paiements`); const p = await get(`/paiements/${ps[0].id}`); printReceipt(p) } catch {} }} title="Télécharger le reçu en PDF (A4)" style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: '6px 10px', fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                            PDF Reçu
                          </button>
                        </td>
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
  const [convSearch, setConvSearch] = useState('')
  const [actif, setActif] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [texte, setTexte] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const msgsRef = useRef(null)
  const pollingRef = useRef(null)
  const sq = convSearch.toLowerCase().trim()
  const filteredConvs = sq
    ? convs.filter(c => (c.prenom + ' ' + c.nom).toLowerCase().includes(sq) || (c.unite || '').toLowerCase().includes(sq))
    : convs

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
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
            <input
              className="form-input"
              placeholder="Rechercher un résident ou appartement…"
              value={convSearch}
              onChange={e => setConvSearch(e.target.value)}
              style={{ fontSize: 12, padding: '8px 12px', borderRadius: 10 }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredConvs.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" style={{ marginBottom: 12 }}>
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Aucune conversation</div>
              </div>
            )}
            {filteredConvs.map((r, idx) => {
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

function PageAlertes({ toast, role }) {
  const [alertes, setAlertes] = useState([])
  const [alertesHistory, setAlertesHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [activeTab, setActiveTab] = useState('actives')
  const [form, setForm] = useState({ residence_id: '', type_alerte: 'info', titre: '', contenu: '', epingle: false, date_publication: '' })
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
      .catch(e => toast(e.message))
      .finally(() => setLoading(false)) 
  }, [])
  
  const charger = () => {
    Promise.all([get('/alertes'), get('/alertes/historique')])
      .then(([a, h]) => { setAlertes(a || []); setAlertesHistory(h || []) })
      .catch(e => toast(e.message))
  }
  
  const creer = async e => {
    e.preventDefault(); setEnvoi(true)
    try {
      await post('/alertes', { ...form, epingle: form.epingle ? 1 : 0 })
      toast('Alerte créée avec succès !')
      setModal(false)
      setForm({ residence_id: '', type_alerte: 'info', titre: '', contenu: '', epingle: false, date_publication: '' })
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
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                <div onClick={() => setForm(f => ({ ...f, epingle: !f.epingle }))} style={{
                  width: 44, height: 24, borderRadius: 12, position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                  background: form.epingle ? 'var(--red)' : '#CBD5E1',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, transition: 'left 0.2s',
                    left: form.epingle ? 22 : 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: 'middle', marginRight: 4 }}><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                  Épingler en haut
                </span>
              </label>
            </div>
            <div className="form-group">
              <label className="form-label">Programmer la publication (optionnel)</label>
              <input
                className="form-input"
                type="datetime-local"
                value={form.date_publication}
                onChange={e => setForm(f => ({ ...f, date_publication: e.target.value }))}
                style={{ fontSize: 13 }}
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Laissez vide pour publier immédiatement</div>
            </div>
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
  const [selectedRole, setSelectedRole] = useState('super_admin')
  const [email, setEmail] = useState('admin@innovim.dz')
  const [mdp, setMdp] = useState('admin123')
  const [erreur, setErreur] = useState('')
  const [loading, setLoading] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)
  const [chatResident, setChatResident] = useState(null)
  const [profilResidentId, setProfilResidentId] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [alertCount, setAlertCount] = useState(0)
  const handleViewProfil = rid => { setProfilResidentId(rid); setPage('profil') }

  const roleCreds = {
    super_admin: { email: 'admin@innovim.dz', mdp: 'admin123', label: 'Super Admin', desc: 'Accès complet à toutes les fonctionnalités' },
    finance:     { email: 'finance@innovim.dz', mdp: 'admin123', label: 'Finance', desc: 'Gestion des charges et paiements' },
    operations:  { email: 'operations@innovim.dz', mdp: 'admin123', label: 'Gestion', desc: 'Messagerie, alertes et requêtes' },
  }

  const toast = msg => setToastMsg(msg)

  const ouvrirChatResident = r => {
    setChatResident(r)
    setPage('messagerie')
  }

  const choisirRole = role => {
    setSelectedRole(role)
    setEmail(roleCreds[role].email)
    setMdp(roleCreds[role].mdp)
    setErreur('')
  }

  const seConnecter = async e => {
    e?.preventDefault(); setErreur(''); setLoading(true)
    try {
      const data = await post('/auth/connexion', { email: email.trim().toLowerCase(), mot_de_passe: mdp })
      if (data.succes && STAFF_ROLES.includes(data.resident.role)) setResident(data.resident)
      else if (data.succes) setErreur('Accès réservé à l\'administration')
      else setErreur('Identifiants incorrects')
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
        width: '100%', maxWidth: 460,
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

        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6, color: '#0F1628', letterSpacing: -0.5 }}>Espace administration</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 24, lineHeight: 1.5 }}>Sélectionnez un profil pour accéder au tableau de bord.</div>

        {erreur && (
          <div style={{ background: '#FFECEC', color: '#C41E1E', padding: '11px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16, borderLeft: '3px solid #C41E1E', fontWeight: 500 }}>
            {erreur}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {Object.entries(roleCreds).map(([key, cred]) => (
            <button
              key={key}
              type="button"
              onClick={() => choisirRole(key)}
              style={{
                flex: 1, padding: '14px 8px', borderRadius: 12, cursor: 'pointer',
                border: `2px solid ${selectedRole === key ? '#C41E1E' : '#E5E7EB'}`,
                background: selectedRole === key ? '#FFF5F5' : '#FAFAFA',
                textAlign: 'center', transition: 'all 0.15s',
              }}
            >
              <div style={{ marginBottom: 4 }}>
                {key === 'super_admin' ? <IconShield /> : key === 'finance' ? <IconCoins /> : <IconMessageSquare />}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: selectedRole === key ? '#C41E1E' : '#374151' }}>{cred.label}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2, lineHeight: 1.3 }}>{cred.desc}</div>
            </button>
          ))}
        </div>

        <form onSubmit={seConnecter}>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: 12.5, color: '#374151' }}>Email</label>
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
            {loading ? 'Connexion…' : `Accéder en tant que ${roleCreds[selectedRole]?.label || ''}`}
          </button>
        </form>
      </div>
    </div>
  )

  function PageAnalytiques() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    useEffect(() => { get('/analytics').then(setData).catch(() => {}).finally(() => setLoading(false)) }, [])
    if (loading) return <Spinner />
    if (!data) return <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Erreur de chargement</div>

    const maxMensuel = Math.max(...(data.mensuel?.map(m => m.total) || [0]), 1)
    const maxImpayes = Math.max(...(data.impayes?.map(i => i.total) || [0]), 1)
    const maxMsg     = Math.max(...(data.messages_7j?.map(m => m.count) || [0]), 1)
    const reqTotal   = data.requetes?.reduce((s, r) => s + r.count, 0) || 1

    return (
      <div>
        <div className="page-title">Analytiques</div>

        {/* KPI cards */}
        <div className="stats-row">
          <div className="stat-card" style={{ background: '#EBF3FF' }}>
            <div className="stat-val">{data.taux_collecte}%</div>
            <div className="stat-lbl">Taux de collecte</div>
          </div>
          <div className="stat-card" style={{ background: '#E6F9F0' }}>
            <div className="stat-val">{fmtDA(data.total_percu)}</div>
            <div className="stat-lbl">Total perçu</div>
          </div>
          <div className="stat-card" style={{ background: '#FFF8E6' }}>
            <div className="stat-val">{fmtDA(data.total_facture - data.total_percu)}</div>
            <div className="stat-lbl">Restant à percevoir</div>
          </div>
          <div className="stat-card" style={{ background: '#FFECEC' }}>
            <div className="stat-val">{data.mauvais_payeurs?.length || 0}</div>
            <div className="stat-lbl">Mauvais payeurs (top)</div>
          </div>
          <div className="stat-card" style={{ background: '#F5F0FF' }}>
            <div className="stat-val">{data.total_residents}</div>
            <div className="stat-lbl">Résidents</div>
          </div>
          <div className="stat-card" style={{ background: '#E0F7FA' }}>
            <div className="stat-val">{data.requetes_ouvertes}</div>
            <div className="stat-lbl">Requêtes ouvertes</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
          {/* Monthly payments chart */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Paiements mensuels</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 140 }}>
              {(data.mensuel || []).map(m => (
                <div key={m.mois} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', background: '#1A6BB5', borderRadius: '4px 4px 0 0', height: Math.max((m.total / maxMensuel) * 120, 4), minHeight: 4, transition: 'height 0.3s' }} />
                  <span style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{m.mois?.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Unpaid by residence */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Impayés par résidence</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(data.impayes || []).map(i => (
                <div key={i.nom_complet}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span>{i.nom_complet}</span>
                    <span style={{ fontWeight: 600 }}>{fmtDA(i.total)}</span>
                  </div>
                  <div style={{ background: 'var(--border)', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${(i.total / maxImpayes) * 100}%`, height: '100%', background: '#C41E1E', borderRadius: 6, transition: 'width 0.3s' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Requests by status */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Requêtes par statut</h3>
            <div style={{ display: 'flex', gap: 12 }}>
              {(data.requetes || []).map(r => {
                const colors = { en_attente: '#FF6B35', resolu: '#1A7E53', en_cours: '#1A6BB5' }
                return (
                  <div key={r.statut} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: colors[r.statut] || 'var(--muted)' }}>{r.count}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{r.statut === 'en_attente' ? 'En attente' : r.statut === 'resolu' ? 'Résolu' : r.statut}</div>
                    <div style={{ background: 'var(--border)', borderRadius: 6, height: 8, marginTop: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${(r.count / reqTotal) * 100}%`, height: '100%', background: colors[r.statut] || '#999', borderRadius: 6 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top delinquents */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Mauvais payeurs</h3>
            {(data.mauvais_payeurs || []).length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Aucun impayé</div>
            ) : (
              <table style={{ width: '100%', fontSize: 12 }}>
                <thead><tr><th style={{ textAlign: 'left', padding: '4px 0' }}>Résident</th><th style={{ textAlign: 'left', padding: '4px 0' }}>Unité</th><th style={{ textAlign: 'right', padding: '4px 0' }}>Dû</th></tr></thead>
                <tbody>
                  {(data.mauvais_payeurs || []).map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 0' }}>{r.nom}</td>
                      <td style={{ padding: '6px 0' }}>{r.unite}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: '#C41E1E' }}>{fmtDA(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Messages last 7 days */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Messages (7 derniers jours)</h3>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 100 }}>
              {(data.messages_7j || []).map(m => (
                <div key={m.jour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', background: '#7B5EA7', borderRadius: '4px 4px 0 0', height: Math.max((m.count / maxMsg) * 80, 4), minHeight: 4 }} />
                  <span style={{ fontSize: 9, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{m.jour?.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alert count */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Alertes actives</h3>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#C41E1E' }}>{data.total_alertes}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>alertes en cours</div>
          </div>
        </div>
      </div>
    )
  }


  // -- PROFIL PAGE ----------------------------------------------------------------

  const ROLE_LABELS = {
    super_admin: 'Super Administrateur',
    finance: 'Finance',
    operations: 'Gestion',
    admin: 'Administrateur',
    resident: 'Résident',
  }

  function PageProfil({ residentId, role, toast }) {
    const [data, setData] = useState(null)
    const [finances, setFinances] = useState(null)
    const [loading, setLoading] = useState(true)
    const [historyModal, setHistoryModal] = useState(false)
    const [historyTab, setHistoryTab] = useState('paiements')
    const [historyData, setHistoryData] = useState(null)
    const [historyLoading, setHistoryLoading] = useState(false)
    const isOwn = !residentId

    const fetchProfile = useCallback(async () => {
      setLoading(true)
      try {
        if (isOwn) {
          const d = await get('/auth/profil')
          setData(d)
          if (role === 'super_admin' || role === 'finance') {
            try { setFinances(await get(`/residents/${d.id}/finances`)) } catch {}
          }
        } else {
          const [d, f] = await Promise.all([
            get(`/residents/${residentId}`),
            (role === 'super_admin' || role === 'finance') ? get(`/residents/${residentId}/finances`) : Promise.resolve(null)
          ])
          setData(d); setFinances(f)
        }
      } catch (err) { toast(err.message) } finally { setLoading(false) }
    }, [residentId, role, isOwn])

    useEffect(() => { fetchProfile() }, [fetchProfile])

    const openHistory = async tab => {
      setHistoryTab(tab); setHistoryModal(true); setHistoryLoading(true); setHistoryData(null)
      const id = residentId || data?.id
      try {
        if (tab === 'paiements' || tab === 'historique') {
          setHistoryData(await get(`/paiements?resident_id=${id}`))
        } else if (tab === 'requetes') {
          const all = await get('/requetes')
          setHistoryData(Array.isArray(all) ? all.filter(r => r.resident_id === id) : [])
        } else if (tab === 'reclamations') {
          const all = await get('/requetes')
          setHistoryData(Array.isArray(all) ? all.filter(r => r.resident_id === id && /plainte|reclam|probleme|nuisance/i.test(r.sujet + ' ' + r.contenu)) : [])
        }
      } catch {} finally { setHistoryLoading(false) }
    }

    const tabs = [
      { id: 'paiements', label: 'Tous les paiements', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>' },
      { id: 'historique', label: 'Historique des paiements', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
      { id: 'requetes', label: 'Demandes de maintenance', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>' },
      { id: 'reclamations', label: 'Réclamations', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' },
    ]

    if (loading) return <Spinner />

    if (!data) return <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>Profil introuvable</div>

    return (
      <div>
        {/* Header card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 16 }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--red-deep) 0%, #2D1A1A 100%)',
            padding: '36px 32px',
            display: 'flex',
            alignItems: 'center',
            gap: 24,
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 700, color: '#fff', flexShrink: 0,
              border: '3px solid rgba(255,255,255,0.2)',
            }}>
              {inits(data.prenom, data.nom)}
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                {data.prenom} {data.nom}
              </div>
              <span className="pill" style={{
                background: role === 'super_admin' ? 'rgba(239,68,68,0.3)' : role === 'finance' ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)',
                color: '#fff', border: '1px solid rgba(255,255,255,0.15)',
              }}>
                {ROLE_LABELS[data.role] || data.role}
              </span>
            </div>
          </div>
        </div>

        {/* General Information */}
        <div className="card" style={{ borderRadius: 16 }}>
          <div className="sec">Informations générales</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              ['Nom complet', `${data.prenom} ${data.nom}`],
              ['Appartement', data.unite],
              ['Résidence', data.residence_nom || '—'],
              ['Téléphone', data.telephone || '—'],
              ['Email', data.email],
              ['Statut', ROLE_LABELS[data.role] || data.role],
            ].map(([label, val]) => (
              <div key={label} style={{
                padding: '14px 16px', background: 'var(--bg)', borderRadius: 12,
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Information (super_admin / finance only) */}
        {(role === 'super_admin' || role === 'finance') && finances && (
          <div className="card" style={{ borderRadius: 16 }}>
            <div className="sec">Informations financières</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { label: 'Total charges', val: finances.total_charges, color: 'var(--blue)', bg: 'var(--blue-l)' },
                { label: 'Total payé', val: finances.total_paid, color: 'var(--green)', bg: 'var(--green-l)' },
                { label: 'Reste à payer', val: finances.remaining, color: 'var(--red)', bg: 'var(--red-light)' },
              ].map(s => (
                  <div key={s.label} style={{
                    padding: 20, background: s.bg, borderRadius: 12,
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{fmtDA(s.val)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History button */}
        <div style={{ marginTop: 8 }}>
          <button className="btn btn-outline" onClick={() => openHistory('paiements')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Historique
          </button>
        </div>

        {/* History Modal */}
        {historyModal && (
          <div className="modal-overlay" onClick={() => setHistoryModal(false)}>
            <div className="modal" style={{ maxWidth: 640, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div className="modal-title" style={{ flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Historique
                <button onClick={() => setHistoryModal(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--muted)', padding: '4px 8px', borderRadius: 6 }}>✕</button>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0, marginBottom: 16, flexShrink: 0 }}>
                {tabs.map(t => (
                  <button key={t.id} onClick={() => openHistory(t.id)} style={{
                    padding: '10px 16px', border: 'none', background: historyTab === t.id ? 'var(--bg)' : 'transparent',
                    borderRadius: '8px 8px 0 0', fontWeight: historyTab === t.id ? 600 : 500,
                    color: historyTab === t.id ? 'var(--text)' : 'var(--muted)',
                    cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
                    borderBottom: historyTab === t.id ? '2px solid var(--red)' : '2px solid transparent',
                  }}>
                    <span dangerouslySetInnerHTML={{ __html: t.icon }} /> {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, overflowY: 'auto', minHeight: 200 }}>
                {historyLoading ? <Spinner /> : !historyData || historyData.length === 0 ? (
                  <div className="empty-state"><div className="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--hint)' }}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg></div><div className="empty-title">Aucune donnée</div><div className="empty-sub">Aucun élément trouvé pour cette section</div></div>
                ) : (
                  <div>
                    {(historyTab === 'paiements' || historyTab === 'historique') && (
                      <table style={{ fontSize: 12 }}>
                        <thead><tr><th>Date</th><th>Désignation</th><th>Montant</th><th>Référence</th><th>Méthode</th></tr></thead>
                        <tbody>
                          {historyData.map(p => (
                            <tr key={p.id}>
                              <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.date_paiement)}</td>
                              <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.designation}</td>
                              <td style={{ fontWeight: 600, color: 'var(--green)' }}>{fmtDA(p.montant)}</td>
                              <td style={{ fontSize: 10, color: 'var(--hint)' }}>{p.reference || '—'}</td>
                              <td><span className="pill pill-blue">{p.methode === 'administration' ? 'Admin' : 'En ligne'}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {(historyTab === 'requetes' || historyTab === 'reclamations') && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {historyData.map(r => (
                          <div key={r.id} style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{r.sujet}</div>
                              <span className={`pill ${r.statut === 'resolu' ? 'pill-green' : r.statut === 'en_attente' ? 'pill-gold' : 'pill-gray'}`}>
                                {r.statut === 'resolu' ? 'Résolu' : r.statut === 'en_attente' ? 'En attente' : r.statut}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{r.contenu}</div>
                            {r.reponse && (
                              <div style={{ marginTop: 8, padding: '8px 12px', background: '#fff', borderRadius: 8, borderLeft: '3px solid var(--green)', fontSize: 12, color: 'var(--text)' }}>
                                <span style={{ fontWeight: 600, color: 'var(--green)' }}>Réponse: </span>{r.reponse}
                              </div>
                            )}
                            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--hint)' }}>
                              {fmtDate(r.date_creation)}
                              {r.date_reponse && <> · Résolu le {fmtDate(r.date_reponse)}</>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }


  // MAIN APP
  const navItemsAll = [
    ['accueil',    'Tableau de bord', null,       'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z'],
    ['residents',  'Résidents',       null,       'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z M7 12h2v5H7zm4-3h2v8h-2zm4-3h2v11h-2z'],
    ['charges',    'Charges',         null,       'M1 4h22v16a2 2 0 01-2 2H3a2 2 0 01-2-2V4z M1 10h22'],
    ['messagerie', 'Messagerie',      unreadCount, 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'],
    ['alertes',    'Alertes',         alertCount,   'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01'],
    ['requetes',   'Requêtes',        null,       'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3 M12 17h.01'],
    ['analytiques', 'Analytiques',      null,       'M18 20V10M12 20V4M6 20v-6'],
  ]
  const role = resident?.role === 'admin' ? 'super_admin' : resident?.role
  const allowedPages = rolePermissions[role] || []
  const navItems = navItemsAll.filter(([id]) => allowedPages.includes(id) && id !== 'profil')

  const pageTitles = {
    accueil: role === 'finance' ? 'Finance' : role === 'operations' ? 'Gestion' : 'Tableau de bord',
    residents: 'Résidents', charges: 'Charges', messagerie: 'Messagerie',
    alertes: 'Alertes', requetes: 'Requêtes', analytiques: 'Analytiques'
  }

  const pageMap = {
    accueil: role === 'operations' ? <PageOperations setPage={setPage} /> : role === 'finance' ? <PageFinance /> : <PageAccueil setPage={setPage} />,
    residents:  <PageResidents toast={toast} onOuvrirChat={ouvrirChatResident} onViewProfil={handleViewProfil} />,
    charges:    <PageCharges toast={toast} />,
    messagerie: <PageMessagerie resident={resident} toast={toast} residentInitial={chatResident} onCloseInitial={() => setChatResident(null)} />,
    alertes:    <PageAlertes toast={toast} role={role} />,
    requetes:   <PageRequetes toast={toast} />,
    analytiques: <PageAnalytiques />,
    profil: <PageProfil residentId={profilResidentId} role={role} toast={toast} />,
  }

  const currentPage = allowedPages.includes(page) ? page : allowedPages[0]

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
          <button key={id} className={`nav-item${currentPage === id ? ' on' : ''}`} onClick={() => { if (id === 'profil') setProfilResidentId(null); setPage(id) }} style={{ position: 'relative' }}>
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
          <div className="topbar-title">{pageTitles[currentPage]}</div>
          <div className="topbar-right">
            <span className="topbar-badge">Administration · {role === 'super_admin' ? 'Super Admin' : role === 'operations' ? 'Gestion' : role === 'finance' ? 'Finance' : role}</span>
            <div className="topbar-av">{inits(resident.prenom, resident.nom)}</div>
          </div>
        </div>
        <div className="content">{pageMap[currentPage]}</div>
      </main>

      {toastMsg && <ToastBar msg={toastMsg} onClose={() => setToastMsg(null)} />}
    </div>
  )
}