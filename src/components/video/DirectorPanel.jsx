import { useState } from 'react'
import { analyzeScene } from '../../lib/videoAPI.js'
import { useVideoStore, MODELS } from '../../store/videoStore.js'
import { CAMERA_RIGS } from './CameraRigSelector.jsx'

const SCENE_EXAMPLES = [
  'A lone astronaut walks on the surface of Mars at sunset',
  'A samurai stands in a bamboo forest as wind moves through the leaves',
  'Product reveal: a luxury watch emerging from dark velvet',
  'High speed chase through neon-lit Tokyo at night',
  'An elderly woman bakes bread in a rustic farmhouse kitchen'
]

export default function DirectorPanel() {
  const { addClip, updateClip, clips } = useVideoStore()
  const [scene, setScene] = useState('')
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState(null)

  const analyze = async () => {
    if (!scene.trim()) return
    setBusy(true)
    setError(null)
    setPlan(null)
    try {
      const shots = await analyzeScene(scene)
      setPlan(shots)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const addShotToTimeline = (shot) => {
    const rig = CAMERA_RIGS.find(r => r.id === shot.cameraRig) || null
    addClip({
      prompt: shot.prompt,
      mode: 'text-to-video',
      model: shot.model || 'runway-gen3-turbo',
      duration: shot.duration || 5,
      cameraRig: rig
    })
  }

  const addAllToTimeline = () => {
    if (!plan) return
    plan.forEach(shot => addShotToTimeline(shot))
    setPlan(null)
  }

  return (
    <div className="panel-inner">
      <div className="panel-head">
        <h2>AI Director <span className="badge">UNIQUE</span></h2>
        <p>Describe your scene. The AI Director will generate a professional shot plan using film grammar.</p>
      </div>

      <label className="field-label">Scene Description</label>
      <textarea
        className="prompt-input"
        rows={4}
        placeholder="Describe your scene: location, subject, mood, action..."
        value={scene}
        onChange={e => setScene(e.target.value)}
        disabled={busy}
      />

      <div className="chips">
        {SCENE_EXAMPLES.slice(0, 3).map(ex => (
          <button key={ex} className="chip" onClick={() => setScene(ex)}>{ex.slice(0, 40)}…</button>
        ))}
      </div>

      <button className="primary-btn full" onClick={analyze} disabled={busy || !scene.trim()}>
        {busy ? '🎬 Directing...' : '🎬 Generate Shot Plan'}
      </button>

      {error && <div className="stage-error">{error}</div>}

      {plan && (
        <div className="shot-plan">
          <div className="shot-plan-header">
            <span>Shot Plan · {plan.length} shots</span>
            <button className="primary-btn" onClick={addAllToTimeline}>Add All →</button>
          </div>
          {plan.map((shot, i) => (
            <div key={i} className="shot-card">
              <div className="shot-card-header">
                <span className="shot-num">#{i + 1}</span>
                <span className="shot-type">{shot.shot}</span>
                <span className="shot-dur">{shot.duration}s</span>
                <span className="shot-model badge">{shot.model?.split('-')[0]}</span>
              </div>
              <p className="shot-prompt">{shot.prompt}</p>
              {shot.notes && <p className="hint-text">📽 {shot.notes}</p>}
              <div className="shot-meta">
                {shot.cameraRig && <span className="chip">{shot.cameraRig}</span>}
              </div>
              <button className="secondary-btn full" onClick={() => addShotToTimeline(shot)}>
                + Add to Timeline
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
