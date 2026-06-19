import PQueue from 'p-queue'
import { v4 as uuidv4 } from 'uuid'

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_JOBS || '3')

// In-memory job store (swap for Redis/BullMQ in production)
const jobs = new Map()

// SSE subscriber registry: jobId → Set of response objects
const subscribers = new Map()

const queue = new PQueue({ concurrency: MAX_CONCURRENT })

export function createJob(params) {
  const jobId = uuidv4()
  jobs.set(jobId, {
    jobId,
    status: 'queued',
    progress: 0,
    params,
    createdAt: Date.now(),
    result: null,
    error: null
  })
  return jobId
}

export function getJob(jobId) {
  return jobs.get(jobId) || null
}

export function getAllJobs() {
  return [...jobs.values()]
}

export function updateJob(jobId, updates) {
  const job = jobs.get(jobId)
  if (!job) return
  Object.assign(job, updates)
  broadcast(jobId, { type: 'job_update', jobId, ...updates })
}

export function cancelJob(jobId) {
  const job = jobs.get(jobId)
  if (!job || job.status === 'completed' || job.status === 'failed') return false
  updateJob(jobId, { status: 'cancelled', error: 'Cancelled by user' })
  return true
}

export function subscribeJob(jobId, res) {
  if (!subscribers.has(jobId)) subscribers.set(jobId, new Set())
  subscribers.get(jobId).add(res)
  res.on('close', () => {
    const subs = subscribers.get(jobId)
    if (subs) subs.delete(res)
  })
}

function broadcast(jobId, data) {
  const subs = subscribers.get(jobId)
  if (!subs || subs.size === 0) return
  const msg = `data: ${JSON.stringify(data)}\n\n`
  for (const res of subs) {
    try { res.write(msg) } catch {}
  }
}

export function enqueueJob(jobId, workerFn) {
  return queue.add(async () => {
    const job = getJob(jobId)
    if (!job || job.status === 'cancelled') return

    updateJob(jobId, { status: 'processing', progress: 5 })
    try {
      const result = await workerFn(jobId, (progress) => {
        updateJob(jobId, { progress })
      })
      updateJob(jobId, { status: 'completed', progress: 100, result, completedAt: Date.now() })
    } catch (err) {
      updateJob(jobId, { status: 'failed', error: err.message })
    }
  })
}
