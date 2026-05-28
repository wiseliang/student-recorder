import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { get } from '../utils/api'

export default function ResultScreen({ route, navigation }) {
  const { taskUuid } = route.params
  const [task, setTask] = useState(null)

  useEffect(() => { get(`/api/task/${taskUuid}`).then(setTask).catch(() => {}) }, [])

  if (!task) return <View style={styles.container}><Text>加载中...</Text></View>

  const duration = task.startedAt && task.completedAt
    ? Math.round((new Date(task.completedAt) - new Date(task.startedAt)) / 1000)
    : 0
  const durStr = duration < 60 ? `${duration}秒` : `${Math.floor(duration/60)}分${duration%60}秒`

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.icon}>{task.progress.error === 0 ? '✅' : '⚠️'}</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>第{task.week}周 {task.type === 'companion' ? '陪伴' : '谈话'}</Text>
        <View style={styles.row}><Text style={styles.label}>共处理</Text><Text style={styles.value}>{task.total} 人</Text></View>
        <View style={styles.row}><Text style={styles.label}>用时</Text><Text style={styles.value}>{durStr}</Text></View>
      </View>
      <View style={styles.statRow}>
        <View style={[styles.stat, styles.statGreen]}><Text style={styles.statNum}>{task.progress.success}</Text><Text>成功</Text></View>
        <View style={[styles.stat, styles.statYellow]}><Text style={styles.statNum}>{task.progress.skipped}</Text><Text>跳过</Text></View>
        <View style={[styles.stat, styles.statRed]}><Text style={styles.statNum}>{task.progress.error}</Text><Text>失败</Text></View>
      </View>
      {task.errors && task.errors.length > 0 && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>失败记录</Text>
          {task.errors.map((e, i) => (
            <Text key={i} style={styles.errorItem}>#{e.seq} {e.reason}</Text>
          ))}
        </View>
      )}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.navigate('Main')}>
          <Text style={styles.btnSecondaryText}>返回首页</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.goBack()}>
          <Text style={styles.btnPrimaryText}>再次录入</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F5F7FA' },
  icon: { fontSize: 64, textAlign: 'center', marginVertical: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { color: '#999', fontSize: 14 },
  value: { fontWeight: '600', fontSize: 14 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center' },
  statGreen: { borderTopWidth: 3, borderTopColor: '#52C41A' },
  statYellow: { borderTopWidth: 3, borderTopColor: '#FAAD14' },
  statRed: { borderTopWidth: 3, borderTopColor: '#FF4D4F' },
  statNum: { fontSize: 28, fontWeight: 'bold' },
  errorCard: { backgroundColor: '#FFF2F0', borderRadius: 12, padding: 16, marginBottom: 20 },
  errorTitle: { fontWeight: '600', color: '#FF4D4F', marginBottom: 8 },
  errorItem: { color: '#666', fontSize: 13, paddingVertical: 2 },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 40 },
  btnSecondary: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 24, height: 48, justifyContent: 'center', alignItems: 'center' },
  btnSecondaryText: { color: '#666', fontSize: 15 },
  btnPrimary: { flex: 1, backgroundColor: '#1B62A5', borderRadius: 24, height: 48, justifyContent: 'center', alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
