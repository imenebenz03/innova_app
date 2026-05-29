import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, RefreshControl } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { Alertes as AlertesAPI, Requetes as RequetesAPI } from '../api'
import { Colors, Radius, Shadows } from '../theme'
import { Spinner, StatutPill, Btn, formatDate, formatDateCourte, Icon } from '../components/UI'

// ── ALERTES ───────────────────────────────────────────────────────────────────
export function AlertesScreen() {
  const { resident } = useAuth()
  const [alertes, setAlertes] = useState([])
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(false)

  const charger = async () => {
    try { setAlertes(await AlertesAPI.lister(resident?.residence_id)) }
    catch {} finally { setLoading(false); setRefresh(false) }
  }
  useEffect(() => { charger() }, [])

  const typeMap = {
    danger:    { border: Colors.danger,  bg: '#FFF0F0', label: 'URGENCE',      labelBg: '#FFCCCC', labelTx: Colors.danger,  icon: 'alert' },
    attention: { border: Colors.warning, bg: '#FFF8E8', label: 'ATTENTION',    labelBg: '#FFE08A', labelTx: Colors.warning, icon: 'alert' },
    info:      { border: Colors.info,    bg: '#EFF5FF', label: 'INFORMATION',  labelBg: '#C0D8FF', labelTx: Colors.info,    icon: 'info'  },
    succes:    { border: Colors.success, bg: '#EFFFEF', label: 'RÉSOLU',       labelBg: '#B8E8C8', labelTx: Colors.success, icon: 'check' },
  }

  if (loading) return <Spinner />
  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Alertes</Text>
        <Text style={styles.pageSub}>Communications officielles</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); charger() }} tintColor={Colors.primary} />}
      >
        {alertes.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIco}><Icon name="bell" size={28} color={Colors.textTertiary} /></View>
            <Text style={styles.emptyTitle}>Aucune alerte active</Text>
            <Text style={styles.emptySub}>Vous serez notifié en cas d'information importante</Text>
          </View>
        ) : alertes.map(a => {
          const cfg = typeMap[a.type_alerte] || typeMap.info
          return (
            <View key={a.id} style={[styles.alertCard, { backgroundColor: cfg.bg, borderLeftColor: cfg.border }]}>
              <View style={[styles.alertLabelPill, { backgroundColor: cfg.labelBg }]}>
                <Text style={[styles.alertLabelTxt, { color: cfg.labelTx }]}>{cfg.label}</Text>
              </View>
              <View style={styles.alertTitleRow}>
                <Icon name={cfg.icon} size={16} color={cfg.border} strokeWidth={2} />
                <Text style={styles.alertTitle}>{a.titre}</Text>
              </View>
              <Text style={styles.alertBody}>{a.contenu}</Text>
              <Text style={styles.alertTime}>{formatDate(a.date_creation)}</Text>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

// ── REQUÊTES ──────────────────────────────────────────────────────────────────
export function RequetesScreen() {
  const { resident } = useAuth()
  const [requetes, setRequetes] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [sujet, setSujet]       = useState('')
  const [contenu, setContenu]   = useState('')
  const [sending, setSending]   = useState(false)
  const [refresh, setRefresh]   = useState(false)

  const charger = async () => {
    try { setRequetes(await RequetesAPI.lister()) }
    catch {} finally { setLoading(false); setRefresh(false) }
  }
  useEffect(() => { charger() }, [])

  const soumettre = async () => {
    if (!sujet.trim() || !contenu.trim()) { Alert.alert('Erreur', 'Veuillez remplir tous les champs'); return }
    setSending(true)
    try {
      await RequetesAPI.creer(sujet, contenu)
      setModal(false); setSujet(''); setContenu(''); charger()
      Alert.alert('Envoyée', 'Votre requête a été soumise à l\'administration.')
    } catch (err) { Alert.alert('Erreur', err.message) }
    finally { setSending(false) }
  }

  if (loading) return <Spinner />
  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Requêtes</Text>
        <Text style={styles.pageSub}>Vos signalements et demandes</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); charger() }} tintColor={Colors.primary} />}
      >
        {requetes.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIco}><Icon name="help" size={28} color={Colors.textTertiary} /></View>
            <Text style={styles.emptyTitle}>Aucune requête</Text>
            <Text style={styles.emptySub}>Utilisez le bouton ci-dessous pour soumettre une demande</Text>
          </View>
        ) : requetes.map(q => (
          <View key={q.id} style={[styles.reqCard, q.statut === 'en_attente' && styles.reqCardPending]}>
            <View style={styles.reqHeader}>
              <Text style={styles.reqSujet} numberOfLines={1}>{q.sujet}</Text>
              <StatutPill statut={q.statut} />
            </View>
            <Text style={styles.reqDate}>{formatDateCourte(q.date_creation)}</Text>
            <Text style={styles.reqBody} numberOfLines={3}>{q.contenu}</Text>
            {q.reponse && (
              <View style={styles.reponseBox}>
                <Text style={styles.reponseLabel}>Réponse de l'administration</Text>
                <Text style={styles.reponseBody}>{q.reponse}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setModal(true)} activeOpacity={0.85}>
        <Icon name="plus" size={18} color={Colors.white} strokeWidth={2.5} />
        <Text style={styles.fabTxt}>Nouvelle requête</Text>
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(false)}>
        <ScrollView style={styles.modalWrap} keyboardShouldPersistTaps="handled">
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Nouvelle requête</Text>
          <Text style={styles.modalSub}>Décrivez votre problème à l'administration</Text>
          <Text style={styles.fieldLabel}>Sujet *</Text>
          <TextInput style={styles.fieldInput} value={sujet} onChangeText={setSujet} placeholder="Ex : Éclairage couloir en panne" placeholderTextColor={Colors.textTertiary} />
          <Text style={styles.fieldLabel}>Description *</Text>
          <TextInput style={[styles.fieldInput, { height: 120, textAlignVertical: 'top' }]} value={contenu} onChangeText={setContenu} placeholder="Décrivez votre problème en détail…" placeholderTextColor={Colors.textTertiary} multiline />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 40 }}>
            <Btn label="Annuler" variant="outline" onPress={() => setModal(false)} style={{ flex: 1 }} />
            <Btn label={sending ? 'Envoi…' : 'Soumettre'} onPress={soumettre} disabled={sending} style={{ flex: 2 }} />
          </View>
        </ScrollView>
      </Modal>
    </View>
  )
}

// ── PROFIL ────────────────────────────────────────────────────────────────────
export function ProfilScreen() {
  const { resident, deconnexion } = useAuth()

  const handleDeconnexion = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: deconnexion },
    ])
  }

  const infos = [
    { icon: 'building', label: 'Unité',      value: resident?.unite },
    { icon: 'info',     label: 'Étage',      value: `${resident?.etage}` },
    { icon: 'mail',     label: 'Email',      value: resident?.email },
    { icon: 'phone',    label: 'Téléphone',  value: resident?.telephone || 'Non renseigné' },
    { icon: 'calendar', label: 'Inscrit le', value: formatDateCourte(resident?.date_inscription) },
  ]

  const initials = ((resident?.prenom?.[0]||'') + (resident?.nom?.[0]||'')).toUpperCase()

  return (
    <View style={styles.container}>
      {/* Hero */}
      <View style={styles.profilHero}>
        <View style={styles.profilAv}>
          <Text style={styles.profilAvTxt}>{initials}</Text>
        </View>
        <Text style={styles.profilName}>{resident?.prenom} {resident?.nom}</Text>
        <View style={styles.profilBadge}>
          <Text style={styles.profilBadgeTxt}>Résident · {resident?.residence_nom || 'Résidence'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitleDark}>Mes informations</Text>
        <View style={styles.infoCard}>
          {infos.map((info, i) => (
            <View key={i}>
              <View style={styles.infoRow}>
                <View style={styles.infoIcoWrap}>
                  <Icon name={info.icon} size={17} color={Colors.primary} strokeWidth={1.8} />
                </View>
                <View>
                  <Text style={styles.infoLabel}>{info.label}</Text>
                  <Text style={styles.infoValue}>{info.value}</Text>
                </View>
              </View>
              {i < infos.length - 1 && <View style={styles.infoDivider} />}
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitleDark}>Application</Text>
        <View style={styles.infoCard}>
          {[['info','Application','INNOVA'],['info','Version','1.0.0']].map(([ic,lb,vl],i,arr)=>(
            <View key={lb}>
              <View style={styles.infoRow}>
                <View style={styles.infoIcoWrap}><Icon name={ic} size={17} color={Colors.primary} strokeWidth={1.8}/></View>
                <View><Text style={styles.infoLabel}>{lb}</Text><Text style={styles.infoValue}>{vl}</Text></View>
              </View>
              {i<arr.length-1&&<View style={styles.infoDivider}/>}
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleDeconnexion} activeOpacity={0.85}>
          <Icon name="logout" size={18} color={Colors.danger} strokeWidth={2} />
          <Text style={styles.logoutTxt}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.background },
  pageHeader: { backgroundColor: Colors.primary, paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20 },
  pageTitle:  { fontSize: 26, fontWeight: '700', color: Colors.white, marginBottom: 3 },
  pageSub:    { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  empty:      { alignItems: 'center', paddingVertical: 60 },
  emptyIco:   { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.surfaceGray, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  emptySub:   { fontSize: 13, color: Colors.textTertiary, textAlign: 'center', paddingHorizontal: 24, lineHeight: 19 },

  alertCard:  { borderRadius: Radius.lg, padding: 14, marginBottom: 10, borderLeftWidth: 4 },
  alertLabelPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full, marginBottom: 8 },
  alertLabelTxt:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  alertTitleRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  alertTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, flex: 1, lineHeight: 20 },
  alertBody:  { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 6 },
  alertTime:  { fontSize: 11, color: Colors.textTertiary },

  reqCard:        { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: 14, marginBottom: 10, ...Shadows.card, borderLeftWidth: 3, borderLeftColor: Colors.border },
  reqCardPending: { borderLeftColor: Colors.warning },
  reqHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  reqSujet:       { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, flex: 1, marginRight: 8 },
  reqDate:        { fontSize: 11, color: Colors.textTertiary, marginBottom: 6 },
  reqBody:        { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  reponseBox:     { backgroundColor: '#FFF8E8', borderLeftWidth: 3, borderLeftColor: Colors.warning, padding: 10, marginTop: 10, borderTopRightRadius: Radius.sm, borderBottomRightRadius: Radius.sm },
  reponseLabel:   { fontSize: 11, fontWeight: '700', color: Colors.warning, marginBottom: 4 },
  reponseBody:    { fontSize: 13, color: '#5C3000', lineHeight: 19 },
  fab:            { position: 'absolute', bottom: 24, right: 20, backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 8, ...Shadows.strong },
  fabTxt:         { fontSize: 14, fontWeight: '700', color: Colors.white },

  modalWrap:      { flex: 1, padding: 22, backgroundColor: Colors.white },
  modalHandle:    { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 22 },
  modalTitle:     { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  modalSub:       { fontSize: 13, color: Colors.textSecondary, marginBottom: 22, lineHeight: 19 },
  fieldLabel:     { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  fieldInput:     { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: 12, fontSize: 14, color: Colors.textPrimary, marginBottom: 14, backgroundColor: Colors.surfaceGray },

  profilHero:     { backgroundColor: Colors.primary, paddingTop: 52, paddingBottom: 28, alignItems: 'center' },
  profilAv:       { width: 82, height: 82, borderRadius: 41, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)' },
  profilAvTxt:    { fontSize: 30, fontWeight: '700', color: Colors.white },
  profilName:     { fontSize: 22, fontWeight: '700', color: Colors.white, marginBottom: 8 },
  profilBadge:    { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 5 },
  profilBadgeTxt: { fontSize: 12, fontWeight: '600', color: Colors.white },
  sectionTitleDark: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 10, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
  infoCard:       { backgroundColor: Colors.white, borderRadius: Radius.lg, marginBottom: 18, ...Shadows.card, overflow: 'hidden' },
  infoRow:        { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  infoIcoWrap:    { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  infoLabel:      { fontSize: 11, color: Colors.textTertiary, marginBottom: 2, fontWeight: '500' },
  infoValue:      { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  infoDivider:    { height: 1, backgroundColor: Colors.border, marginLeft: 64 },
  logoutBtn:      { backgroundColor: '#FFF0F0', borderRadius: Radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: '#FFD0D0', marginBottom: 20 },
  logoutTxt:      { fontSize: 15, fontWeight: '600', color: Colors.danger },
})
