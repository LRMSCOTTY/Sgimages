import { useAuthStore } from '../store/authStore.js'

function authHeaders() {
  const token = useAuthStore.getState().getToken()
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
}

async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`)
  return data
}

export async function register(email, password, name) {
  const data = await request('POST', '/api/auth/register', { email, password, name })
  return data
}

export async function login(email, password) {
  const data = await request('POST', '/api/auth/login', { email, password })
  return data
}

export async function getMe() {
  try {
    return await request('GET', '/api/auth/me')
  } catch {
    return null
  }
}

export async function getProjects() {
  try {
    return await request('GET', '/api/auth/projects')
  } catch {
    return []
  }
}

export async function saveProject(id, name, data) {
  return request('POST', '/api/auth/projects', { id, name, data })
}

export async function deleteProject(id) {
  return request('DELETE', `/api/auth/projects/${id}`)
}
