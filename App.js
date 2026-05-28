import 'react-native-gesture-handler'
import React, { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Text } from 'react-native'
import HomeScreen from './src/screens/HomeScreen'
import RecordScreen from './src/screens/RecordScreen'
import ProgressScreen from './src/screens/ProgressScreen'
import ResultScreen from './src/screens/ResultScreen'
import SettingsScreen from './src/screens/SettingsScreen'
import HistoryScreen from './src/screens/HistoryScreen'
import { post } from './src/utils/api'

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
        options={{ title: '首页', headerTitle: '批量录入助手', tabBarIcon: ({ color }) => <Text style={{fontSize:20}}>📋</Text> }} />
      <Tab.Screen name="History" component={HistoryScreen}
        options={{ title: '历史', tabBarIcon: () => <Text style={{fontSize:20}}>📜</Text> }} />
      <Tab.Screen name="Settings" component={SettingsScreen}
        options={{ title: '设置', tabBarIcon: () => <Text style={{fontSize:20}}>⚙️</Text> }} />
    </Tab.Navigator>
  )
}

export default function App() {
  useEffect(() => {
    (async () => {
      const openid = await AsyncStorage.getItem('openid')
      if (!openid) {
        try {
          const data = await post('/api/auth/login', { code: 'app_' + Date.now() })
          await AsyncStorage.setItem('openid', data.openid)
        } catch (_) {}
      }
    })()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#1B62A5' }, headerTintColor: '#fff' }}>
          <Stack.Screen name="Main" component={HomeTabs} options={{ headerShown: false }} />
          <Stack.Screen name="Record" component={RecordScreen} options={{ title: '录入' }} />
          <Stack.Screen name="Progress" component={ProgressScreen} options={{ title: '执行中', headerLeft: () => null }} />
          <Stack.Screen name="Result" component={ResultScreen} options={{ title: '结果', headerLeft: () => null }} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  )
}
