import { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, RefreshControl, KeyboardAvoidingView, Platform, Animated
} from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { useAuth } from '../context/AuthContext'
import { Charges } from '../api'
import { Colors, Radius, Shadows } from '../theme'
import { Spinner, StatutPill, SectionLabel, Btn, formatDA, formatDateCourte, formatDate } from '../components/UI'

const formatCardNumber = (value) => {
  const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
  const matches = v.match(/\d{4,16}/g)
  const match = (matches && matches[0]) || ''
  const parts = []
  for (let i = 0, len = match.length; i < len; i += 4) {
    parts.push(match.substring(i, i + 4))
  }
  return parts.length ? parts.join(' ') : v
}

const formatExpiry = (value) => {
  const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
  if (v.length >= 2) {
    return v.substring(0, 2) + '/' + v.substring(2, 4)
  }
  return v
}

export default function PaiementsScreen() {
  const { resident } = useAuth()
  const [charges, setCharges]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [refresh, setRefresh]   = useState(false)
  const [modal, setModal]       = useState(null)
  const [succes, setSucces]      = useState(null)
  const [montant, setMontant]   = useState('')
  const [paying, setPaying]      = useState(false)
  const [historique, setHistorique] = useState([])
  const [showCard, setShowCard]   = useState(false)

  const [cardNom, setCardNom]     = useState('')
  const [cardNum, setCardNum]     = useState('')
  const [cardExp, setCardExp]     = useState('')
  const [cardCvc, setCardCvc]     = useState('')

  const cardAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (showCard) {
      Animated.spring(cardAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8
      }).start()
    } else {
      cardAnim.setValue(0)
    }
  }, [showCard])

  const charger = async () => {
    try { setCharges(await Charges.lister(resident.id)) }
    catch {} finally { setLoading(false); setRefresh(false) }
  }

  useEffect(() => { charger() }, [])

  const ouvrirModal = async (charge) => {
    setModal(charge)
    setMontant(charge.montant_restant.toString())
    setSucces(null)
    setCardNom(`${resident?.prenom || ''} ${resident?.nom || ''}`)
    setCardNum(''); setCardExp(''); setCardCvc('')
    setShowCard(false)
    try {
      const hist = await Charges.paiements(charge.id)
      setHistorique(hist)
    } catch { setHistorique([]) }
  }

  const validateCard = () => {
    const cleanNum = cardNum.replace(/\s/g, '')
    if (!cardNom.trim()) { Alert.alert('Erreur', 'Nom du titulaire requis'); return false }
    if (cleanNum.length < 16) { Alert.alert('Erreur', 'Numéro de carte invalide'); return false }
    if (!cardExp || cardExp.length < 5) { Alert.alert('Erreur', "Date d'expiration invalide"); return false }
    if (!cardCvc || cardCvc.length < 3) { Alert.alert('Erreur', 'Code CVV invalide'); return false }
    
    const [month, year] = cardExp.split('/')
    const expMonth = parseInt(month, 10)
    const expYear = parseInt('20' + year, 10)
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    
    if (expMonth < 1 || expMonth > 12) { Alert.alert('Erreur', 'Mois invalide'); return false }
    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
      Alert.alert('Erreur', 'Carte expirée'); return false
    }
    return true
  }

  const payer = async () => {
    const m = parseFloat(montant)
    if (!m || m <= 0 || m > modal.montant_restant) {
      Alert.alert('Erreur', `Le montant doit être entre 100 et ${formatDA(modal.montant_restant)}`); return
    }
    if (!validateCard()) return

    setPaying(true)
    try {
      const maskedCard = '**** **** **** ' + cardNum.replace(/\s/g, '').slice(-4)
      
      try {
        await SecureStore.setItemAsync('lastCard', maskedCard)
      } catch {}

      const data = await Charges.payerEnLigne(modal.id, m)
      setSucces(data)
      charger()
    } catch (err) {
      Alert.alert('Erreur de paiement', err.message)
    } finally { setPaying(false) }
  }

  if (loading) return <Spinner />

  const enAttente      = charges.filter(c => c.statut !== 'payé')
  const futureCharges   = enAttente.filter(c => new Date(c.echeance) >= new Date())
  const pastCharges    = enAttente.filter(c => new Date(c.echeance) < new Date())
  const payees        = charges.filter(c => c.statut === 'payé')
  const total          = enAttente.reduce((s, c) => s + c.montant_restant, 0)

  const frontInterpolate = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg']
  })

  const backInterpolate = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg']
  })

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); charger() }} tintColor={Colors.primary} />}
    >
<View style={styles.hero}>
          <Text style={styles.heroLabel}>Total restant à payer</Text>
          <Text style={[styles.heroAmount, { color: total > 0 ? '#FF6B35' : Colors.success }]}>{formatDA(total)}</Text>
          <Text style={styles.heroSub}>{resident?.unite} · {resident?.residence_nom || 'Résidence'}</Text>
        </View>

      <View style={{ padding: 16 }}>
        {enAttente.length > 0 ? (
          <>
            {futureCharges.length > 0 && (
              <>
                <SectionLabel>Charges à venir</SectionLabel>
                {futureCharges.map(c => (
                  <View key={c.id} style={styles.chargeCard}>
                    <View style={styles.chargeInfo}>
                      <Text style={styles.chargeName}>{c.designation}</Text>
                      <Text style={styles.chargeSub}>
                        Total: {formatDA(c.montant_total)}
                      </Text>
                      <Text style={styles.chargeEch}>Échéance: {formatDateCourte(c.echeance)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 8 }}>
                      <Text style={styles.chargeReste}>{formatDA(c.montant_restant)}</Text>
                      <TouchableOpacity style={styles.payBtn} onPress={() => ouvrirModal(c)} activeOpacity={0.85}>
                        <Text style={styles.payBtnText}>Payer</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}
            {pastCharges.length > 0 && (
              <>
                <SectionLabel>Charges en retard</SectionLabel>
                {pastCharges.map(c => (
                  <View key={c.id} style={[styles.chargeCard, { borderLeftWidth: 3, borderLeftColor: Colors.danger }]}>
                    <View style={styles.chargeInfo}>
                      <Text style={styles.chargeName}>{c.designation}</Text>
                      <Text style={styles.chargeSub}>
                        Total: {formatDA(c.montant_total)}
                      </Text>
                      <Text style={[styles.chargeEch, { color: Colors.danger }]}>Échéance dépassée: {formatDateCourte(c.echeance)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 8 }}>
                      <Text style={[styles.chargeReste, { color: Colors.danger }]}>{formatDA(c.montant_restant)}</Text>
                      <TouchableOpacity style={[styles.payBtn, { backgroundColor: Colors.danger }]} onPress={() => ouvrirModal(c)} activeOpacity={0.85}>
                        <Text style={styles.payBtnText}>Payer</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        ) : null}

        {payees.length > 0 && (
          <>
            <SectionLabel>Historique des paiements</SectionLabel>
            {payees.map(c => (
              <TouchableOpacity key={c.id} style={styles.histCard} onPress={() => ouvrirModal(c)} activeOpacity={0.85}>
                <View style={styles.histIco}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.histName}>{c.designation}</Text>
                  <Text style={styles.histDate}>{formatDateCourte(c.date_paiement)}</Text>
                </View>
                <Text style={styles.histAmount}>{formatDA(c.montant_total)}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>

      <Modal visible={!!modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !paying && setModal(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.modalContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Paiement</Text>
                <Text style={styles.modalSub} numberOfLines={2}>{modal?.designation}</Text>
              </View>
            </View>

            {succes ? (
              <View style={styles.successBox}>
                <View style={[styles.successIcon, { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.success }]}>
                  <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.success }}>✓</Text>
                </View>
                <Text style={styles.successTitle}>Paiement confirmé</Text>
                <Text style={styles.successSub}>Le montant a été déduit de votre compte.</Text>
                <View style={styles.successRef}>
                  <Text style={styles.successRefLabel}>Référence</Text>
                  <Text style={styles.successRefText}>{succes.reference}</Text>
                </View>
                {succes.montant_restant > 0 && (
                  <View style={styles.resteBox}>
                    <Text style={styles.resteLabel}>Reste à payer</Text>
                    <Text style={styles.resteAmount}>{formatDA(succes.montant_restant)}</Text>
                  </View>
                )}
                <Btn label="Fermer" onPress={() => setModal(null)} style={{ marginTop: 24, width: '100%' }} />
              </View>
            ) : (
              <>
                <View style={styles.resumeBox}>
                  <View style={styles.resumeRow}>
                    <Text style={styles.resumeLabel}>Montant total</Text>
                    <Text style={styles.resumeValue}>{formatDA(modal?.montant_total)}</Text>
                  </View>
                  <View style={styles.resumeRow}>
                    <Text style={[styles.resumeLabel, { color: Colors.success }]}>Déjà payé</Text>
                    <Text style={[styles.resumeValue, { color: Colors.success }]}>{formatDA((modal?.montant_total || 0) - (modal?.montant_restant || 0))}</Text>
                  </View>
                  <View style={styles.resumeDivider} />
                  <View style={styles.resumeRow}>
                    <Text style={styles.resumeLabelBold}>Reste à payer</Text>
                    <Text style={styles.resumeValueBold}>{formatDA(modal?.montant_restant)}</Text>
                  </View>
                </View>

                <View style={styles.inputSection}>
                  <Text style={styles.sectionTitle}>Montant à payer</Text>
                  <View style={styles.montantBox}>
                    <Text style={styles.montantPrefix}>DA</Text>
                    <TextInput
                      style={styles.montantInput}
                      value={montant}
                      onChangeText={setMontant}
                      keyboardType="numeric"
                      placeholder={modal?.montant_restant.toString()}
                      placeholderTextColor={Colors.textTertiary}
                    />
                  </View>
                  <Text style={styles.inputHint}>Max: {formatDA(modal?.montant_restant)}</Text>
                </View>

                <TouchableOpacity style={styles.cardToggle} onPress={() => setShowCard(!showCard)} activeOpacity={0.9}>
                  <View style={styles.cardToggleLeft}>
                    <View style={styles.cardToggleIconBox} />
                    <Text style={styles.cardToggleText}>Carte bancaire</Text>
                  </View>
                  <View style={[styles.cardToggleSwitch, showCard && styles.cardToggleSwitchOn]}>
                    <View style={[styles.cardToggleDot, showCard && styles.cardToggleDotOn]} />
                  </View>
                </TouchableOpacity>

                {showCard && (
                  <View style={styles.cardForm}>
                    <View style={styles.secureBadge}>
                      <View style={[styles.secureBadgeIcon, { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.success }]} />
                      <Text style={styles.secureBadgeText}>Paiement sécurisé</Text>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Titulaire</Text>
                      <TextInput
                        style={styles.input}
                        value={cardNom}
                        onChangeText={setCardNom}
                        placeholder="Nom du titulaire"
                        placeholderTextColor={Colors.textTertiary}
                        autoCapitalize="words"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Numéro de carte</Text>
                      <TextInput
                        style={styles.input}
                        value={cardNum}
                        onChangeText={(t) => setCardNum(formatCardNumber(t))}
                        placeholder="•••• •••• •••• ••••"
                        placeholderTextColor={Colors.textTertiary}
                        keyboardType="numeric"
                        maxLength={19}
                      />
                    </View>

                    <View style={styles.inputRow}>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>Expiration</Text>
                        <TextInput
                          style={styles.input}
                          value={cardExp}
                          onChangeText={(t) => setCardExp(formatExpiry(t))}
                          placeholder="MM/AA"
                          placeholderTextColor={Colors.textTertiary}
                          keyboardType="numeric"
                          maxLength={5}
                        />
                      </View>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>CVV</Text>
                        <TextInput
                          style={styles.input}
                          value={cardCvc}
                          onChangeText={(t) => setCardCvc(t.replace(/[^0-9]/g, '').slice(0, 3))}
                          placeholder="•••"
                          placeholderTextColor={Colors.textTertiary}
                          keyboardType="numeric"
                          maxLength={3}
                          secureTextEntry
                        />
                      </View>
                    </View>
                  </View>
                )}

                {historique.length > 0 && (
                  <View style={styles.historiqueSection}>
                    <Text style={styles.historiqueTitle}>Paiements précédents</Text>
                    {historique.map(p => (
                      <View key={p.id} style={styles.historiqueItem}>
                        <Text style={styles.historiqueMethod}>{p.methode === 'administration' ? 'Agence' : 'En ligne'}</Text>
                        <Text style={styles.historiqueDate}>{formatDate(p.date_paiement)}</Text>
                        <Text style={styles.historiqueAmount}>{formatDA(p.montant)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.actionButtons}>
                  <Btn label="Annuler" variant="outline" onPress={() => setModal(null)} style={{ flex: 1 }} disabled={paying} />
                  <Btn
                    label={paying ? 'Traitement...' : `Payer ${formatDA(parseFloat(montant) || 0)}`}
                    onPress={payer}
                    disabled={paying || !showCard}
                    style={{ flex: 2 }}
                  />
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FC' },
  hero: { backgroundColor: Colors.primary, paddingTop: 56, paddingBottom: 28, paddingHorizontal: 20, alignItems: 'center' },
  heroShield: { marginBottom: 12 },
  heroLabel:  { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 6, fontWeight: '500' },
  heroAmount: { fontSize: 40, fontWeight: '700', marginBottom: 6, letterSpacing: -1 },
  heroSub:    { fontSize: 12, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 },
  chargeCard: {
    backgroundColor: Colors.white, borderRadius: Radius.lg, padding: 16, marginBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', ...Shadows.card,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  chargeInfo:  { flex: 1, marginRight: 12 },
  chargeName:  { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  chargeSub:   { fontSize: 12, color: Colors.textTertiary },
  chargeEch:   { fontSize: 11, color: Colors.textTertiary },
  chargeReste: { fontSize: 17, fontWeight: '700', color: Colors.warning },
  payBtn:      { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 20, paddingVertical: 10 },
  payBtnText:  { fontSize: 13, fontWeight: '600', color: Colors.white },
  histCard:    { backgroundColor: Colors.white, borderRadius: Radius.md, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, ...Shadows.card },
  histIco:     { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  histName:    { fontSize: 13, fontWeight: '500', color: Colors.textPrimary, marginBottom: 2 },
  histDate:    { fontSize: 11, color: Colors.textTertiary },
  histAmount:  { fontSize: 14, fontWeight: '700', color: Colors.success },
  allGood:     { alignItems: 'center', padding: 36, backgroundColor: '#E8F5E9', borderRadius: Radius.lg, marginBottom: 16 },

  modalContainer: { flex: 1, backgroundColor: '#F8F9FC', padding: 20 },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  modalLockIco:{ width: 48, height: 48, borderRadius: Radius.lg, backgroundColor: Colors.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  modalTitle:  { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  modalSub:    { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  resumeBox:   { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: 18, marginBottom: 20, ...Shadows.card },
  resumeRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  resumeLabel: { fontSize: 13, color: Colors.textSecondary },
  resumeValue: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary },
  resumeDivider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 8 },
  resumeLabelBold: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  resumeValueBold: { fontSize: 14, fontWeight: '700', color: Colors.warning },

  inputSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8 },
  montantBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.primary, paddingHorizontal: 14, ...Shadows.card },
  montantPrefix: { fontSize: 16, fontWeight: '600', color: Colors.primary, marginRight: 6 },
  montantInput: { flex: 1, fontSize: 20, fontWeight: '700', color: Colors.textPrimary, paddingVertical: 14 },
  inputHint: { fontSize: 11, color: Colors.textTertiary, marginTop: 6 },

  cardToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.white, borderRadius: Radius.lg, padding: 16, marginBottom: 12, ...Shadows.card },
  cardToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardToggleIconBox: { width: 24, height: 18, borderWidth: 2, borderColor: Colors.primary, borderRadius: 4 },
  cardToggleText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  cardToggleSwitch: { width: 50, height: 28, borderRadius: 14, backgroundColor: Colors.border, justifyContent: 'center', paddingHorizontal: 2 },
  cardToggleSwitchOn: { backgroundColor: Colors.primary },
  cardToggleDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.white, ...Shadows.card },
  cardToggleDotOn: { alignSelf: 'flex-end' },

  cardForm: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: 16, marginBottom: 16, ...Shadows.card },
  secureBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E8F5E9', borderRadius: Radius.sm, padding: 10, marginBottom: 16 },
  secureBadgeIcon: { fontSize: 14 },
  secureBadgeText: { fontSize: 12, color: Colors.success, fontWeight: '500' },

  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: 14, fontSize: 15, color: Colors.textPrimary, backgroundColor: Colors.surfaceGray },
  inputRow: { flexDirection: 'row', gap: 12 },

  historiqueSection: { marginBottom: 20 },
  historiqueTitle: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 10 },
  historiqueItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  historiqueMethod: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  historiqueDate: { fontSize: 12, color: Colors.textTertiary, flex: 1 },
  historiqueAmount: { fontSize: 13, fontWeight: '600', color: Colors.success },

  actionButtons: { flexDirection: 'row', gap: 12, marginBottom: 40 },

  successBox: { alignItems: 'center', padding: 20 },
  successIcon: { marginBottom: 16 },
  successTitle:{ fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  successSub:  { fontSize: 14, color: Colors.textSecondary, marginBottom: 20 },
  successRef: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: 16, width: '100%', alignItems: 'center', ...Shadows.card },
  successRefLabel: { fontSize: 11, color: Colors.textTertiary, marginBottom: 4 },
  successRefText: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  resteBox: { backgroundColor: Colors.warningLight, borderRadius: Radius.md, padding: 14, marginTop: 12, width: '100%', alignItems: 'center' },
  resteLabel: { fontSize: 12, color: Colors.warning, marginBottom: 4 },
  resteAmount: { fontSize: 20, fontWeight: '700', color: Colors.warning },
})