import { useState } from 'react'
import { generateStoryboard } from '../../lib/videoAPI.js'
import { useVideoStore } from '../../store/videoStore.js'
import { CAMERA_RIGS } from './CameraRigSelector.jsx'
import { runJob } from '../../lib/videoAPI.js'

export default function StoryboardView({ onClose }) {
  const { addClip, updateClip } = useVideoStore()
  const [scene, setScene] = useState('')
  const [panels, setPanels] = useState([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [allProgress, setAllProgress] = useState({})

  const generate = async () => {
    if (!scene.trim()) return
    setGenerating(true)
    setError(null)
    try {
      const newPanels = await generateStoryboard(scene, 5)
      setPanels(newPanels)
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const updatePanel = (id, updates) => {
    setPanels(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  const generateAllClips = async () => {
    setGeneratingAll(true)
    const clipIds = panels.map(panel => {
      const rig = CAMERA_RIGS.find(r => r.id === panel.cameraRig) || null
      return { panel, clipId: addClip({ prompt: panel.prompt, mode: 'text-to-video', model: panel.model || 'runway-gen3-turbo', duration: panel.duration, cameraRig: rig, status: 'queued' }) }
    })

    await Promise.all(clipIds.map(async ({ panel, clipId }) => {
      updateClip(clipId, { status: 'processing' })
      try {
        const result = await runJob(
          { model: 'runway-gen3-turbo', mode: 'text-to-video', prompt: panel.prompt, duration: panel.duration, aspectRatio: '16:9' },
          (pct) => { updateClip(clipId, { _progress: pct }); setAllProgress(p => ({ ...p, [clipId]: pct })) }
        )
        updateClip(clipId, { status: 'completed', result, _progress: 100 })
        updatePanel(panel.id, { videoUrl: result.videoUrl, status: 'completed' })
      } catch (e) {
        updateClip(clipId, { status: 'failed', _error: e.message })
        updatePanel(panel.id, { status: 'failed' })
      }
    }))

    setGeneratingAll(false)
  }

  return (
    <div className="storyboard-view">
      <div className="storyboard-header">
        <div>
          <h2>Storyboard-to-Video <span className="badge">UNIQUE</span></h2>
          <p>Describe a scene → AI generates storyboard → click to generate all clips at once.</p>
        </div>
        <button className="ghost-btn" onClick={onClose}>✕</button>
      </div>

      {panels.length === 0 ? (
        <div className="sb-generator">
          <textarea
            className="prompt-input"
            rows={4}
            placeholder="Describe your complete scene or video story..."
            value={scene}
            onChange={e => setScene(e.target.value)}
            disabled={generating}
          />
          <button className="primary-btn full" onClick={generate} disabled={generating || !scene.trim()}>
            {generating ? '📽 Analyzing scene...' : '🎞 Generate Storyboard'}
          </button>
          {error && <div className="stage-error">{error}</div>}
        </div>
      ) : (
        <>
          <div className="sb-controls">
            <span>{panels.length} shots planned</span>
            <button className="ghost-btn" onClick={() => { setPanels([]); setScene('') }}>← New Scene</button>
            <button className="primary-btn" onClick={generateAllClips} disabled={generatingAll}>
              {generatingAll ? '⚙️ Generating All...' : '🚀 Generate All Clips'}
            </button>
          </div>

          <div className="sb-panels">
            {panels.map((panel, i) => (
              <div key={panel.id} className={`sb-panel ${panel.status}`}>
                <div className="sb-panel-num">
                  {panel.videoUrl
                    ? <video src={panel.videoUrl} className="sb-thumb" loop autoPlay muted />
                    : <div className="sb-thumb-placeholder">{i + 1}</div>
                  }
                </div>
                <div className="sb-panel-meta">
                  <div className="sb-shot-type">{panel.shotType}</div>
                  <textarea
                    className="prompt-input"
                    rows={2}
                    value={panel.prompt}
                    onChange={e => updatePanel(panel.id, { prompt: e.target.value })}
                    style={{ fontSize: 11.5 }}
                  />
                  <div className="sb-panel-footer">
                    <span className="chip">{panel.cameraRig || 'auto'}</span>
                    <span className="chip">{panel.duration}s</span>
                    <span className="chip">{panel.model?.split('-')[0]}</span>
                    {allProgress[panel.id] > 0 && allProgress[panel.id] < 100 && (
                      <span className="badge">{allProgress[panel.id]}%</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
