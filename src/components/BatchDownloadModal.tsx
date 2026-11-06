import React, { useState } from 'react';
import { X, Layers, Download, Loader2 } from 'lucide-react';
import { downloadManager } from '../utils/downloadEngine';
import { VideoInfo } from './FormatSelectorModal';
import { inspectMediaUrl } from '../utils/platformHelper';

interface BatchDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQueueStarted: () => void;
}

export const BatchDownloadModal: React.FC<BatchDownloadModalProps> = ({
  isOpen,
  onClose,
  onQueueStarted
}) => {
  if (!isOpen) return null;

  const [urlsText, setUrlsText] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<'4K' | '1080p' | 'audio'>('1080p');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const handleStartBatch = async () => {
    const rawLines = urlsText.split('\n').map(l => l.trim()).filter(Boolean);
    if (rawLines.length === 0) {
      setStatusMessage('Please paste at least one video link.');
      return;
    }

    setIsProcessing(true);
    setStatusMessage(`Fetching ${rawLines.length} links...`);

    for (let i = 0; i < rawLines.length; i++) {
      const url = rawLines[i];
      try {
        setStatusMessage(`Fetching media ${i + 1} of ${rawLines.length}...`);
        const video: VideoInfo = await inspectMediaUrl(url);

        const targetFormat = video.formats.find(f => {
          if (selectedPreset === '4K') return f.id.includes('2160') || f.id.includes('hd') || f.id.includes('1080');
          if (selectedPreset === 'audio') return f.type === 'audio';
          return f.id.includes('1080') || f.type === 'video';
        }) || video.formats[0];

        downloadManager.addTask({
          videoId: video.id,
          title: video.title,
          channel: video.channel,
          thumbnail: video.thumbnail,
          formatId: targetFormat.id,
          qualityLabel: targetFormat.quality,
          resolution: targetFormat.resolution,
          container: targetFormat.container,
          fileType: targetFormat.type,
          totalBytes: targetFormat.approxSizeMb * 1024 * 1024,
          sampleVideoUrl: targetFormat.downloadUrl || video.sampleVideoUrl,
          duration: video.duration,
          durationSeconds: video.durationSeconds || 300,
          fps: targetFormat.fps,
          platform: video.platform
        });
      } catch (err) {
        console.warn(`Failed to batch queue ${url}:`, err);
      }
    }

    setIsProcessing(false);
    onClose();
    onQueueStarted();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-white dark:bg-zinc-900 border-t sm:border border-zinc-200 dark:border-zinc-800 rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3.5">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-rose-500" />
              <span>Batch Download</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Paste multiple links (one per line) to download them together.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-800 dark:hover:text-white p-1.5 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* URLs Textarea */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
            Video Links (One per line):
          </label>
          <textarea
            rows={4}
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            placeholder={"https://www.instagram.com/reels/...\nhttps://www.tiktok.com/@user/video/...\nhttps://www.youtube.com/watch?v=..."}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-3 text-xs font-mono text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-rose-500 leading-relaxed resize-none"
          />
        </div>

        {/* Format Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
            Format Preset:
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedPreset('4K')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                selectedPreset === '4K'
                  ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-zinc-900 dark:text-white'
                  : 'bg-zinc-50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <div className="font-bold text-xs">Best HD</div>
              <div className="text-[11px] opacity-75">MP4 Video</div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPreset('1080p')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                selectedPreset === '1080p'
                  ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-zinc-900 dark:text-white'
                  : 'bg-zinc-50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <div className="font-bold text-xs">Standard</div>
              <div className="text-[11px] opacity-75">Fast MP4</div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPreset('audio')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                selectedPreset === 'audio'
                  ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-zinc-900 dark:text-white'
                  : 'bg-zinc-50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <div className="font-bold text-xs">MP3 Audio</div>
              <div className="text-[11px] opacity-75">320 kbps</div>
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
            {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />}
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleStartBatch}
            disabled={isProcessing}
            className="min-h-[40px] px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 text-xs font-bold text-white rounded-xl transition-all flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Fetching...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Start Batch</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
