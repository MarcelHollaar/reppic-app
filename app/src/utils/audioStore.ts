export type AudioBlobRecord = {
  uniqueId: string;
  userId: string;
  deviceId?: string;
  deviceType?: string;
  status?: string;
  title?: string;
  customerName?: string;
  notes?: string;
  timestamp?: number;
  duration?: number;
  meetingDate?: string;
  startTime?: string;
  endTime?: string;
  conversationId?: string | number;
  uploadStatus?: 'failed' | 'success' | 'twinAiFailed' | string;
  retryCount?: number;
  lastRetryAt?: number;
  firstFailedAt?: number;
  blob?: Blob | null;
};

const DB_NAME = 'mtp-audio';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject(new Error('IndexedDB not available'));
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'uniqueId' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('conversationId', 'conversationId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open DB'));
  });
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => void): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      let result: any;
      tx.oncomplete = () => resolve(result as T);
      tx.onerror = () => reject(tx.error);
      // Allow fn to set result via assigning to local
      const setResult = (v: any) => { result = v; };
      (fn as any)(store, setResult);
    } catch (e) {
      reject(e);
    }
  });
}

export async function putRecord(record: AudioBlobRecord): Promise<void> {
  return withStore<void>('readwrite', (store) => {
    const normalized: AudioBlobRecord = {
      ...record,
      conversationId:
        record.conversationId !== undefined && record.conversationId !== null
          ? String(record.conversationId)
          : undefined,
    };
    store.put(normalized);
  });
}

export async function getRecord(uniqueId: string): Promise<AudioBlobRecord | undefined> {
  return withStore<AudioBlobRecord | undefined>('readonly', (store, setResult) => {
    const req = store.get(uniqueId);
    req.onsuccess = () => setResult(req.result as AudioBlobRecord | undefined);
  });
}

export async function getByConversationId(conversationId: string | number): Promise<AudioBlobRecord | undefined> {
  return withStore<AudioBlobRecord | undefined>('readonly', (store, setResult) => {
    const idx = store.index('conversationId');
    const key = String(conversationId);
    const req = idx.get(key);
    req.onsuccess = () => setResult(req.result as AudioBlobRecord | undefined);
  });
}

export async function listByUser(userId: string): Promise<AudioBlobRecord[]> {
  return withStore<AudioBlobRecord[]>('readonly', (store, setResult) => {
    const idx = store.index('userId');
    const req = idx.getAll(userId);
    req.onsuccess = () => setResult(req.result as AudioBlobRecord[]);
  });
}

export async function deleteByUniqueId(uniqueId: string): Promise<void> {
  return withStore<void>('readwrite', (store) => {
    store.delete(uniqueId);
  });
}

export async function updateField(uniqueId: string, patch: Partial<AudioBlobRecord>): Promise<void> {
  const existing = await getRecord(uniqueId);
  if (!existing) return;
  await putRecord({ ...existing, ...patch });
}

export async function deleteByIdMatch(id: string | number, key: 'uniqueId' | 'conversationId'): Promise<void> {
  if (key === 'uniqueId') {
    return deleteByUniqueId(String(id));
  }
  const rec = await getByConversationId(id);
  if (rec?.uniqueId) {
    await deleteByUniqueId(rec.uniqueId);
  }
}

/**
 * Finds the most recent paused blob for a user without a conversationId
 * Useful as fallback when conversationId wasn't set due to API call failure
 */
export async function getMostRecentPausedBlob(
  userId: string,
  deviceId?: string
): Promise<AudioBlobRecord | undefined> {
  return withStore<AudioBlobRecord | undefined>('readonly', (store, setResult) => {
    const idx = store.index('userId');
    const req = idx.getAll(userId);
    req.onsuccess = () => {
      const records = req.result as AudioBlobRecord[];
      // Filter for paused blobs without conversationId
      const pausedWithoutConversationId = records.filter(
        (rec) =>
          rec.status === 'pause' &&
          (!rec.conversationId || rec.conversationId === '' || rec.conversationId === 'undefined')
      );
      
      // Optionally filter by deviceId if provided
      const filtered = deviceId
        ? pausedWithoutConversationId.filter((rec) => rec.deviceId === deviceId)
        : pausedWithoutConversationId;
      
      // Sort by timestamp (most recent first) and return the first one
      const sorted = filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setResult(sorted[0]);
    };
  });
}

export function readLocalStorageAudioBlobs(): any[] {
  try {
    return JSON.parse(localStorage.getItem('audio_blobs') || '[]');
  } catch {
    return [];
  }
}
