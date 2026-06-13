'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import FeatureGuard from '@/app/components/ui/FeatureGuard'
import { Music, Clock, Plus, MessageSquareText, ExternalLink, Trophy } from 'lucide-react'
import StatsCollapse, { StatsToggleButton, useStatsToggle } from '@/app/components/ui/StatsCollapse'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Song {
  id: string
  guest_name: string
  song_title: string
  artist: string
  spotify_url: string | null
  category: string | null
  created_at: string
  position: number
  notes: string | null
  thumbnail: string | null
  preview_url: string | null
  duration_ms: number | null
}

function generateToken(length = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Formatea ms totales a "Xh Ym" / "Ym"
function formatTotalDuration(totalMs: number): string {
  const totalSecs = Math.floor(totalMs / 1000)
  const hours = Math.floor(totalSecs / 3600)
  const mins = Math.floor((totalSecs % 3600) / 60)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

// Formatea duration_ms de una canción individual a "M:SS"
function formatSongDuration(ms: number | null): string | null {
  if (!ms) return null
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}`
}

// Saca la inicial segura del nombre del invitado
function getInitial(name: string): string {
  return name?.trim().charAt(0).toUpperCase() || '?'
}

// Indicador visual de drag (6 puntos en grid 2x3)
function DragDots() {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-[3px] py-2 pr-1">
      {[...Array(6)].map((_, i) => (
        <span key={i} className="block h-1 w-1 rounded-full bg-[#bbb]" />
      ))}
    </div>
  )
}

// Card de canción — toda la card es draggable, excepto botones y sección de nota
function SongRow({
  song, onEditNote, isEditingNote, onCloseNote, onSaveNote,
}: {
  song: Song
  onEditNote: () => void
  isEditingNote: boolean
  onCloseNote: () => void
  onSaveNote: (note: string) => Promise<void>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id })
  const [localNote, setLocalNote] = useState(song.notes || '')

  useEffect(() => {
    if (isEditingNote) setLocalNote(song.notes || '')
  }, [isEditingNote, song.notes])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const songDuration = formatSongDuration(song.duration_ms)
  const initial = getInitial(song.guest_name)

  // Helper para evitar que el drag se active desde botones/inputs
  const stopDragPropagation = (e: React.PointerEvent) => e.stopPropagation()

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className="cursor-grab overflow-hidden rounded-xl border border-[#d8d8d8] bg-white shadow-sm transition hover:border-[#48C9B0] active:cursor-grabbing"
    >
      {/* Row principal — toda esta zona es draggable */}
      <div className="flex items-center gap-3 px-3 py-3">

        <DragDots />

        {/* Thumbnail */}
        {song.thumbnail ? (
          <img
            src={song.thumbnail}
            alt={song.song_title}
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#f0f0f0]">
            <Music size={18} className="text-[#ccc]" />
          </div>
        )}

        {/* Info central */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="truncate text-sm font-semibold text-[#1D1E20]">{song.song_title}</p>
            {songDuration && (
              <span className="shrink-0 text-xs text-[#aaa]">{songDuration}</span>
            )}
          </div>
          <p className="truncate text-xs text-[#888]">{song.artist}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {song.category ? (
              <span className="rounded-full bg-[#E1F5EE] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0F6E56]">
                {song.category}
              </span>
            ) : (
              <span className="rounded-full border border-dashed border-[#e0e0e0] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#bbb]">
                Sin etapa
              </span>
            )}
            {/* Invitado con avatar circular y color teal */}
            <div className="flex min-w-0 items-center gap-1.5">
              <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#48C9B0] text-[8px] font-bold text-white">
                {initial}
              </div>
              <span className="truncate text-[11px] font-medium text-[#1a9e88]">
                {song.guest_name}
              </span>
            </div>
          </div>
        </div>

        {/* Acciones derecha — stopPropagation para que no activen drag */}
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onPointerDown={stopDragPropagation}
            onClick={onEditNote}
            className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition
              ${song.notes
                ? 'text-[#48C9B0] hover:bg-[#f0fdfb]'
                : 'text-[#bbb] hover:bg-[#f5f5f5] hover:text-[#888]'}`}
            title={song.notes ? 'Editar nota' : 'Agregar nota'}
          >
            {song.notes ? <MessageSquareText size={17} /> : <Plus size={18} />}
          </button>
          {song.spotify_url && (
            <button
              onPointerDown={stopDragPropagation}
              onClick={() => window.open(song.spotify_url!, '_blank')}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#bbb] transition hover:bg-[#f5f5f5] hover:text-[#1DB954]"
              title="Abrir en Spotify"
            >
              <ExternalLink size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Sección de nota expandida — toda esta zona NO es draggable */}
      {(song.notes || isEditingNote) && (
        <div
          onPointerDown={stopDragPropagation}
          className="cursor-default border-t border-[#f0f0f0] bg-[#fafafa] px-3 py-2"
        >
          {isEditingNote ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={localNote}
                onChange={e => setLocalNote(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') onSaveNote(localNote)
                  if (e.key === 'Escape') onCloseNote()
                }}
                placeholder="Nota para el DJ..."
                className="min-w-0 flex-1 cursor-text rounded-lg border border-[#48C9B0] bg-white px-2.5 py-1 text-xs text-[#1D1E20] outline-none"
              />
              <button
                onClick={() => onSaveNote(localNote)}
                className="shrink-0 cursor-pointer rounded-lg bg-[#48C9B0] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#3ab89f]"
              >
                Guardar
              </button>
              <button
                onClick={onCloseNote}
                className="shrink-0 cursor-pointer rounded-lg border border-[#e0e0e0] bg-white px-2.5 py-1 text-xs text-[#aaa] hover:bg-[#f5f5f5]"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={onEditNote}
              className="block w-full cursor-pointer text-left text-xs italic text-[#666] transition hover:text-[#1a9e88]"
            >
              &ldquo;{song.notes}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Card que se muestra mientras se arrastra
function DragCard({ song }: { song: Song }) {
  const initial = getInitial(song.guest_name)
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#48C9B0] bg-white px-3 py-3 shadow-lg opacity-95">
      <DragDots />
      {song.thumbnail ? (
        <img src={song.thumbnail} alt={song.song_title} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#f0f0f0]">
          <Music size={18} className="text-[#ccc]" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#1D1E20]">{song.song_title}</p>
        <p className="truncate text-xs text-[#888]">{song.artist}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#48C9B0] text-[8px] font-bold text-white">
            {initial}
          </div>
          <span className="truncate text-[11px] font-medium text-[#1a9e88]">{song.guest_name}</span>
        </div>
      </div>
    </div>
  )
}

function PlaylistPlannerPageInner() {
  const { id } = useParams()

  // Toggle de estadísticas en mobile (persiste por evento en localStorage)
  const { visible: statsVisible, toggle: toggleStats } = useStatsToggle(id as string, 'playlist')

  const [allSongs, setAllSongs]           = useState<Song[]>([])
  const [categories, setCategories]       = useState<string[]>([])
  const [playlistToken, setPlaylistToken] = useState<string | null>(null)
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [filterCat, setFilterCat]         = useState('todas')
  const [search, setSearch]               = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [newCat, setNewCat]               = useState('')
  const [addingCat, setAddingCat]         = useState(false)
  const [copied, setCopied]               = useState(false)
  const [mobileTab, setMobileTab]         = useState<'playlist' | 'config'>('playlist')
  const [activeDragId, setActiveDragId]   = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const [{ data: settingsData }, { data: songsData }] = await Promise.all([
      supabase.from('event_settings').select('playlist_categories, playlist_token').eq('event_id', id).single(),
      supabase.from('song_recommendations').select('*').eq('event_id', id).order('position', { ascending: true }),
    ])
    if (settingsData) {
      setCategories(Array.isArray(settingsData.playlist_categories) ? settingsData.playlist_categories : [])
      setPlaylistToken(settingsData.playlist_token || null)
    }
    setAllSongs(songsData || [])
    setLoading(false)
  }

  const savePlaylistSettings = async (token: string | null, cats: string[]) => {
    await supabase.from('event_settings')
      .update({ playlist_token: token, playlist_categories: cats })
      .eq('event_id', id)
  }

  const handleGenerateToken = async () => {
    const token = generateToken()
    setPlaylistToken(token)
    await savePlaylistSettings(token, categories)
  }

  const playlistUrl = playlistToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/playlist/${playlistToken}`
    : null

  const copyLink = async () => {
    if (!playlistUrl) return
    await navigator.clipboard.writeText(playlistUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const addCategory = async () => {
    const trimmed = newCat.trim()
    if (!trimmed || categories.includes(trimmed)) return
    const updated = [...categories, trimmed]
    setCategories(updated)
    setNewCat('')
    setAddingCat(false)
    await savePlaylistSettings(playlistToken, updated)
  }

  const removeCategory = async (cat: string) => {
    const updated = categories.filter(c => c !== cat)
    setCategories(updated)
    await savePlaylistSettings(playlistToken, updated)
  }

  const handleDragStart = (event: DragStartEvent) => setActiveDragId(event.active.id as string)

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = allSongs.findIndex(s => s.id === active.id)
    const newIndex = allSongs.findIndex(s => s.id === over.id)
    const reordered = arrayMove(allSongs, oldIndex, newIndex).map((s, i) => ({ ...s, position: i }))
    setAllSongs(reordered)
    setSaving(true)
    await Promise.all(reordered.map(s =>
      supabase.from('song_recommendations').update({ position: s.position }).eq('id', s.id)
    ))
    setSaving(false)
  }

  const saveNote = async (songId: string, note: string) => {
    await supabase.from('song_recommendations').update({ notes: note || null }).eq('id', songId)
    setAllSongs(prev => prev.map(s => s.id === songId ? { ...s, notes: note || null } : s))
    setEditingNoteId(null)
  }

  // ─── Métricas ──────────────────────────────────────────────
  const totalSongs      = allSongs.length
  const totalDurationMs = allSongs.reduce((acc, s) => acc + (s.duration_ms || 0), 0)
  const durationLabel   = totalSongs > 0 ? formatTotalDuration(totalDurationMs) : '0m'

  // Agrupa canciones por título+artista para detectar repeticiones (Top 5)
  const songCounts = (() => {
    const map = new Map<string, { title: string; artist: string; count: number }>()
    for (const s of allSongs) {
      const key = `${s.song_title.toLowerCase().trim()}|${s.artist.toLowerCase().trim()}`
      const existing = map.get(key)
      if (existing) existing.count++
      else map.set(key, { title: s.song_title, artist: s.artist, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  })()
  const repeatedSongs = songCounts.filter(s => s.count > 1)
  const top5Repeated  = repeatedSongs.slice(0, 5)

  const activeDragSong = activeDragId ? allSongs.find(s => s.id === activeDragId) : null

  const filtered = allSongs.filter(s => {
    const matchCat    = filterCat === 'todas' || s.category === filterCat || (filterCat === '__none__' && !s.category)
    const matchSearch = search === '' ||
      s.song_title.toLowerCase().includes(search.toLowerCase()) ||
      s.artist.toLowerCase().includes(search.toLowerCase()) ||
      s.guest_name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  if (loading) return <div className="p-8 text-sm text-[#666]">Cargando playlist...</div>

  // Stats: solo canciones + duración
  const StatsCards = () => (
    <>
      {/* Canciones */}
      <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Canciones</span>
          <Music size={14} className="text-[#48C9B0]" />
        </div>
        <div className="text-xl font-bold text-[#1D1E20]">{totalSongs}</div>
        <div className="mt-1 text-[10px] text-[#aaa]">recibidas de invitados</div>
      </div>

      {/* Duración */}
      <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Duración</span>
          <Clock size={14} className="text-[#48C9B0]" />
        </div>
        <div className="text-xl font-bold text-[#1D1E20]">{durationLabel}</div>
        <div className="mt-1 text-[10px] text-[#aaa]">tiempo total estimado</div>
      </div>
    </>
  )

  // Sección Top 5 — solo se muestra si hay repeticiones
  const TopRepeatedSection = () => {
    if (top5Repeated.length === 0) return null

    return (
      <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <Trophy size={13} className="text-[#48C9B0]" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#666]">
            Top {top5Repeated.length} más pedidas
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {top5Repeated.map((s, i) => (
            <div key={`${s.title}-${s.artist}`} className="flex items-center gap-2">
              {/* Número de puesto */}
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold
                  ${i === 0 ? 'bg-[#48C9B0] text-white' : 'bg-[#E1F5EE] text-[#0F6E56]'}`}
              >
                {i + 1}
              </span>
              {/* Título + artista */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[#1D1E20]">{s.title}</p>
                <p className="truncate text-[10px] text-[#888]">{s.artist}</p>
              </div>
              {/* Conteo */}
              <span className="shrink-0 rounded-full bg-[#E1F5EE] px-2 py-0.5 text-[10px] font-bold text-[#0F6E56]">
                {s.count}x
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const StageManager = ({ compact = false }: { compact?: boolean }) => (
    <div className={compact ? 'flex flex-wrap items-center gap-1.5' : 'flex flex-col gap-3'}>
      {!compact && <p className="text-[10px] font-semibold uppercase tracking-wide text-[#999]">Etapas</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        {categories.map(cat => (
          <span key={cat} className="flex items-center gap-1 rounded-full bg-[#E1F5EE] px-2.5 py-1 text-xs font-medium text-[#0F6E56]">
            {cat}
            <button onClick={() => removeCategory(cat)} className="ml-0.5 text-[#48C9B0] hover:text-[#0F6E56]">×</button>
          </span>
        ))}
        {addingCat ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') setAddingCat(false) }}
              placeholder="Nueva etapa..."
              className="w-28 rounded-lg border border-[#48C9B0] px-2 py-1 text-xs outline-none"
            />
            <button onClick={addCategory} className="rounded-lg bg-[#48C9B0] px-2 py-1 text-xs text-white">✓</button>
            <button onClick={() => setAddingCat(false)} className="rounded-lg border border-[#e0e0e0] px-2 py-1 text-xs text-[#aaa]">✕</button>
          </div>
        ) : (
          <button
            onClick={() => setAddingCat(true)}
            className="rounded-full border border-dashed border-[#ccc] px-2.5 py-1 text-xs text-[#aaa] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
          >
            + Etapa
          </button>
        )}
      </div>
    </div>
  )

  const SongList = () => (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={filtered.map(s => s.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {filtered.map(song => (
            <SongRow
              key={song.id}
              song={song}
              onEditNote={() => setEditingNoteId(song.id)}
              isEditingNote={editingNoteId === song.id}
              onCloseNote={() => setEditingNoteId(null)}
              onSaveNote={(note) => saveNote(song.id, note)}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeDragSong && <DragCard song={activeDragSong} />}
      </DragOverlay>
    </DndContext>
  )

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h2 className="text-base font-semibold text-[#1D1E20]">Sin recomendaciones aún</h2>
      <p className="mt-1 text-sm text-[#999]">Comparte el link con tus invitados.</p>
    </div>
  )

  const MobileConfigPanel = () => (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#999]">Link para invitados</p>
        {!playlistToken ? (
          <button
            onClick={handleGenerateToken}
            className="rounded-lg border border-dashed border-[#48C9B0] bg-[#f0fdfb] px-3 py-1.5 text-xs font-medium text-[#1a9e88]"
          >
            + Generar link
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="truncate rounded-lg border border-dashed border-[#48C9B0] bg-[#f0fdfb] px-2.5 py-1.5 text-xs text-[#0F6E56]">
              {playlistUrl}
            </span>
            <button
              onClick={copyLink}
              className="rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white"
            >
              {copied ? '¡Copiado!' : 'Copiar link'}
            </button>
          </div>
        )}
      </div>
      <StageManager />
    </div>
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f4f4f4]">

      {/* MOBILE */}
      <div className="flex h-full flex-col sm:hidden">
        <div className="shrink-0 border-b border-[#e8e8e8] bg-white px-4 py-3">
          {/* Título + subtítulo + toggle */}
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-[#1D1E20]">Playlist</h1>
              <p className="mt-0.5 text-xs text-[#888]">Canciones recomendadas por tus invitados</p>
            </div>
            <div className="shrink-0 pt-1">
              <StatsToggleButton visible={statsVisible} onClick={toggleStats} />
            </div>
          </div>

          <StatsCollapse visible={statsVisible}>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <StatsCards />
              </div>
              <TopRepeatedSection />
            </div>
          </StatsCollapse>
        </div>

        <div className="flex shrink-0 border-b border-[#e8e8e8] bg-white">
          <button
            onClick={() => setMobileTab('playlist')}
            className={`flex-1 py-2.5 text-xs font-medium transition ${mobileTab === 'playlist' ? 'border-b-2 border-[#48C9B0] text-[#48C9B0]' : 'text-[#999]'}`}
          >
            Playlist
          </button>
          <button
            onClick={() => setMobileTab('config')}
            className={`flex-1 py-2.5 text-xs font-medium transition ${mobileTab === 'config' ? 'border-b-2 border-[#48C9B0] text-[#48C9B0]' : 'text-[#999]'}`}
          >
            Configuración
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {mobileTab === 'playlist'
            ? (totalSongs === 0 ? <EmptyState /> : <SongList />)
            : <MobileConfigPanel />}
        </div>
      </div>

      {/* DESKTOP */}
      <div className="hidden h-full flex-col overflow-hidden sm:flex">

        {/* Header + stats */}
        <div className="shrink-0 border-b border-[#e8e8e8] bg-white px-6 py-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-[#1D1E20] sm:text-xl lg:text-2xl">Playlist</h1>
              <p className="mt-0.5 text-xs text-[#888] sm:text-sm">Canciones recomendadas por tus invitados</p>
            </div>
            {saving && <span className="text-xs text-[#aaa]">Guardando orden...</span>}
          </div>

          {/* Si hay top 5 → side-by-side en desktop. Si no → solo stats */}
          {top5Repeated.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="grid grid-cols-2 gap-3">
                <StatsCards />
              </div>
              <TopRepeatedSection />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <StatsCards />
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="shrink-0 border-b border-[#e8e8e8] bg-white px-6 py-2.5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar canción, artista..."
              className="w-52 shrink-0 rounded-lg border border-[#d0d0d0] bg-white px-3 py-1.5 text-xs text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
            />

            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
              className="shrink-0 rounded-lg border border-[#1D1E20] bg-[#1D1E20] px-2.5 py-1.5 text-xs text-white outline-none"
            >
              <option value="todas">Todas las etapas</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__none__">Sin etapa</option>
            </select>

            <div className="h-4 w-px shrink-0 bg-[#e8e8e8]" />

            <div className="min-w-0 flex-1">
              <StageManager compact />
            </div>

            <div className="h-4 w-px shrink-0 bg-[#e8e8e8]" />

            {!playlistToken ? (
              <button
                onClick={handleGenerateToken}
                className="shrink-0 rounded-lg border border-dashed border-[#48C9B0] bg-[#f0fdfb] px-3 py-1.5 text-xs font-medium text-[#1a9e88] transition hover:bg-[#e0faf5]"
              >
                + Generar link
              </button>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                <span className="max-w-[180px] truncate text-xs text-[#48C9B0]">{playlistUrl}</span>
                <button
                  onClick={copyLink}
                  className="shrink-0 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3ab89f]"
                >
                  {copied ? '¡Copiado!' : 'Copiar link'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {totalSongs === 0 ? <EmptyState /> : <SongList />}
        </div>
      </div>
    </div>
  )
}
export default function PlaylistPlannerPage() {
  return (
    <FeatureGuard feature="playlist">
      <PlaylistPlannerPageInner />
    </FeatureGuard>
  )
}
