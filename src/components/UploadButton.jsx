import { useRef } from 'react'

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function UploadButton({ onImage, label = 'Upload image', disabled }) {
  const inputRef = useRef(null)

  async function handleChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const dataURL = await fileToDataURL(file)
    onImage(dataURL)
    e.target.value = '' // allow re-uploading the same file
  }

  return (
    <>
      <button
        className="secondary-btn full"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        {label}
      </button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleChange} />
    </>
  )
}
