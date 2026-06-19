import { useState, useRef, useEffect } from 'react'
import { submitMultiModel, subscribeJobSSE } from '../../lib/videoAPI.js'
import { runMockJob } from '../../lib/mockVideoAI.js'
import { useVideoStore } from '../../store/videoStore.js'

const BATTLE_MODELS = [
  { id: 'runway-gen3-turbo', name: 'Runway Turbo', color: '#7c5cff' },
  { id: 'luma-dream-machine', name: 'Luma Dream', color: '#23d5ab' },
  { id: 'kling-v2', name: 'Kling v2', color: '#ff6b35' }
]

function BattleColumn({ model, params, onWin }) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('pending')
  const [videoUrl, setVideoUrl] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const videoRef = useRef(null)

  useEffect(() => {
    let start = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)

    runMockJob({ ...params, model: model.id }, (pct) => {
      setStatus('generating')
      setProgress(pct)
      if (pct >= 100) {
        setStatus('done')
        clearInterval(timer)
      }
    }).then(result => {
      setVideoUrl(result.videoUrl)
      setStatus('done')
      clearInterval(timer)
    }).catch(err => {
      setStatus('failed')
      clearInterval(timer)
    })

    return () => clearInterval(timer)
  }, [])

  return (
    <div className={`battle-col ${status === 'done' ? 'done' : ''}`}>
      <div className="battle-col-header" style={{ borderBottomColor: model.color }}>
        <span className="battle-model-name" style={{ color: model.color }}>{model.name}</span>
        {status !== 'pending' && status !== 'done' && (
          <span className="battle-timer">{elapsed}s</span>
        )}
        {status === 'done' && <span className="battle-done-badge">✓ Ready</span>}
      </div>

      <div className="battle-preview">
        {status === 'generating' && (
          <div className="battle-generating">
            <div className="spinner" />
            <div className="battle-progress-bar">
              <div className="battle-progress-fill" style={{ width: `${progress}%`, background: model.color }} />
            </div>
            <span>{progress}%</span>
          </div>
        )}
        {status === 'done' && videoUrl && (
          <video ref={videoRef} src={videoUrl} className="battle-video" loop autoPlay muted playsInline />
        )}
        {status === 'failed' && <div className="battle-failed">Generation failed</div>}
      </div>

      {status === 'done' && (
        <button className="primary-btn full battle-pick" onClick={() => onWin(videoUrl, model.id)}>
          👑 Use This
        </button>
      )}
    </div>
  )
}

export default function MultiModelBattle({ clip, onPickWinner, onClose }) {
  const params = {
    prompt: clip?.prompt || '',
    sourceImageDataURL: clip?.sourceImageDataURL,
    duration: clip?.duration || 5,
    aspectRatio: clip?.aspectRatio || '16:9',
    mode: clip?.mode || 'text-to-video'
  }

  if (!clip) return null

  return (
    <div className="battle-arena">
      <div className="battle-header">
        <div>
          <h2>⚔️ Multi-Model Battle <span className="badge">UNIQUE</span></h2>
          <p>All 3 models generating simultaneously. Pick the winner.</p>
        </div>
        <button className="ghost-btn" onClick={onClose}>✕ Close</button>
      </div>

      <div className="battle-prompt">
        <span className="field-label">Prompt</span>
        <span className="battle-prompt-text">{clip.prompt || '(no prompt)'}</span>
      </div>

      <div className="battle-grid">
        {BATTLE_MODELS.map(model => (
          <BattleColumn
            key={model.id}
            model={model}
            params={params}
            onWin={(videoUrl, modelId) => {
              onPickWinner({ videoUrl, model: modelId })
              onClose()
            }}
          />
        ))}
      </div>
    </div>
  )
}
