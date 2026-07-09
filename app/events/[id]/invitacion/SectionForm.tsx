'use client'

import type { Section } from '@/lib/invite/schema'

function TextField({
  label, value, onChange, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[#555]">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
      />
    </div>
  )
}

function TextAreaField({
  label, value, onChange, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[#555]">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none rounded-lg border border-[#d0d0d0] bg-white px-3 py-2 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
      />
    </div>
  )
}

function ToggleField({
  label, value, onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs font-medium text-[#555]">{label}</p>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors
          ${value ? 'bg-[#48C9B0]' : 'bg-[#d8d8d8]'}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform
            ${value ? 'translate-x-5' : 'translate-x-1'}`}
        />
      </button>
    </div>
  )
}

export default function SectionForm({
  section, onPatch,
}: {
  section: Section
  onPatch: (patch: Record<string, unknown>) => void
}) {
  switch (section.type) {
    case 'portada':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Texto pequeño arriba" value={section.content.kicker} onChange={v => onPatch({ kicker: v })} placeholder="Nuestra boda" />
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} placeholder="Nombre de los anfitriones" />
          <TextAreaField label="Subtítulo" value={section.content.subtitulo} onChange={v => onPatch({ subtitulo: v })} placeholder="Una frase corta de bienvenida" />
        </div>
      )
    case 'saludo':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          <TextAreaField label="Mensaje" value={section.content.mensaje} onChange={v => onPatch({ mensaje: v })} />
        </div>
      )
    case 'detalles':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          <ToggleField label="Mostrar mapa" value={section.content.mostrar_mapa} onChange={v => onPatch({ mostrar_mapa: v })} />
        </div>
      )
    case 'dress_code':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          <p className="text-xs text-[#999]">El contenido se toma de la configuración de vestimenta del evento.</p>
        </div>
      )
    case 'itinerario':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          <p className="text-xs text-[#999]">El contenido se toma del itinerario del evento.</p>
        </div>
      )
    case 'rsvp':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          <TextAreaField label="Texto" value={section.content.texto} onChange={v => onPatch({ texto: v })} />
        </div>
      )
    case 'enganche':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          <ToggleField label="Mostrar playlist" value={section.content.mostrar_playlist} onChange={v => onPatch({ mostrar_playlist: v })} />
          <ToggleField label="Mostrar mesa de regalos" value={section.content.mostrar_mesa} onChange={v => onPatch({ mostrar_mesa: v })} />
        </div>
      )
    case 'playlist':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          <TextField label="Descripción" value={section.content.descripcion} onChange={v => onPatch({ descripcion: v })} />
          <p className="text-xs text-[#999]">Se muestra cuando el evento tiene playlist activa.</p>
        </div>
      )
    case 'mesa':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          <TextField label="Descripción" value={section.content.descripcion} onChange={v => onPatch({ descripcion: v })} />
          <p className="text-xs text-[#999]">Se muestra cuando el evento tiene mesa de regalos activa.</p>
        </div>
      )
    case 'texto':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Texto pequeño arriba" value={section.content.eyebrow} onChange={v => onPatch({ eyebrow: v })} />
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          <TextAreaField label="Cuerpo" value={section.content.cuerpo} onChange={v => onPatch({ cuerpo: v })} />
        </div>
      )
    case 'cierre':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          <p className="text-xs text-[#999]">La firma usa los nombres del evento (los mismos de la portada).</p>
        </div>
      )
    default:
      return null
  }
}
