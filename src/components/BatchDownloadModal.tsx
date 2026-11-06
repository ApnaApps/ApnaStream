import React, { useState } from 'react';
import { X, Layers, Download, Check, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { downloadManager } from '../utils/downloadEngine';
import { VideoInfo, VideoFormat } from './FormatSelectorModal';
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

  const sampleUrls = [
    'https://www.instagram.com/reels/Db8b8L_MQ1-/',
    'https://www.youtube.com/watch?v=LXb3EKWsInQ',
    'https://www.tiktok.com/@natgeo/video/7339482718919283999',
    'https://fb.watch/r8aBcDeFgH/',
    'https://www.pinterest.com/pin/123456789012345678/'
  ];

  const handleLoadSampleBatch = () => {
    setUrlsText(sampleUrls.join('\n'));
  };

  const handleStartBatch = async () => {
    const rawLines = urlsText.split('\n').map(l => l.trim()).filter(Boolean);
    if (rawLines.length === 0) {
      setStatusMessage('Please enter at least one media URL from YouTube, TikTok, Instagram, Facebook, or Pinterest.');
      return;
    }

    setIsProcessing(true);
    setStatusMessage(`Inspecting and queuing ${rawLines.length} links...`);

    let addedCount = 0;

    for (let i = 0; i < rawLines.length; i++) {
      const url = rawLines[i];
      try {
        setStatusMessage(`Resolving media ${i + 1} of ${rawLines.length}...`);
        const video: VideoInfo = await inspectMediaUrl(url);

        // Select matching format
        let targetFormat = video.formats.find(f => {
          if (selectedPreset === '4K') return f.id.includes('2160') || f.id.includes('hd') || f.id.includes('1080');
          if (selectedPreset === 'audio') return f.type === 'audio';
          return f.id.includes('1080') || f.type === 'video';
        }) || video.formats[0];

        // Add to download queue
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

        addedCount++;
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-rose-500" />
              <span>Batch Video & Audio Downloader</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Paste multiple links from YouTube, TikTok, Instagram, Facebook, or Pinterest to queue and download at once.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* URLs Textarea */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-zinc-300">
              Media Links (One URL per line):
            </label>
            <button
              onClick={handleLoadSampleBatch}
              className="text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load 5 Multi-Platform Samples</span>
            </button>
          </div>

          <textarea
            rows={5}
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            placeholder={"https://www.youtube.com/watch?v=...\nhttps://www.tiktok.com/@user/video/...\nhttps://www.instagram.com/reel/...\nhttps://fb.watch/...\nhttps://www.pinterest.com/pin/..."}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-rose-500 leading-relaxed resize-none"
          />
        </div>

        {/* Default Format Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-300">
            Batch Quality Preset:
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedPreset('4K')}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedPreset === '4K'
                  ? 'bg-rose-950/60 border-rose-500 text-white'
                  : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="font-bold text-xs">4K Ultra HD</div>
              <div className="text-[11px] text-zinc-400 mt-0.5">2160p 60fps MP4</div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPreset('1080p')}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedPreset === '1080p'
                  ? 'bg-rose-950/60 border-rose-500 text-white'
                  : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="font-bold text-xs">1080p Full HD</div>
              <div className="text-[11px] text-zinc-400 mt-0.5">Best Compatibility</div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPreset('audio')}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedPreset === 'audio'
                  ? 'bg-rose-950/60 border-rose-500 text-white'
                  : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="font-bold text-xs">MP3 Audio</div>
              <div className="text-[11px] text-zinc-400 mt-0.5">320 kbps Master</div>
            </button>
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 flex items-center gap-2">
            {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />}
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <span className="text-[11px] text-zinc-500 font-mono">
            Auto-saves to IndexedDB Offline Vault
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleStartBatch}
              disabled={isProcessing}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-xs font-bold text-white rounded-xl transition-all shadow-lg shadow-rose-950/50 flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Queue All Downloads</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
