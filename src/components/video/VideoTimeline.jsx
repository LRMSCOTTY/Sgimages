import { useRef, useState } from 'react'
import { useVideoStore } from '../../store/videoStore.js'
import ClipCard from './ClipCard.jsx'

export default function VideoTimeline() {
  const { clips, activeClipId, addClip, removeClip, reorderClips, setActiveClip } = useVideoStore()
  const [dragFrom, setDragFrom] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const railRef = useRef(null)

  const totalDuration = clips.reduce((s, c) => s + (c.duration || 5), 0)

  const handleDragStart = (e, index) => {
    setDragFrom(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    setDragOver(index)
  }

  const handleDrop = (e, toIndex) => {
    e.preventDefault()
    if (dragFrom !== null && dragFrom !== toIndex) {
      reorderClips(dragFrom, toIndex)
    }
    setDragFrom(null)
    setDragOver(null)
  }

  const handleDragEnd = () => { setDragFrom(null); setDragOver(null) }

  return (
    <div className="video-timeline">
      <div className="timeline-header">
        <span className="timeline-label">Timeline</span>
        <span className="timeline-total">{totalDuration}s total · {clips.length} clips</span>
        <button className="ghost-btn timeline-add" onClick={() => addClip()}>+ Add Clip</button>
      </div>
      <div className="timeline-rail" ref={railRef} onDragEnd={handleDragEnd}>
        {clips.length === 0 ? (
          <div className="timeline-empty">
            <span>Click <strong>+ Add Clip</strong> or use <strong>AI Director</strong> to start →</span>
          </div>
        ) : (
          clips.map((clip, i) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              index={i}
              isActive={clip.id === activeClipId}
              onSelect={setActiveClip}
              onRemove={removeClip}
              dragging={dragFrom === i}
              dragOver={dragOver === i}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          ))
        )}
      </div>
    </div>
  )
}
