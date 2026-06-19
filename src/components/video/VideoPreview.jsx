import { useRef, useState, useEffect } from 'react'

export default function VideoPreview({ clip, sourceImage }) {
  const videoRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(null)

  const videoUrl = clip?.result?.videoUrl

  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
    setError(null)
  }, [videoUrl])

  const toggle = () => {
    const v = videoRef.current
    if (!v) return
    if (playing) { v.pause(); setPlaying(false) }
    else { v.play().catch(e => setError(e.message)); setPlaying(true) }
  }

  const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`

  if (!clip) {
    return (
      <div className="vp-empty">
        <div className="vp-empty-icon">🎬</div>
        <h3>No clip selected</h3>
        <p>Add a clip to the timeline and configure it in the panel →</p>
      </div>
    )
  }

  if (clip.status === 'processing' || clip.status === 'queued') {
    return (
      <div className="vp-empty">
        <div className="vp-spinner-wrap">
          <div className="spinner" style={{ width: 48, height: 48, borderWidth: 4 }} />
          <div className="vp-progress-label">
            {clip.status === 'queued' ? 'Queued for generation...' : `Generating with ${clip.model}...`}
          </div>
          {clip._progress > 0 && (
            <div className="vp-progress-bar-wrap">
              <div className="vp-progress-bar" style={{ width: `${clip._progress}%` }} />
            </div>
          )}
        </div>
      </div>
    )
  }

  if (clip.status === 'failed') {
    return (
      <div className="vp-empty">
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h3>Generation failed</h3>
        <p className="vp-error-msg">{clip._error || 'Unknown error — check console'}</p>
      </div>
    )
  }

  if (!videoUrl) {
    const showImage = sourceImage || clip.sourceImageDataURL
    return (
      <div className="vp-empty">
        {showImage ? (
          <img src={showImage} alt="Source frame" className="vp-source-preview" />
        ) : (
          <>
            <div className="vp-empty-icon">✨</div>
            <h3>Ready to generate</h3>
            <p>Configure your clip in the panel and click Generate</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="vp-container">
      <div className="vp-stage">
        <video
          ref={videoRef}
          src={videoUrl}
          className="vp-video"
          loop
          playsInline
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
          onEnded={() => setPlaying(false)}
          onError={() => setError('Failed to load video')}
        />
        {error && <div className="vp-video-error">{error}</div>}
      </div>
      <div className="vp-controls">
        <button className="vp-play-btn" onClick={toggle}>
          {playing ? '⏸' : '▶'}
        </button>
        <div className="vp-timeline">
          <div
            className="vp-timeline-fill"
            style={{ width: duration ? `${(currentTime/duration)*100}%` : '0%' }}
          />
          <input
            type="range" min={0} max={duration || 0} step={0.05}
            value={currentTime}
            className="vp-scrubber"
            onChange={e => { if(videoRef.current) videoRef.current.currentTime = e.target.value }}
          />
        </div>
        <span className="vp-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
        <a href={videoUrl} download={`clip-${clip.id}.webm`} className="ghost-btn" title="Download">⬇</a>
      </div>
    </div>
  )
}
