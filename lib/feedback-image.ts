import { COMPRESS_MAX_EDGE, COMPRESS_QUALITY, shouldCompress } from '@/lib/feedback'

export type PreparedImage = { file: File; compressed: boolean }

async function readDimensions(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    const dims = { width: bitmap.width, height: bitmap.height }
    bitmap.close?.()
    return dims
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => reject(new Error('no se pudo leer la imagen'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function renameToJpg(name: string): string {
  const base = name.replace(/\.[^.]+$/, '')
  return `${base || 'imagen'}.jpg`
}

async function toJpeg(file: File, width: number, height: number): Promise<File> {
  const scale = COMPRESS_MAX_EDGE / Math.max(width, height)
  const targetW = scale < 1 ? Math.round(width * scale) : width
  const targetH = scale < 1 ? Math.round(height * scale) : height

  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('sin canvas')
  ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  bitmap.close?.()

  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/jpeg', COMPRESS_QUALITY)
  )
  if (!blob) throw new Error('sin blob')
  return new File([blob], renameToJpg(file.name), { type: 'image/jpeg' })
}

// Devuelve el archivo original salvo que de verdad convenga encogerlo. Si algo
// falla al procesarlo, se manda tal cual: el servidor decide si cabe.
export async function prepareImage(file: File): Promise<PreparedImage> {
  try {
    const { width, height } = await readDimensions(file)
    if (!shouldCompress({ size: file.size, width, height })) {
      return { file, compressed: false }
    }
    const compressed = await toJpeg(file, width, height)
    if (compressed.size >= file.size) return { file, compressed: false }
    return { file: compressed, compressed: true }
  } catch {
    return { file, compressed: false }
  }
}
