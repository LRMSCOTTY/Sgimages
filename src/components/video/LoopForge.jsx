import { useState } from 'react'
import { generateMockVideo } from '../../lib/mockVideoAI.js'

export default function LoopForge({ clip, onUpdate }) {
  const [crossfade, setCrossfade] = useState(10)
  const [busy, setBusy] = useState(false)
  const [loopUrl, setLoopUrl] = useState(clip?.result?.videoUrl || null)

  const hasVideo = !!(clip?.result?.videoUrl)

  const createLoop = async () => {
    if (!hasVideo) return
    setBusy(true)
    try {
      // In mock mode: generate a slightly modified version representing the loop
      const url = await generateMockVideo({
        prompt: `${clip.prompt} [SEAMLESS LOOP]`,
        duration: clip.duration,
        aspectRatio: clip.aspectRatio,
        model: 'loop-forge'
      })
      setLoopUrl(url)
      onUpdate({ ...clip.result, videoUrl: url, isLoop: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel-inner">
      <div className="panel-head">
        <h2>Loop Forge <span className="badge">UNIQUE</span></h2>
        <p>Create a seamless infinite loop from your generated clip — perfect for backgrounds and ambient video.</p>
      </div>

      {!hasVideo && (
        <div className="loop-no-video">
          <span>⚠️ Generate a clip first, then come back to forge a loop.</span>
        </div>
      )}

      {hasVideo && (
        <>
          <label className="field-label">Crossfade Duration: {crossfade}%</label>
          <input
            type="range" min={5} max={30} value={crossfade}
            onChange={e => setCrossfade(+e.target.value)}
            disabled={busy}
          />
          <p className="hint-text">
            Higher values = smoother loop but more content overlap.
            {crossfade >= 20 ? ' Best for ambient/background video.' : ' Best for action/narrative.'}
          </p>

          <div className="loop-algo-cards">
            <div className="loop-algo active">
              <div className="loop-algo-name">FFmpeg Crossfade</div>
              <div className="loop-algo-desc">Fast, blends end→start frames. Great for most content.</div>
            </div>
            <div className="loop-algo">
              <div className="loop-algo-name">AI Bridge</div>
              <div className="loop-algo-desc">Generates a connecting clip. Higher quality, takes longer.</div>
              <span className="badge">Coming Soon</span>
            </div>
          </div>

          <button className="primary-btn full" onClick={createLoop} disabled={busy}>
            {busy ? '🔄 Forging loop...' : '🔁 Create Seamless Loop'}
          </button>

          {loopUrl && (
            <div className="loop-result">
              <span className="field-label">Loop Preview</span>
              <video src={loopUrl} className="loop-preview-video" loop autoPlay muted playsInline />
              <p className="hint-text">This video loops seamlessly — no visible seam at the join point.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
