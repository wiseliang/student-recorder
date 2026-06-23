import React, { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { get } from '../utils/api'
import { getCurrentWeek, getWeekRange } from '../utils/week'

export default function HomeScreen({ navigation }) {
  const [week, setWeek] = useState(0)
  const [weekRange, setWeekRange] = useState('')
  const [hasCred, setHasCred] = useState(false)
  const [hasActiveSession, setHasActiveSession] = useState(false)

  useFocusEffect(useCallback(() => {
    const w = getCurrentWeek()
    setWeek(w)
    setWeekRange(getWeekRange(w))
    get('/api/auth/credential').then(r => setHasCred(r.hasCredential)).catch(() => {})
    get('/api/auth/session-status').then(r => setHasActiveSession(r.hasActiveSession)).catch(() => {})
  }, []))

  const go = (type) => {
    navigation.navigate('Record', { type, week })
  }

  return (
    <View style={styles.container}>
      <View style={styles.weekCard}>
        <View style={styles.weekRow}>
          <Text style={styles.weekNum}>第{week}周</Text>
          <Text style={styles.weekDate}>{weekRange}</Text>
        </View>
        <Text style={styles.weekHint}>{week % 2 === 1 ? '奇数周 → 建议录入陪伴' : '偶数周 → 建议录入谈话'}</Text>
      </View>

      <TouchableOpacity style={[styles.entry, styles.entryCompanion]} onPress={() => go('companion')}>
        <Text style={styles.entryIcon}>📝</Text>
        <View style={styles.entryText}>
          <Text style={styles.entryTitle}>录入陪伴</Text>
          <Text style={styles.entryDesc}>共同进餐/上课/自习/运动</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.entry, styles.entryTalk]} onPress={() => go('talk')}>
        <Text style={styles.entryIcon}>🏠</Text>
        <View style={styles.entryText}>
          <Text style={styles.entryTitle}>录入谈话</Text>
          <Text style={styles.entryDesc}>走访寝室 / 走访课堂</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.entry, styles.entryBatch]} onPress={() => go('batch')}>
        <Text style={styles.entryIcon}>🚀</Text>
        <View style={styles.entryText}>
          <Text style={styles.entryTitle}>一键录入</Text>
          <Text style={styles.entryDesc}>第1周～当前周，自动交替</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.entry, styles.entryFill]} onPress={() => go('fill-missing')}>
        <Text style={styles.entryIcon}>🔍</Text>
        <View style={styles.entryText}>
          <Text style={styles.entryTitle}>查询补录</Text>
          <Text style={styles.entryDesc}>扫描缺失记录，一键补齐</Text>
        </View>
      </TouchableOpacity>

      {!hasCred && !hasActiveSession && (
        <TouchableOpacity style={styles.warn} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.warnText}>⚠️ 请先配置工号和密码</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F5F7FA' },
  weekCard: { backgroundColor: '#1B62A5', borderRadius: 16, padding: 24, marginBottom: 16 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  weekNum: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  weekDate: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  weekHint: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 8 },
  entry: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 10, borderLeftWidth: 5 },
  entryCompanion: { borderLeftColor: '#4A90D9' },
  entryTalk: { borderLeftColor: '#E8A838' },
  entryBatch: { borderLeftColor: '#52C41A' },
  entryFill: { borderLeftColor: '#FF4D4F' },
  entryIcon: { fontSize: 32, marginRight: 16 },
  entryText: { flex: 1 },
  entryTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  entryDesc: { fontSize: 13, color: '#999', marginTop: 2 },
  warn: { backgroundColor: '#FFF7E6', borderRadius: 12, padding: 16, alignItems: 'center' },
  warnText: { color: '#E8A838', fontSize: 14 },
})
