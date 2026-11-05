/**
 * IndexedDB storage engine for offline video & audio persistence.
 * Allows storing large video blobs directly in the browser for true offline viewing.
 */

export interface OfflineMediaItem {
  id: string;
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  formatId: string;
  qualityLabel: string;
  resolution: string;
  container: string;
  fileType: 'video' | 'audio';
  sizeBytes: number;
  sizeFormatted: string;
  duration: string;
  durationSeconds: number;
  dateDownloaded: number;
  blob?: Blob;
  subtitles?: string;
  tags?: string[];
  fps?: number;
  sampleVideoUrl?: string;
  platform?: 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'pinterest';
}

const DB_NAME = 'NexusStreamVault';
const DB_VERSION = 1;
const STORE_NAME = 'offline_media';

let dbInstance: IDBDatabase | null = null;

export async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('videoId', 'videoId', { unique: false });
        store.createIndex('dateDownloaded', 'dateDownloaded', { unique: false });
        store.createIndex('fileType', 'fileType', { unique: false });
      }
    };

    request.onsuccess = (event: any) => {
      dbInstance = event.target.result as IDBDatabase;
      resolve(dbInstance);
    };

    request.onerror = (event: any) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };
  });
}

export async function saveOfflineMedia(item: OfflineMediaItem): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllOfflineMedia(): Promise<OfflineMediaItem[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const items = (request.result || []) as OfflineMediaItem[];
      // Sort newest first
      items.sort((a, b) => b.dateDownloaded - a.dateDownloaded);
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineMediaById(id: string): Promise<OfflineMediaItem | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineMedia(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getStorageQuota(): Promise<{
  usedBytes: number;
  quotaBytes: number;
  usedFormatted: string;
  quotaFormatted: string;
  percentUsed: number;
}> {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usedBytes = estimate.usage || 0;
      const quotaBytes = estimate.quota || 1024 * 1024 * 1024 * 10; // 10GB fallback
      const percentUsed = Math.min(100, Math.round((usedBytes / quotaBytes) * 100));

      return {
        usedBytes,
        quotaBytes,
        usedFormatted: formatBytes(usedBytes),
        quotaFormatted: formatBytes(quotaBytes),
        percentUsed
      };
    } catch (e) {
      console.warn('Storage estimate failed:', e);
    }
  }

  return {
    usedBytes: 0,
    quotaBytes: 10 * 1024 * 1024 * 1024,
    usedFormatted: '0 MB',
    quotaFormatted: '10 GB',
    percentUsed: 0
  };
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
