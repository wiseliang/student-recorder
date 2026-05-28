import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, StyleSheet, Alert } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { get, post } from '../utils/api'

const TYPE_NAMES = { companion: '录入陪伴', talk: '录入谈话', batch: '一键录入', 'fill-missing': '查询补录' }

export default function RecordScreen({ route, navigation }) {
  const { type, week } = route.params
  const currentWeek = week || 1
  const weeks = Array.from({ length: currentWeek }, (_, i) => ({
    val: i + 1, checked: i + 1 === currentWeek,
    hint: (i + 1) % 2 === 1 ? '陪伴' : '谈话'
  }))

  const [loginStep, setLoginStep] = useState('init')
  const [checking, setChecking] = useState(false)
  const [code, setCode] = useState('')
  const [captchaText, setCaptchaText] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [students, setStudents] = useState([])
  const [weekList, setWeekList] = useState(weeks)
  const [pbType, setPbType] = useState('共同上课')
  const [scene, setScene] = useState('走访寝室')
  const [contentText, setContentText] = useState(type === 'companion' ? '查课' : '查寝')
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)

  const openid = () => AsyncStorage.getItem('openid')

  const checkLogin = async () => {
    setChecking(true)
    try {
      const res = await post('/api/auth/start-login', { openid: await openid() })
      if (res.needsCaptcha) setLoginStep('needCaptcha'), setCaptchaImage(res.captchaImage)
      else if (res.needsCode) setLoginStep('needCode')
      else setLoginStep('done')
    } catch (e) { Alert.alert('登录失败', e.message) }
    finally { setChecking(false) }
  }

  const submitCaptcha = async () => {
    setSubmitting(true)
    try {
      const res = await post('/api/auth/submit-captcha', { openid: await openid(), captcha: captchaText })
      if (res.needsCaptcha) setCaptchaImage(res.captchaImage), setCaptchaText(''), Alert.alert('验证码错误，请重试')
      else if (res.needsCode) setLoginStep('needCode')
      else setLoginStep('done')
    } catch (e) { Alert.alert('提交失败', e.message) }
    finally { setSubmitting(false) }
  }

  const submitCode = async () => {
    setSubmitting(true)
    try {
      await post('/api/auth/submit-code', { openid: await openid(), code })
      setLoginStep('done')
    } catch (e) { Alert.alert('验证失败', e.message) }
    finally { setSubmitting(false) }
  }

  const resendCode = async () => {
    try { await post('/api/auth/resend-code', { openid: await openid() }); Alert.alert('已重新发送') }
    catch (e) { Alert.alert('重发失败', e.message) }
  }

  const loadStudents = async () => {
    setLoading(true)
    try {
      const w = weekList.find(w => w.checked)?.val || currentWeek
      const res = await get('/api/auth/student-list', { week: w })
      setStudents((res.students || []).map(s => ({ ...s, checked: true })))
    } catch (e) { Alert.alert('加载失败', e.message) }
    finally { setLoading(false) }
  }

  const toggleWeek = (val) => {
    setWeekList(prev => prev.map(w => w.val === val ? { ...w, checked: !w.checked } : w))
  }

  const toggleStudent = (idx) => {
    setStudents(prev => prev.map(s => s.index === idx ? { ...s, checked: !s.checked } : s))
  }

  const startRecord = async () => {
    setRecording(true)
    const selectedWeeks = weekList.filter(w => w.checked).map(w => w.val)
    const selectedStudents = students.filter(s => s.checked)
    const opts = {}
    if (type === 'companion') { opts.pbType = pbType; if (contentText) opts.content = contentText }
    else if (type === 'talk') { opts.scene = scene; if (contentText) opts.content = contentText }
    if (selectedStudents.length < students.length) opts.studentIndices = selectedStudents.map(s => s.index)
    if (type !== 'batch' && selectedWeeks.length > 0) opts.weeks = selectedWeeks

    try {
      const res = await post('/api/task/create', { openid: await openid(), type, week: type === 'batch' || type === 'fill-missing' ? 0 : (selectedWeeks[0] || 1), options: opts })
      navigation.navigate('Progress', { taskUuid: res.taskUuid, type, week: selectedWeeks[0] || 1 })
    } catch (e) { Alert.alert('创建失败', e.message) }
    finally { setRecording(false) }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{TYPE_NAMES[type]}</Text>
      {type !== 'batch' && type !== 'fill-missing' && <Text style={styles.subtitle}>第{week}周</Text>}

      {loginStep !== 'done' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>登录学工系统</Text>
          {loginStep === 'init' && (
            <TouchableOpacity style={styles.btn} onPress={checkLogin} disabled={checking}>
              <Text style={styles.btnText}>{checking ? '检测中...' : '检测登录'}</Text>
            </TouchableOpacity>
          )}
          {loginStep === 'needCaptcha' && (
            <View>
              <Text style={styles.hint}>请输入图片验证码</Text>
              <Image source={{ uri: captchaImage }} style={styles.captcha} resizeMode="contain" />
              <View style={styles.row}>
                <TextInput style={styles.input} value={captchaText} onChangeText={setCaptchaText} placeholder="验证码" />
                <TouchableOpacity style={styles.smallBtn} onPress={submitCaptcha} disabled={submitting}>
                  <Text style={styles.btnText}>提交</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {loginStep === 'needCode' && (
            <View>
              <Text style={styles.hint}>已发送验证码，打开认证APP查看</Text>
              <View style={styles.row}>
                <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="6位验证码" keyboardType="number-pad" maxLength={6} />
                <TouchableOpacity style={styles.smallBtn} onPress={submitCode} disabled={submitting}>
                  <Text style={styles.btnText}>提交</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={resendCode}><Text style={styles.link}>未收到？重新发送</Text></TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View>
          {type !== 'batch' && type !== 'fill-missing' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>选择周次</Text>
              {weekList.map(w => (
                <TouchableOpacity key={w.val} style={styles.checkRow} onPress={() => toggleWeek(w.val)}>
                  <Text>{w.checked ? '☑' : '☐'} 第{w.val}周</Text>
                  <Text style={styles.hintText}>{w.hint}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>学生列表</Text>
              <TouchableOpacity onPress={loadStudents} disabled={loading}>
                <Text style={styles.link}>{loading ? '加载中...' : students.length ? `已选 ${students.filter(s=>s.checked).length}/${students.length}` : '加载学生列表'}</Text>
              </TouchableOpacity>
            </View>
            {students.map(s => (
              <TouchableOpacity key={s.index} style={styles.checkRow} onPress={() => toggleStudent(s.index)}>
                <Text>{s.checked ? '☑' : '☐'} {s.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {type === 'fill-missing' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🔍 自动扫描补录</Text>
              <Text style={styles.hint}>扫描第1周～当前周所有奇数周</Text>
              <Text style={styles.hint}>对"差x次"学生强制补录陪伴上课</Text>
              <Text style={styles.hint}>跳过已有记录，只补缺失次数</Text>
            </View>
          )}

          {type === 'companion' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>陪伴类型</Text>
              <View style={styles.tagRow}>
                {['共同上课', '共同进餐', '共上自习', '共同运动'].map(t => (
                  <TouchableOpacity key={t} style={[styles.tag, pbType === t && styles.tagActive]} onPress={() => { setPbType(t); setContentText(t === '共同上课' ? '查课' : '') }}>
                    <Text style={[styles.tagText, pbType === t && styles.tagTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={styles.textInput} value={contentText} onChangeText={setContentText} placeholder="工作内容" />
            </View>
          )}

          {type === 'talk' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>谈话场景</Text>
              <View style={styles.tagRow}>
                {['走访寝室', '走访课堂'].map(s => (
                  <TouchableOpacity key={s} style={[styles.tag, scene === s && styles.tagActive]} onPress={() => { setScene(s); setContentText(s === '走访寝室' ? '查寝' : '查课') }}>
                    <Text style={[styles.tagText, scene === s && styles.tagTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={styles.textInput} value={contentText} onChangeText={setContentText} placeholder="工作内容" />
            </View>
          )}

          <TouchableOpacity style={styles.startBtn} onPress={startRecord} disabled={recording}>
            <Text style={styles.startBtnText}>{recording ? '创建中...' : '🚀 开始录入'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F5F7FA' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#999', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  hint: { fontSize: 13, color: '#666', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, height: 44, backgroundColor: '#F5F7FA', borderRadius: 8, paddingHorizontal: 12, fontSize: 16 },
  btn: { backgroundColor: '#1B62A5', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
  smallBtn: { backgroundColor: '#1B62A5', borderRadius: 8, width: 80, height: 44, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: '#1B62A5', fontSize: 13, textAlign: 'center', marginTop: 8 },
  checkRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  hintText: { fontSize: 12, color: '#999' },
  captcha: { width: 200, height: 60, alignSelf: 'center', marginVertical: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tag: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F5F5F5' },
  tagActive: { backgroundColor: '#E8A838' },
  tagText: { fontSize: 14, color: '#666' },
  tagTextActive: { color: '#fff' },
  textInput: { height: 44, backgroundColor: '#F5F7FA', borderRadius: 8, paddingHorizontal: 12, fontSize: 15 },
  startBtn: { backgroundColor: '#52C41A', borderRadius: 24, height: 52, justifyContent: 'center', alignItems: 'center', marginTop: 8, marginBottom: 40 },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
})
