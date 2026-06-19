import { useRef, useState } from 'react'
import { useVideoStore } from '../../store/videoStore.js'
import { uploadSourceImage } from '../../lib/videoAPI.js'

const TAGS = ['Character', 'Style', 'Object', 'Setting', 'Environment']

export default function ReferencePanel() {
  const { referenceImages, addReferenceImage, removeReferenceImage, updateReferenceImage,
    getActiveClip, updateClip } = useVideoStore()
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const clip = getActiveClip()

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const dataURL = ev.target.result
        const refId = addReferenceImage({ dataURL, label: file.name.replace(/\.[^.]+$/, ''), tag: 'Character' })
        try {
          const uploadedUrl = await uploadSourceImage(dataURL)
          updateReferenceImage(refId, { uploadedUrl })
        } catch {}
      }
      reader.readAsDataURL(file)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const toggleClipRef = (refId) => {
    if (!clip) return
    const current = clip.referenceIds || []
    const next = current.includes(refId) ? current.filter(id => id !== refId) : [...current, refId]
    updateClip(clip.id, { referenceIds: next })
  }

  const useLastFrameAsRef = () => {
    if (!clip?.result?.videoUrl) return
    addReferenceImage({
      dataURL: null,
      uploadedUrl: clip.result.videoUrl,
      label: `Last frame of clip`,
      tag: 'Style',
      isVideoFrame: true
    })
  }

  return (
    <div className="panel-inner">
      <div className="panel-head">
        <h2>References <span className="badge">NEW</span></h2>
        <p>Upload 1–7 character, style, or environment references for visual consistency.</p>
      </div>

      <div className="ref-actions">
        <button
          className="primary-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || referenceImages.length >= 7}
        >
          {uploading ? '⏳ Uploading...' : '+ Add Reference'}
        </button>
        {clip?.result?.videoUrl && (
          <button className="ghost-btn" onClick={useLastFrameAsRef}>
            🎞 Use Last Frame
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
      </div>

      {referenceImages.length === 0 && (
        <div className="loop-no-video">
          <span>No references yet. Add images to maintain consistency across clips.</span>
        </div>
      )}

      <div className="ref-grid">
        {referenceImages.map(ref => {
          const isLinked = clip?.referenceIds?.includes(ref.id)
          return (
            <div key={ref.id} className={`ref-card ${isLinked ? 'linked' : ''}`}>
              <div className="ref-thumb">
                {ref.dataURL || ref.uploadedUrl
                  ? <img src={ref.dataURL || ref.uploadedUrl} alt={ref.label} />
                  : <div className="ref-thumb-empty">🎞</div>}
              </div>
              <div className="ref-info">
                <input
                  className="ref-label-input"
                  value={ref.label}
                  onChange={e => updateReferenceImage(ref.id, { label: e.target.value })}
                  placeholder="Name..."
                />
                <select
                  className="ref-tag-select"
                  value={ref.tag}
                  onChange={e => updateReferenceImage(ref.id, { tag: e.target.value })}
                >
                  {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="ref-card-actions">
                {clip && (
                  <button
                    className={`ghost-btn ${isLinked ? 'active' : ''}`}
                    onClick={() => toggleClipRef(ref.id)}
                    title={isLinked ? 'Remove from clip' : 'Add to active clip'}
                  >
                    {isLinked ? '✓ Linked' : '+ Link'}
                  </button>
                )}
                <button className="clip-remove" onClick={() => removeReferenceImage(ref.id)}>×</button>
              </div>
            </div>
          )
        })}
      </div>

      {referenceImages.length > 0 && (
        <p className="hint-text">
          Linked references inject style guidance into the generation prompt automatically.
        </p>
      )}
    </div>
  )
}
