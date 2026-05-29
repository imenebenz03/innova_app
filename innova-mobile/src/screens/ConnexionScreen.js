import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, StatusBar
} from 'react-native'
import { useAuth } from '../context/AuthContext'
import { Colors, Radius, Shadows } from '../theme'
import { LogoMark, Btn } from '../components/UI'
import { Residences } from '../api'

export default function ConnexionScreen({ navigation }) {
  const [mode, setMode] = useState('connexion')
  const [email, setEmail] = useState('')
  const [mdp, setMdp] = useState('')
  const [loading, setLoading] = useState(false)
  const [residences, setResidences] = useState([])
  const [dropdownError, setDropdownError] = useState(null)
  const [form, setForm] = useState({
    residence_id: '', prenom: '', nom: '', email: '', mot_de_passe: '', confirmer: '',
    unite: '', etage: '', telephone: ''
  })
  
  const auth = useAuth()

  useEffect(() => {
    const loadResidences = async () => {
      try {
        const data = await Residences.lister()
        if (data && data.length > 0) {
          setResidences(data)
        } else {
          setResidences([
            { id: 1, nom: 'baitek', nom_complet: 'Baitek', adresse: 'Alger' },
            { id: 2, nom: 'baitek2', nom_complet: 'Baitek 2', adresse: 'Alger' },
            { id: 3, nom: 'INNOVIM', nom_complet: 'INNOVIM', adresse: 'Alger' },
            { id: 4, nom: 'INNOVIM2', nom_complet: 'INNOVIM 2', adresse: 'Alger' },
          ])
        }
      } catch (e) {
        setDropdownError('Erreur: ' + e.message)
        setResidences([
          { id: 1, nom: 'baitek', nom_complet: 'Baitek', adresse: 'Alger' },
          { id: 2, nom: 'baitek2', nom_complet: 'Baitek 2', adresse: 'Alger' },
          { id: 3, nom: 'INNOVIM', nom_complet: 'INNOVIM', adresse: 'Alger' },
          { id: 4, nom: 'INNOVIM2', nom_complet: 'INNOVIM 2', adresse: 'Alger' },
        ])
      }
    }
    loadResidences()
  }, [])

  const handleConnexion = async () => {
    if (!email || !mdp) { Alert.alert('Erreur', 'Veuillez remplir tous les champs'); return }
    setLoading(true)
    try {
      await auth.connexion(email.trim().toLowerCase(), mdp)
    } catch (err) {
      Alert.alert('Connexion echouee', err.message || 'Email ou mot de passe incorrect')
    } finally { setLoading(false) }
  }

  const handleInscription = async () => {
    if (!form.residence_id || !form.prenom || !form.nom || !form.email || !form.mot_de_passe || !form.unite || !form.etage) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires'); return
    }
    if (form.mot_de_passe !== form.confirmer) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas'); return
    }
    setLoading(true)
    try {
      const resData = { ...form, etage: parseInt(form.etage) || 0, residence_id: parseInt(form.residence_id) || 0 }
      const res = await auth.inscrircre(resData)
      if (res.succes) {
        await auth.connexion(form.email.trim().toLowerCase(), form.mot_de_passe)
      } else {
        Alert.alert('Erreur', res.message)
      }
    } catch (err) {
      Alert.alert('Erreur', err.message)
    } finally { setLoading(false) }
  }

  const champ = (k) => (v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDeep} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <LogoMark size={64} />
          <Text style={styles.appName}>BENZAAMIA PROMOTION</Text>
          <Text style={styles.appSub}>Gestion Residences · Algerie</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.tabs}>
            {['connexion', 'inscription'].map(m => (
              <TouchableOpacity key={m} style={[styles.tab, mode === m && styles.tabActive]} onPress={() => setMode(m)}>
                <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                  {m === 'connexion' ? 'Se connecter' : 'Creer un compte'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode === 'connexion' ? (
            <>
              <Input label="Adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="votre@email.dz" />
              <Input label="Mot de passe" value={mdp} onChangeText={setMdp} secureTextEntry placeholder="********" />
              <Btn label={loading ? 'Connexion…' : 'Se connecter'} onPress={handleConnexion} disabled={loading} style={{ marginTop: 8 }} />
              <Text style={styles.hint}>Demo : ahmed.karim@email.dz / resident123</Text>
            </>
          ) : (
            <>
              <View style={{ marginBottom: 12, position: 'relative', zIndex: 100 }}>
                <Text style={styles.label}>Residence *</Text>
                {residences.length > 0 ? (
                  <View style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, overflow: 'hidden' }}>
                    {residences.map(r => (
                      <TouchableOpacity 
                        key={r.id} 
                        style={{ 
                          padding: 12, 
                          backgroundColor: form.residence_id === r.id.toString() ? Colors.primaryFaint : Colors.white,
                          borderBottomWidth: 1, 
                          borderBottomColor: Colors.border 
                        }}
                        onPress={() => champ('residence_id')(r.id.toString())}
                      >
                        <Text style={{ fontSize: 15, fontWeight: form.residence_id === r.id.toString() ? 600 : 400, color: form.residence_id === r.id.toString() ? Colors.primary : Colors.textPrimary }}>
                          {r.nom_complet}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={[styles.input, { paddingVertical: 14, backgroundColor: Colors.surfaceGray }]}>
                    <Text style={{ color: dropdownError ? Colors.danger : Colors.textTertiary }}>
                      {dropdownError || 'Chargement des residences...'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.row}>
                <View style={{ flex: 1 }}><Input label="Prenom *" value={form.prenom} onChangeText={champ('prenom')} /></View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}><Input label="Nom *" value={form.nom} onChangeText={champ('nom')} /></View>
              </View>
              <Input label="E-mail *" value={form.email} onChangeText={champ('email')} keyboardType="email-address" autoCapitalize="none" />
              <Input label="Telephone" value={form.telephone} onChangeText={champ('telephone')} keyboardType="phone-pad" placeholder="+213 6XX XXX XXX" />
              <View style={styles.row}>
                <View style={{ flex: 1 }}><Input label="Unite *" value={form.unite} onChangeText={champ('unite')} placeholder="ex: 7C" /></View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}><Input label="Etage *" value={form.etage} onChangeText={champ('etage')} keyboardType="numeric" placeholder="0" /></View>
              </View>
              <Input label="Mot de passe *" value={form.mot_de_passe} onChangeText={champ('mot_de_passe')} secureTextEntry />
              <Input label="Confirmer *" value={form.confirmer} onChangeText={champ('confirmer')} secureTextEntry />
              <Btn label={loading ? 'Creation…' : 'Creer mon compte'} onPress={handleInscription} disabled={loading} style={{ marginTop: 8 }} />
              <Text style={styles.hint}>Votre compte sera valide par l'administration.</Text>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Input({ label, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={Colors.textTertiary} {...props} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  content: { paddingBottom: 40 },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 32, paddingHorizontal: 24 },
  appName: { fontSize: 32, fontWeight: '700', color: Colors.white, letterSpacing: 3, marginTop: 14 },
  appSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4, letterSpacing: 0.5 },
  card: { backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, minHeight: 400 },
  tabs: { flexDirection: 'row', backgroundColor: Colors.surfaceGray, borderRadius: Radius.md, padding: 4, marginBottom: 24 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: Radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.white, ...Shadows.card },
  tabText: { fontSize: 13, fontWeight: '500', color: Colors.textTertiary },
  tabTextActive: { color: Colors.textPrimary, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 5 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.sm, padding: 12, fontSize: 14, color: Colors.textPrimary, backgroundColor: Colors.surfaceGray },
  row: { flexDirection: 'row' },
  hint: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center', marginTop: 14, lineHeight: 18 },
})