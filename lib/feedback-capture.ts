// Cerrar el selector del navegador no es una falla: es el usuario diciendo que no.
const CANCEL_NAMES = ['NotAllowedError', 'AbortError']

export function isCaptureCancelled(err: unknown): boolean {
  return err instanceof Error && CANCEL_NAMES.includes(err.name)
}

export function canCaptureScreen(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  if (typeof navigator.mediaDevices?.getDisplayMedia !== 'function') return false
  // En iOS y Android la API existe a medias o no dispara nada: ahi el usuario
  // toma la captura con el telefono y la adjunta desde Fotos.
  return !window.matchMedia('(pointer: coarse)').matches
}

function grabFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('sin canvas')
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('sin blob'))), 'image/png')
  })
}

export async function captureScreen(): Promise<File> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
    // Chrome preselecciona la pestana actual y deja el permiso en un solo clic.
    preferCurrentTab: true,
  } as DisplayMediaStreamOptions)

  const video = document.createElement('video')
  video.srcObject = stream
  video.muted = true
  try {
    await video.play()
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const blob = await grabFrame(video)
    return new File([blob], 'captura-pantalla.png', { type: 'image/png' })
  } finally {
    stream.getTracks().forEach(track => track.stop())
    video.srcObject = null
  }
}
