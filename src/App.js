import React, { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Alert } from 'react-native'
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
import { post, BASE_URL } from './utils/api'

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
  const [initError, setInitError] = useState('')

  useEffect(() => {
    initOpenid()
  }, [])

  const initOpenid = async () => {
    setReady(false)
    setInitError('')
    try {
      const data = await post('/api/auth/login', { platform: 'android' })
      if (!data.openid || !data.token) throw new Error('登录响应无效，请更新服务端')
      await AsyncStorage.multiSet([['openid', data.openid], ['authToken', data.token], ['authServer', BASE_URL]])
    } catch (e) {
      setInitError(e.message || '无法连接服务器')
    } finally {
      setReady(true)
    }
  }

  if (ready && initError) {
    return <View style={splashStyles.container}>
      <Text style={splashStyles.title}>连接失败</Text>
      <Text style={splashStyles.subtitle}>{initError}</Text>
      <TouchableOpacity onPress={initOpenid}><Text style={{ color: '#fff', fontSize: 18 }}>重试</Text></TouchableOpacity>
      {initError.includes('登录已失效') && <TouchableOpacity onPress={() => Alert.alert(
        '重新登录', '会话已过期。重新登录后需要重新配置学工账号，原任务历史仍保留在原账户下。',
        [{ text: '取消', style: 'cancel' }, { text: '重新登录', onPress: async () => {
          try { await AsyncStorage.multiRemove(['openid', 'authToken']); await initOpenid() }
          catch (e) { setInitError(e.message || '无法清除登录信息') }
        } }]
      )}><Text style={{ color: '#fff', marginTop: 20 }}>重新登录</Text></TouchableOpacity>}
    </View>
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
