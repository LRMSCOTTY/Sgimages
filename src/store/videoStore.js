import { create } from 'zustand'

const uid = () => crypto.randomUUID()

export const DURATIONS = [3, 5, 10, 15, 25, 30]

export const MODELS = [
  { id: 'runway-gen3-turbo', name: 'Runway Turbo', quality: 4, speed: 4, nativeDurations: [5, 10], modes: ['text-to-video', 'image-to-video'], badge: 'Fast' },
  { id: 'runway-gen3-alpha', name: 'Runway Alpha', quality: 5, speed: 3, nativeDurations: [5, 10], modes: ['text-to-video', 'image-to-video'], badge: 'Ultra' },
  { id: 'luma-dream-machine', name: 'Luma Dream', quality: 4, speed: 3, nativeDurations: [5, 9], modes: ['text-to-video', 'image-to-video'], badge: 'Cinematic' },
  { id: 'kling-v2', name: 'Kling v2', quality: 4, speed: 2, nativeDurations: [5, 10], modes: ['image-to-video'], badge: 'Motion' },
  { id: 'hailuo-minimax', name: 'Hailuo AI', quality: 3, speed: 4, nativeDurations: [6], modes: ['text-to-video', 'image-to-video'], badge: 'Quick' },
  { id: 'wan2.1', name: 'Wan 2.1', quality: 3, speed: 2, nativeDurations: [5], modes: ['image-to-video'], badge: 'Open' },
  { id: 'cogvideox', name: 'CogVideoX', quality: 3, speed: 2, nativeDurations: [6], modes: ['text-to-video'], badge: 'Open' }
]

export const ASPECT_RATIOS = ['16:9', '9:16', '1:1']

function makeClip(overrides = {}) {
  return {
    id: uid(),
    mode: 'text-to-video',
    model: 'runway-gen3-turbo',
    prompt: '',
    negativePrompt: '',
    sourceImageDataURL: null,
    duration: 5,
    aspectRatio: '16:9',
    cameraRig: null,
    motionPath: null,
    promptKeyframes: [],
    loopMode: false,
    colorGrade: null,
    jobId: null,
    status: 'draft',
    result: null,
    battleResults: null,
    createdAt: Date.now(),
    ...overrides
  }
}

export const useVideoStore = create((set, get) => ({
  projectName: 'Untitled Video',
  clips: [],
  activeClipId: null,

  addClip: (overrides = {}) => {
    const clip = makeClip(overrides)
    set(s => ({ clips: [...s.clips, clip], activeClipId: clip.id }))
    return clip.id
  },

  removeClip: (clipId) => {
    set(s => {
      const clips = s.clips.filter(c => c.id !== clipId)
      const activeClipId = s.activeClipId === clipId
        ? (clips.length > 0 ? clips[clips.length - 1].id : null)
        : s.activeClipId
      return { clips, activeClipId }
    })
  },

  reorderClips: (fromIdx, toIdx) => {
    set(s => {
      const clips = [...s.clips]
      const [moved] = clips.splice(fromIdx, 1)
      clips.splice(toIdx, 0, moved)
      return { clips }
    })
  },

  updateClip: (clipId, updates) => {
    set(s => ({ clips: s.clips.map(c => c.id === clipId ? { ...c, ...updates } : c) }))
  },

  setActiveClip: (clipId) => set({ activeClipId: clipId }),

  duplicateClip: (clipId) => {
    const clip = get().clips.find(c => c.id === clipId)
    if (!clip) return
    const newClip = makeClip({ ...clip, id: uid(), jobId: null, status: 'draft', result: null, battleResults: null, createdAt: Date.now() })
    set(s => ({ clips: [...s.clips, newClip], activeClipId: newClip.id }))
    return newClip.id
  },

  clearProject: () => set({ clips: [], activeClipId: null }),
  setProjectName: (name) => set({ projectName: name }),

  getActiveClip: () => {
    const { clips, activeClipId } = get()
    return clips.find(c => c.id === activeClipId) || null
  },
  getClipById: (id) => get().clips.find(c => c.id === id) || null
}))
