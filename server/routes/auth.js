import express from 'express'
import bcrypt from 'bcryptjs'
import { createUser, findUserByEmail, getUserProjects, saveProject, deleteProject, getProject, isDbAvailable } from '../db/client.js'
import { signToken, requireAuth } from '../middleware/auth.js'

const router = express.Router()

function dbRequired(req, res, next) {
  if (!isDbAvailable()) {
    return res.status(503).json({ error: 'Database not configured. Set DATABASE_URL to enable user accounts.' })
  }
  next()
}

// POST /api/auth/register
router.post('/register', dbRequired, async (req, res) => {
  try {
    const { email, password, name } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address' })

    const existing = await findUserByEmail(email)
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' })

    const hashed = await bcrypt.hash(password, 12)
    const user = await createUser({ email, password: hashed, name })
    const token = await signToken({ userId: user.id, email: user.email })
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } })
  } catch (e) {
    console.error('Register error:', e)
    res.status(500).json({ error: 'Registration failed. Please try again.' })
  }
})

// POST /api/auth/login
router.post('/login', dbRequired, async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

    const user = await findUserByEmail(email)
    if (!user) return res.status(401).json({ error: 'Invalid email or password' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' })

    const token = await signToken({ userId: user.id, email: user.email })
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } })
  } catch (e) {
    console.error('Login error:', e)
    res.status(500).json({ error: 'Login failed. Please try again.' })
  }
})

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const { id, email, name, plan, is_admin } = req.user
  res.json({ id, email, name, plan, is_admin })
})

// POST /api/auth/logout (client-side, just for completeness)
router.post('/logout', (req, res) => {
  res.json({ ok: true })
})

// ── Projects CRUD ──────────────────────────────────────────

// GET /api/auth/projects
router.get('/projects', requireAuth, async (req, res) => {
  if (!isDbAvailable()) return res.json([])
  try {
    const projects = await getUserProjects(req.user.id)
    res.json(projects)
  } catch (e) {
    res.status(500).json({ error: 'Failed to load projects' })
  }
})

// POST /api/auth/projects — save or update project
router.post('/projects', requireAuth, async (req, res) => {
  if (!isDbAvailable()) return res.json({ ok: true })
  try {
    const { id, name, data } = req.body
    const project = await saveProject({ id, userId: req.user.id, name: name || 'Untitled', data })
    res.json(project)
  } catch (e) {
    res.status(500).json({ error: 'Failed to save project' })
  }
})

// GET /api/auth/projects/:id
router.get('/projects/:id', requireAuth, async (req, res) => {
  if (!isDbAvailable()) return res.status(404).json({ error: 'Not found' })
  try {
    const project = await getProject(req.params.id, req.user.id)
    if (!project) return res.status(404).json({ error: 'Project not found' })
    res.json(project)
  } catch (e) {
    res.status(500).json({ error: 'Failed to load project' })
  }
})

// DELETE /api/auth/projects/:id
router.delete('/projects/:id', requireAuth, async (req, res) => {
  if (!isDbAvailable()) return res.json({ ok: true })
  try {
    const ok = await deleteProject(req.params.id, req.user.id)
    if (!ok) return res.status(404).json({ error: 'Project not found' })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete project' })
  }
})

export default router
