import React, { useState, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import { get, post } from '../utils/api'
import { getCurrentWeek, getWeekRange } from '../utils/week'

export default function SettingsScreen({ navigation }) {
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [hasCred, setHasCred] = useState(false)
  const [maskedId, setMaskedId] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentWeek, setCurrentWeek] = useState(0)
  const [weekRange, setWeekRangeState] = useState('')

  useFocusEffect(useCallback(() => {
    checkCred()
    const w = getCurrentWeek()
    setCurrentWeek(w)
    setWeekRangeState(getWeekRange(w))
  }, []))

  const checkCred = async () => {
    try {
      const oid = await AsyncStorage.getItem('openid')
      const params = oid ? { openid: oid } : {}
      const res = await get('/api/auth/credential', params)
      setHasCred(res.hasCredential)
      if (res.hasCredential) {
        const stored = await AsyncStorage.getItem('studentId')
        if (stored) {
          setMaskedId(stored.replace(/.(?=.{2})/g, '*'))
        }
      }
    } catch (_) {}
  }

  const save = async () => {
    if (!studentId.trim() || !password.trim()) return Alert.alert('请填写完整')
    setSaving(true)
    try {
      await post('/api/auth/credential', { openid: await AsyncStorage.getItem('openid'), studentId: studentId.trim(), password: password.trim() })
      await AsyncStorage.setItem('studentId', studentId.trim())
      Alert.alert('保存成功')
      setHasCred(true)
      setMaskedId(studentId.trim().replace(/.(?=.{2})/g, '*'))
      setPassword('')
    } catch (e) { Alert.alert('保存失败', e.message) }
    finally { setSaving(false) }
  }

  const clearCred = () => {
    Alert.alert('确认清除', '清除后需要重新配置学号密码才能使用', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定清除', style: 'destructive',
        onPress: async () => {
          setHasCred(false)
          setMaskedId('')
          setStudentId('')
          await AsyncStorage.removeItem('studentId')
          Alert.alert('已清除')
        }
      }
    ])
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔑 账号凭证</Text>
        <Text style={styles.desc}>用于登录管理系统</Text>
        <Text style={styles.label}>工号</Text>
        <TextInput style={styles.input} value={studentId} onChangeText={setStudentId} placeholder="请输入工号" />
        <Text style={styles.label}>密码</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="请输入密码" secureTextEntry />
        <TouchableOpacity style={styles.btn} onPress={save} disabled={saving}>
          <Text style={styles.btnText}>{saving ? '💾 保存中...' : '💾 保存凭证'}</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>凭证将加密存储在服务器上</Text>
      </View>

      {hasCred && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>✅ 凭证已配置</Text>
          <Text style={styles.desc}>工号：{maskedId}</Text>
          <TouchableOpacity style={styles.clearBtn} onPress={clearCred}>
            <Text style={styles.clearBtnText}>清除凭证</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.navRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>📅 周次基准日期</Text>
            <Text style={styles.desc}>当前: 第{currentWeek}周 · {weekRange}</Text>
          </View>
          <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('WeekSettings')}>
            <Text style={styles.navBtnText}>设置 →</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>ℹ️ 关于</Text>
        <Text style={styles.desc}>批量录入助手 v1.0.0</Text>
        <Text style={styles.desc}>高效的批量数据处理工具</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F5F7FA' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  desc: { fontSize: 13, color: '#999', marginBottom: 8 },
  label: { fontSize: 14, color: '#666', marginBottom: 4 },
  input: { height: 48, backgroundColor: '#F5F7FA', borderRadius: 8, paddingHorizontal: 12, fontSize: 16, marginBottom: 12 },
  btn: { backgroundColor: '#1B62A5', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 11, color: '#ccc', textAlign: 'center', marginTop: 8 },
  clearBtn: { backgroundColor: '#FFF2F0', borderRadius: 10, height: 44, justifyContent: 'center', alignItems: 'center' },
  clearBtnText: { color: '#FF4D4F', fontSize: 14, fontWeight: '600' },
  navRow: { flexDirection: 'row', alignItems: 'center' },
  navBtn: { backgroundColor: '#F0F7FF', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  navBtnText: { color: '#1B62A5', fontSize: 14, fontWeight: '600' },
})
