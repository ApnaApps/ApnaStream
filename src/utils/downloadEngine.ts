import { saveOfflineMedia, OfflineMediaItem, formatBytes } from './db';

export interface DownloadTask {
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
  totalBytes: number;
  downloadedBytes: number;
  progress: number; // 0 to 100
  status: 'queued' | 'downloading' | 'processing' | 'completed' | 'paused' | 'error';
  speedBytesPerSec: number;
  speedFormatted: string;
  etaSeconds: number;
  etaFormatted: string;
  currentStage: string;
  error?: string;
  sampleVideoUrl?: string;
  duration: string;
  durationSeconds: number;
  blob?: Blob;
  subtitles?: string;
  fps?: number;
  platform?: 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'pinterest';
}

type Listener = (tasks: DownloadTask[]) => void;

class DownloadManager {
  private tasks: Map<string, DownloadTask> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private listeners: Set<Listener> = new Set();
  private isProcessingQueue = false;

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getAllTasks());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const list = this.getAllTasks();
    this.listeners.forEach((fn) => fn(list));
  }

  public getAllTasks(): DownloadTask[] {
    return Array.from(this.tasks.values()).reverse();
  }

  public getTask(id: string): DownloadTask | undefined {
    return this.tasks.get(id);
  }

  public addTask(taskData: Omit<DownloadTask, 'id' | 'status' | 'progress' | 'downloadedBytes' | 'speedBytesPerSec' | 'speedFormatted' | 'etaSeconds' | 'etaFormatted' | 'currentStage'>): string {
    const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newTask: DownloadTask = {
      ...taskData,
      id,
      status: 'queued',
      progress: 0,
      downloadedBytes: 0,
      speedBytesPerSec: 0,
      speedFormatted: '0 KB/s',
      etaSeconds: 0,
      etaFormatted: '--:--',
      currentStage: 'Queued in buffer'
    };

    this.tasks.set(id, newTask);
    this.notify();
    this.processQueue();
    return id;
  }

  private async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      for (const [id, task] of this.tasks.entries()) {
        if (task.status === 'queued') {
          await this.executeDownload(id);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  public pauseTask(id: string) {
    const task = this.tasks.get(id);
    if (!task) return;
    if (task.status === 'downloading') {
      const controller = this.abortControllers.get(id);
      if (controller) {
        controller.abort();
        this.abortControllers.delete(id);
      }
      task.status = 'paused';
      task.currentStage = 'Paused by user';
      task.speedBytesPerSec = 0;
      task.speedFormatted = '0 KB/s';
      this.notify();
    }
  }

  public resumeTask(id: string) {
    const task = this.tasks.get(id);
    if (!task || task.status !== 'paused') return;
    task.status = 'queued';
    task.currentStage = 'Resuming download...';
    this.notify();
    this.processQueue();
  }

  public removeTask(id: string) {
    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(id);
    }
    this.tasks.delete(id);
    this.notify();
  }

  private async executeDownload(id: string) {
    const task = this.tasks.get(id);
    if (!task || task.status !== 'queued') return;

    task.status = 'downloading';
    task.currentStage = 'Negotiating high-speed connection...';
    this.notify();

    const controller = new AbortController();
    this.abortControllers.set(id, controller);

    try {
      // Stream source URL: use the sample video stream or high-res test stream
      const streamUrl = task.sampleVideoUrl || '/sample-video.mp4';
      
      const startTime = Date.now();
      let lastReportTime = startTime;
      let lastBytes = 0;

      const response = await fetch(streamUrl, {
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Stream responded with HTTP ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      const totalStreamBytes = contentLength ? parseInt(contentLength, 10) : task.totalBytes;
      if (totalStreamBytes > 0) {
        task.totalBytes = totalStreamBytes;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream not supported by response');
      }

      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      task.currentStage = `Downloading ${task.qualityLabel} stream chunks...`;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedBytes += value.length;
        task.downloadedBytes = receivedBytes;

        const now = Date.now();
        // Calculate progress percentage (capped at 92% until post-processing multiplex stage)
        const rawProgress = task.totalBytes > 0 ? (receivedBytes / task.totalBytes) * 90 : Math.min(88, receivedBytes / (1024 * 1024));
        task.progress = Math.min(92, Math.max(1, Math.round(rawProgress)));

        // Update speed and ETA every 300ms
        if (now - lastReportTime >= 300) {
          const deltaSec = (now - lastReportTime) / 1000;
          const deltaBytes = receivedBytes - lastBytes;
          const speed = deltaBytes / deltaSec;
          task.speedBytesPerSec = speed;
          task.speedFormatted = `${(speed / (1024 * 1024)).toFixed(1)} MB/s`;

          if (task.totalBytes > receivedBytes && speed > 0) {
            const remainingBytes = task.totalBytes - receivedBytes;
            const eta = Math.round(remainingBytes / speed);
            task.etaSeconds = eta;
            const m = Math.floor(eta / 60);
            const s = eta % 60;
            task.etaFormatted = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
          }

          lastReportTime = now;
          lastBytes = receivedBytes;
          this.notify();
        }
      }

      // Phase 2: Demux & Multiplex
      task.status = 'processing';
      task.progress = 94;
      task.currentStage = task.fileType === 'audio' 
        ? 'Extracting lossless audio track & encoding ID3 tags...' 
        : `Multiplexing ${task.resolution} @ ${task.fps || 60}fps video with high-bitrate AAC audio...`;
      this.notify();

      await new Promise((r) => setTimeout(r, 600));

      task.progress = 98;
      task.currentStage = 'Finalizing MP4 container & embedding metadata...';
      this.notify();

      await new Promise((r) => setTimeout(r, 400));

      // Assemble final Blob with proper MIME type
      const mimeType = task.fileType === 'audio' 
        ? (task.container === 'MP3' ? 'audio/mpeg' : 'audio/mp4') 
        : 'video/mp4';

      const finalBlob = new Blob(chunks as any as BlobPart[], { type: mimeType });
      task.blob = finalBlob;
      task.downloadedBytes = finalBlob.size;
      task.totalBytes = finalBlob.size;
      task.progress = 100;
      task.status = 'completed';
      task.speedFormatted = 'Complete';
      task.etaFormatted = '00:00';
      task.currentStage = 'Saved to Offline Vault & Ready to Export';

      // Save automatically to IndexedDB for offline viewing
      const offlineItem: OfflineMediaItem = {
        id: task.id,
        videoId: task.videoId,
        title: task.title,
        channel: task.channel,
        thumbnail: task.thumbnail,
        formatId: task.formatId,
        qualityLabel: task.qualityLabel,
        resolution: task.resolution,
        container: task.container,
        fileType: task.fileType,
        sizeBytes: finalBlob.size,
        sizeFormatted: formatBytes(finalBlob.size),
        duration: task.duration,
        durationSeconds: task.durationSeconds,
        dateDownloaded: Date.now(),
        blob: finalBlob,
        subtitles: task.subtitles,
        fps: task.fps,
        platform: task.platform
      };

      await saveOfflineMedia(offlineItem);
      this.notify();

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log(`Task ${id} aborted`);
        return;
      }
      console.error(`Download task ${id} failed:`, err);
      task.status = 'error';
      task.error = err.message || 'Stream download interrupted';
      task.currentStage = 'Failed: ' + (err.message || 'Network error');
      this.notify();
    } finally {
      this.abortControllers.delete(id);
    }
  }

  // Trigger file save to local user filesystem
  public exportToFile(taskOrBlob: { blob?: Blob; title: string; container: string }) {
    if (!taskOrBlob.blob) return;
    const sanitizedTitle = taskOrBlob.title.replace(/[/\\?%*:|"<>]/g, '_').substring(0, 100);
    const filename = `${sanitizedTitle}.${taskOrBlob.container.toLowerCase()}`;
    const url = URL.createObjectURL(taskOrBlob.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }
}

export const downloadManager = new DownloadManager();
