import { useState } from 'react'
import { useVideoStore } from '../../store/videoStore.js'
import { composeProject } from '../../lib/videoAPI.js'

const ACT_LABELS = ['Act I — Setup', 'Act II — Confrontation', 'Act III — Resolution']

export default function MovieBuilder() {
  const { clips, updateClip, setProjectName, projectName } = useVideoStore()
  const [acts, setActs] = useState([
    { id: 'act1', label: ACT_LABELS[0], clipIds: [] },
    { id: 'act2', label: ACT_LABELS[1], clipIds: [] },
    { id: 'act3', label: ACT_LABELS[2], clipIds: [] }
  ])
  const [exporting, setExporting] = useState(false)
  const [exportUrl, setExportUrl] = useState(null)
  const [titleCard, setTitleCard] = useState(projectName)

  const completedClips = clips.filter(c => c.status === 'completed' && c.result?.videoUrl)
  const unassigned = completedClips.filter(c => !acts.some(a => a.clipIds.includes(c.id)))

  const assignToAct = (clipId, actId) => {
    setActs(prev => prev.map(a => ({
      ...a,
      clipIds: a.id === actId
        ? (a.clipIds.includes(clipId) ? a.clipIds : [...a.clipIds, clipId])
        : a.clipIds.filter(id => id !== clipId)
    })))
  }

  const removeFromAct = (clipId, actId) => {
    setActs(prev => prev.map(a => ({
      ...a,
      clipIds: a.id === actId ? a.clipIds.filter(id => id !== clipId) : a.clipIds
    })))
  }

  const totalMovieDuration = acts.reduce((sum, act) => {
    return sum + act.clipIds.reduce((s, id) => {
      const c = clips.find(cl => cl.id === id)
      return s + (c?.duration || 0)
    }, 0)
  }, 0)

  const exportMovie = async () => {
    const orderedClips = acts.flatMap(a => a.clipIds)
      .map(id => clips.find(c => c.id === id))
      .filter(c => c?.result?.videoUrl)

    if (!orderedClips.length) return
    setExporting(true)
    try {
      const urls = orderedClips.map(c => c.result.videoUrl)
      const result = await composeProject(urls, `${titleCard.replace(/\s+/g, '_')}_MOVIE.mp4`)
      setExportUrl(result.videoUrl)
    } catch (e) {
      console.error('Movie export failed:', e)
    } finally {
      setExporting(false)
    }
  }

  const downloadMovie = () => {
    if (!exportUrl) return
    const a = document.createElement('a')
    a.href = exportUrl
    a.download = `${titleCard.replace(/\s+/g, '_')}.mp4`
    a.click()
  }

  return (
    <div className="movie-builder panel-inner">
      <div className="panel-head">
        <h2>Movie Builder <span className="badge">NEW</span></h2>
        <p>Organize your clips into acts, set your title, and export a complete feature.</p>
      </div>

      <label className="field-label">Movie Title</label>
      <input
        type="text"
        className="prompt-input"
        style={{ minHeight: 'auto', padding: '8px 12px' }}
        value={titleCard}
        onChange={e => { setTitleCard(e.target.value); setProjectName(e.target.value) }}
        placeholder="Your Movie Title..."
      />

      <div className="movie-stats">
        <span>Total Runtime: <strong>{totalMovieDuration}s</strong></span>
        <span>Scenes: <strong>{acts.flatMap(a => a.clipIds).length}</strong></span>
      </div>

      {/* Three-act structure */}
      <div className="act-structure">
        {acts.map(act => {
          const actClips = act.clipIds.map(id => clips.find(c => c.id === id)).filter(Boolean)
          const actDuration = actClips.reduce((s, c) => s + (c?.duration || 0), 0)
          return (
            <div key={act.id} className="act-block">
              <div className="act-header">
                <span className="act-label">{act.label}</span>
                <span className="act-dur">{actDuration}s</span>
              </div>
              <div className="act-clips">
                {actClips.map((c, i) => (
                  <div key={c.id} className="act-clip-row">
                    <div className="act-clip-thumb">
                      {c.result?.videoUrl && <video src={c.result.videoUrl} muted />}
                    </div>
                    <span className="act-clip-label">{c.prompt?.slice(0, 40) || `Clip ${i+1}`}</span>
                    <span className="act-clip-dur">{c.duration}s</span>
                    <button className="clip-remove" onClick={() => removeFromAct(c.id, act.id)}>×</button>
                  </div>
                ))}
                {actClips.length === 0 && (
                  <div className="act-empty">Drag clips here or assign below</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Unassigned clips */}
      {unassigned.length > 0 && (
        <>
          <label className="field-label" style={{ marginTop: 16 }}>Unassigned Clips</label>
          <div className="unassigned-clips">
            {unassigned.map(c => (
              <div key={c.id} className="unassigned-clip">
                <div className="act-clip-thumb">
                  <video src={c.result?.videoUrl} muted />
                </div>
                <span className="act-clip-label">{c.prompt?.slice(0, 30) || 'Clip'}</span>
                <div className="assign-btns">
                  {acts.map(a => (
                    <button
                      key={a.id}
                      className="ghost-btn assign-btn"
                      onClick={() => assignToAct(c.id, a.id)}
                    >
                      {a.id.replace('act', 'Act ')}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {completedClips.length === 0 && (
        <div className="loop-no-video">
          <span>⚠️ Generate some clips first, then organize them into your movie structure here.</span>
        </div>
      )}

      <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
        <button
          className="primary-btn"
          style={{ flex: 1 }}
          onClick={exportMovie}
          disabled={exporting || !acts.flatMap(a => a.clipIds).length}
        >
          {exporting ? '⏳ Composing movie...' : '🎬 Export Full Movie'}
        </button>
        {exportUrl && (
          <button className="secondary-btn" onClick={downloadMovie}>
            ⬇ Download
          </button>
        )}
      </div>

      {exportUrl && (
        <div className="loop-result" style={{ marginTop: 16 }}>
          <span className="field-label">Movie Preview</span>
          <video src={exportUrl} controls className="loop-preview-video" />
        </div>
      )}
    </div>
  )
}
