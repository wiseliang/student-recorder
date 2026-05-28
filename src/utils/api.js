import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = 'https://wiseliang.cloud'

async function request(method, path, data) {
  const openid = await AsyncStorage.getItem('openid')
  const headers = { 'Content-Type': 'application/json' }
  if (openid) headers['x-openid'] = openid

  const resp = await fetch(BASE_URL + path, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  })

  const json = await resp.json()
  if (!resp.ok) throw new Error(json.error || `HTTP ${resp.status}`)
  return json
}

export const get = (path, params) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return request('GET', path + qs)
}
export const post = (path, data) => request('POST', path, data)
