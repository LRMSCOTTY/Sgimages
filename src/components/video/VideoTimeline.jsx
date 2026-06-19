import { useRef, useState } from 'react'
import { useVideoStore } from '../../store/videoStore.js'
import { composeProject, callExtend } from '../../lib/videoAPI.js'
import ClipCard from './ClipCard.jsx'

export default function VideoTimeline() {
  const { clips, activeClipId, addClip, removeClip, reorderClips, setActiveClip,
    updateClip, saveProjectJSON, loadProjectJSON, newProject, projectName, setProjectName } = useVideoStore()
  const [dragFrom, setDragFrom] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const railRef = useRef(null)
  const fileInputRef = useRef(null)

  const totalDuration = clips.reduce((s, c) => s + (c.duration || 5), 0)
  const completedClips = clips.filter(c => c.status === 'completed' && c.result?.videoUrl)

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

  const handleExport = async () => {
    if (!completedClips.length) return
    setExporting(true)
    try {
      const urls = completedClips.map(c => c.result.videoUrl)
      const result = await composeProject(urls, `${projectName.replace(/\s+/g, '_')}_export.mp4`)
      const a = document.createElement('a')
      a.href = result.videoUrl
      a.download = `${projectName.replace(/\s+/g, '_')}.mp4`
      a.click()
    } catch (e) {
      console.error('Export failed:', e)
    } finally {
      setExporting(false)
    }
  }

  const handleExtend = async (clip) => {
    const newClipId = addClip({
      model: clip.model,
      mode: 'image-to-video',
      prompt: clip.prompt,
      duration: clip.duration,
      aspectRatio: clip.aspectRatio,
      status: 'queued'
    })
    try {
      const result = await callExtend(clip, (pct) => updateClip(newClipId, { status: 'processing', _progress: pct }))
      updateClip(newClipId, { status: 'completed', result, _progress: 100 })
    } catch (e) {
      updateClip(newClipId, { status: 'failed', _error: e.message })
    }
  }

  const handleLoad = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try { loadProjectJSON(ev.target.result) } catch { alert('Invalid project file') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleNewProject = () => {
    if (clips.length === 0 || confirm('Start a new project? Unsaved changes will be lost.')) {
      newProject()
    }
  }

  return (
    <div className="video-timeline">
      <div className="timeline-header">
        <div className="timeline-name-wrap">
          {editingName ? (
            <input
              className="timeline-name-input"
              value={projectName}
              autoFocus
              onChange={e => setProjectName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
            />
          ) : (
            <span className="timeline-label" onClick={() => setEditingName(true)} title="Click to rename">
              {projectName}
            </span>
          )}
          <span className="timeline-total">{totalDuration}s · {clips.length} clips</span>
        </div>
        <div className="timeline-actions">
          <button className="ghost-btn" onClick={handleNewProject} title="New project">New</button>
          <button className="ghost-btn" onClick={saveProjectJSON} title="Save project JSON">Save</button>
          <button className="ghost-btn" onClick={() => fileInputRef.current?.click()} title="Load project JSON">Load</button>
          <button
            className="ghost-btn timeline-export"
            onClick={handleExport}
            disabled={!completedClips.length || exporting}
            title="Export final video"
          >
            {exporting ? '⏳ Exporting...' : '⬇ Export'}
          </button>
          <button className="ghost-btn timeline-add" onClick={() => addClip()}>+ Add Clip</button>
        </div>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleLoad} />
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
              onExtend={handleExtend}
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
