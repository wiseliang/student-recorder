import React, { useState, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import { get, post } from '../utils/api'

export default function SettingsScreen() {
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [hasCred, setHasCred] = useState(false)
  const [saving, setSaving] = useState(false)

  useFocusEffect(useCallback(() => {
    get('/api/auth/credential').then(r => setHasCred(r.hasCredential)).catch(() => {})
  }, []))

  const save = async () => {
    if (!studentId.trim() || !password.trim()) return Alert.alert('请填写完整')
    setSaving(true)
    try {
      await post('/api/auth/credential', { openid: await AsyncStorage.getItem('openid'), studentId: studentId.trim(), password: password.trim() })
      Alert.alert('保存成功')
      setHasCred(true)
    } catch (e) { Alert.alert('保存失败', e.message) }
    finally { setSaving(false) }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>账号凭证</Text>
        <Text style={styles.desc}>用于登录学工系统</Text>
        <Text style={styles.label}>工号</Text>
        <TextInput style={styles.input} value={studentId} onChangeText={setStudentId} placeholder="请输入工号" />
        <Text style={styles.label}>密码</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="请输入密码" secureTextEntry />
        <TouchableOpacity style={styles.btn} onPress={save} disabled={saving}>
          <Text style={styles.btnText}>{saving ? '保存中...' : '保存凭证'}</Text>
        </TouchableOpacity>
      </View>
      {hasCred && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>✅ 凭证已配置</Text>
        </View>
      )}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>关于</Text>
        <Text style={styles.desc}>学生工作记录 v1.0.0</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F5F7FA' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  desc: { fontSize: 13, color: '#999', marginBottom: 16 },
  label: { fontSize: 14, color: '#666', marginBottom: 4 },
  input: { height: 48, backgroundColor: '#F5F7FA', borderRadius: 8, paddingHorizontal: 12, fontSize: 16, marginBottom: 12 },
  btn: { backgroundColor: '#1B62A5', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
