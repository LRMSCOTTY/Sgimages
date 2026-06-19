import { useAuthStore } from '../store/authStore.js'

function authHeaders() {
  const token = useAuthStore.getState().getToken()
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }
}

async function req(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`)
  return data
}

export const getAdminStats = () => req('GET', '/api/admin/stats')
export const getAdminUsers = () => req('GET', '/api/admin/users')
export const getAdminConfig = () => req('GET', '/api/admin/config')
export const setAdminConfig = (key, value) => req('PUT', `/api/admin/config/${key}`, { value })
export const deleteAdminConfig = (key) => req('DELETE', `/api/admin/config/${key}`)

export function streamClaude(messages, { onText, onDone, onError }) {
  const token = useAuthStore.getState().getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const ctrl = new AbortController()

  fetch('/api/admin/claude', {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages }),
    signal: ctrl.signal
  }).then(async (res) => {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      onError(data.error || `HTTP ${res.status}`)
      return
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (!raw) continue
        try {
          const parsed = JSON.parse(raw)
          if (parsed.text) onText(parsed.text)
          else if (parsed.done) onDone()
          else if (parsed.error) onError(parsed.error)
        } catch {}
      }
    }
    onDone()
  }).catch((err) => {
    if (err.name !== 'AbortError') onError(err.message)
  })

  return () => ctrl.abort()
}
