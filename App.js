import 'react-native-gesture-handler'
import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

// 最小兜底页面
function FallbackScreen({ msg }) {
  return (
    <View style={styles.center}>
      <Text style={{ fontSize: 18, color: '#333' }}>{msg || '页面加载中...'}</Text>
    </View>
  )
}

// 动态加载页面，如果导入失败就显示兜底
let HomeScreen, RecordScreen, ProgressScreen, ResultScreen, SettingsScreen, HistoryScreen
try {
  HomeScreen = require('./src/screens/HomeScreen').default
} catch (e) { console.warn('HomeScreen load failed:', e.message); HomeScreen = () => <FallbackScreen msg="首页加载失败" /> }
try {
  RecordScreen = require('./src/screens/RecordScreen').default
} catch (e) { console.warn('RecordScreen load failed:', e.message); RecordScreen = () => <FallbackScreen msg="录入页加载失败" /> }
try {
  ProgressScreen = require('./src/screens/ProgressScreen').default
} catch (e) { console.warn('ProgressScreen load failed:', e.message); ProgressScreen = () => <FallbackScreen msg="进度页加载失败" /> }
try {
  ResultScreen = require('./src/screens/ResultScreen').default
} catch (e) { console.warn('ResultScreen load failed:', e.message); ResultScreen = () => <FallbackScreen msg="结果页加载失败" /> }
try {
  SettingsScreen = require('./src/screens/SettingsScreen').default
} catch (e) { console.warn('SettingsScreen load failed:', e.message); SettingsScreen = () => <FallbackScreen msg="设置页加载失败" /> }
try {
  HistoryScreen = require('./src/screens/HistoryScreen').default
} catch (e) { console.warn('HistoryScreen load failed:', e.message); HistoryScreen = () => <FallbackScreen msg="历史页加载失败" /> }

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
    // 非阻塞后台登录
    AsyncStorage.getItem('openid').then(openid => {
      if (!openid) {
        const { post } = require('./src/utils/api')
        post('/api/auth/login', { code: 'app_' + Date.now() })
          .then(d => AsyncStorage.setItem('openid', d.openid))
          .catch(() => {})
      }
    }).catch(() => {})
    // 延迟 100ms 确保导航就绪
    setTimeout(() => setBooted(true), 100)
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
