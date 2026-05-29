import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import { View, Text, Platform, TouchableOpacity } from 'react-native'
import Svg, { Path, Line, Polyline, Circle, Rect, Polygon } from 'react-native-svg'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import { Colors } from './src/theme'
import { Messages, Alertes } from './src/api'
import * as NotificationsExpo from 'expo-notifications'
import * as Device from 'expo-device'
import { useState, useEffect, useRef } from 'react'

import ConnexionScreen  from './src/screens/ConnexionScreen'
import AccueilScreen    from './src/screens/AccueilScreen'
import PaiementsScreen  from './src/screens/PaiementsScreen'
import MessagerieScreen from './src/screens/MessagerieScreen'
import { AlertesScreen, RequetesScreen, ProfilScreen } from './src/screens/OtherScreens'

NotificationsExpo.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

const Tab   = createBottomTabNavigator()
const Stack = createStackNavigator()

function TabIcon({ name, focused, size = 22 }) {
  const color = focused ? Colors.primary : '#AAAAAA'
  const sw    = focused ? 2.2 : 1.8
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' }
  const sp    = { stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' }

  const icons = {
    home: <Svg {...props}><Path {...sp} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><Polyline {...sp} points="9 22 9 12 15 12 15 22"/></Svg>,
    chat: <Svg {...props}><Path {...sp} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></Svg>,
    card: <Svg {...props}><Rect {...sp} x="1" y="4" width="22" height="16" rx="2"/><Line {...sp} x1="1" y1="10" x2="23" y2="10"/></Svg>,
    bell: <Svg {...props}><Path {...sp} d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></Svg>,
    help: <Svg {...props}><Circle {...sp} cx="12" cy="12" r="10"/><Path {...sp} d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><Line {...sp} x1="12" y1="17" x2="12.01" y2="17"/></Svg>,
    user: <Svg {...props}><Path {...sp} d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><Circle {...sp} cx="12" cy="7" r="4"/></Svg>,
  }

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {icons[name]}
    </View>
  )
}

function NotificationPopup({ visible, title, body, onHide }) {
  useEffect(() => {
    if (visible) {
      const t = setTimeout(onHide, 4000)
      return () => clearTimeout(t)
    }
  }, [visible])
  if (!visible) return null
  return (
    <View style={{
      position: 'absolute', top: 50, left: 16, right: 16,
      backgroundColor: '#fff', borderRadius: 16, padding: 16,
      flexDirection: 'row', alignItems: 'center', gap: 12,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
      borderLeftWidth: 4, borderLeftColor: Colors.primary,
    }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryFaint, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20 }}>{title?.startsWith('Alerte') ? '🔔' : '💬'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>{title}</Text>
        <Text style={{ fontSize: 13, color: '#666', marginTop: 2 }} numberOfLines={2}>{body}</Text>
      </View>
      <TouchableOpacity onPress={onHide} style={{ padding: 4 }}>
        <Text style={{ fontSize: 18, color: '#999' }}>×</Text>
      </TouchableOpacity>
    </View>
  )
}

function NotificationHandler() {
  const { resident } = useAuth()

  useEffect(() => {
    if (!resident || !Device.isDevice) return

    const registerForPushNotifications = async () => {
      try {
        const { status: existingStatus } = await NotificationsExpo.getPermissionsAsync()
        let finalStatus = existingStatus
        
        if (existingStatus !== 'granted') {
          const { status } = await NotificationsExpo.requestPermissionsAsync()
          finalStatus = status
        }
        
        if (finalStatus !== 'granted') return
        
        if (Platform.OS === 'android') {
          await NotificationsExpo.setNotificationChannelAsync('default', {
            name: 'default',
            importance: NotificationsExpo.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: Colors.primary,
          })
        }
        
        const token = await NotificationsExpo.getExpoPushTokenAsync()
        if (token?.token) {
          try {
            await fetch('http://10.111.130.206:5000/api/notifications/register-device', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ expo_token: token.token, type_app: 'mobile' })
            })
          } catch {}
        }
      } catch {}
    }

    registerForPushNotifications()
  }, [resident])

  return null
}

function AppTabs() {
  const [badges, setBadges] = useState({ messages: 0, alertes: 0 })
  const [lastPopup, setLastPopup] = useState(null)
  const prevBadges = useRef({ messages: 0, alertes: 0 })
  
  useEffect(() => {
    const loadBadges = async () => {
      try {
        const [msgData, alertData] = await Promise.all([
          Messages.nonLus().catch(() => ({ count: 0 })),
          Alertes.nonLues().catch(() => ({ count: 0 })),
        ])
        const newCount = { messages: msgData.count || 0, alertes: alertData.count || 0 }
        
        if (prevBadges.current.messages < newCount.messages) {
          setLastPopup({ title: 'Nouveau message', body: 'Vous avez un nouveau message!' })
        } else if (prevBadges.current.alertes < newCount.alertes) {
          setLastPopup({ title: 'Nouvelle alerte', body: 'Vous avez une nouvelle alerte!' })
        }
        
        prevBadges.current = newCount
        setBadges(newCount)
      } catch {}
    }
    loadBadges()
    const interval = setInterval(loadBadges, 15000)
    return () => clearInterval(interval)
  }, [])
  
  useEffect(() => {
    if (!lastPopup) return
    const t = setTimeout(() => setLastPopup(null), 4000)
    return () => clearTimeout(t)
  }, [lastPopup])

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor:   Colors.primary,
          tabBarInactiveTintColor: '#AAAAAA',
          tabBarStyle: {
            backgroundColor: Colors.white,
            borderTopColor: '#EEEEEE',
            borderTopWidth: 1,
            height: 78,
            paddingBottom: 14,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            letterSpacing: 0.2,
            marginTop: 3,
          },
          tabBarIcon: ({ focused }) => {
            const map = { Accueil:'home', Messagerie:'chat', Paiements:'card', Alertes:'bell', Requetes:'help' }
            const name = map[route.name] || 'home'
            const badge = route.name === 'Messagerie' ? badges.messages : route.name === 'Alertes' ? badges.alertes : 0
            return (
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <TabIcon name={name} focused={focused} />
                {badge > 0 && (
                  <View style={{ position: 'absolute', top: -4, right: -10, backgroundColor: '#DC2626', borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{badge > 9 ? '9+' : badge}</Text>
                  </View>
                )}
              </View>
            )
          },
        })}
      >
        <Tab.Screen name="Accueil"    component={AccueilScreen}    options={{ tabBarLabel: 'Accueil' }} />
        <Tab.Screen name="Messagerie" component={MessagerieScreen}  options={{ tabBarLabel: 'Messages' }} />
        <Tab.Screen name="Paiements"  component={PaiementsScreen}   options={{ tabBarLabel: 'Paiements' }} />
        <Tab.Screen name="Alertes"    component={AlertesScreen}     options={{ tabBarLabel: 'Alertes' }} />
        <Tab.Screen name="Requetes"   component={RequetesScreen}    options={{ tabBarLabel: 'Requêtes' }} />
      </Tab.Navigator>
      {lastPopup && (
        <NotificationPopup visible title={lastPopup.title} body={lastPopup.body} onHide={() => setLastPopup(null)} />
      )}
    </View>
  )
}

function RootNavigator() {
  const { resident } = useAuth()
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!resident ? (
        <Stack.Screen name="Connexion" component={ConnexionScreen} />
      ) : (
        <Stack.Screen name="App" component={AppTabs} />
      )}
    </Stack.Navigator>
  )
}

export default function App() {
  return (
    <NavigationContainer>
      <AuthProvider>
        <NotificationHandler />
        <RootNavigator />
      </AuthProvider>
    </NavigationContainer>
  )
}