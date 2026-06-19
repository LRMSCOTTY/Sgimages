import multer from 'multer'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { promises as fs } from 'fs'

const UPLOAD_DIR = './public/videos/uploads'

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
}
ensureUploadDir()

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  }
})

const fileFilter = (req, file, cb) => {
  const ok = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)
  cb(ok ? null : new Error('Only image files accepted'), ok)
}

export const uploadImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
}).single('image')

export function handleUpload(req, res, next) {
  uploadImage(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message })
    next()
  })
}
