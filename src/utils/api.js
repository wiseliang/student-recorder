import AsyncStorage from '@react-native-async-storage/async-storage'

// Cloudflare Tunnel URL（服务器重启后会变，需同步更新）
const BASE_URL = 'https://terrorists-solaris-trail-care.trycloudflare.com'
// 原直连: 'https://118.190.208.230'

const REQUEST_TIMEOUT_MS = 15000
const LOGIN_TIMEOUT_MS = 45000  // Login flows need more time (browser nav + SSO)

async function request(method, path, data) {
  const openid = await AsyncStorage.getItem('openid')
  const headers = { 'Content-Type': 'application/json' }
  if (openid) headers['x-openid'] = openid

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
