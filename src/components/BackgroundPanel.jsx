import { useState } from 'react'
import UploadButton from './UploadButton.jsx'
import { removeBackground } from '../lib/mockAI.js'

export default function BackgroundPanel({ image, runTask, busy, setImage }) {
  const [tolerance, setTolerance] = useState(40)

  function run() {
    if (!image) return
    runTask('Removing background…', () => removeBackground(image, { tolerance }))
  }

  if (!image) {
    return (
      <div className="panel-inner">
        <header className="panel-head">
          <h2>Background</h2>
          <p>Upload a photo to cut out its background.</p>
        </header>
        <UploadButton onImage={setImage} label="⬆ Upload an image" />
      </div>
    )
  }

  return (
    <div className="panel-inner">
      <header className="panel-head">
        <h2>Background</h2>
        <p>Samples the corner colors and removes matching pixels. Works best on uniform backgrounds.</p>
      </header>

      <div className="slider-row">
        <div className="slider-top">
          <span>Tolerance</span>
          <span className="slider-val">{tolerance}</span>
        </div>
        <input
          type="range"
          min={10}
          max={120}
          value={tolerance}
          onChange={(e) => setTolerance(Number(e.target.value))}
        />
        <p className="hint-text">Higher tolerance removes a wider range of background colors.</p>
      </div>

      <button className="primary-btn full" onClick={run} disabled={busy}>
        ✂️ Remove background
      </button>

      <UploadButton onImage={setImage} label="Replace image" disabled={busy} />
    </div>
  )
}
