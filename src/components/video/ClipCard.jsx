import { useVideoStore } from '../../store/videoStore.js'

const STATUS_COLORS = {
  draft: 'var(--text-dim)',
  queued: '#ffd200',
  processing: '#23d5ab',
  completed: '#23d5ab',
  failed: 'var(--danger)'
}

const STATUS_ICONS = {
  draft: '○',
  queued: '◔',
  processing: '◑',
  completed: '●',
  failed: '✕'
}

export default function ClipCard({ clip, index, isActive, onSelect, onRemove, onExtend, dragging, onDragStart, onDragOver, onDrop }) {
  const model = clip.model?.replace('runway-gen3-', 'Runway ').replace('-dream-machine', ' Dream').replace('kling-v2', 'Kling').replace('wan2.1', 'Wan').split('-').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ')

  const thumbUrl = clip.result?.videoUrl || clip.sourceImageDataURL

  return (
    <div
      className={`clip-card ${isActive ? 'active' : ''} ${dragging ? 'dragging' : ''}`}
      onClick={() => onSelect(clip.id)}
      draggable
      onDragStart={e => onDragStart(e, index)}
      onDragOver={e => { e.preventDefault(); onDragOver(e, index) }}
      onDrop={e => { e.preventDefault(); onDrop(e, index) }}
    >
      <div className="clip-thumb">
        {thumbUrl ? (
          clip.result?.videoUrl
            ? <video src={thumbUrl} muted className="clip-thumb-video" />
            : <img src={thumbUrl} alt="" />
        ) : (
          <div className="clip-thumb-empty">{index + 1}</div>
        )}
        {clip.status === 'processing' && (
          <div className="clip-thumb-overlay">
            <div className="clip-spinner" />
            {clip._progress > 0 && <span>{clip._progress}%</span>}
          </div>
        )}
      </div>
      <div className="clip-meta">
        <div className="clip-index">#{index + 1}</div>
        <div className="clip-dur">{clip.duration}s</div>
        <div
          className="clip-status"
          style={{ color: STATUS_COLORS[clip.status] || STATUS_COLORS.draft }}
          title={clip.status}
        >
          {STATUS_ICONS[clip.status] || '○'}
        </div>
      </div>
      {clip.status === 'completed' && onExtend && (
        <button
          className="clip-extend"
          onClick={e => { e.stopPropagation(); onExtend(clip) }}
          title="Extend clip"
        >+</button>
      )}
      <button
        className="clip-remove"
        onClick={e => { e.stopPropagation(); onRemove(clip.id) }}
        title="Remove clip"
      >×</button>
    </div>
  )
}
