"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Info, Monitor, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/app/components/ui/Modal";
import {
  FEEDBACK_TYPES,
  MAX_IMAGES,
  validateImages,
  type FeedbackType,
} from "@/lib/feedback";
import { prepareImage } from "@/lib/feedback-image";
import { canCaptureScreen, captureScreen, isCaptureCancelled } from "@/lib/feedback-capture";
import { clearDraft, loadDraft, saveDraft } from "@/lib/feedback-draft-store";

type Status = "idle" | "sending" | "sent" | "error";
type Attachment = { file: File; preview: string; compressed: boolean };

export default function FeedbackModal() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState("");
  const [type, setType] = useState<FeedbackType>("sugerencia");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [images, setImages] = useState<Attachment[]>([]);
  const [imageError, setImageError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [canCapture, setCanCapture] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setCanCapture(canCaptureScreen()); }, []);

  const clearImages = useCallback((list: Attachment[]) => {
    list.forEach((a) => URL.revokeObjectURL(a.preview));
  }, []);

  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const handler = () => {
      setPage(window.location.pathname);
      setStatus("idle");
      setImageError("");
      setDragging(false);
      setImages((prev) => { clearImages(prev); return []; });
      setType("sugerencia");
      setMessage("");
      setRestored(false);
      setOpen(true);

      void loadDraft().then((draft) => {
        if (!draft) return;
        setType(draft.type);
        setMessage(draft.message);
        setImages(draft.images.map((i) => {
          const file = new File([i.blob], i.name, { type: i.type });
          return { file, preview: URL.createObjectURL(file), compressed: i.compressed };
        }));
        setRestored(true);
      });
    };
    window.addEventListener("anfiora:open-feedback", handler);
    return () => window.removeEventListener("anfiora:open-feedback", handler);
  }, [clearImages]);

  // Se guarda mientras escribe: cerrar el modal por accidente no debe costarle el
  // reporte, y volver a tomar tres capturas es lo que hace que ya no lo mande.
  useEffect(() => {
    if (!open || status === "sent") return;
    const id = setTimeout(() => {
      const payload = images.map((a) => ({
        blob: a.file, name: a.file.name, type: a.file.type, compressed: a.compressed,
      }));
      if (message.trim() || payload.length > 0) {
        void saveDraft({ type, message, images: payload });
      } else {
        void clearDraft();
      }
    }, 400);
    return () => clearTimeout(id);
  }, [open, status, type, message, images]);

  const discardDraft = () => {
    void clearDraft();
    setImages((prev) => { clearImages(prev); return []; });
    setMessage("");
    setType("sugerencia");
    setImageError("");
    setRestored(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const addFiles = useCallback(async (incoming: File[]) => {
    if (incoming.length === 0) return;
    setImageError("");

    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      setImageError(`Solo puedes adjuntar ${MAX_IMAGES} imágenes. Quita una para agregar otra.`);
      return;
    }
    if (incoming.length > room) {
      setImageError(`Solo caben ${room} más. Agregamos las primeras.`);
    }

    // Se comprime antes de validar: una foto de celular de 6 MB si cabe una vez encogida.
    const prepared = await Promise.all(incoming.slice(0, room).map(prepareImage));
    const check = validateImages(prepared.map((p) => ({ type: p.file.type, size: p.file.size })));
    if (!check.ok) {
      setImageError(check.error);
      return;
    }

    setImages((prev) => [
      ...prev,
      ...prepared.map((p) => ({
        file: p.file,
        preview: URL.createObjectURL(p.file),
        compressed: p.compressed,
      })),
    ]);
  }, [images.length]);

  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) return;
      e.preventDefault();
      void addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, addFiles]);

  const imagesRef = useRef<Attachment[]>([]);
  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => () => clearImages(imagesRef.current), [clearImages]);

  // El modal se desmonta mientras corre la captura para no salir en su propia foto.
  // El texto ya escrito vive en este componente, que no se desmonta, asi que vuelve intacto.
  const takeScreenshot = async () => {
    setImageError("");
    if (images.length >= MAX_IMAGES) {
      setImageError(`Solo puedes adjuntar ${MAX_IMAGES} imágenes. Quita una para agregar otra.`);
      return;
    }
    setCapturing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 220));
      const shot = await captureScreen();
      await addFiles([shot]);
    } catch (err) {
      if (!isCaptureCancelled(err)) {
        setImageError("No se pudo capturar la pantalla. Tómala tú y pégala con Ctrl+V.");
      }
    } finally {
      setCapturing(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
    setImageError("");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) {
      setImageError("Ese archivo no es una imagen. Adjunta PNG, JPG o WEBP.");
      return;
    }
    void addFiles(files);
  };

  const close = () => setOpen(false);

  const submit = async () => {
    if (!message.trim() || status === "sending") return;
    setStatus("sending");
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) { setStatus("error"); return; }

      const body = new FormData();
      body.append("type", type);
      body.append("message", message);
      body.append("page", page);
      body.append("viewport", String(window.innerWidth));
      images.forEach((a) => body.append("images", a.file, a.file.name));

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}` },
        body,
      });
      if (!res.ok) { setStatus("error"); return; }
      void clearDraft();
      setRestored(false);
      setStatus("sent");
      // Lo justo para que se registre el acuse: quien acaba de enviar ya sabe
      // lo que hizo, y esperar de mas hace sentir lento un envio que fue rapido.
      setTimeout(() => setOpen(false), 900);
    } catch {
      setStatus("error");
    }
  };

  const full = images.length >= MAX_IMAGES;
  const anyCompressed = images.some((a) => a.compressed);

  return (
    <Modal open={open && !capturing} onClose={close} size="md">
      <Modal.Header title="Enviar feedback" />
      {status === "sent" ? (
        <Modal.Body>
          <p className="py-6 text-center text-sm text-[#2a7a50]">Gracias, recibimos tu mensaje.</p>
        </Modal.Body>
      ) : (
        <>
          <Modal.Body>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`rounded-lg transition ${dragging ? "ring-2 ring-[#48C9B0] ring-offset-4 ring-offset-white" : ""}`}
            >
              <label className="mb-1 block text-xs font-medium text-[#666]">Tipo</label>
              <div className="mb-3 flex gap-2">
                {FEEDBACK_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                      type === t.value
                        ? "border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]"
                        : "border-[#e0e0e0] text-[#888] hover:bg-[#f8f8f8]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {restored && (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-2.5 py-1.5">
                  <span className="text-[11px] text-[#666]">
                    Recuperamos tu reporte sin enviar.
                  </span>
                  <button
                    type="button"
                    onClick={discardDraft}
                    className="shrink-0 text-[11px] font-medium text-[#999] underline underline-offset-2 transition hover:text-[#1D1E20]"
                  >
                    Descartar
                  </button>
                </div>
              )}

              <label className="mb-1 block text-xs font-medium text-[#666]">Cuéntanos</label>
              <textarea
                autoFocus
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Escribe tu sugerencia, nota o error..."
                className="w-full resize-none rounded-lg border border-[#e0e0e0] px-3 py-2 text-base text-[#1D1E20] outline-none focus:border-[#48C9B0]"
              />

              <div className="mt-3 flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={full}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#666] transition hover:bg-[#f8f8f8] hover:text-[#1D1E20] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
                    >
                      <ImageIcon size={15} />
                      Adjuntar imagen
                    </button>
                    {canCapture && (
                      <button
                        type="button"
                        onClick={takeScreenshot}
                        disabled={full}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#666] transition hover:bg-[#f8f8f8] hover:text-[#1D1E20] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
                      >
                        <Monitor size={15} />
                        Capturar pantalla
                      </button>
                    )}
                    <span className="hidden text-[11px] text-[#999] sm:inline">
                      o pega con Ctrl+V
                    </span>
                  </div>
                  <span className={`text-[11px] font-medium ${full ? "text-[#1a9e88]" : "text-[#999]"}`}>
                    {images.length === 0 ? `Hasta ${MAX_IMAGES} imágenes` : `${images.length} de ${MAX_IMAGES}`}
                  </span>
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={(e) => {
                    void addFiles(Array.from(e.target.files ?? []));
                    e.target.value = "";
                  }}
                  className="hidden"
                />

                {imageError && (
                  <p className="rounded-lg border border-[#f3d0d0] bg-[#fff5f5] px-2.5 py-1.5 text-[11px] text-[#cc3333]">
                    {imageError}
                  </p>
                )}

                {images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {images.map((a, i) => (
                      <div key={a.preview} className="relative aspect-[4/3] overflow-hidden rounded-lg border border-[#e0e0e0] bg-[#f8f8f8]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.preview} alt={a.file.name} className="h-full w-full object-cover" />
                        {a.compressed && (
                          <span className="absolute bottom-1 left-1 rounded bg-[#1D1E20]/75 px-1.5 py-0.5 text-[9px] font-medium text-white">
                            comprimida
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          aria-label={`Quitar ${a.file.name}`}
                          className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-[#1D1E20]/80 text-white transition hover:bg-[#1D1E20]"
                        >
                          <X size={11} strokeWidth={2.6} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {anyCompressed && (
                  <p className="flex items-center gap-1.5 text-[11px] text-[#999]">
                    <Info size={13} className="shrink-0" />
                    Una imagen venía pesada y se redujo para enviarse.
                  </p>
                )}
              </div>
            </div>

            {status === "error" && (
              <p className="mt-2 text-xs text-[#cc3333]">No se pudo enviar. Intenta de nuevo.</p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <button
              onClick={submit}
              disabled={!message.trim() || status === "sending"}
              className="w-full rounded-lg bg-[#48C9B0] py-2.5 text-sm font-semibold text-white transition hover:bg-[#3db39d] disabled:opacity-50"
            >
              {status === "sending" ? "Enviando..." : "Enviar"}
            </button>
          </Modal.Footer>
        </>
      )}
    </Modal>
  );
}
