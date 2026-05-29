import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { Charges, Alertes } from '../api'
import { Colors, Radius, Shadows } from '../theme'
import { StatutPill, Spinner, formatDA, formatDateCourte, LogoMark, Icon } from '../components/UI'

export default function AccueilScreen({ navigation }) {
  const { resident } = useAuth()
  const [allCharges, setAllCharges] = useState([])
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(false)
  const [alertes, setAlertes] = useState([])

  const charger = async () => {
    try {
      const [ch, al] = await Promise.all([
        Charges.lister(resident.id),
        Alertes.lister(resident.residence_id)
      ])
      setAllCharges(ch)
      setAlertes(al || [])
    } catch {} finally { setLoading(false); setRefresh(false) }
  }

  useEffect(() => { charger() }, [])
  useEffect(() => {
    const interval = setInterval(() => charger(), 30000)
    return () => clearInterval(interval)
  }, [])

  const futureCharges = allCharges.filter(c => new Date(c.echeance) >= new Date() && c.statut !== 'payé')
  const derniereAlerte = alertes.length > 0 ? alertes[0] : null

  if (loading) return <Spinner />

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); charger() }} tintColor={Colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Bonjour, {resident?.prenom}</Text>
            <Text style={styles.subGreeting}>{resident?.residence_nom || 'Résidence'}</Text>
          </View>
          <LogoMark size={42} />
        </View>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLbl}>Charges à venir</Text>
          <Text style={[styles.balanceAmt, { color: futureCharges.length > 0 ? Colors.warning : Colors.success }]}>
            {formatDA(futureCharges.reduce((s, c) => s + (c.montant_restant || 0), 0))}
          </Text>
          <View style={styles.balanceMetas}>
            <BalanceMeta label="Unité" value={resident?.unite} />
            <View style={styles.metaDivider} />
            <BalanceMeta label="Étage" value={`${resident?.etage}`} />
            <View style={styles.metaDivider} />
            <BalanceMeta label="À payer" value={`${futureCharges.length} charge${futureCharges.length !== 1 ? 's' : ''}`} />
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {/* Future charges */}
        {futureCharges.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Charges à venir</Text>
            {futureCharges.map(c => (
              <TouchableOpacity key={c.id} style={styles.chargeCard} onPress={() => navigation.navigate('Paiements')} activeOpacity={0.85}>
                <View style={styles.chargeLeft}>
                  <View style={styles.chargeIco}>
                    <Icon name="building" size={18} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.chargeName} numberOfLines={2}>{c.designation}</Text>
                    <Text style={styles.chargeEch}>Éch. {formatDateCourte(c.echeance)}</Text>
                    {c.statut === 'partiel' && (
                      <Text style={styles.chargePartial}>Payé : {formatDA(c.montant_total - c.montant_restant)}</Text>
                    )}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={styles.chargeAmt}>{formatDA(c.montant_restant)}</Text>
                  <StatutPill statut={c.statut} />
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  )
}

function BalanceMeta({ label, value }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  header:       { backgroundColor: Colors.primary, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 28 },
  headerTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting:     { fontSize: 24, fontWeight: '700', color: Colors.white, letterSpacing: -0.3 },
  subGreeting:  { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  balanceCard:  { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: 20, ...Shadows.strong },
  balanceLbl:   { fontSize: 12, color: Colors.textTertiary, fontWeight: '500', marginBottom: 4 },
  balanceAmt:   { fontSize: 32, fontWeight: '700', letterSpacing: -0.5, marginBottom: 16 },
  balanceMetas: { flexDirection: 'row', alignItems: 'center' },
  metaDivider:  { width: 1, height: 28, backgroundColor: Colors.border },
  metaLabel:    { fontSize: 10, color: Colors.textTertiary, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue:    { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  body:         { padding: 16, paddingTop: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seeAll:       { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  chargeCard:   { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: 16, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, ...Shadows.card },
  chargeLeft:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1, marginRight: 12 },
  chargeIco:    { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  chargeName:   { fontSize: 13.5, fontWeight: '600', color: Colors.textPrimary, marginBottom: 3, lineHeight: 19 },
  chargeEch:    { fontSize: 11.5, color: Colors.textTertiary },
  chargePartial:{ fontSize: 11.5, color: Colors.success, marginTop: 2, fontWeight: '500' },
  chargeAmt:    { fontSize: 16, fontWeight: '700', color: Colors.warning, marginBottom: 4 },
  alertPreview: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: 13, marginBottom: 8, borderLeftWidth: 3, ...Shadows.card },
  alertPreviewTitle: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 3 },
  alertPreviewBody:  { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
})
