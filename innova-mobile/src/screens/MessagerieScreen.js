import { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StatusBar } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { Messages } from '../api'
import { Colors, Radius, Shadows } from '../theme'
import { Spinner, formatDate, initiales, Icon } from '../components/UI'

const CANAUX = [
  { id: 'prive',      label: 'Administration', sub: 'Conversation privée' },
  { id: 'communaute', label: 'Communauté',      sub: 'Forum résidents' },
]

export default function MessagerieScreen() {
  const { resident }  = useAuth()
  const [canal, setCanal]       = useState('prive')
  const [messages, setMessages] = useState([])
  const [texte, setTexte]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [sending, setSending]   = useState(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { charger() }, [canal])

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages])

  // Auto-refresh every 5s
  useEffect(() => {
    const t = setInterval(charger, 5000)
    return () => clearInterval(t)
  }, [canal])

  const charger = async () => {
    if (!loading) setLoading(messages.length === 0)
    try {
      const data = canal === 'prive' ? await Messages.prives() : await Messages.communaute()
      setMessages(data)
    } catch { setMessages([]) }
    finally { setLoading(false) }
  }

  const envoyer = async () => {
    const txt = texte.trim()
    if (!txt || sending) return
    setSending(true)
    // Optimistic message
    const opt = {
      id: `opt-${Date.now()}`, contenu: txt,
      expediteur_id: resident.id, date_envoi: new Date().toISOString(),
      expediteur_nom: `${resident.prenom} ${resident.nom}`, role: resident.role,
    }
    setMessages(prev => [...prev, opt])
    setTexte('')
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)
    try {
      const fn = canal === 'prive' ? Messages.envoyerPrive : Messages.envoyerCommunaute
      await fn(txt)
      charger()
    } catch {} finally { setSending(false) }
  }

  const canalInfo = CANAUX.find(c => c.id === canal)

const renderMsg = ({ item: m, index }) => {
    const estMoi   = m.expediteur_id === resident?.id
    const estAdmin = m.role === 'admin'
    const isPending = m.id && m.id.toString().startsWith('opt-')
    const inits    = initiales(m.expediteur_nom?.split(' ')[0]||'', m.expediteur_nom?.split(' ')[1]||'')
    const prevMsg  = messages[index - 1]
    const showHeader = !prevMsg || prevMsg.expediteur_id !== m.expediteur_id

    // Avatar colors
    const avBg = estMoi ? Colors.primary : estAdmin ? Colors.warning : '#E0E0E0'
    const avTx = estMoi ? Colors.white   : estAdmin ? Colors.white   : Colors.textSecondary

    return (
      <View style={[styles.msgRow, estMoi && styles.msgRowMe, !showHeader && { marginTop: 2 }]}>
        {!estMoi && (
          <View style={[styles.avatar, { backgroundColor: avBg, opacity: showHeader ? 1 : 0 }]}>
            <Text style={[styles.avatarTxt, { color: avTx }]}>{inits}</Text>
          </View>
        )}
        <View style={[styles.msgContent, estMoi && styles.msgContentMe]}>
          {showHeader && !estMoi && (
            <Text style={styles.senderName}>
              {estAdmin ? 'Administration' : m.expediteur_nom?.split(' ')[0] || 'Resident'}
            </Text>
          )}
          <View style={[
            styles.bubble,
            estMoi ? styles.bubbleMe :
            estAdmin ? styles.bubbleAdmin :
            styles.bubbleOther
          ]}>
            <Text style={[styles.bubbleTxt, estMoi && { color: Colors.white }, estAdmin && { color: '#5C3000' }]}>
              {m.contenu}
            </Text>
          </View>
          {showHeader && (
            <View style={[styles.msgTimeRow, estMoi && { justifyContent: 'flex-end' }]}>
              <Text style={[styles.msgTime, estMoi && { textAlign: 'right' }]}>
                {formatDate(m.date_envoi)}
              </Text>
              {estMoi && (
                <Text style={styles.deliveryStatus}>
                  {isPending ? '⏱' : m.lu ? '✓✓' : '✓'}
                </Text>
              )}
            </View>
          )}
        </View>
        {estMoi && (
          <View style={[styles.avatar, { backgroundColor: Colors.primary }]}>
            <Text style={[styles.avatarTxt, { color: Colors.white }]}>
              {initiales(resident.prenom, resident.nom)}
            </Text>
          </View>
        )}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={88}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />
      <View style={styles.container}>

        {/* Canal selector */}
        <View style={styles.canalBar}>
          {CANAUX.map(c => (
            <TouchableOpacity key={c.id} style={[styles.canalTab, canal === c.id && styles.canalTabActive]} onPress={() => setCanal(c.id)} activeOpacity={0.8}>
              <Text style={[styles.canalLabel, canal === c.id && styles.canalLabelActive]}>{c.label}</Text>
              <Text style={[styles.canalSub, canal === c.id && { color: 'rgba(255,255,255,0.7)' }]}>{c.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Privacy notice */}
        <View style={styles.privacyBar}>
          <Icon name={canal === 'prive' ? 'lock' : 'user'} size={12} color={Colors.primary} strokeWidth={2} />
          <Text style={styles.privacyTxt}>
            {canal === 'prive'
              ? 'Conversation privée et confidentielle avec l\'administration'
              : 'Forum partagé entre tous les résidents de la résidence'}
          </Text>
        </View>

        {/* Messages */}
        {loading && messages.length === 0 ? <Spinner /> : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id?.toString()}
            renderItem={renderMsg}
            contentContainerStyle={styles.msgList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIco}>
                  <Icon name="chat" size={28} color={Colors.textTertiary} />
                </View>
                <Text style={styles.emptyTitle}>Aucun message</Text>
                <Text style={styles.emptySub}>Commencez la conversation</Text>
              </View>
            }
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Input */}
        <View style={styles.inputBar}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={texte}
            onChangeText={setTexte}
            placeholder={canal === 'prive' ? "Écrire à l'administration…" : "Écrire à la communauté…"}
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={envoyer}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { opacity: texte.trim() && !sending ? 1 : 0.35 }]}
            onPress={envoyer}
            disabled={!texte.trim() || sending}
            activeOpacity={0.8}
          >
            <Icon name="send" size={16} color={Colors.white} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F5F5F5' },
  canalBar:    { flexDirection: 'row', backgroundColor: Colors.primary, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 8 },
  canalTab:    { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  canalTabActive: { backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  canalLabel:  { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 1 },
  canalLabelActive: { color: Colors.white },
  canalSub:    { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  privacyBar:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primaryFaint, paddingHorizontal: 16, paddingVertical: 8 },
  privacyTxt:  { fontSize: 11.5, color: Colors.primaryDark, flex: 1, lineHeight: 16 },
  msgList:     { padding: 12, paddingBottom: 8, gap: 6 },
  msgRow:      { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 8 },
  msgRowMe:    { flexDirection: 'row-reverse' },
  avatar:      { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt:   { fontSize: 10, fontWeight: '700' },
  msgContent:  { flex: 1, maxWidth: '76%' },
  msgContentMe:{ alignItems: 'flex-end' },
  senderName:  { fontSize: 11, color: Colors.textTertiary, marginBottom: 3, marginLeft: 2, fontWeight: '600' },
  bubble:      { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleOther: { backgroundColor: Colors.white, borderBottomLeftRadius: 4, ...Shadows.card },
  bubbleAdmin: { backgroundColor: '#FFF4E0', borderBottomLeftRadius: 4, borderLeftWidth: 3, borderLeftColor: Colors.warning },
  bubbleMe:    { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleTxt:   { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  msgTime:     { fontSize: 10, color: Colors.textTertiary, marginTop: 3, marginHorizontal: 2 },
  msgTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deliveryStatus: { fontSize: 10, color: Colors.textTertiary },
  emptyWrap:   { alignItems: 'center', paddingVertical: 60 },
  emptyIco:    { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.surfaceGray, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle:  { fontSize: 15, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
  emptySub:    { fontSize: 13, color: Colors.textTertiary },
  inputBar:    { flexDirection: 'row', padding: 10, gap: 8, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'flex-end' },
  input:       { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: Colors.textPrimary, maxHeight: 100, backgroundColor: Colors.surfaceGray, lineHeight: 20 },
  sendBtn:     { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
})
