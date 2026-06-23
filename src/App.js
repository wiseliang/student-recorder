import React, { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import AsyncStorage from '@react-native-async-storage/async-storage'
import HomeScreen from './screens/HomeScreen'
import RecordScreen from './screens/RecordScreen'
import ProgressScreen from './screens/ProgressScreen'
import ResultScreen from './screens/ResultScreen'
import SettingsScreen from './screens/SettingsScreen'
import WeekSettingsScreen from './screens/WeekSettingsScreen'
import HistoryScreen from './screens/HistoryScreen'
import { BASE_URL } from './utils/api'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

const stackScreenOptions = {
  headerStyle: { backgroundColor: '#1B62A5' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: 'bold' },
}

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: '批量录入助手' }} />
      <Stack.Screen name="Record" component={RecordScreen} options={{ title: '录入' }} />
      <Stack.Screen name="Progress" component={ProgressScreen} options={{ title: '进度' }} />
      <Stack.Screen name="Result" component={ResultScreen} options={{ title: '结果' }} />
    </Stack.Navigator>
  )
}

function HistoryStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="History" component={HistoryScreen} options={{ title: '历史' }} />
      <Stack.Screen name="Result" component={ResultScreen} options={{ title: '结果' }} />
    </Stack.Navigator>
  )
}

function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: '设置' }} />
      <Stack.Screen name="WeekSettings" component={WeekSettingsScreen} options={{ title: '周次基准' }} />
    </Stack.Navigator>
  )
}

const splashStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1B62A5' },
  title: { fontSize: 28, color: '#fff', fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 24 },
  spinner: { marginTop: 16 },
})

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initOpenid()
  }, [])

  const initOpenid = async () => {
    try {
      let openid = await AsyncStorage.getItem('openid')
      if (!openid) {
        const code = 'rn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10)
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 8000)
          try {
            const resp = await fetch(BASE_URL + '/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code }),
              signal: controller.signal,
            })
            const data = await resp.json()
            if (data.openid) {
              await AsyncStorage.setItem('openid', data.openid)
              return
            }
          } finally {
            clearTimeout(timeoutId)
          }
        } catch (_) {}
        // Fallback: generate local openid when server unreachable
        const fallbackId = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10)
        await AsyncStorage.setItem('openid', fallbackId)
      }
    } catch (_) {}
    setReady(true)
  }

  if (!ready) {
    return (
      <View style={splashStyles.container}>
        <Text style={splashStyles.title}>批量录入助手</Text>
        <Text style={splashStyles.subtitle}>学生工作记录系统</Text>
        <ActivityIndicator size="large" color="#fff" style={splashStyles.spinner} />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#1B62A5',
          tabBarInactiveTintColor: '#999999',
          tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#E0E0E0' },
          tabBarLabelStyle: { fontSize: 11, marginBottom: 2 },
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeStack}
          options={{ tabBarLabel: '首页', tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🏠</Text> }}
        />
        <Tab.Screen
          name="HistoryTab"
          component={HistoryStack}
          options={{ tabBarLabel: '历史', tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📋</Text> }}
        />
        <Tab.Screen
          name="SettingsTab"
          component={SettingsStack}
          options={{
            tabBarLabel: '设置',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>⚙️</Text>,
            headerShown: false,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  )
}
