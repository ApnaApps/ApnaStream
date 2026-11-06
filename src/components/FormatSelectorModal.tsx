import React, { useState } from 'react';
import { 
  X, Download, HardDrive, Play, Sparkles, Check, 
  Film, Music, ChevronDown, ChevronUp,
  FileText, Copy, Loader2
} from 'lucide-react';
import { PLATFORMS } from '../utils/platformHelper';

export interface VideoFormat {
  id: string;
  quality: string;
  resolution: string;
  fps: number;
  container: string;
  videoCodec: string;
  audioCodec: string;
  bitrate: string;
  approxSizeMb: number;
  isHighRes: boolean;
  badge: string;
  type: 'video' | 'audio';
  downloadUrl?: string;
}

export interface VideoInfo {
  id: string;
  url: string;
  title: string;
  channel: string;
  thumbnail: string;
  views: string;
  duration: string;
  durationSeconds: number;
  category: string;
  description: string;
  sampleVideoUrl?: string;
  captions?: Array<{ lang: string; label: string; content: string }>;
  formats: VideoFormat[];
  platform?: 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'pinterest';
}

interface FormatSelectorModalProps {
  video: VideoInfo;
  isOpen: boolean;
  onClose: () => void;
  onStartDownload: (format: VideoFormat, target: 'vault' | 'device', includeSubtitles: boolean) => void;
  onPreview: (video: VideoInfo, format: VideoFormat) => void;
}

export const FormatSelectorModal: React.FC<FormatSelectorModalProps> = ({
  video,
  isOpen,
  onClose,
  onStartDownload,
  onPreview
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'subtitles'>('video');
  const [selectedFormatId, setSelectedFormatId] = useState<string>(
    video.formats.find(f => f.id === '2160p-60')?.id || video.formats[0]?.id || ''
  );
  const [includeSubtitles, setIncludeSubtitles] = useState<boolean>(true);
  const [showFullDesc, setShowFullDesc] = useState<boolean>(false);
  
  const [transcriptData, setTranscriptData] = useState<any>(null);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  const loadTranscript = async () => {
    if (transcriptData || isLoadingTranscript) return;
    setIsLoadingTranscript(true);
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: video.title,
          channel: video.channel,
          description: video.description,
          durationSeconds: video.durationSeconds,
          existingCaptions: video.captions?.[0]?.content
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTranscriptData(data);
      }
    } catch (err) {
      console.warn('Transcript fetch error:', err);
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  const videoFormats = video.formats.filter(f => f.type === 'video');
  const audioFormats = video.formats.filter(f => f.type === 'audio');
  
  const selectedFormat = video.formats.find(f => f.id === selectedFormatId) || video.formats[0];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-3xl bg-white dark:bg-zinc-900 border-t sm:border border-zinc-200 dark:border-zinc-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/60 shrink-0">
          <div className="flex items-center gap-2">
            {(() => {
              const platKey = video.platform || 'youtube';
              const plat = PLATFORMS[platKey];
              return plat ? (
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${plat.accentClass}`}>
                  {plat.icon({ className: 'w-4 h-4' })}
                  <span>{plat.name}</span>
                </div>
              ) : null;
            })()}
            <span aria-hidden="true" className="text-zinc-400">·</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Select Format</span>
          </div>

          <button
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1">
          {/* Video Card Summary */}
          <div className="p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 flex flex-col sm:flex-row gap-4 items-start">
            <div className="relative w-full sm:w-52 aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex-shrink-0 group">
              {video.thumbnail ? (
                <img 
                  src={video.thumbnail} 
                  alt={video.title} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-500" />
              )}
              <div className="absolute bottom-2 right-2 bg-black/85 text-[11px] font-mono tabular-nums text-white px-2 py-0.5 rounded-md">
                {video.duration}
              </div>

              <button
                onClick={() => onPreview(video, selectedFormat)}
                className="absolute inset-0 bg-black/35 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
              >
                <div className="w-10 h-10 rounded-full bg-rose-600 flex items-center justify-center shadow-lg">
                  <Play className="w-4 h-4 ml-0.5 fill-white" />
                </div>
              </button>
            </div>

            <div className="flex-1 min-w-0 space-y-1.5">
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white line-clamp-2 leading-snug">
                {video.title}
              </h2>

              <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">{video.channel}</span>
                {video.views && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{video.views}</span>
                  </>
                )}
              </div>

              {video.description && (
                <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed pt-0.5">
                  <p className={showFullDesc ? '' : 'line-clamp-2'}>
                    {video.description}
                  </p>
                  {video.description.length > 120 && (
                    <button
                      onClick={() => setShowFullDesc(!showFullDesc)}
                      className="text-rose-600 dark:text-rose-400 font-medium mt-1 flex items-center gap-1"
                    >
                      {showFullDesc ? (
                        <>Show less <ChevronUp className="w-3 h-3" /></>
                      ) : (
                        <>Show more <ChevronDown className="w-3 h-3" /></>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tab Selection */}
          <div className="px-4 sm:px-6 pt-3 flex items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
            <button
              onClick={() => {
                setActiveTab('video');
                if (videoFormats.length > 0) setSelectedFormatId(videoFormats[0].id);
              }}
              className={`pb-2.5 text-xs sm:text-sm font-semibold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'video'
                  ? 'border-rose-600 text-rose-600 dark:border-rose-500 dark:text-white'
                  : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Film className="w-4 h-4" />
              <span>Video ({videoFormats.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('audio');
                if (audioFormats.length > 0) setSelectedFormatId(audioFormats[0].id);
              }}
              className={`pb-2.5 text-xs sm:text-sm font-semibold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'audio'
                  ? 'border-rose-600 text-rose-600 dark:border-rose-500 dark:text-white'
                  : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Music className="w-4 h-4" />
              <span>Audio ({audioFormats.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('subtitles');
                if (!transcriptData) loadTranscript();
              }}
              className={`pb-2.5 text-xs sm:text-sm font-semibold transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'subtitles'
                  ? 'border-rose-600 text-rose-600 dark:border-rose-500 dark:text-white'
                  : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Transcript</span>
            </button>
          </div>

          {/* Tab Body */}
          <div className="p-4 sm:p-6">
            {(activeTab === 'video' || activeTab === 'audio') && (
              <div className="grid grid-cols-1 gap-2.5">
                {(activeTab === 'video' ? videoFormats : audioFormats).map((fmt) => {
                  const isSelected = selectedFormatId === fmt.id;
                  return (
                    <div
                      key={fmt.id}
                      onClick={() => setSelectedFormatId(fmt.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-rose-50/80 dark:bg-rose-950/35 border-rose-500'
                          : 'bg-zinc-50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-rose-600 bg-rose-600 text-white' : 'border-zinc-400 dark:border-zinc-700'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                              {fmt.quality}
                            </span>
                            <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400 font-semibold">
                              {fmt.badge}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                            <span>{fmt.type === 'video' ? fmt.resolution : `${fmt.container} Audio`}</span>
                            <span aria-hidden="true">·</span>
                            <span>{fmt.type === 'video' ? fmt.videoCodec : fmt.audioCodec}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs sm:text-sm font-mono tabular-nums font-bold text-zinc-900 dark:text-white">
                          ~{fmt.approxSizeMb} MB
                        </div>
                        <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                          {fmt.container}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'subtitles' && (
              <div className="space-y-4">
                <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-rose-500" />
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                        Video Transcript
                      </h4>
                    </div>

                    {transcriptData && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const text = transcriptData.segments.map((s: any) => `[${s.time}] ${s.text}`).join('\n\n');
                            navigator.clipboard.writeText(text);
                            setCopiedText(true);
                            setTimeout(() => setCopiedText(false), 2000);
                          }}
                          className="px-2.5 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 rounded-lg flex items-center gap-1"
                        >
                          {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedText ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {isLoadingTranscript ? (
                    <div className="py-6 flex flex-col items-center justify-center text-center text-zinc-500 space-y-2">
                      <Loader2 className="w-5 h-5 animate-spin text-rose-500" />
                      <span className="text-xs">Generating transcript...</span>
                    </div>
                  ) : transcriptData ? (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
                      {transcriptData.segments.map((seg: any, idx: number) => (
                        <div key={idx} className="p-2 rounded-lg bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/60 flex items-start gap-2.5">
                          <span className="font-mono text-[11px] text-rose-600 dark:text-rose-400 font-semibold flex-shrink-0">
                            {seg.time}
                          </span>
                          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                            {seg.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={loadTranscript}
                      className="w-full py-2.5 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-800 dark:text-zinc-200 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5 text-rose-500" />
                      <span>Generate Transcript</span>
                    </button>
                  )}
                </div>

                <label className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSubtitles}
                    onChange={(e) => setIncludeSubtitles(e.target.checked)}
                    className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-semibold text-zinc-900 dark:text-white">Include Captions in Offline Vault</span>
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions (Mobile Ergonomic Buttons) */}
        <div className="p-4 sm:px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-zinc-600 dark:text-zinc-400 hidden sm:block">
            Selected: <span className="font-semibold text-zinc-900 dark:text-white">{selectedFormat.quality}</span> (~{selectedFormat.approxSizeMb} MB)
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => onPreview(video, selectedFormat)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white flex items-center justify-center gap-1.5 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>

            <button
              onClick={() => onStartDownload(selectedFormat, 'device', includeSubtitles)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </button>

            <button
              onClick={() => onStartDownload(selectedFormat, 'vault', includeSubtitles)}
              className="col-span-2 sm:col-span-1 min-h-[44px] px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors shadow-md shadow-rose-600/25"
            >
              <HardDrive className="w-4 h-4" />
              <span>Save to Offline Vault</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
