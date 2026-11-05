import React, { useState } from 'react';
import { 
  X, Download, HardDrive, Play, Sparkles, Check, 
  Film, Music, Subtitles, ShieldCheck, ChevronDown, ChevronUp, FileVideo,
  FileText, Copy, Loader2
} from 'lucide-react';
import { formatBytes } from '../utils/db';
import { PLATFORMS, SocialPlatform } from '../utils/platformHelper';

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
  
  // Transcription state
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div 
        className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            {(() => {
              const platKey = video.platform || 'youtube';
              const plat = PLATFORMS[platKey];
              return plat ? (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${plat.bgClass} ${plat.borderClass} border ${plat.accentClass}`}>
                  {plat.icon({ className: 'w-3.5 h-3.5' })}
                  <span>{plat.name}</span>
                </div>
              ) : null;
            })()}
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span className="text-xs text-zinc-400">High-Resolution Pipeline</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Card Summary */}
        <div className="p-5 sm:p-6 border-b border-zinc-800 bg-zinc-950/30 flex flex-col sm:flex-row gap-5 items-start">
          <div className="relative w-full sm:w-60 aspect-video rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 flex-shrink-0 group">
            {video.thumbnail ? (
              <img 
                src={video.thumbnail} 
                alt={video.title} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-700" />
            )}
            <div className="absolute bottom-2 right-2 bg-black/85 text-[11px] font-mono text-zinc-200 px-2 py-0.5 rounded-md">
              {video.duration}
            </div>

            <button
              onClick={() => onPreview(video, selectedFormat)}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-xs font-semibold text-white"
            >
              <div className="w-10 h-10 rounded-full bg-rose-600 flex items-center justify-center shadow-lg">
                <Play className="w-4 h-4 ml-0.5 fill-white" />
              </div>
            </button>
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-white line-clamp-2 leading-snug">
              {video.title}
            </h2>

            {/* Clean metadata without pill boxes */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">{video.channel}</span>
              <span aria-hidden="true">·</span>
              <span>{video.views} views</span>
              <span aria-hidden="true">·</span>
              <span>{video.category}</span>
            </div>

            <div className="text-xs text-zinc-400 leading-relaxed">
              <p className={showFullDesc ? '' : 'line-clamp-2'}>
                {video.description}
              </p>
              {video.description && video.description.length > 120 && (
                <button
                  onClick={() => setShowFullDesc(!showFullDesc)}
                  className="text-rose-400 hover:text-rose-300 font-medium mt-1 flex items-center gap-1"
                >
                  {showFullDesc ? (
                    <>Show less <ChevronUp className="w-3 h-3" /></>
                  ) : (
                    <>Show more <ChevronDown className="w-3 h-3" /></>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="px-5 sm:px-6 pt-5 flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab('video');
                if (videoFormats.length > 0) setSelectedFormatId(videoFormats[0].id);
              }}
              className={`pb-3 text-xs sm:text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'video'
                  ? 'border-rose-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Film className="w-4 h-4" />
              <span>High-Resolution Video</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('audio');
                if (audioFormats.length > 0) setSelectedFormatId(audioFormats[0].id);
              }}
              className={`pb-3 text-xs sm:text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'audio'
                  ? 'border-rose-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Music className="w-4 h-4" />
              <span>Audio Only Extracts</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('subtitles');
                if (!transcriptData) loadTranscript();
              }}
              className={`pb-3 text-xs sm:text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'subtitles'
                  ? 'border-rose-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Transcript & Captions</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-5 sm:p-6 max-h-[380px] overflow-y-auto">
          {activeTab === 'video' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                <span>Select Quality Preset</span>
                <span>Container: MP4 (MPEG-4 Part 14)</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {videoFormats.map((fmt) => {
                  const isSelected = selectedFormatId === fmt.id;
                  return (
                    <div
                      key={fmt.id}
                      onClick={() => setSelectedFormatId(fmt.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-rose-950/40 border-rose-500/80 shadow-md shadow-rose-950/30'
                          : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-950'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-rose-500 bg-rose-600 text-white' : 'border-zinc-700'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">
                              {fmt.quality}
                            </span>
                            {fmt.isHighRes && (
                              <span className="text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">
                                {fmt.badge}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
                            <span>{fmt.resolution} @ {fmt.fps}fps</span>
                            <span aria-hidden="true">·</span>
                            <span>{fmt.videoCodec}</span>
                            <span aria-hidden="true">·</span>
                            <span>{fmt.audioCodec}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-mono font-bold text-white">
                          ~{fmt.approxSizeMb} MB
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400">
                          {fmt.bitrate}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                <span>Select Audio Extract Quality</span>
                <span>Optimized for Music & Podcasts</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {audioFormats.map((fmt) => {
                  const isSelected = selectedFormatId === fmt.id;
                  return (
                    <div
                      key={fmt.id}
                      onClick={() => setSelectedFormatId(fmt.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-rose-950/40 border-rose-500/80 shadow-md shadow-rose-950/30'
                          : 'bg-zinc-950/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-950'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-rose-500 bg-rose-600 text-white' : 'border-zinc-700'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">
                              {fmt.quality}
                            </span>
                            <span className="text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded">
                              {fmt.badge}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
                            <span>{fmt.container} Container</span>
                            <span aria-hidden="true">·</span>
                            <span>{fmt.audioCodec}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-mono font-bold text-white">
                          ~{fmt.approxSizeMb} MB
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400">
                          {fmt.bitrate}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'subtitles' && (
            <div className="space-y-4">
              {/* AI Transcript & Chapters Section */}
              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-rose-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                      Synchronized Speech-to-Text Transcript
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    {transcriptData && (
                      <>
                        <button
                          onClick={() => {
                            const text = transcriptData.segments.map((s: any) => `[${s.time}] ${s.speaker || 'Speaker'}: ${s.text}`).join('\n\n');
                            navigator.clipboard.writeText(text);
                            setCopiedText(true);
                            setTimeout(() => setCopiedText(false), 2000);
                          }}
                          className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-semibold text-zinc-300 hover:text-white rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedText ? 'Copied' : 'Copy Text'}</span>
                        </button>

                        <button
                          onClick={() => {
                            const text = `# ${video.title}\n\nSummary:\n${transcriptData.summary}\n\n${transcriptData.segments.map((s: any) => `[${s.time}] ${s.text}`).join('\n\n')}`;
                            const blob = new Blob([text], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${video.title.substring(0, 30)}_transcript.txt`;
                            a.click();
                          }}
                          className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-semibold text-zinc-300 hover:text-white rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download .TXT</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isLoadingTranscript ? (
                  <div className="py-8 flex flex-col items-center justify-center text-center text-zinc-400 space-y-2">
                    <Loader2 className="w-5 h-5 animate-spin text-rose-500" />
                    <span className="text-xs">Generating video transcript & key moments...</span>
                  </div>
                ) : transcriptData ? (
                  <div className="space-y-3">
                    {/* Summary */}
                    {transcriptData.summary && (
                      <div className="p-3 bg-rose-950/20 border border-rose-900/30 rounded-lg text-xs text-zinc-300 leading-relaxed">
                        <span className="font-semibold text-rose-400 block mb-0.5">Executive Summary</span>
                        {transcriptData.summary}
                      </div>
                    )}

                    {/* Chapters */}
                    {transcriptData.chapters && transcriptData.chapters.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {transcriptData.chapters.map((ch: any, idx: number) => (
                          <div key={idx} className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[11px] text-zinc-300 flex items-center gap-1.5">
                            <span className="font-mono text-rose-400">{ch.time}</span>
                            <span>{ch.title}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Segments Preview */}
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
                      {transcriptData.segments.map((seg: any, idx: number) => (
                        <div key={idx} className="p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/60 flex items-start gap-2.5">
                          <span className="font-mono text-[11px] text-rose-400 font-semibold flex-shrink-0 pt-0.5">
                            {seg.time}
                          </span>
                          <p className="text-zinc-300 leading-relaxed">
                            {seg.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={loadTranscript}
                    className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-200 rounded-lg border border-zinc-800 flex items-center justify-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-rose-500" />
                    <span>Generate Speech-to-Text Transcript</span>
                  </button>
                )}
              </div>

              {/* Subtitle embed toggle */}
              <label className="flex items-center gap-3 p-3 bg-zinc-950/40 border border-zinc-800 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSubtitles}
                  onChange={(e) => setIncludeSubtitles(e.target.checked)}
                  className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-white">Embed Subtitles in Offline Vault</span>
                  <p className="text-[11px] text-zinc-400">Enables synced closed captions when viewing offline</p>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-zinc-400">
            Selected: <span className="font-semibold text-white">{selectedFormat.quality}</span> ({selectedFormat.container}, ~{selectedFormat.approxSizeMb} MB)
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Preview stream */}
            <button
              onClick={() => onPreview(video, selectedFormat)}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Preview Stream</span>
            </button>

            {/* Direct Export to Device */}
            <button
              onClick={() => onStartDownload(selectedFormat, 'device', includeSubtitles)}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
              title="Download direct file to your device download folder"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export to Device</span>
            </button>

            {/* Save to Offline Vault */}
            <button
              onClick={() => onStartDownload(selectedFormat, 'vault', includeSubtitles)}
              className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors shadow-lg shadow-rose-950/40"
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
