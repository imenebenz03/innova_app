import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native'
import Svg, { Path, Line, Polyline, Circle, Rect, Polygon } from 'react-native-svg'
import { Colors, Radius, Shadows } from '../theme'

// ── SVG ICONS ────────────────────────────────────────────────────────────────
export const Icon = ({ name, size = 20, color = Colors.textSecondary, strokeWidth = 1.8 }) => {
  const s = size
  const props = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none' }
  const sp = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' }

  const icons = {
    home:     <Svg {...props}><Path {...sp} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><Polyline {...sp} points="9 22 9 12 15 12 15 22"/></Svg>,
    chat:     <Svg {...props}><Path {...sp} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></Svg>,
    card:     <Svg {...props}><Rect {...sp} x="1" y="4" width="22" height="16" rx="2"/><Line {...sp} x1="1" y1="10" x2="23" y2="10"/></Svg>,
    bell:     <Svg {...props}><Path {...sp} d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></Svg>,
    help:     <Svg {...props}><Circle {...sp} cx="12" cy="12" r="10"/><Path {...sp} d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><Line {...sp} x1="12" y1="17" x2="12.01" y2="17"/></Svg>,
    user:     <Svg {...props}><Path {...sp} d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><Circle {...sp} cx="12" cy="7" r="4"/></Svg>,
    send:     <Svg {...props}><Line {...sp} x1="22" y1="2" x2="11" y2="13"/><Polygon {...sp} points="22 2 15 22 11 13 2 9 22 2"/></Svg>,
    check:    <Svg {...props}><Polyline {...sp} points="20 6 9 17 4 12"/></Svg>,
    lock:     <Svg {...props}><Rect {...sp} x="3" y="11" width="18" height="11" rx="2"/><Path {...sp} d="M7 11V7a5 5 0 0110 0v4"/></Svg>,
    alert:    <Svg {...props}><Path {...sp} d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><Line {...sp} x1="12" y1="9" x2="12" y2="13"/><Line {...sp} x1="12" y1="17" x2="12.01" y2="17"/></Svg>,
    shield:   <Svg {...props}><Path {...sp} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Svg>,
    arrow:    <Svg {...props}><Polyline {...sp} points="9 18 15 12 9 6"/></Svg>,
    logout:   <Svg {...props}><Path {...sp} d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><Polyline {...sp} points="16 17 21 12 16 7"/><Line {...sp} x1="21" y1="12" x2="9" y2="12"/></Svg>,
    building: <Svg {...props}><Path {...sp} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></Svg>,
    plus:     <Svg {...props}><Line {...sp} x1="12" y1="5" x2="12" y2="19"/><Line {...sp} x1="5" y1="12" x2="19" y2="12"/></Svg>,
    phone:    <Svg {...props}><Path {...sp} d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 7a2 2 0 012-2.18h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L9.91 10a16 16 0 006.09 6.09l.72-.72a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></Svg>,
    mail:     <Svg {...props}><Path {...sp} d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><Polyline {...sp} points="22,6 12,13 2,6"/></Svg>,
    calendar: <Svg {...props}><Rect {...sp} x="3" y="4" width="18" height="18" rx="2"/><Line {...sp} x1="16" y1="2" x2="16" y2="6"/><Line {...sp} x1="8" y1="2" x2="8" y2="6"/><Line {...sp} x1="3" y1="10" x2="21" y2="10"/></Svg>,
    info:     <Svg {...props}><Circle {...sp} cx="12" cy="12" r="10"/><Line {...sp} x1="12" y1="8" x2="12" y2="12"/><Line {...sp} x1="12" y1="16" x2="12.01" y2="16"/></Svg>,
  }
  return icons[name] || icons.info
}

// ── LOGO MARK ─────────────────────────────────────────────────────────────────
export function LogoMark({ size = 48 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.2, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
        <Path stroke="#fff" strokeWidth="2" strokeLinecap="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <Polyline stroke="#fff" strokeWidth="2" strokeLinecap="round" points="9 22 9 12 15 12 15 22"/>
      </Svg>
    </View>
  )
}

// ── SPINNER ───────────────────────────────────────────────────────────────────
export function Spinner({ color = Colors.primary }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <ActivityIndicator size="large" color={color} />
    </View>
  )
}

// ── CARD ──────────────────────────────────────────────────────────────────────
export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>
}

// ── BUTTON ────────────────────────────────────────────────────────────────────
export function Btn({ label, onPress, variant = 'primary', disabled = false, style, icon }) {
  const bg      = { primary: Colors.primary, outline: 'transparent', ghost: 'transparent', success: Colors.success, white: Colors.white }[variant]
  const txtColor = { primary: Colors.white, outline: Colors.primary, ghost: Colors.textSecondary, success: Colors.white, white: Colors.primary }[variant]
  const border  = variant === 'outline' ? { borderWidth: 1.5, borderColor: Colors.primary } : {}

  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8}
      style={[styles.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }, border, style]}>
      {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
      <Text style={[styles.btnText, { color: txtColor }]}>{label}</Text>
    </TouchableOpacity>
  )
}

// ── PILL ──────────────────────────────────────────────────────────────────────
export function Pill({ label, type = 'gray' }) {
  const map = {
    gold:    { bg: '#FFF4E0', text: '#D4860F' },
    green:   { bg: Colors.successLight, text: Colors.success },
    red:     { bg: Colors.dangerLight, text: Colors.danger },
    blue:    { bg: Colors.infoLight, text: Colors.info },
    gray:    { bg: '#F0F0F0', text: '#666' },
    partial: { bg: Colors.infoLight, text: Colors.info },
  }
  const c = map[type] || map.gray
  return (
    <View style={{ backgroundColor: c.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full, alignSelf: 'flex-start' }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: c.text }}>{label}</Text>
    </View>
  )
}

export function StatutPill({ statut }) {
  const map = { 'en_attente':['gold','En attente'], 'partiel':['partial','Partiel'], 'payé':['green','Payé'], 'résolu':['green','Résolu'], 'rejeté':['red','Rejeté'] }
  const [type, label] = map[statut] || ['gray', statut]
  return <Pill label={label} type={type} />
}

// ── SECTION LABEL ─────────────────────────────────────────────────────────────
export function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>
}

// ── FORMAT UTILS ──────────────────────────────────────────────────────────────
export function formatDate(str) {
  if (!str) return ''
  const d = new Date(str)
  if (isNaN(d)) return str
  return d.toLocaleDateString('fr-DZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatDateCourte(str) {
  if (!str) return ''
  const d = new Date(str)
  if (isNaN(d)) return str
  return d.toLocaleDateString('fr-DZ', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatDateRelative(str) {
  if (!str) return ''
  const d = new Date(str)
  if (isNaN(d)) return str
  const diff = Date.now() - d
  if (diff < 60000) return 'À l\'instant'
  if (diff < 3600000) return `${Math.floor(diff/60000)} min`
  if (diff < 86400000) return d.toLocaleTimeString('fr-DZ', { hour:'2-digit', minute:'2-digit' })
  return d.toLocaleDateString('fr-DZ', { day:'numeric', month:'short' })
}

export function initiales(prenom = '', nom = '') {
  return ((prenom[0] || '') + (nom[0] || '')).toUpperCase()
}

export function formatDA(montant) {
  return `${Number(montant).toLocaleString('fr-DZ')} DA`
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white, borderRadius: Radius.lg, padding: 16, marginBottom: 12, ...Shadows.card,
  },
  btn: {
    paddingVertical: 14, paddingHorizontal: 20, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
  },
  btnText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase',
    color: Colors.textTertiary, marginBottom: 10, marginTop: 4,
  },
})
