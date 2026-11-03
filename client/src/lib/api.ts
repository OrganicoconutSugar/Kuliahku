import { QueryClient } from '@tanstack/react-query'
export const qc = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 10000, refetchOnWindowFocus: 'always' },
    mutations: { retry: false },
  },
})
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}
export async function api<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let r: Response
  try {
    r = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      headers:
        body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Koneksi terputus. Periksa koneksimu dan coba lagi.')
  }
  const v = await r.json().catch(() => ({}))
  if (!r.ok) {
    if (r.status === 401 && !path.startsWith('/auth/') && location.pathname !== '/login')
      location.assign('/login')
    throw new ApiError(r.status, v.error?.message || 'Permintaan belum berhasil. Coba lagi.')
  }
  return v as T
}
export const msg = (e: unknown) => (e instanceof Error ? e.message : 'Ada kendala. Coba lagi.')
export const refresh = () =>
  qc.invalidateQueries({ predicate: (q) => !['me', 'status'].includes(String(q.queryKey[0])) })
export const termQuery = (path: string, id?: string) =>
  path + (id ? (path.includes('?') ? '&' : '?') + 'semesterId=' + encodeURIComponent(id) : '')
export async function compress(file: File): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height))
    if (scale === 1 && file.size < 450000) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Foto belum bisa diproses.')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.83))
    if (!blob) throw new Error('Foto belum bisa diproses.')
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(url)
  }
}
export async function attachImage(
  file: File,
  note: { id: string; courseId: string; sessionId: string | null },
) {
  const data = new FormData()
  data.set('file', await compress(file))
  data.set('courseId', note.courseId)
  if (note.sessionId) data.set('sessionId', note.sessionId)
  data.set('kind', 'note_image')
  data.set('noteId', note.id)
  data.set('title', file.name)
  return api<{ id: string }>('/attachments', 'POST', data)
}
