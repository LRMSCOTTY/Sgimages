import express from 'express'
import { analyzeScene } from '../services/director.js'

const router = express.Router()

// POST /api/storyboard/generate
router.post('/generate', async (req, res) => {
  const { sceneDescription, numPanels = 4 } = req.body
  if (!sceneDescription) return res.status(400).json({ error: 'sceneDescription required' })

  try {
    const shotPlan = await analyzeScene(sceneDescription)
    const panels = shotPlan.slice(0, numPanels).map((shot, i) => ({
      id: `panel_${Date.now()}_${i}`,
      index: i,
      shotType: shot.shot,
      prompt: shot.prompt,
      cameraRig: shot.cameraRig,
      duration: shot.duration,
      model: shot.model,
      notes: shot.notes,
      imageUrl: null,
      videoUrl: null,
      status: 'draft'
    }))
    res.json({ panels })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
