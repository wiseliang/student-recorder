import React, { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useFocusEffect } from '@react-navigation/native'
import { post } from '../utils/api'
import { getCurrentWeek, getWeekRange } from '../utils/week'

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export default function WeekSettingsScreen() {
  const [week1Date, setWeek1Date] = useState('2026-03-09')
  const [newDate, setNewDate] = useState(new Date())
  const [showPicker, setShowPicker] = useState(false)
  const [currentWeek, setCurrentWeek] = useState(0)
  const [weekRange, setWeekRangeState] = useState('')
  const [settingWeek, setSettingWeek] = useState(false)

  useFocusEffect(useCallback(() => {
    const w = getCurrentWeek()
    setCurrentWeek(w)
    setWeekRangeState(getWeekRange(w))
  }, []))

  const setWeekStart = async () => {
    const d = newDate
    if (d.getDay() !== 1) {
      return Alert.alert('日期不是周一', `选择的日期是${DAY_NAMES[d.getDay()]}，请选择周一`)
    }
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setSettingWeek(true)
    try {
      const res = await post('/api/week/set-start-date', { date: dateStr })
      Alert.alert('周次基准已更新', `第1周周一: ${res.newDate}\n当前: 第${res.currentWeek}周 · ${res.weekRange}`)
      setWeek1Date(res.newDate)
      setCurrentWeek(res.currentWeek)
      setWeekRangeState(res.weekRange)
    } catch (e) { Alert.alert('更新失败', e.message) }
    finally { setSettingWeek(false) }
  }

  const onDateChange = (_event, selectedDate) => {
    setShowPicker(Platform.OS === 'ios')
    if (selectedDate) setNewDate(selectedDate)
  }

  const newDateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📅 当前周次信息</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>第1周周一</Text>
          <Text style={styles.infoValue}>{week1Date}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>当前周次</Text>
          <Text style={styles.infoValue}>第{currentWeek}周</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>日期范围</Text>
          <Text style={styles.infoValue}>{weekRange}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔄 设置新基准</Text>
        <Text style={styles.desc}>选择新学期第1周周一的日期。此操作会影响所有用户的周次计算，请谨慎操作。</Text>

        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}>
          <Text style={styles.dateLabel}>新基准日期（周一）</Text>
          <Text style={styles.dateValue}>{newDateStr}</Text>
        </TouchableOpacity>
        {showPicker && (
          <DateTimePicker
            value={newDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
          />
        )}

        <TouchableOpacity style={styles.btn} onPress={setWeekStart} disabled={settingWeek}>
          <Text style={styles.btnText}>{settingWeek ? '📅 更新中...' : '📅 确认更新周次基准'}</Text>
        </TouchableOpacity>

        <View style={styles.warn}>
          <Text style={styles.warnText}>⚠️ 注意：更新后不可撤销，请确认日期为周一</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F5F7FA' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  desc: { fontSize: 13, color: '#999', marginBottom: 16, lineHeight: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  infoLabel: { fontSize: 14, color: '#666' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#333' },
  dateBtn: { backgroundColor: '#F5F7FA', borderRadius: 8, padding: 14, marginBottom: 16 },
  dateLabel: { fontSize: 13, color: '#999', marginBottom: 4 },
  dateValue: { fontSize: 18, fontWeight: '600', color: '#1B62A5' },
  btn: { backgroundColor: '#1B62A5', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  warn: { backgroundColor: '#FFF7E6', borderRadius: 8, padding: 12, marginTop: 12 },
  warnText: { color: '#E8A838', fontSize: 12, textAlign: 'center' },
})
