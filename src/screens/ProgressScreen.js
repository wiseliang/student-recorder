import React, { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { get, post } from '../utils/api'

export default function ProgressScreen({ route, navigation }) {
  const { taskUuid } = route.params
  const [task, setTask] = useState(null)
  const [code, setCode] = useState('')
  const [fetchError, setFetchError] = useState('')
  const [pausing, setPausing] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [abandoning, setAbandoning] = useState(false)
  const backoffRef = useRef(2000)
  const pollTimerRef = useRef(null)

  const fetchProgress = async () => {
    try {
      const t = await get(`/api/task/${taskUuid}`)
      setTask(t)
      setFetchError('')
      backoffRef.current = 2000
      if ((t.status === 'completed' || t.status === 'failed') && !t.paused) {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
        setTimeout(() => navigation.replace('Result', { taskUuid }), 1500)
      }
    } catch (_) {
      setFetchError('网络异常，正在重试...')
      backoffRef.current = Math.min(backoffRef.current * 2, 16000)
    }
  }

  useEffect(() => {
    fetchProgress()
    const schedulePoll = () => {
      pollTimerRef.current = setTimeout(async () => {
        await fetchProgress()
        schedulePoll()
      }, backoffRef.current)
    }
    schedulePoll()
    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current) }
  }, [])

  const submitCode = async () => {
    try {
      await post(`/api/task/${taskUuid}/submit-code`, { code })
      Alert.alert('已提交')
    } catch (e) { Alert.alert('失败', e.message) }
  }

  const handlePause = async () => {
    setPausing(true)
    try {
      await post(`/api/task/${taskUuid}/pause`)
    } catch (e) {
      Alert.alert('暂停失败', e.message)
    }
    finally { setPausing(false) }
  }

  const handleResume = async () => {
    setResuming(true)
    try {
      await post(`/api/task/${taskUuid}/resume`)
    } catch (e) {
      Alert.alert('恢复失败', e.message)
    }
    finally { setResuming(false) }
  }

  const handleAbandon = () => {
    Alert.alert('确认放弃', '已录入的数据将保留，未完成的将被跳过。', [
      { text: '取消', style: 'cancel' },
      { text: '放弃', style: 'destructive', onPress: async () => {
        setAbandoning(true)
        try {
          await post(`/api/task/${taskUuid}/abandon`)
        } catch (e) {
          Alert.alert('操作失败', e.message)
        }
        finally { setAbandoning(false) }
      }}
    ])
  }

  if (!task) return <View style={styles.container}><Text>加载中...</Text></View>

  if (task.status === 'awaiting_code') {
    return (
      <View style={styles.container}>
        <Text style={styles.icon}>🔐</Text>
        <Text style={styles.title}>需要验证码</Text>
        <Text style={styles.hint}>打开认证APP查看动态口令</Text>
        <View style={styles.row}>
          <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="验证码" keyboardType="number-pad" maxLength={6} />
          <TouchableOpacity style={styles.btn} onPress={submitCode}><Text style={styles.btnText}>提交</Text></TouchableOpacity>
        </View>
      </View>
    )
  }

  // Paused state
  if (task.paused) {
    return (
      <View style={styles.container}>
        <Text style={styles.icon}>⏸️</Text>
        <Text style={styles.title}>已暂停</Text>
        <Text style={styles.progressText}>{task.progress.processed} / {task.total}</Text>
        <View style={styles.statRow}>
          <View style={styles.stat}><Text style={styles.green}>{task.progress.success}</Text><Text> 成功</Text></View>
          <View style={styles.stat}><Text style={styles.yellow}>{task.progress.skipped}</Text><Text> 跳过</Text></View>
          <View style={styles.stat}><Text style={styles.red}>{task.progress.error}</Text><Text> 失败</Text></View>
        </View>
        <Text style={styles.current}>当前: {task.currentStudent || '-'}</Text>
        <View style={styles.pauseRow}>
          <TouchableOpacity style={[styles.btn, styles.resumeBtn]} onPress={handleResume} disabled={resuming}>
            <Text style={styles.btnText}>{resuming ? '恢复中...' : '▶️ 继续录入'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.abandonBtn]} onPress={handleAbandon} disabled={abandoning}>
            <Text style={styles.btnText}>{abandoning ? '终止中...' : '❌ 放弃'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const pct = task.total > 0 ? Math.round(task.progress.processed / task.total * 100) : 0

  return (
    <View style={styles.container}>
      {fetchError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{fetchError}</Text>
        </View>
      ) : null}
      <Text style={styles.title}>
        {task.status === 'completed' ? '✅ 录入完成' : task.status === 'failed' ? '❌ 录入失败' : '📡 执行中...'}
      </Text>
      <View style={styles.barWrap}>
        <View style={[styles.bar, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.progressText}>{task.progress.processed} / {task.total}</Text>
      <View style={styles.statRow}>
        <View style={styles.stat}><Text style={styles.green}>{task.progress.success}</Text><Text> 成功</Text></View>
        <View style={styles.stat}><Text style={styles.yellow}>{task.progress.skipped}</Text><Text> 跳过</Text></View>
        <View style={styles.stat}><Text style={styles.red}>{task.progress.error}</Text><Text> 失败</Text></View>
      </View>
      <Text style={styles.current}>当前: {task.currentStudent || '-'}</Text>

      {task.status === 'running' && (
        <TouchableOpacity style={[styles.btn, styles.pauseBtn]} onPress={handlePause} disabled={pausing}>
          <Text style={styles.btnText}>{pausing ? '暂停中...' : '⏸️ 暂停'}</Text>
        </TouchableOpacity>
      )}

      {task.status === 'completed' || task.status === 'failed' ? (
        <TouchableOpacity style={styles.btn} onPress={() => navigation.replace('Result', { taskUuid })}>
          <Text style={styles.btnText}>查看详细结果</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, alignItems: 'center', backgroundColor: '#F5F7FA' },
  icon: { fontSize: 48, marginTop: 40 },
  title: { fontSize: 22, fontWeight: '600', marginVertical: 20 },
  hint: { fontSize: 14, color: '#999', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 8, width: '100%' },
  input: { flex: 1, height: 48, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, fontSize: 18, letterSpacing: 6 },
  btn: { backgroundColor: '#1B62A5', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  barWrap: { width: '100%', height: 12, backgroundColor: '#E8E8E8', borderRadius: 6, marginBottom: 12 },
  bar: { height: 12, backgroundColor: '#1B62A5', borderRadius: 6 },
  progressText: { fontSize: 18, color: '#666', marginBottom: 20 },
  statRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  stat: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  green: { color: '#52C41A', fontSize: 24, fontWeight: 'bold' },
  yellow: { color: '#FAAD14', fontSize: 24, fontWeight: 'bold' },
  red: { color: '#FF4D4F', fontSize: 24, fontWeight: 'bold' },
  current: { fontSize: 13, color: '#999', marginBottom: 20 },
  errorBanner: { width: '100%', backgroundColor: '#FFF3E0', borderRadius: 12, padding: 16, marginBottom: 16 },
  errorBannerText: { fontSize: 13, color: '#E65100' },
  pauseBtn: { backgroundColor: '#FAAD14', marginTop: 8 },
  pauseRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  resumeBtn: { backgroundColor: '#52C41A', flex: 1 },
  abandonBtn: { backgroundColor: '#FF4D4F', flex: 1 },
})
