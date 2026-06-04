'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, FileSpreadsheet, Upload } from 'lucide-react'

interface ImportStepsModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle: string
  step1Desc: string
  downloadLabel: string
  onDownload: () => void
  step2Desc: string
  selectLabel: string
  onSelectFile: () => void
  error?: string
}

export function ImportStepsModal({
  open, onClose, title, subtitle,
  step1Desc, downloadLabel, onDownload,
  step2Desc, selectLabel, onSelectFile, error,
}: ImportStepsModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="import-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1D1E20]">{title}</h2>
              <button onClick={onClose} className="text-[#aaa] transition hover:text-[#555]"><X size={18} /></button>
            </div>
            <p className="mb-5 text-xs text-[#888]">{subtitle}</p>

            <div className="mb-5">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#48C9B0] text-[11px] font-bold text-white">1</span>
                <span className="text-sm font-semibold text-[#1D1E20]">Descarga la plantilla</span>
              </div>
              <p className="mb-2 ml-7 text-xs leading-relaxed text-[#666]">{step1Desc}</p>
              <button onClick={onDownload}
                className="ml-7 flex items-center gap-1.5 rounded-lg border border-[#48C9B0] px-4 py-2 text-xs font-medium text-[#1a9e88] transition hover:bg-[#f0fdfb]">
                <FileSpreadsheet size={14} /> {downloadLabel}
              </button>
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#48C9B0] text-[11px] font-bold text-white">2</span>
                <span className="text-sm font-semibold text-[#1D1E20]">Sube tu archivo</span>
              </div>
              <p className="mb-2 ml-7 text-xs leading-relaxed text-[#666]">{step2Desc}</p>
              {error && (
                <div className="mb-2 ml-7 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2 text-xs text-[#cc3333]">{error}</div>
              )}
              <button onClick={onSelectFile}
                className="ml-7 flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3ab89f]">
                <Upload size={14} /> {selectLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
