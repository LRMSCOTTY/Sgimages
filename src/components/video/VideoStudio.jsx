import { useState, useCallback } from 'react'
import { useVideoStore } from '../../store/videoStore.js'
import VideoTimeline from './VideoTimeline.jsx'
import VideoPreview from './VideoPreview.jsx'
import ClipBuilder from './ClipBuilder.jsx'
import DirectorPanel from './DirectorPanel.jsx'
import MotionPathCanvas from './MotionPathCanvas.jsx'
import StoryboardView from './StoryboardView.jsx'
import MultiModelBattle from './MultiModelBattle.jsx'
import ShotGrammarLib from './ShotGrammarLib.jsx'
import LoopForge from './LoopForge.jsx'
import ColorGradePanel from './ColorGradePanel.jsx'
import JobStatusBar from './JobStatusBar.jsx'
import { CAMERA_RIGS } from './CameraRigSelector.jsx'

const PANELS = [
  { id: 'clip', label: '🎬 Clip', title: 'Clip Builder' },
  { id: 'director', label: '🎭 Director', title: 'AI Director' },
  { id: 'grammar', label: '📚 Grammar', title: 'Shot Grammar' },
  { id: 'grade', label: '🎨 Grade', title: 'Color Grade' },
  { id: 'loop', label: '🔁 Loop', title: 'Loop Forge' }
]

const STAGES = [
  { id: 'preview', label: '▶ Preview' },
  { id: 'motion', label: '✏️ Motion Path' },
  { id: 'battle', label: '⚔️ Battle' },
  { id: 'storyboard', label: '🎞 Storyboard' }
]

export default function VideoStudio({ sourceImage }) {
  const { getActiveClip, updateClip, addClip, clips } = useVideoStore()
  const [panelMode, setPanelMode] = useState('clip')
  const [stageMode, setStageMode] = useState('preview')
  const [battleClip, setBattleClip] = useState(null)
  const clip = getActiveClip()

  const handleBattle = useCallback((c) => {
    setBattleClip(c)
    setStageMode('battle')
  }, [])

  const handleBattleWin = useCallback(({ videoUrl, model }) => {
    if (battleClip) {
      updateClip(battleClip.id, {
        status: 'completed',
        result: { videoUrl, model, durationSeconds: battleClip.duration },
        model
      })
    }
    setStageMode('preview')
  }, [battleClip, updateClip])

  const handleGrammarApply = useCallback((shots) => {
    shots.forEach(shot => {
      const rig = CAMERA_RIGS.find(r => r.id === shot.cameraRig) || null
      addClip({ prompt: shot.prompt, model: 'runway-gen3-turbo', duration: shot.duration, cameraRig: rig, mode: 'text-to-video' })
    })
    setPanelMode('clip')
  }, [addClip])

  const handleMotionUpdate = useCallback((motionPath) => {
    if (clip) updateClip(clip.id, { motionPath })
  }, [clip, updateClip])

  const basePrompt = clips.map(c => c.prompt).filter(Boolean)[0] || ''

  const rightPanel = () => {
    switch (panelMode) {
      case 'director': return <DirectorPanel />
      case 'grammar': return (
        <div className="panel-inner">
          <ShotGrammarLib basePrompt={basePrompt} onApply={handleGrammarApply} />
        </div>
      )
      case 'grade': return (
        <div className="panel-inner">
          <ColorGradePanel
            value={clip?.colorGrade || null}
            onChange={g => clip && updateClip(clip.id, { colorGrade: g })}
          />
        </div>
      )
      case 'loop': return <LoopForge clip={clip} onUpdate={r => clip && updateClip(clip.id, { result: r })} />
      default: return <ClipBuilder onBattle={handleBattle} />
    }
  }

  const centerStage = () => {
    switch (stageMode) {
      case 'motion': return (
        <MotionPathCanvas
          sourceImage={clip?.sourceImageDataURL || sourceImage}
          value={clip?.motionPath}
          onChange={handleMotionUpdate}
        />
      )
      case 'battle': return battleClip ? (
        <MultiModelBattle
          clip={battleClip}
          onPickWinner={handleBattleWin}
          onClose={() => setStageMode('preview')}
        />
      ) : null
      case 'storyboard': return (
        <StoryboardView onClose={() => setStageMode('preview')} />
      )
      default: return <VideoPreview clip={clip} sourceImage={sourceImage} />
    }
  }

  return (
    <div className="video-studio">
      {/* Stage mode tabs */}
      <div className="studio-toolbar">
        <div className="studio-tabs">
          {STAGES.map(s => (
            <button
              key={s.id}
              className={`studio-tab ${stageMode === s.id ? 'active' : ''}`}
              onClick={() => setStageMode(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="studio-info">
          {clip ? (
            <span className="studio-clip-info">
              Active: <strong>{clip.model?.split('-')[0]}</strong> · {clip.duration}s · {clip.aspectRatio}
            </span>
          ) : <span className="studio-clip-info">No clip selected</span>}
        </div>
      </div>

      {/* Main area: center stage + right panel */}
      <div className="studio-body">
        <div className="studio-center">
          {centerStage()}
        </div>
        <aside className="studio-panel">
          <div className="studio-panel-tabs">
            {PANELS.map(p => (
              <button
                key={p.id}
                className={`studio-panel-tab ${panelMode === p.id ? 'active' : ''}`}
                onClick={() => setPanelMode(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="studio-panel-content">
            {rightPanel()}
          </div>
        </aside>
      </div>

      {/* Bottom timeline */}
      <VideoTimeline />

      {/* Job status bar */}
      <JobStatusBar />
    </div>
  )
}
