'use client'

import { useEffect, useState } from 'react'

type GifResult = { id: string; preview: string; url: string }

export default function GifSearch({ onSelect }: { onSelect: (url: string) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GifResult[]>([])
  const [loading, setLoading] = useState(false)
  const [noKey, setNoKey] = useState(false)

  const handlePick = (url: string) => {
    onSelect(url)
    setQuery('')
    setResults([])
    setLoading(false)
  }

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/giphy/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        })
        const data = (await res.json()) as { results?: GifResult[]; error?: string }
        setNoKey(data.error === 'no_key')
        setResults(data.results ?? [])
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setResults([])
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 400)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  return (
    <div className="flex flex-col gap-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-[#555]">Buscar GIF en Giphy</label>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Busca un GIF... (ej. celebracion, baile)"
          className="w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
        />
      </div>

      {noKey && (
        <p className="text-[11px] text-[#b8912f]">
          Falta configurar GIPHY_API_KEY. Mientras, pega la URL de un GIF abajo.
        </p>
      )}

      {loading && <p className="text-xs text-[#999]">Buscando...</p>}

      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {results.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => handlePick(r.url)}
              className="overflow-hidden rounded-md transition hover:opacity-80"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.preview} alt="" className="h-20 w-full rounded-md object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
