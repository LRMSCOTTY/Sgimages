import { useEffect, useState } from 'react'
import UploadButton from './UploadButton.jsx'
import {
  defaultAdjustments,
  adjustmentsToFilter,
  applyAdjustments,
  rotate,
  flip
} from '../lib/imageUtils.js'

const SLIDERS = [
  { key: 'brightness', label: 'Brightness', min: 0, max: 200, suffix: '%' },
  { key: 'contrast', label: 'Contrast', min: 0, max: 200, suffix: '%' },
  { key: 'saturate', label: 'Saturation', min: 0, max: 200, suffix: '%' },
  { key: 'hue', label: 'Hue', min: 0, max: 360, suffix: '°' },
  { key: 'grayscale', label: 'Grayscale', min: 0, max: 100, suffix: '%' },
  { key: 'sepia', label: 'Sepia', min: 0, max: 100, suffix: '%' },
  { key: 'blur', label: 'Blur', min: 0, max: 20, suffix: 'px' },
  { key: 'invert', label: 'Invert', min: 0, max: 100, suffix: '%' }
]

export default function AdjustPanel({ image, runTask, busy, setImage }) {
  const [adj, setAdj] = useState(defaultAdjustments)

  // Reset sliders whenever the underlying image changes.
  useEffect(() => {
    setAdj(defaultAdjustments)
  }, [image])

  function update(key, value) {
    setAdj((a) => ({ ...a, [key]: Number(value) }))
  }

  function bake() {
    if (!image) return
    runTask('Applying adjustments…', () => applyAdjustments(image, adj))
    setAdj(defaultAdjustments)
  }

  const livePreview = adjustmentsToFilter(adj)

  if (!image) {
    return (
      <div className="panel-inner">
        <header className="panel-head">
          <h2>Adjust</h2>
          <p>Upload an image to tune filters and transforms.</p>
        </header>
        <UploadButton onImage={setImage} label="⬆ Upload an image" />
      </div>
    )
  }

  return (
    <div className="panel-inner">
      <header className="panel-head">
        <h2>Adjust</h2>
        <p>Live preview below; click apply to bake it into the image.</p>
      </header>

      <div className="adjust-preview">
        <img src={image} alt="Adjustment preview" style={{ filter: livePreview }} />
      </div>

      <div className="sliders">
        {SLIDERS.map((s) => (
          <div key={s.key} className="slider-row">
            <div className="slider-top">
              <span>{s.label}</span>
              <span className="slider-val">
                {adj[s.key]}
                {s.suffix}
              </span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              value={adj[s.key]}
              onChange={(e) => update(s.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="transform-row">
        <button className="secondary-btn" disabled={busy} onClick={() => runTask('Rotating…', () => rotate(image, -90))}>↺ Rotate L</button>
        <button className="secondary-btn" disabled={busy} onClick={() => runTask('Rotating…', () => rotate(image, 90))}>↻ Rotate R</button>
        <button className="secondary-btn" disabled={busy} onClick={() => runTask('Flipping…', () => flip(image, 'h'))}>⇋ Flip H</button>
        <button className="secondary-btn" disabled={busy} onClick={() => runTask('Flipping…', () => flip(image, 'v'))}>⇅ Flip V</button>
      </div>

      <div className="panel-actions">
        <button className="secondary-btn" onClick={() => setAdj(defaultAdjustments)} disabled={busy}>
          Reset
        </button>
        <button className="primary-btn" onClick={bake} disabled={busy}>
          Apply adjustments
        </button>
      </div>

      <UploadButton onImage={setImage} label="Replace image" disabled={busy} />
    </div>
  )
}
