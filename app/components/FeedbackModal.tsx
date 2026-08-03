"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/app/components/ui/Modal";
import { FEEDBACK_TYPES, type FeedbackType } from "@/lib/feedback";

type Status = "idle" | "sending" | "sent" | "error";

export default function FeedbackModal() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState("");
  const [type, setType] = useState<FeedbackType>("sugerencia");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    const handler = () => {
      setPage(window.location.pathname);
      setType("sugerencia");
      setMessage("");
      setStatus("idle");
      setOpen(true);
    };
    window.addEventListener("anfiora:open-feedback", handler);
    return () => window.removeEventListener("anfiora:open-feedback", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  const submit = async () => {
    if (!message.trim() || status === "sending") return;
    setStatus("sending");
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) { setStatus("error"); return; }
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ type, message, page }),
      });
      if (!res.ok) { setStatus("error"); return; }
      setStatus("sent");
      setTimeout(() => setOpen(false), 1500);
    } catch {
      setStatus("error");
    }
  };

  return (
    <Modal open={open} onClose={close} size="md">
      <Modal.Header title="Enviar feedback" />
      {status === "sent" ? (
        <Modal.Body>
          <p className="py-6 text-center text-sm text-[#2a7a50]">Gracias, recibimos tu mensaje.</p>
        </Modal.Body>
      ) : (
        <>
          <Modal.Body>
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

            <label className="mb-1 block text-xs font-medium text-[#666]">Cuentanos</label>
            <textarea
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Escribe tu sugerencia, nota o error..."
              className="w-full resize-none rounded-lg border border-[#e0e0e0] px-3 py-2 text-base text-[#1D1E20] outline-none focus:border-[#48C9B0]"
            />

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
