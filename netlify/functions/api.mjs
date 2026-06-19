/**
 * Netlify Function: api
 * Handles all /api/* routes EXCEPT /api/video/* and /api/admin/claude
 * (those have their own functions with streaming/background support)
 */

import * as jose from 'jose'
import bcrypt from 'bcryptjs'
import Anthropic from '@anthropic-ai/sdk'
import { v4 as uuidv4 } from 'uuid'
import {
  getDb, isDbAvailable, initDb,
  createUser, findUserByEmail, findUserById,
  getUserProjects, getProject, saveProject, deleteProject,
  getStats, listUsers, getConfig, setConfig, deleteConfig
} from '../../server/db/client.js'

let dbReady = false
async function ensureDb() {
  if (dbReady || !isDbAvailable()) return
  await initDb().catch(() => {})
  dbReady = true
}

// ── JWT helpers ────────────────────────────────────────────
function jwtSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-in-production-please')
}

async function signToken(payload) {
  return jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(jwtSecret())
}

async function verifyToken(token) {
  const { payload } = await jose.jwtVerify(token, jwtSecret())
  return payload
}

function isAdminEmail(email) {
  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail) return email === adminEmail
  return process.env.NODE_ENV !== 'production'
}

async function getAuthUser(req) {
  if (!isDbAvailable()) {
    return { id: 'anonymous', email: 'dev@local', name: 'Developer', plan: 'free', is_admin: true }
  }
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const payload = await verifyToken(auth.slice(7))
    const user = await findUserById(payload.userId)
    if (!user) return null
    return { ...user, is_admin: isAdminEmail(user.email) }
  } catch { return null }
}

// ── Response helpers ───────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  })
}

// ── Director / Storyboard ──────────────────────────────────
function buildDirectorSystemPrompt() {
  return `You are an expert film director and cinematographer. When given a scene description, return a JSON array of shot objects.
Each shot must have: shot (string), prompt (string), cameraRig (string), duration (number, in seconds), model (string), notes (string).
Respond ONLY with valid JSON, no markdown.
Available camera rigs: static, dolly-push-in, dolly-pull-out, steadicam-walk, orbital, tilt-reveal, crane-up, handheld-urgent, drone-establishing, rack-focus.
Available models: runway-gen3-turbo, luma-dream-machine, kling-v2, ltx-video, hunyuanvideo.`
}

async function runDirector(sceneDescription) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: buildDirectorSystemPrompt(),
    messages: [{ role: 'user', content: `Scene: ${sceneDescription}\n\nGenerate a 4-shot plan.` }]
  })
  const text = msg.content[0]?.text || '[]'
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned)
}

// ── Main handler ───────────────────────────────────────────
export default async function handler(req) {
  const url = new URL(req.url)
  const path = url.pathname
  const method = req.method

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  await ensureDb()

  try {
    // ── Health ────────────────────────────────────────────
    if (path === '/api/health' && method === 'GET') {
      const providers = {
        runway: !!process.env.RUNWAY_API_KEY,
        replicate: !!process.env.REPLICATE_API_TOKEN,
        luma: !!process.env.LUMA_API_KEY,
        kling: !!(process.env.KLING_ACCESS_KEY && process.env.KLING_SECRET_KEY),
        anthropic: !!process.env.ANTHROPIC_API_KEY
      }
      return json({
        status: 'ok',
        providers,
        dbAvailable: isDbAvailable(),
        mockMode: !Object.values(providers).some(Boolean)
      })
    }

    // ── Auth: register ────────────────────────────────────
    if (path === '/api/auth/register' && method === 'POST') {
      if (!isDbAvailable()) return json({ error: 'Database not configured. Set DATABASE_URL.' }, 503)
      const { email, password, name } = await req.json()
      if (!email || !password) return json({ error: 'Email and password required' }, 400)
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Invalid email address' }, 400)
      const existing = await findUserByEmail(email)
      if (existing) return json({ error: 'An account with this email already exists' }, 409)
      const hashed = await bcrypt.hash(password, 12)
      const user = await createUser({ email, password: hashed, name })
      const token = await signToken({ userId: user.id, email: user.email })
      return json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } }, 201)
    }

    // ── Auth: login ───────────────────────────────────────
    if (path === '/api/auth/login' && method === 'POST') {
      if (!isDbAvailable()) return json({ error: 'Database not configured. Set DATABASE_URL.' }, 503)
      const { email, password } = await req.json()
      if (!email || !password) return json({ error: 'Email and password required' }, 400)
      const user = await findUserByEmail(email)
      if (!user) return json({ error: 'Invalid email or password' }, 401)
      const valid = await bcrypt.compare(password, user.password)
      if (!valid) return json({ error: 'Invalid email or password' }, 401)
      const token = await signToken({ userId: user.id, email: user.email })
      return json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } })
    }

    // ── Auth: me ──────────────────────────────────────────
    if (path === '/api/auth/me' && method === 'GET') {
      const user = await getAuthUser(req)
      if (!user) return json({ error: 'Authentication required' }, 401)
      return json({ id: user.id, email: user.email, name: user.name, plan: user.plan, is_admin: user.is_admin })
    }

    // ── Auth: logout ──────────────────────────────────────
    if (path === '/api/auth/logout' && method === 'POST') {
      return json({ ok: true })
    }

    // ── Projects ──────────────────────────────────────────
    if (path === '/api/auth/projects') {
      const user = await getAuthUser(req)
      if (!user) return json({ error: 'Authentication required' }, 401)
      if (method === 'GET') {
        if (!isDbAvailable()) return json([])
        return json(await getUserProjects(user.id))
      }
      if (method === 'POST') {
        if (!isDbAvailable()) return json({ ok: true })
        const { id, name, data } = await req.json()
        return json(await saveProject({ id, userId: user.id, name: name || 'Untitled', data }))
      }
    }

    const projectMatch = path.match(/^\/api\/auth\/projects\/([^/]+)$/)
    if (projectMatch) {
      const user = await getAuthUser(req)
      if (!user) return json({ error: 'Authentication required' }, 401)
      const projectId = projectMatch[1]
      if (method === 'GET') {
        if (!isDbAvailable()) return json({ error: 'Not found' }, 404)
        const project = await getProject(projectId, user.id)
        if (!project) return json({ error: 'Project not found' }, 404)
        return json(project)
      }
      if (method === 'DELETE') {
        if (!isDbAvailable()) return json({ ok: true })
        const ok = await deleteProject(projectId, user.id)
        if (!ok) return json({ error: 'Project not found' }, 404)
        return json({ ok: true })
      }
    }

    // ── Admin ─────────────────────────────────────────────
    if (path.startsWith('/api/admin')) {
      const user = await getAuthUser(req)
      if (!user) return json({ error: 'Authentication required' }, 401)
      if (!user.is_admin) return json({ error: 'Admin access required' }, 403)

      if (path === '/api/admin/stats' && method === 'GET') {
        const stats = isDbAvailable() ? await getStats() : { users: 0, projects: 0, recentUsers: [] }
        return json({
          ...stats,
          providers: {
            runway: !!process.env.RUNWAY_API_KEY,
            replicate: !!process.env.REPLICATE_API_TOKEN,
            luma: !!process.env.LUMA_API_KEY,
            kling: !!(process.env.KLING_ACCESS_KEY && process.env.KLING_SECRET_KEY),
            anthropic: !!process.env.ANTHROPIC_API_KEY
          },
          dbAvailable: isDbAvailable(),
          env: process.env.NODE_ENV || 'production'
        })
      }

      if (path === '/api/admin/users' && method === 'GET') {
        if (!isDbAvailable()) return json([])
        return json(await listUsers(200))
      }

      if (path === '/api/admin/config' && method === 'GET') {
        return json(isDbAvailable() ? await getConfig() : {})
      }

      const configMatch = path.match(/^\/api\/admin\/config\/(.+)$/)
      if (configMatch) {
        const key = configMatch[1]
        if (method === 'PUT') {
          const { value } = await req.json()
          if (value === undefined) return json({ error: 'value required' }, 400)
          if (isDbAvailable()) await setConfig(key, value)
          return json({ ok: true, key, value })
        }
        if (method === 'DELETE') {
          if (isDbAvailable()) await deleteConfig(key)
          return json({ ok: true })
        }
      }

      // /api/admin/claude is handled by the separate claude function
      if (path === '/api/admin/claude') {
        return json({ error: 'Use the streaming endpoint' }, 307)
      }
    }

    // ── Director ──────────────────────────────────────────
    if (path === '/api/director/analyze' && method === 'POST') {
      const { sceneDescription } = await req.json()
      if (!sceneDescription) return json({ error: 'sceneDescription required' }, 400)
      try {
        const shotPlan = await runDirector(sceneDescription)
        return json({ shotPlan })
      } catch (e) {
        return json({ error: e.message }, 503)
      }
    }

    // ── Storyboard ────────────────────────────────────────
    if (path === '/api/storyboard/generate' && method === 'POST') {
      const { sceneDescription, numPanels = 4 } = await req.json()
      if (!sceneDescription) return json({ error: 'sceneDescription required' }, 400)
      try {
        const shots = await runDirector(sceneDescription)
        const panels = shots.slice(0, numPanels).map((s, i) => ({
          id: `panel_${Date.now()}_${i}`,
          index: i,
          shotType: s.shot,
          prompt: s.prompt,
          cameraRig: s.cameraRig,
          duration: s.duration,
          model: s.model,
          notes: s.notes,
          imageUrl: null,
          videoUrl: null,
          status: 'draft'
        }))
        return json({ panels })
      } catch (e) {
        return json({ error: e.message }, 503)
      }
    }

    return json({ error: 'Not found' }, 404)
  } catch (e) {
    console.error('[api]', e)
    return json({ error: e.message || 'Internal server error' }, 500)
  }
}

export const config = { path: '/api/*' }
