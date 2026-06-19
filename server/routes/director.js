import express from 'express'
import { analyzeScene } from '../services/director.js'

const router = express.Router()

// POST /api/director/analyze
router.post('/analyze', async (req, res) => {
  const { sceneDescription, imageDescription } = req.body
  if (!sceneDescription) return res.status(400).json({ error: 'sceneDescription required' })

  try {
    const shotPlan = await analyzeScene(sceneDescription, imageDescription)
    res.json({ shotPlan })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
