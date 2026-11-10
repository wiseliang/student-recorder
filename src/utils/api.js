import AsyncStorage from '@react-native-async-storage/async-storage'

// Fixed HTTPS reverse proxy on the local deployment server.
export const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://wiseliang.cloud/student-recorder'
// 原直连: 'https://118.190.208.230'

const REQUEST_TIMEOUT_MS = 15000
const LOGIN_TIMEOUT_MS = 45000  // Login flows need more time (browser nav + SSO)

async function request(method, path, data) {
  const openid = await AsyncStorage.getItem('openid')
  const headers = { 'Content-Type': 'application/json' }
  const server = await AsyncStorage.getItem('authServer')
  const token = await AsyncStorage.getItem('authToken')
  if (server === BASE_URL) {
    if (openid) headers['x-openid'] = openid
    if (token) headers.Authorization = 'Bearer ' + token
  }

  // Login/auth endpoints need longer timeout for browser navigation
  const isAuthEndpoint = path.includes('/api/auth/')
  const timeoutMs = isAuthEndpoint ? LOGIN_TIMEOUT_MS : REQUEST_TIMEOUT_MS

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const resp = await fetch(BASE_URL + path, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      signal: controller.signal,
    })

    const json = await resp.json()
    if (!resp.ok) throw new Error(json.error || `HTTP ${resp.status}`)
    return json
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(`请求超时（${timeoutMs / 1000}秒），请检查网络连接`)
    }
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
}

export const get = (path, params) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return request('GET', path + qs)
}
export const post = (path, data) => request('POST', path, data)
