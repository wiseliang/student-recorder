import { registerRootComponent } from 'expo'
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>批量录入助手</Text>
      <Text style={styles.sub}>v1.0.0</Text>
      <Text style={styles.status}>✅ 渲染正常</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1B62A5', marginBottom: 8 },
  sub: { fontSize: 14, color: '#999', marginBottom: 20 },
  status: { fontSize: 16, color: '#52C41A' },
})
