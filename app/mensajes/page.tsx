"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, MessageCircle, Clock } from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type RsvpStatus = "pending" | "confirmed" | "declined";

interface Event {
  id: string;
  name: string;
}

interface Guest {
  id: string;
  name: string;
  phone: string;
  rsvp_status: RsvpStatus;
  event_id: string;
}

interface WaMessage {
  id: string;
  guest_id: string;
  event_id: string;
  direction: "sent" | "received";
  content: string;
  created_at: string;
}

interface Conversation {
  guest: Guest;
  event: Event;
  lastMessage: WaMessage;
  messages: WaMessage[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tiempoRelativo(fecha: string): string {
  const diff = Math.floor((Date.now() - new Date(fecha).getTime()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return "ayer";
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} días`;
  return new Date(fecha).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function formatHora(fecha: string): string {
  return new Date(fecha).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function formatFechaChat(fecha: string): string {
  const d = new Date(fecha);
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}

const rsvpConfig: Record<RsvpStatus, { label: string; bg: string; text: string }> = {
  confirmed: { label: "Confirmado", bg: "bg-emerald-50", text: "text-emerald-700" },
  pending:   { label: "Pendiente",  bg: "bg-amber-50",   text: "text-amber-700"   },
  declined:  { label: "Declinó",    bg: "bg-red-50",     text: "text-red-600"     },
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MensajesGlobalPage() {
  const router = useRouter();

  const [eventos, setEventos] = useState<Event[]>([]);
  const [eventoFiltro, setEventoFiltro] = useState<string>("todos");
  const [conversaciones, setConversaciones] = useState<Conversation[]>([]);
  const [seleccionada, setSeleccionada] = useState<Conversation | null>(null);
  const [cargando, setCargando] = useState(true);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (seleccionada) {
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [seleccionada]);

  useEffect(() => {
    async function cargar() {
      setCargando(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }

      // 1. Eventos del usuario
      const { data: eventosData } = await supabase
        .from("events")
        .select("id, name")
        .order("event_date", { ascending: true });

      if (!eventosData || eventosData.length === 0) { setCargando(false); return; }
      setEventos(eventosData);

      const eventoIds = eventosData.map((e: Event) => e.id);

      // 2. Mensajes de todos los eventos
      const { data: mensajes } = await supabase
        .from("wa_messages")
        .select("*")
        .in("event_id", eventoIds)
        .order("created_at", { ascending: true });

      if (!mensajes || mensajes.length === 0) { setCargando(false); return; }

      // 3. Invitados con mensajes
      const guestIds = [...new Set(mensajes.map((m: WaMessage) => m.guest_id))];
      const { data: guests } = await supabase
        .from("guests")
        .select("id, name, phone, rsvp_status, event_id")
        .in("id", guestIds);

      if (!guests) { setCargando(false); return; }

      // 4. Armar conversaciones
      const convs: Conversation[] = guestIds
        .map((gid) => {
          const guest = guests.find((g: Guest) => g.id === gid);
          if (!guest) return null;
          const evento = eventosData.find((e: Event) => e.id === guest.event_id);
          if (!evento) return null;
          const msgs = mensajes.filter((m: WaMessage) => m.guest_id === gid);
          return { guest, event: evento, lastMessage: msgs[msgs.length - 1], messages: msgs };
        })
        .filter(Boolean) as Conversation[];

      convs.sort(
        (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
      );

      setConversaciones(convs);
      setCargando(false);
    }

    cargar();
  }, []);

  const convsFiltradas = eventoFiltro === "todos"
    ? conversaciones
    : conversaciones.filter((c) => c.event.id === eventoFiltro);

  // ── Vista lista ────────────────────────────────────────────────────────────

  const Lista = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-[#e8e8e8] space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[#1D1E20] font-semibold text-lg">Mensajes</h2>
          <span className="text-[#9ca3af] text-xs">{convsFiltradas.length} conversación{convsFiltradas.length !== 1 ? "es" : ""}</span>
        </div>
        {/* Filtro por evento */}
        {eventos.length > 1 && (
          <select
            value={eventoFiltro}
            onChange={(e) => setEventoFiltro(e.target.value)}
            className="w-full rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-3 py-2 text-sm text-[#1D1E20] focus:border-[#48C9B0] focus:outline-none"
          >
            <option value="todos">Todos los eventos</option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {cargando ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-[#f3f4f6]">
              <div className="w-10 h-10 rounded-full bg-[#f3f4f6] animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-[#f3f4f6] rounded animate-pulse w-1/3" />
                <div className="h-3 bg-[#f3f4f6] rounded animate-pulse w-2/3" />
              </div>
            </div>
          ))
        ) : convsFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#48C9B0]/10 flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-[#48C9B0]" />
            </div>
            <h3 className="text-[#1D1E20] font-semibold text-lg mb-2">Sin mensajes aún</h3>
            <p className="text-[#6b7280] text-sm max-w-xs leading-relaxed">
              Aquí verás el historial de conversaciones cuando envíes tu primera campaña de WhatsApp.
            </p>
          </div>
        ) : (
          convsFiltradas.map((conv) => {
            const rsvp = rsvpConfig[conv.guest.rsvp_status] ?? rsvpConfig.pending;
            const preview = conv.lastMessage.direction === "sent"
              ? `Tú: ${conv.lastMessage.content}`
              : conv.lastMessage.content;

            return (
              <button
                key={conv.guest.id}
                onClick={() => setSeleccionada(conv)}
                className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-[#f3f4f6] hover:bg-[#f8fffe] transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-[#48C9B0]/15 flex items-center justify-center shrink-0">
                  <span className="text-[#1D9E75] font-semibold text-sm">
                    {conv.guest.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[#1D1E20] font-medium text-sm truncate">{conv.guest.name}</span>
                    <span className="text-[#9ca3af] text-xs shrink-0">{tiempoRelativo(conv.lastMessage.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#6b7280] text-xs truncate">{preview}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${rsvp.bg} ${rsvp.text}`}>
                      {rsvp.label}
                    </span>
                  </div>
                  {/* Etiqueta del evento */}
                  <span className="text-[10px] text-[#9ca3af] mt-0.5 block truncate">
                    {conv.event.name}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  // ── Vista chat ─────────────────────────────────────────────────────────────

  const Chat = ({ conv }: { conv: Conversation }) => {
    const rsvp = rsvpConfig[conv.guest.rsvp_status] ?? rsvpConfig.pending;

    const porFecha: { fecha: string; msgs: WaMessage[] }[] = [];
    conv.messages.forEach((msg) => {
      const fecha = new Date(msg.created_at).toDateString();
      const grupo = porFecha.find((g) => g.fecha === fecha);
      if (grupo) grupo.msgs.push(msg);
      else porFecha.push({ fecha, msgs: [msg] });
    });

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#e8e8e8] bg-white shrink-0">
          <button
            onClick={() => setSeleccionada(null)}
            className="lg:hidden p-1.5 -ml-1 rounded-lg hover:bg-[#f3f4f6] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#6b7280]" />
          </button>
          <div className="w-9 h-9 rounded-full bg-[#48C9B0]/15 flex items-center justify-center shrink-0">
            <span className="text-[#1D9E75] font-semibold text-sm">
              {conv.guest.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[#1D1E20] font-semibold text-sm truncate">{conv.guest.name}</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${rsvp.bg} ${rsvp.text}`}>
                {rsvp.label}
              </span>
            </div>
            <p className="text-[#9ca3af] text-xs">{conv.event.name}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-[#fafafa]">
          {porFecha.map(({ fecha, msgs }) => (
            <div key={fecha}>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-[#e8e8e8]" />
                <span className="text-xs text-[#9ca3af] font-medium px-2">{formatFechaChat(msgs[0].created_at)}</span>
                <div className="flex-1 h-px bg-[#e8e8e8]" />
              </div>
              {msgs.map((msg) => (
                <div key={msg.id} className={`flex mb-1.5 ${msg.direction === "sent" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                    msg.direction === "sent"
                      ? "bg-[#48C9B0]/20 rounded-tr-sm"
                      : "bg-white border border-[#e8e8e8] rounded-tl-sm shadow-sm"
                  }`}>
                    <p className="text-[#1D1E20] text-sm leading-relaxed break-words">{msg.content}</p>
                    <div className={`flex items-center gap-1 mt-1 ${msg.direction === "sent" ? "justify-end" : "justify-start"}`}>
                      <Clock className="w-2.5 h-2.5 text-[#9ca3af]" />
                      <span className="text-[10px] text-[#9ca3af]">{formatHora(msg.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div ref={chatBottomRef} />
        </div>

        <div className="px-4 py-3 border-t border-[#e8e8e8] bg-white shrink-0">
          <p className="text-center text-xs text-[#9ca3af]">El envío de mensajes estará disponible pronto</p>
        </div>
      </div>
    );
  };

  // ── Layout ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-white font-sans text-[#1D1E20]">

      {/* Header global */}
      <header className="shrink-0 border-b border-[#e8e8e8] bg-white">
        <div className="mx-auto flex h-14 max-w-full items-center justify-between px-4 sm:h-16 sm:px-6">
          <span className="shrink-0">
            <img src="/images/isotipo.svg" alt="Anfiora" className="h-11 w-11 sm:hidden" />
            <img src="/images/logo.svg" alt="Anfiora" className="hidden h-11 sm:block lg:h-14" />
          </span>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-xs text-[#999] transition hover:text-[#48C9B0]"
          >
            ← Mis eventos
          </button>
        </div>
      </header>

      {/* Cuerpo */}
      <div className="flex flex-1 overflow-hidden">

        {/* Lista */}
        <div className={`w-full lg:w-[320px] lg:border-r lg:border-[#e8e8e8] flex flex-col shrink-0 ${seleccionada ? "hidden lg:flex" : "flex"}`}>
          <Lista />
        </div>

        {/* Chat */}
        <div className={`flex-1 flex flex-col ${seleccionada ? "flex" : "hidden lg:flex"}`}>
          {seleccionada ? (
            <Chat conv={seleccionada} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-[#48C9B0]/10 flex items-center justify-center mb-4">
                <MessageCircle className="w-7 h-7 text-[#48C9B0]" />
              </div>
              <p className="text-[#1D1E20] font-medium mb-1">Selecciona una conversación</p>
              <p className="text-[#9ca3af] text-sm">Elige un invitado de la lista para ver el historial</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
