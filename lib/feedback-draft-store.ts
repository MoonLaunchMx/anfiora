import { buildDraftRecord, parseDraft, type FeedbackDraft } from '@/lib/feedback-draft'

const DB_NAME = 'anfiora-feedback'
const DB_VERSION = 1
const STORE = 'draft'
const KEY = 'current'

// IndexedDB y no localStorage: aqui viajan las imagenes, que localStorage no
// guarda sin convertirlas a texto y reventar su cuota de ~5 MB.
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = work(tx.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        tx.oncomplete = () => db.close()
      })
  )
}

// Perder un borrador nunca debe romper el formulario: si el navegador no deja
// guardar (modo privado, cuota llena), se sigue de largo en silencio.
export async function saveDraft(draft: FeedbackDraft): Promise<void> {
  try {
    const record = buildDraftRecord(draft, Date.now())
    await run('readwrite', store => store.put(record, KEY))
  } catch {}
}

export async function loadDraft(): Promise<FeedbackDraft | null> {
  try {
    const record = await run<unknown>('readonly', store => store.get(KEY))
    return parseDraft(record, Date.now())
  } catch {
    return null
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await run('readwrite', store => store.delete(KEY))
  } catch {}
}
