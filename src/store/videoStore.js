import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const uid = () => crypto.randomUUID()

export const DURATIONS = [3, 5, 10, 15, 25, 30]

export const MODELS = [
  // Commercial providers (need API keys)
  { id: 'runway-gen3-turbo', name: 'Runway Turbo', quality: 4, speed: 4, nativeDurations: [5, 10], modes: ['text-to-video', 'image-to-video', 'video-to-video'], badge: 'Fast', tier: 'commercial' },
  { id: 'runway-gen3-alpha', name: 'Runway Alpha', quality: 5, speed: 3, nativeDurations: [5, 10], modes: ['text-to-video', 'image-to-video', 'video-to-video'], badge: 'Ultra', tier: 'commercial' },
  { id: 'luma-dream-machine', name: 'Luma Dream', quality: 4, speed: 3, nativeDurations: [5, 9], modes: ['text-to-video', 'image-to-video', 'keyframe'], badge: 'Cinematic', tier: 'commercial' },
  { id: 'kling-v2', name: 'Kling v2', quality: 4, speed: 2, nativeDurations: [5, 10], modes: ['image-to-video', 'video-to-video'], badge: 'Motion', tier: 'commercial' },
  { id: 'hailuo-minimax', name: 'Hailuo AI', quality: 3, speed: 4, nativeDurations: [6], modes: ['text-to-video', 'image-to-video'], badge: 'Quick', tier: 'commercial' },
  // Open-source via Replicate (REPLICATE_API_TOKEN)
  { id: 'ltx-video', name: 'LTX-Video', quality: 4, speed: 5, nativeDurations: [5], modes: ['text-to-video', 'image-to-video'], badge: 'Open·Fast', tier: 'open' },
  { id: 'hunyuanvideo', name: 'HunyuanVideo', quality: 5, speed: 2, nativeDurations: [5], modes: ['text-to-video'], badge: 'Open·Best', tier: 'open' },
  { id: 'mochi-1', name: 'Mochi-1', quality: 4, speed: 3, nativeDurations: [5], modes: ['text-to-video'], badge: 'Open·Motion', tier: 'open' },
  { id: 'wan2.1', name: 'Wan 2.1', quality: 3, speed: 3, nativeDurations: [5], modes: ['image-to-video'], badge: 'Open·I2V', tier: 'open' },
  { id: 'cogvideox', name: 'CogVideoX', quality: 3, speed: 2, nativeDurations: [6], modes: ['text-to-video'], badge: 'Open', tier: 'open' }
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
    sourceImageEndDataURL: null,
    duration: 5,
    aspectRatio: '16:9',
    cameraRig: null,
    motionPath: null,
    motionBrushRegions: [],
    promptKeyframes: [],
    loopMode: false,
    colorGrade: null,
    effects: [],
    soundDesign: { mode: 'silence', mood: null, sfx: [], volume: 80 },
    referenceIds: [],
    jobId: null,
    status: 'draft',
    result: null,
    battleResults: null,
    createdAt: Date.now(),
    ...overrides
  }
}

export const useVideoStore = create(
  persist(
    (set, get) => ({
      projectName: 'Untitled Video',
      clips: [],
      activeClipId: null,
      referenceImages: [],

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

      clearProject: () => set({ clips: [], activeClipId: null, referenceImages: [] }),
      setProjectName: (name) => set({ projectName: name }),

      addReferenceImage: (ref) => {
        const image = { id: uid(), tag: 'Character', label: 'Reference', dataURL: null, ...ref }
        set(s => ({ referenceImages: [...s.referenceImages, image] }))
        return image.id
      },

      removeReferenceImage: (refId) => {
        set(s => ({ referenceImages: s.referenceImages.filter(r => r.id !== refId) }))
      },

      updateReferenceImage: (refId, updates) => {
        set(s => ({ referenceImages: s.referenceImages.map(r => r.id === refId ? { ...r, ...updates } : r) }))
      },

      saveProjectJSON: () => {
        const { projectName, clips, referenceImages } = get()
        const data = {
          projectName,
          referenceImages: referenceImages.map(r => ({ ...r, dataURL: null })),
          clips: clips.map(c => ({
            ...c,
            sourceImageDataURL: null,
            sourceImageEndDataURL: null,
            result: c.result?.videoUrl?.startsWith('blob:') ? null : c.result
          })),
          version: 1,
          savedAt: Date.now()
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${projectName.replace(/\s+/g, '_')}.sgproject.json`
        a.click()
        URL.revokeObjectURL(url)
      },

      loadProjectJSON: (jsonStr) => {
        try {
          const data = JSON.parse(jsonStr)
          set({
            projectName: data.projectName || 'Loaded Project',
            clips: (data.clips || []).map(c => makeClip(c)),
            referenceImages: data.referenceImages || [],
            activeClipId: data.clips?.[0]?.id || null
          })
        } catch {
          throw new Error('Invalid project file')
        }
      },

      newProject: () => set({ projectName: 'Untitled Video', clips: [], activeClipId: null, referenceImages: [] }),

      getActiveClip: () => {
        const { clips, activeClipId } = get()
        return clips.find(c => c.id === activeClipId) || null
      },
      getClipById: (id) => get().clips.find(c => c.id === id) || null
    }),
    {
      name: 'sgimages-video-project',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projectName: state.projectName,
        referenceImages: state.referenceImages.map(r => ({ ...r, dataURL: null })),
        clips: state.clips.map(c => ({
          ...c,
          sourceImageDataURL: null,
          sourceImageEndDataURL: null,
          result: c.result?.videoUrl?.startsWith('blob:') ? null : c.result
        }))
      })
    }
  )
)
