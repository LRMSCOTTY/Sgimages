import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { fileURLToPath } from 'url'
import path from 'path'
import videoRoutes from './routes/video.js'
import directorRoutes from './routes/director.js'
import storyboardRoutes from './routes/storyboard.js'
import authRoutes from './routes/auth.js'
import { initDb, isDbAvailable } from './db/client.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT || '3001')
const IS_PROD = process.env.NODE_ENV === 'production'
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

const app = express()

// Security headers (relaxed CSP for video content)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}))

// CORS
app.use(cors({
  origin: IS_PROD ? true : [CORS_ORIGIN, 'http://localhost:5173'],
  credentials: true
}))

// Body parsing
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Rate limiting — protect generation endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
})

const generateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 10,
  message: { error: 'Generation rate limit reached. Wait a moment.' }
})

app.use('/api/', apiLimiter)
app.use('/api/video/generate', generateLimiter)

// Serve generated videos
const publicDir = path.join(__dirname, '..', 'public')
app.use('/public', express.static(publicDir))

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/video', videoRoutes)
app.use('/api/director', directorRoutes)
app.use('/api/storyboard', storyboardRoutes)

// Health check
app.get('/api/health', (req, res) => {
  const providers = {
    runway: !!process.env.RUNWAY_API_KEY,
    replicate: !!process.env.REPLICATE_API_TOKEN,
    luma: !!process.env.LUMA_API_KEY,
    kling: !!(process.env.KLING_API_KEY && process.env.KLING_API_SECRET),
    fal: !!process.env.FAL_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY
  }
  res.json({
    status: 'ok',
    providers,
    dbAvailable: isDbAvailable(),
    mockMode: !Object.values(providers).some(Boolean)
  })
})

// In production, serve the React SPA
if (IS_PROD) {
  const distPath = path.join(__dirname, '..', 'dist')
  app.use(express.static(distPath, { maxAge: '1d' }))
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/public/')) return res.status(404).end()
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// Global error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

// Start server
app.listen(PORT, async () => {
  console.log(`\n🎬 AI Video Creator running on http://localhost:${PORT}`)
  console.log(`   Mode: ${IS_PROD ? 'production' : 'development'}`)

  if (isDbAvailable()) {
    try {
      await initDb()
    } catch (e) {
      console.error('  ⚠️  Database init failed:', e.message)
    }
  } else {
    console.log('   Database: not configured (set DATABASE_URL to enable user accounts)')
  }

  const configured = []
  if (process.env.RUNWAY_API_KEY) configured.push('Runway')
  if (process.env.REPLICATE_API_TOKEN) configured.push('Replicate')
  if (process.env.LUMA_API_KEY) configured.push('Luma')
  if (process.env.KLING_API_KEY) configured.push('Kling')
  if (process.env.FAL_KEY) configured.push('fal.ai')
  if (process.env.ANTHROPIC_API_KEY) configured.push('Claude Director')
  console.log(configured.length
    ? `   AI Providers: ${configured.join(', ')}`
    : '   AI Providers: none — frontend will use mock video mode\n')
})
