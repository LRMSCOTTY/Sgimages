import { useVideoStore } from '../../store/videoStore.js'

const STATUS_EMOJI = { draft: '', queued: '⏳', processing: '⚙️', completed: '✓', failed: '✕' }

export default function JobStatusBar() {
  const clips = useVideoStore(s => s.clips)
  const active = clips.filter(c => c.status === 'processing' || c.status === 'queued')
  const done = clips.filter(c => c.status === 'completed').length
  const failed = clips.filter(c => c.status === 'failed').length

  if (clips.length === 0) return null

  return (
    <div className="job-status-bar">
      <div className="job-bar-left">
        {active.length > 0 ? (
          active.map(c => (
            <div key={c.id} className="job-chip">
              <span className="job-chip-model">{c.model?.split('-')[0]}</span>
              <div className="job-chip-bar">
                <div className="job-chip-fill" style={{ width: `${c._progress || 5}%` }} />
              </div>
              <span className="job-chip-pct">{c._progress || 0}%</span>
            </div>
          ))
        ) : (
          <span className="job-idle">Queue idle</span>
        )}
      </div>
      <div className="job-bar-right">
        {done > 0 && <span className="job-stat done">✓ {done}</span>}
        {failed > 0 && <span className="job-stat failed">✕ {failed}</span>}
        <span className="job-stat total">{clips.length} clips</span>
      </div>
    </div>
  )
}
