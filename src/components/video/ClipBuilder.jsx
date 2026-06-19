import { useState, useCallback, useRef } from 'react'
import { useVideoStore, MODELS, DURATIONS, ASPECT_RATIOS } from '../../store/videoStore.js'
import { runJob, uploadSourceImage, uploadSourceVideo } from '../../lib/videoAPI.js'
import CameraRigSelector from './CameraRigSelector.jsx'
import PromptKeyframes from './PromptKeyframes.jsx'
import UploadButton from '../UploadButton.jsx'

const MODES = [
  { id: 'text-to-video', label: 'Text → Video', icon: '✍️' },
  { id: 'image-to-video', label: 'Image → Video', icon: '🖼' },
  { id: 'keyframe', label: 'Keyframe', icon: '⟷' },
  { id: 'video-to-video', label: 'Vid→Vid', icon: '🔄' },
  { id: 'multi-angle', label: 'Multi-Angle', icon: '⟳' }
]

export default function ClipBuilder({ onBattle }) {
  const { getActiveClip, updateClip, referenceImages } = useVideoStore()
  const clip = getActiveClip()
  const [busy, setBusy] = useState(false)
  const [styleStrength, setStyleStrength] = useState(70)
  const videoInputRef = useRef(null)

  const update = useCallback((key, val) => {
    if (!clip) return
    updateClip(clip.id, { [key]: val })
  }, [clip, updateClip])

  const generate = async () => {
    if (!clip || busy) return
    setBusy(true)
    updateClip(clip.id, { status: 'queued', _progress: 0, _error: null })
    try {
      let sourceImageUrl = null
      let sourceImageEndUrl = null

      if (clip.sourceImageDataURL && clip.mode !== 'text-to-video') {
        sourceImageUrl = await uploadSourceImage(clip.sourceImageDataURL)
      }
      if (clip.sourceImageEndDataURL && clip.mode === 'keyframe') {
        sourceImageEndUrl = await uploadSourceImage(clip.sourceImageEndDataURL)
      }

      const clipRefs = (clip.referenceIds || [])
        .map(id => referenceImages.find(r => r.id === id))
        .filter(Boolean)
        .map(r => ({ tag: r.tag, label: r.label, url: r.uploadedUrl || null }))

      const result = await runJob({
        model: clip.model,
        mode: clip.mode,
        prompt: clip.prompt + (clip.mode === 'video-to-video' ? ` Style strength: ${styleStrength}%` : ''),
        negativePrompt: clip.negativePrompt,
        sourceImageUrl,
        sourceImageEndUrl,
        duration: clip.duration,
        aspectRatio: clip.aspectRatio,
        cameraRig: clip.cameraRig,
        motionPath: clip.motionPath,
        motionBrushRegions: clip.motionBrushRegions,
        promptKeyframes: clip.promptKeyframes,
        loopMode: clip.loopMode,
        effects: clip.effects,
        referenceImages: clipRefs,
        soundDesign: clip.soundDesign
      }, (pct) => updateClip(clip.id, { status: 'processing', _progress: pct }))
      updateClip(clip.id, { status: 'completed', result, _progress: 100 })
    } catch (e) {
      updateClip(clip.id, { status: 'failed', _error: e.message })
    } finally {
      setBusy(false)
    }
  }

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const url = await uploadSourceVideo(file)
      update('sourceImageUrl', url)
      update('_sourceVideoName', file.name)
    } catch (err) {
      console.error('Video upload failed:', err)
    }
    e.target.value = ''
  }

  if (!clip) {
    return (
      <div className="panel-inner">
        <div className="panel-head">
          <h2>Clip Builder</h2>
          <p>Select a clip from the timeline or add a new one to configure it here.</p>
        </div>
        <button className="primary-btn full" onClick={() => useVideoStore.getState().addClip()}>
          + New Clip
        </button>
      </div>
    )
  }

  const isGenerating = clip.status === 'processing' || clip.status === 'queued'
  const availableModels = MODELS.filter(m => m.modes.includes(clip.mode))

  return (
    <div className="panel-inner">
      <div className="panel-head">
        <h2>Clip Builder</h2>
        <p>Configure clip #{useVideoStore.getState().clips.findIndex(c => c.id === clip.id) + 1}</p>
      </div>

      {/* Mode */}
      <label className="field-label">Mode</label>
      <div className="mode-selector">
        {MODES.map(m => (
          <button
            key={m.id}
            className={`mode-btn ${clip.mode === m.id ? 'active' : ''}`}
            onClick={() => update('mode', m.id)}
            disabled={isGenerating}
          >
            <span>{m.icon}</span> {m.label}
          </button>
        ))}
      </div>

      {/* Keyframe mode: start + end image */}
      {clip.mode === 'keyframe' && (
        <>
          <label className="field-label">Keyframe Images</label>
          <div className="keyframe-pair">
            <div className="keyframe-slot">
              <div className="keyframe-label">Start Frame</div>
              {clip.sourceImageDataURL
                ? <img src={clip.sourceImageDataURL} alt="Start" className="source-thumb" />
                : <div className="source-img-empty">No image</div>}
              <UploadButton onImage={dataURL => update('sourceImageDataURL', dataURL)} label="Upload" disabled={isGenerating} />
            </div>
            <div className="keyframe-arrow">→</div>
            <div className="keyframe-slot">
              <div className="keyframe-label">End Frame</div>
              {clip.sourceImageEndDataURL
                ? <img src={clip.sourceImageEndDataURL} alt="End" className="source-thumb" />
                : <div className="source-img-empty">No image</div>}
              <UploadButton onImage={dataURL => update('sourceImageEndDataURL', dataURL)} label="Upload" disabled={isGenerating} />
            </div>
          </div>
          <p className="hint-text">Luma will interpolate between these two images.</p>
        </>
      )}

      {/* Image source for image-to-video */}
      {(clip.mode === 'image-to-video' || clip.mode === 'multi-angle') && (
        <>
          <label className="field-label">Source Image</label>
          <div className="source-img-area">
            {clip.sourceImageDataURL
              ? <img src={clip.sourceImageDataURL} alt="Source" className="source-thumb" />
              : <div className="source-img-empty">No source image</div>}
            <UploadButton
              onImage={dataURL => update('sourceImageDataURL', dataURL)}
              label={clip.sourceImageDataURL ? '↺ Replace' : '+ Upload Image'}
              disabled={isGenerating}
            />
          </div>
        </>
      )}

      {/* Video source for video-to-video */}
      {clip.mode === 'video-to-video' && (
        <>
          <label className="field-label">Source Video</label>
          <div className="source-img-area">
            {clip._sourceVideoName
              ? <div className="source-img-empty" style={{ color: 'var(--accent)' }}>📹 {clip._sourceVideoName}</div>
              : <div className="source-img-empty">No source video</div>}
            <button className="ghost-btn" onClick={() => videoInputRef.current?.click()} disabled={isGenerating}>
              + Upload Video
            </button>
            <input ref={videoInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoUpload} />
          </div>
          <label className="field-label">Style Strength: {styleStrength}%</label>
          <input type="range" min={0} max={100} value={styleStrength}
            onChange={e => setStyleStrength(+e.target.value)} disabled={isGenerating} />
          <p className="hint-text">Higher = more transformation, lower = preserve original motion.</p>
        </>
      )}

      {/* Prompt */}
      <label className="field-label">Prompt</label>
      <textarea
        className="prompt-input"
        rows={3}
        placeholder="Describe the video you want to generate..."
        value={clip.prompt}
        onChange={e => update('prompt', e.target.value)}
        disabled={isGenerating}
      />

      {/* Prompt Keyframes */}
      <PromptKeyframes
        keyframes={clip.promptKeyframes || []}
        onChange={kf => update('promptKeyframes', kf)}
        duration={clip.duration}
      />

      {/* Duration */}
      <label className="field-label">Duration</label>
      <div className="duration-grid">
        {DURATIONS.map(d => (
          <button
            key={d}
            className={`dur-btn ${clip.duration === d ? 'active' : ''}`}
            onClick={() => update('duration', d)}
            disabled={isGenerating}
          >{d}s</button>
        ))}
      </div>

      {/* Aspect Ratio */}
      <label className="field-label">Aspect Ratio</label>
      <div className="chips">
        {ASPECT_RATIOS.map(ar => (
          <button
            key={ar}
            className={`chip ${clip.aspectRatio === ar ? 'active' : ''}`}
            onClick={() => update('aspectRatio', ar)}
            disabled={isGenerating}
          >{ar}</button>
        ))}
      </div>

      {/* Model */}
      <label className="field-label">Model</label>
      <div className="model-grid">
        {availableModels.map(m => (
          <button
            key={m.id}
            className={`model-btn ${clip.model === m.id ? 'active' : ''}`}
            onClick={() => update('model', m.id)}
            disabled={isGenerating}
          >
            <div className="model-name">{m.name}</div>
            <div className="model-meta">
              <span className="badge">{m.badge}</span>
              <span className="model-qual">{'★'.repeat(m.quality)}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Camera Rig */}
      <label className="field-label">Camera Rig</label>
      <CameraRigSelector value={clip.cameraRig} onChange={rig => update('cameraRig', rig)} compact />

      {/* Loop toggle */}
      <div className="advanced-toggles">
        <button
          className={`ghost-btn ${clip.loopMode ? 'active' : ''}`}
          onClick={() => update('loopMode', !clip.loopMode)}
          disabled={isGenerating}
        >
          {clip.loopMode ? '🔁 Loop: ON' : '🔁 Loop: OFF'}
        </button>
      </div>

      {/* Negative prompt */}
      <label className="field-label">Negative Prompt</label>
      <input
        type="text"
        className="prompt-input"
        style={{ minHeight: 'auto', padding: '8px 12px' }}
        placeholder="What to avoid: blur, distortion, watermark..."
        value={clip.negativePrompt || ''}
        onChange={e => update('negativePrompt', e.target.value)}
        disabled={isGenerating}
      />

      {/* Active effects summary */}
      {clip.effects?.length > 0 && (
        <div className="active-effects-row">
          {clip.effects.map(fx => (
            <span key={fx} className="effect-tag">{fx}</span>
          ))}
        </div>
      )}

      {/* Active sound summary */}
      {clip.soundDesign?.mood && clip.soundDesign.mood !== 'silence' && (
        <div className="sound-badge">🔊 {clip.soundDesign.mood.replace(/-/g, ' ')}</div>
      )}

      {/* Actions */}
      <div className="clip-actions">
        <button
          className="secondary-btn"
          onClick={() => onBattle(clip)}
          disabled={isGenerating || !clip.prompt}
          title="Compare 3 models side by side"
        >⚔️ Battle</button>
        <button
          className="primary-btn"
          style={{ flex: 2 }}
          onClick={generate}
          disabled={isGenerating || !clip.prompt}
        >
          {isGenerating
            ? `${clip._progress || 0}% — ${clip.model?.split('-')[0]}...`
            : '🎬 Generate Clip'}
        </button>
      </div>

      {clip._error && <div className="stage-error">{clip._error}</div>}
    </div>
  )
}
