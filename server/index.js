import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import path from 'path'
import videoRoutes from './routes/video.js'
import directorRoutes from './routes/director.js'
import storyboardRoutes from './routes/storyboard.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT || '3001')
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

const app = express()

app.use(cors({ origin: [CORS_ORIGIN, 'http://localhost:5173'], credentials: true }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Serve generated videos as static files
const publicDir = path.join(__dirname, '..', 'public')
app.use('/public', express.static(publicDir))

// API routes
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
    anthropic: !!process.env.ANTHROPIC_API_KEY
  }
  res.json({
    status: 'ok',
    providers,
    mockMode: !Object.values(providers).some(Boolean)
  })
})

// Global error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`\n🎬 AI Video Creator Server running on http://localhost:${PORT}`)
  const configured = []
  if (process.env.RUNWAY_API_KEY) configured.push('Runway')
  if (process.env.REPLICATE_API_TOKEN) configured.push('Replicate')
  if (process.env.LUMA_API_KEY) configured.push('Luma')
  if (process.env.KLING_API_KEY) configured.push('Kling')
  if (process.env.ANTHROPIC_API_KEY) configured.push('Claude Director')
  console.log(configured.length
    ? `   Providers: ${configured.join(', ')}`
    : '   No API keys found — frontend will use mock video mode\n')
})
