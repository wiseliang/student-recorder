import 'react-native-gesture-handler'
import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import HomeScreen from './src/screens/HomeScreen'
import RecordScreen from './src/screens/RecordScreen'
import ProgressScreen from './src/screens/ProgressScreen'
import ResultScreen from './src/screens/ResultScreen'
import SettingsScreen from './src/screens/SettingsScreen'
import HistoryScreen from './src/screens/HistoryScreen'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

function HomeTabs() {
  return (
    <Tab.Navigator screenOptions={{
      headerStyle: { backgroundColor: '#1B62A5' },
      headerTintColor: '#fff',
      tabBarActiveTintColor: '#1B62A5',
    }}>
      <Tab.Screen name="Home" component={HomeScreen}
        options={{ title: '首页', headerTitle: '批量录入助手', tabBarIcon: () => <Text>📋</Text> }} />
      <Tab.Screen name="History" component={HistoryScreen}
        options={{ title: '历史', tabBarIcon: () => <Text>📜</Text> }} />
      <Tab.Screen name="Settings" component={SettingsScreen}
        options={{ title: '设置', tabBarIcon: () => <Text>⚙️</Text> }} />
    </Tab.Navigator>
  )
}

export default function App() {
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem('openid').then(openid => {
      if (!openid) {
        const { post } = require('./src/utils/api')
        post('/api/auth/login', { code: 'app_' + Date.now() })
          .then(d => AsyncStorage.setItem('openid', d.openid))
          .catch(() => {})
      }
    }).catch(() => {})
    setTimeout(() => setBooted(true), 200)
  }, [])

  if (!booted) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1B62A5" />
        <Text style={{ marginTop: 12, color: '#666' }}>启动中...</Text>
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#1B62A5' }, headerTintColor: '#fff' }}>
        <Stack.Screen name="Main" component={HomeTabs} options={{ headerShown: false }} />
        <Stack.Screen name="Record" component={RecordScreen} options={{ title: '录入' }} />
        <Stack.Screen name="Progress" component={ProgressScreen} options={{ title: '执行中', headerLeft: () => null }} />
        <Stack.Screen name="Result" component={ResultScreen} options={{ title: '结果', headerLeft: () => null }} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' }
})
