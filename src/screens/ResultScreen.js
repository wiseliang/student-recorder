import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { get } from '../utils/api'

export default function ResultScreen({ route, navigation }) {
  const { taskUuid } = route.params
  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  const loadResult = () => {
    setLoading(true); setFetchError(null)
    get(`/api/task/${taskUuid}`).then(setTask)
      .catch(e => setFetchError(e.message || '加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadResult() }, [])

  const groupedDetails = useMemo(() => {
    if (!task?.details || task.details.length === 0) return null
    const groups = {}
    task.details.forEach(d => {
      const key = d.name || `#${d.seq}`
      if (!groups[key]) groups[key] = { name: key, week: d.week, success: 0, skipped: 0, error: 0, total: 0 }
      groups[key][d.result]++
      groups[key].total++
    })
    return Object.values(groups)
  }, [task?.details])

  if (loading) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color="#1B62A5" />
    </View>
  )
  if (fetchError) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
      <Text style={{ fontSize: 16, color: '#FF4D4F', marginBottom: 16 }}>❌ {fetchError}</Text>
      <TouchableOpacity style={{ backgroundColor: '#1B62A5', borderRadius: 24, paddingHorizontal: 32, height: 48, justifyContent: 'center', alignItems: 'center' }} onPress={loadResult}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>🔄 重试</Text>
      </TouchableOpacity>
    </View>
  )
  if (!task) return <View style={styles.container}><Text>未找到任务数据</Text></View>

  const duration = task.startedAt && task.completedAt
    ? Math.round((new Date(task.completedAt) - new Date(task.startedAt)) / 1000)
    : 0
  const durStr = duration < 60 ? `${duration}秒` : `${Math.floor(duration/60)}分${duration%60}秒`

  const typeNames = { companion: '录入陪伴', talk: '录入谈话', batch: '一键录入', 'fill-missing': '查询补录' }
  const typeName = typeNames[task.type] || task.type

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={styles.icon}>{task.progress.error === 0 ? '✅' : '⚠️'}</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{typeName}{task.week > 0 ? ` · 第${task.week}周` : ''}</Text>
        <View style={styles.row}><Text style={styles.label}>共处理</Text><Text style={styles.value}>{task.total} 次</Text></View>
        <View style={styles.row}><Text style={styles.label}>用时</Text><Text style={styles.value}>{durStr}</Text></View>
      </View>
      <View style={styles.statRow}>
        <View style={[styles.stat, styles.statGreen]}><Text style={styles.statNum}>{task.progress.success}</Text><Text>成功</Text></View>
        <View style={[styles.stat, styles.statYellow]}><Text style={styles.statNum}>{task.progress.skipped}</Text><Text>跳过</Text></View>
        <View style={[styles.stat, styles.statRed]}><Text style={styles.statNum}>{task.progress.error}</Text><Text>失败</Text></View>
      </View>

      {groupedDetails && groupedDetails.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 逐人详情</Text>
          {groupedDetails.map((d, i) => (
            <View key={i} style={styles.detailRow}>
              <Text style={styles.detailName}>{d.name}</Text>
              <View style={styles.detailCounts}>
                {d.success > 0 && <Text style={styles.detailSuccess}>✓{d.success}</Text>}
                {d.skipped > 0 && <Text style={styles.detailSkip}>-{d.skipped}</Text>}
                {d.error > 0 && <Text style={styles.detailError}>✕{d.error}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}

      {task.errors && task.errors.length > 0 && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>❌ 失败记录</Text>
          {task.errors.map((e, i) => (
            <Text key={i} style={styles.errorItem}>
              {e.student ? `${e.student} · ` : ''}{e.week ? `第${e.week}周 ` : ''}{e.reason || ''}
            </Text>
          ))}
        </View>
      )}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.popToTop()}>
          <Text style={styles.btnSecondaryText}>🏠 返回首页</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.replace('Record', { type: task.type, week: task.week || 1 })}>
          <Text style={styles.btnPrimaryText}>🔁 再次录入</Text>
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
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  detailName: { fontSize: 14, color: '#333', flex: 1 },
  detailCounts: { flexDirection: 'row', gap: 8 },
  detailSuccess: { fontSize: 13, color: '#52C41A', fontWeight: '600' },
  detailSkip: { fontSize: 13, color: '#FAAD14' },
  detailError: { fontSize: 13, color: '#FF4D4F', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 40 },
  btnSecondary: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 24, height: 48, justifyContent: 'center', alignItems: 'center' },
  btnSecondaryText: { color: '#666', fontSize: 15 },
  btnPrimary: { flex: 1, backgroundColor: '#1B62A5', borderRadius: 24, height: 48, justifyContent: 'center', alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
