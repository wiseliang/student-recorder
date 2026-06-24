import React, { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system'
import * as MediaLibrary from 'expo-media-library'
import { get, post } from '../utils/api'

const TYPE_NAMES = { companion: '录入陪伴', talk: '录入谈话', batch: '一键录入', 'fill-missing': '查询补录' }

export default function RecordScreen({ route, navigation }) {
  const { type, week } = route.params
  const currentWeek = week || 1
  const weeks = Array.from({ length: currentWeek }, (_, i) => ({
    val: i + 1, checked: i + 1 === currentWeek,
    hint: (i + 1) % 2 === 1 ? '陪伴' : '谈话'
  }))

  // credential
  const [hasLocalCred, setHasLocalCred] = useState(false)
  const [checkingLocalCred, setCheckingLocalCred] = useState(true)

  // login
  const [loginStep, setLoginStep] = useState('init')
  const [checking, setChecking] = useState(false)
  const [code, setCode] = useState('')
  const [captchaText, setCaptchaText] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  // qr
  const [qrCodeImage, setQrCodeImage] = useState('')
  const [qrMessage, setQrMessage] = useState('')
  const [checkingQr, setCheckingQr] = useState(false)
  const [isQrMfa, setIsQrMfa] = useState(false)
  const qrPollRef = useRef(null)
  // login failed
  const [loginFailedMsg, setLoginFailedMsg] = useState('')
  const [loginFailedScreenshot, setLoginFailedScreenshot] = useState('')

  // students
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [weekList, setWeekList] = useState(weeks)
  const [weekAllChecked, setWeekAllChecked] = useState(false)

  // options
  const [pbType, setPbType] = useState('共同上课')
  const [scene, setScene] = useState('走访寝室')
  const [contentText, setContentText] = useState(type === 'companion' ? '查课' : '查寝')
  const [recording, setRecording] = useState(false)

  const openid = () => AsyncStorage.getItem('openid')

  // Check credentials + active session on mount
  useEffect(() => {
    (async () => {
      try {
        const oid = await openid()
        const params = oid ? { openid: oid } : {}
        // Check active session first
        try {
          const sessionRes = await get('/api/auth/session-status', params)
          if (sessionRes.hasActiveSession) { setLoginStep('done'); setCheckingLocalCred(false); return }
        } catch (_) {}
        // Check DB credentials
        const credRes = await get('/api/auth/credential', params)
        setHasLocalCred(credRes.hasCredential)
      } catch (_) {}
      finally { setCheckingLocalCred(false) }
    })()
  }, [])

  // ===== Password login =====
  const checkLogin = async () => {
    setChecking(true)
    try {
      const res = await post('/api/auth/start-login', { openid: await openid() })
      handleLoginResult(res)
    } catch (e) { Alert.alert('登录失败', e.message) }
    finally { setChecking(false) }
  }

  const handleLoginResult = (res) => {
    if (res.loginFailed) { setLoginStep('loginFailed'); setLoginFailedMsg(res.message); setLoginFailedScreenshot(res.screenshot) }
    else if (res.needsCaptcha) { setLoginStep('needCaptcha'); setCaptchaImage(res.captchaImage) }
    else if (res.needsCode) { setLoginStep('needCode') }
    else { setLoginStep('done') }
  }

  const submitCaptcha = async () => {
    if (!captchaText.trim()) return Alert.alert('请输入验证码')
    setSubmitting(true)
    try {
      const res = await post('/api/auth/submit-captcha', { openid: await openid(), captcha: captchaText.trim() })
      if (res.needsCaptcha) { setCaptchaImage(res.captchaImage); setCaptchaText(''); Alert.alert('验证码错误，请重试') }
      else if (res.needsCode) { setLoginStep('needCode') }
      else { setLoginStep('done') }
    } catch (e) { Alert.alert('提交失败', e.message) }
    finally { setSubmitting(false) }
  }

  const submitCode = async () => {
    const c = code.trim()
    if (c.length < 4) return Alert.alert('请输入完整验证码')
    setSubmitting(true)
    if (isQrMfa) {
      try {
        const res = await post('/api/auth/qrcode-submit-code', { openid: await openid(), code: c })
        if (res.success) { Alert.alert('MFA 验证成功！'); setLoginStep('done'); setIsQrMfa(false) }
        else { Alert.alert(res.message || '验证失败') }
      } catch (e) { Alert.alert('提交失败', e.message) }
      finally { setSubmitting(false) }
      return
    }
    try {
      await post('/api/auth/submit-code', { openid: await openid(), code: c })
      Alert.alert('验证成功'); setLoginStep('done')
    } catch (e) { Alert.alert('验证失败', e.message) }
    finally { setSubmitting(false) }
  }

  const resendCode = async () => {
    setResending(true)
    try { await post('/api/auth/resend-code', { openid: await openid() }); Alert.alert('已重新发送') }
    catch (e) { Alert.alert(e.message || '重发失败') }
    finally { setResending(false) }
  }

  // ===== QR Code login =====
  const startQrLogin = async () => {
    setChecking(true)
    try {
      const res = await post('/api/auth/qrcode-start', { openid: await openid() })
      if (res.loggedIn) { Alert.alert('已登录，无需扫码'); setLoginStep('done') }
      else if (res.hasQrCode) { setLoginStep('qrcode'); setQrCodeImage(res.qrcode); setQrMessage(res.message); startQrPolling() }
      else if (res.needsMfa) { setLoginStep('needCode'); setCode(''); setIsQrMfa(true) }
      else { Alert.alert(res.message || '获取二维码失败') }
    } catch (e) { Alert.alert('获取二维码失败', e.message) }
    finally { setChecking(false) }
  }

  const startQrPolling = useCallback(() => {
    let attempts = 0; const MAX = 20; let cancelled = false
    const poll = async () => {
      if (cancelled) return
      try {
        const res = await post('/api/auth/qrcode-wait', { openid: await openid() })
        if (cancelled) return
        if (res.loggedIn) { Alert.alert('扫码登录成功！'); setLoginStep('done'); return }
        else if (res.needsMfa) { setLoginStep('needCode'); setCode(''); setIsQrMfa(true); return }
      } catch (_) {}
      attempts++
      if (attempts < MAX) qrPollRef.current = setTimeout(poll, 3000)
    }
    qrPollRef.current = setTimeout(poll, 3000)
  }, [])

  useEffect(() => { return () => { if (qrPollRef.current) { clearTimeout(qrPollRef.current); qrPollRef.current = null } } }, [])

  const checkQrLogin = async () => {
    if (qrPollRef.current) { clearTimeout(qrPollRef.current); qrPollRef.current = null }
    setCheckingQr(true)
    try {
      const res = await post('/api/auth/qrcode-wait', { openid: await openid() })
      if (res.loggedIn) { Alert.alert('扫码登录成功！'); setLoginStep('done') }
      else if (res.needsMfa) { setLoginStep('needCode'); setCode(''); setIsQrMfa(true) }
      else { Alert.alert('尚未扫码，请扫描后再试') }
    } catch (e) { Alert.alert('验证失败', e.message) }
    finally { setCheckingQr(false) }
  }

  // ===== Students =====
  const loadStudents = async () => {
    setLoadingStudents(true)
    try {
      const w = weekList.find(w => w.checked)?.val || currentWeek
      const res = await get('/api/auth/student-list', { week: w })
      setStudents((res.students || []).map(s => ({ ...s, _checked: true, _hasRecord: false })))
    } catch (e) { Alert.alert('加载失败', e.message) }
    finally { setLoadingStudents(false) }
  }

  const selectedCount = students.filter(s => s._checked).length
  const studentAllChecked = students.length > 0 && students.every(s => s._checked)

  const toggleWeek = (val) => {
    const next = weekList.map(w => w.val === val ? { ...w, checked: !w.checked } : w)
    setWeekList(next); setWeekAllChecked(next.every(w => w.checked))
  }
  const toggleAllWeeks = () => {
    const all = !weekAllChecked
    setWeekList(weekList.map(w => ({ ...w, checked: all }))); setWeekAllChecked(all)
  }
  const toggleStudent = (idx) => {
    setStudents(students.map(s => s.index === idx ? { ...s, _checked: !s._checked } : s))
  }
  const toggleAllStudents = () => {
    const all = !studentAllChecked
    setStudents(students.map(s => ({ ...s, _checked: all })))
  }

  // 保存二维码到相册
  const saveQrCode = async () => {
    if (!qrCodeImage) return
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('需要权限', '请在设置中允许访问相册')
        return
      }
      // data:image/png;base64,... → 写入临时文件 → 保存到相册
      const base64Data = qrCodeImage.includes('base64,')
        ? qrCodeImage.split('base64,')[1]
        : qrCodeImage
      const fileUri = FileSystem.cacheDirectory + `qrcode_${Date.now()}.png`
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      })
      await MediaLibrary.saveToLibraryAsync(fileUri)
      Alert.alert('已保存', '二维码已保存到相册')
    } catch (e) {
      Alert.alert('保存失败', e.message)
    }
  }

  const startRecord = async () => {
    setRecording(true)
    const selectedWeeks = weekList.filter(w => w.checked).map(w => w.val)
    const selectedStudents = students.filter(s => s._checked)
    const opts = {}
    if (type === 'companion') { opts.pbType = pbType; if (contentText) opts.content = contentText }
    else if (type === 'talk') { opts.scene = scene; if (contentText) opts.content = contentText }
    if (selectedStudents.length < students.length) opts.studentIndices = selectedStudents.map(s => s.index)
    if (selectedWeeks.length > 0) opts.weeks = selectedWeeks
    try {
      const res = await post('/api/task/create', { openid: await openid(), type, week: type === 'batch' || type === 'fill-missing' ? 0 : (selectedWeeks[0] || 1), options: opts })
      navigation.navigate('Progress', { taskUuid: res.taskUuid, type, week: selectedWeeks[0] || 1 })
    } catch (e) { Alert.alert('创建失败', e.message) }
    finally { setRecording(false) }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }} nestedScrollEnabled={true}>
      <Text style={styles.title}>{TYPE_NAMES[type]}</Text>
      {type !== 'batch' && type !== 'fill-missing' && <Text style={styles.subtitle}>第{week}周</Text>}

      {/* Login section */}
      {loginStep !== 'done' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔐 登录管理系统</Text>

          {loginStep === 'init' && (
            <View>
              {checkingLocalCred ? (
                <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                  <ActivityIndicator size="small" color="#1B62A5" />
                  <Text style={[styles.loginHint, { marginTop: 8 }]}>检测凭证状态...</Text>
                </View>
              ) : (
                <>
                  {hasLocalCred && (
                    <TouchableOpacity style={styles.btn} onPress={checkLogin} disabled={checking}>
                      <Text style={styles.btnText}>{checking ? '检测中...' : '密码登录'}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.btn, styles.btnQr, hasLocalCred ? { marginTop: 10 } : {}]} onPress={startQrLogin} disabled={checking}>
                    <Text style={styles.btnText}>{checking ? '获取二维码中...' : '📱 二维码登录'}</Text>
                  </TouchableOpacity>
                  {!hasLocalCred && (
                    <Text style={[styles.loginHint, { marginTop: 10 }]}>推荐使用二维码扫码登录，无需在 App 中保存密码</Text>
                  )}
                </>
              )}
            </View>
          )}

          {loginStep === 'qrcode' && (
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.loginHint}>{qrMessage || '请使用 HIT APP 扫描二维码'}</Text>
              {qrCodeImage ? (
                <TouchableOpacity onLongPress={saveQrCode} activeOpacity={0.8}>
                  <Image source={{ uri: qrCodeImage }} style={styles.qrCode} resizeMode="contain" />
                </TouchableOpacity>
              ) : null}
              <Text style={styles.saveHint}>长按二维码可保存到相册</Text>
              <TouchableOpacity style={[styles.btn, { marginTop: 10, width: '100%' }]} onPress={checkQrLogin} disabled={checkingQr}>
                <Text style={styles.btnText}>{checkingQr ? '验证中...' : '🔄 已完成扫码，验证登录'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setLoginStep('init'); setIsQrMfa(false) }}>
                <Text style={styles.link}>返回</Text>
              </TouchableOpacity>
            </View>
          )}

          {loginStep === 'loginFailed' && (
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.loginHint, { color: '#FF4D4F' }]}>❌ {loginFailedMsg}</Text>
              {loginFailedScreenshot ? <Image source={{ uri: loginFailedScreenshot }} style={styles.screenshot} resizeMode="contain" /> : null}
              <TouchableOpacity style={[styles.btn, { marginTop: 10 }]} onPress={checkLogin} disabled={checking}>
                <Text style={styles.btnText}>重试登录</Text>
              </TouchableOpacity>
            </View>
          )}

          {loginStep === 'needCaptcha' && (
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.loginHint}>需要输入图片验证码</Text>
              <Image source={{ uri: captchaImage }} style={styles.captcha} resizeMode="contain" />
              <View style={styles.row}>
                <TextInput style={styles.input} value={captchaText} onChangeText={setCaptchaText} placeholder="输入验证码" maxLength={6} />
                <TouchableOpacity style={styles.smallBtn} onPress={submitCaptcha} disabled={submitting}>
                  <Text style={styles.btnText}>提交</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {loginStep === 'needCode' && (
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.loginHint}>已发送验证码，打开 认证APP 查看</Text>
              <View style={styles.row}>
                <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="6位验证码" keyboardType="number-pad" maxLength={6} />
                <TouchableOpacity style={styles.smallBtn} onPress={submitCode} disabled={submitting}>
                  <Text style={styles.btnText}>提交</Text>
                </TouchableOpacity>
              </View>
              {resending ? <Text style={[styles.link, { color: '#ccc' }]}>重新发送中...</Text> :
                <TouchableOpacity onPress={resendCode}><Text style={styles.link}>未收到？重新发送</Text></TouchableOpacity>}
            </View>
          )}
        </View>
      ) : (
        /* Post-login */
        <View>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>📅 选择周次（多选）</Text>
              <TouchableOpacity onPress={toggleAllWeeks}>
                <Text style={styles.toggleAll}>{weekAllChecked ? '全不选' : '全选'}</Text>
              </TouchableOpacity>
            </View>
            {weekList.map(w => (
              <TouchableOpacity key={w.val} style={[styles.weekCheckRow, w.checked && styles.weekCheckRowActive]} onPress={() => toggleWeek(w.val)}>
                <Text style={styles.checkLabel}>{w.checked ? '☑' : '☐'} 第{w.val}周</Text>
                <Text style={styles.hintText}>{w.hint}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {type !== 'fill-missing' && (
            <View style={styles.card}>
              <View style={styles.headerRow}>
                <Text style={styles.cardTitle}>👥 学生列表</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {students.length > 0 && <Text style={styles.countText}>已选 {selectedCount}/{students.length}</Text>}
                  {students.length > 0 && (
                    <TouchableOpacity onPress={toggleAllStudents}>
                      <Text style={styles.toggleAll}>{studentAllChecked ? '全不选' : '全选'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              {loadingStudents ? (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <ActivityIndicator size="small" color="#1B62A5" />
                  <Text style={[styles.emptyText, { marginTop: 8 }]}>加载学生列表...</Text>
                </View>
              ) : students.length === 0 ? (
                <TouchableOpacity style={styles.loadBtn} onPress={loadStudents}>
                  <Text style={styles.loadBtnText}>加载学生列表</Text>
                </TouchableOpacity>
              ) : (
                <ScrollView style={styles.studentScroll} nestedScrollEnabled={true}>
                  {students.map(s => (
                    <TouchableOpacity key={s.index} style={styles.studentRow} onPress={() => toggleStudent(s.index)}>
                      <Text style={styles.checkLabel}>{s._checked ? '☑' : '☐'}</Text>
                      <Text style={styles.studentName}>{s.name}</Text>
                      {s._hasRecord ? <Text style={styles.recordedTag}>已录入</Text> : null}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {type === 'fill-missing' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🔍 自动扫描补录</Text>
              <Text style={styles.descText}>扫描第1周～当前周所有奇数周</Text>
              <Text style={styles.descText}>对标记"差x次"学生强制补录陪伴上课</Text>
              <Text style={styles.descText}>跳过已有记录，只补缺失次数</Text>
            </View>
          )}

          {type === 'companion' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📝 陪伴类型</Text>
              <View style={styles.tagRow}>
                {['共同上课', '共同进餐', '共上自习', '共同运动'].map(t => (
                  <TouchableOpacity key={t} style={[styles.tag, pbType === t && styles.tagActive]} onPress={() => { setPbType(t); setContentText(t === '共同上课' ? '查课' : '') }}>
                    <Text style={[styles.tagText, pbType === t && styles.tagTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.cardTitle}>✏️ 工作内容</Text>
              <TextInput style={styles.textInput} value={contentText} onChangeText={setContentText} placeholder="请输入工作内容" />
            </View>
          )}

          {type === 'talk' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏠 谈话场景</Text>
              <View style={styles.tagRow}>
                {['走访寝室', '走访课堂'].map(s => (
                  <TouchableOpacity key={s} style={[styles.tag, scene === s && styles.tagActive]} onPress={() => { setScene(s); setContentText(s === '走访寝室' ? '查寝' : '查课') }}>
                    <Text style={[styles.tagText, scene === s && styles.tagTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.cardTitle}>✏️ 工作内容</Text>
              <TextInput style={styles.textInput} value={contentText} onChangeText={setContentText} placeholder="请输入工作内容" />
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
  loginHint: { fontSize: 13, color: '#666', marginBottom: 10, textAlign: 'center' },
  btn: { backgroundColor: '#1B62A5', borderRadius: 10, height: 48, justifyContent: 'center', alignItems: 'center' },
  btnQr: { backgroundColor: '#4A90D9' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  smallBtn: { backgroundColor: '#1B62A5', borderRadius: 8, width: 80, height: 44, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', gap: 8, width: '100%' },
  input: { flex: 1, height: 44, backgroundColor: '#F5F7FA', borderRadius: 8, paddingHorizontal: 12, fontSize: 18, letterSpacing: 6 },
  captcha: { width: 200, height: 60, alignSelf: 'center', marginVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  qrCode: { width: 260, height: 260, alignSelf: 'center', marginVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  saveHint: { fontSize: 11, color: '#ccc', marginBottom: 4 },
  screenshot: { width: '100%', height: 250, alignSelf: 'center', marginVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  link: { color: '#1B62A5', fontSize: 13, textAlign: 'center', marginTop: 8, textDecorationLine: 'underline' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  toggleAll: { fontSize: 13, color: '#1B62A5', paddingHorizontal: 4 },
  weekCheckRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#FAFAFA', marginBottom: 4 },
  weekCheckRowActive: { backgroundColor: '#EBF3FC' },
  countText: { fontSize: 12, color: '#999' },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center', paddingVertical: 20 },
  loadBtn: { backgroundColor: '#F5F7FA', borderRadius: 12, height: 44, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  loadBtnText: { color: '#1B62A5', fontSize: 14 },
  studentScroll: { maxHeight: 300 },
  studentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  studentName: { flex: 1, fontSize: 15, marginLeft: 10 },
  recordedTag: { fontSize: 11, color: '#ccc' },
  descText: { fontSize: 13, color: '#999', marginBottom: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tag: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F5F5F5' },
  tagActive: { backgroundColor: '#E8A838' },
  tagText: { fontSize: 14, color: '#666' },
  tagTextActive: { color: '#fff' },
  textInput: { height: 44, backgroundColor: '#F5F7FA', borderRadius: 8, paddingHorizontal: 12, fontSize: 15 },
  checkLabel: { fontSize: 15, color: '#333' },
  hintText: { fontSize: 12, color: '#999' },
  startBtn: { backgroundColor: '#52C41A', borderRadius: 24, height: 52, justifyContent: 'center', alignItems: 'center', marginTop: 8, marginBottom: 40 },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
})
