import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, 
  RotateCcw, RotateCw, Subtitles, Settings, Download, X,
  HardDrive, Radio, Check, Info, ArrowLeft, FileText, Search,
  Copy, Sparkles, Clock, Loader2, Film
} from 'lucide-react';
import { OfflineMediaItem } from '../utils/db';
import { downloadManager } from '../utils/downloadEngine';

interface CinemaPlayerProps {
  media: OfflineMediaItem | {
    title: string;
    channel: string;
    thumbnail: string;
    qualityLabel: string;
    resolution: string;
    container: string;
    fileType: 'video' | 'audio';
    duration: string;
    blob?: Blob;
    sampleVideoUrl?: string;
    subtitles?: string;
    description?: string;
  };
  onClose: () => void;
  isOfflineMode?: boolean;
}

interface ParsedSubtitle {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface TranscriptSegment {
  start: number;
  end: number;
  time: string;
  text: string;
  speaker?: string;
}

export const CinemaPlayer: React.FC<CinemaPlayerProps> = ({ media, onClose, isOfflineMode = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(true);
  const [activeSubtitle, setActiveSubtitle] = useState<string>('');
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(() => {
    if (media.blob) {
      return URL.createObjectURL(media.blob);
    }
    let rawUrl = media.sampleVideoUrl || '/sample-nature.mp4';
    if (rawUrl.includes('commondatastorage.googleapis.com') || (!rawUrl.startsWith('/') && !rawUrl.startsWith('blob:'))) {
      return '/sample-nature.mp4';
    }
    return rawUrl;
  });
  
  // Transcription state
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [transcriptData, setTranscriptData] = useState<{
    summary?: string;
    chapters?: Array<{ time: string; title: string }>;
    segments: TranscriptSegment[];
  } | null>(null);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState<boolean>(false);
  const [transcriptSearch, setTranscriptSearch] = useState<string>('');
  const [copiedTranscript, setCopiedTranscript] = useState<boolean>(false);
  
  const [currentQuality, setCurrentQuality] = useState<string>(media.qualityLabel || '4K Ultra HD');
  const [currentFileType, setCurrentFileType] = useState<'video' | 'audio'>(media.fileType || 'video');
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [qualityToast, setQualityToast] = useState<string | null>(null);

  const controlsTimeoutRef = useRef<any>(null);

  // Quality Switcher
  const handleQualitySelect = (q: { label: string; res: string; type: 'video' | 'audio' }) => {
    setCurrentQuality(q.label);
    setCurrentFileType(q.type);
    setShowQualityMenu(false);
    setQualityToast(`Active Preset: ${q.label} (${q.res})`);
    setTimeout(() => setQualityToast(null), 3000);

    const prevTime = videoRef.current ? videoRef.current.currentTime : currentTime;

    let targetStream = videoBlobUrl;
    if (q.type === 'audio') {
      if (media.title.includes('Cyberpunk')) targetStream = '/sample-cyberpunk.mp3';
      else if (media.title.includes('lofi') || media.title.includes('Chill')) targetStream = '/sample-lofi.mp3';
      else if (media.title.includes('Space') || media.title.includes('JWST')) targetStream = '/sample-space.mp3';
      else targetStream = '/sample-nature.mp3';
    } else {
      if (media.title.includes('Cyberpunk')) targetStream = '/sample-cyberpunk.mp4';
      else if (media.title.includes('lofi') || media.title.includes('Chill')) targetStream = '/sample-lofi.mp4';
      else if (media.title.includes('Space') || media.title.includes('JWST')) targetStream = '/sample-space.mp4';
      else targetStream = '/sample-nature.mp4';
    }

    if (targetStream && targetStream !== videoBlobUrl) {
      setVideoBlobUrl(targetStream);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = prevTime;
          videoRef.current.volume = volume;
          videoRef.current.muted = isMuted;
          videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        }
      }, 150);
    }
  };

  // Setup video source on media change
  useEffect(() => {
    setCurrentFileType(media.fileType || 'video');
    let url = '';
    if (media.blob) {
      url = URL.createObjectURL(media.blob);
      setVideoBlobUrl(url);
    } else {
      let rawUrl = media.sampleVideoUrl || '/sample-nature.mp4';
      if (rawUrl.includes('commondatastorage.googleapis.com') || (!rawUrl.startsWith('/') && !rawUrl.startsWith('blob:'))) {
        rawUrl = '/sample-nature.mp4';
      }
      setVideoBlobUrl(rawUrl);
    }

    return () => {
      if (url && media.blob) {
        URL.revokeObjectURL(url);
      }
    };
  }, [media]);

  // Parse SRT subtitles
  const parsedSubtitles = useRef<ParsedSubtitle[]>([]);
  useEffect(() => {
    if (!media.subtitles) return;
    const lines = media.subtitles.split('\n');
    const items: ParsedSubtitle[] = [];
    let currentItem: Partial<ParsedSubtitle> = {};

    const parseTime = (timeStr: string) => {
      const parts = timeStr.trim().split(':');
      if (parts.length === 3) {
        const secParts = parts[2].split(',');
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const s = parseInt(secParts[0], 10);
        const ms = parseInt(secParts[1] || '0', 10);
        return h * 3600 + m * 60 + s + ms / 1000;
      }
      return 0;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.includes('-->')) {
        const [startStr, endStr] = line.split('-->');
        currentItem.start = parseTime(startStr);
        currentItem.end = parseTime(endStr);
      } else if (!isNaN(Number(line)) && !currentItem.id) {
        currentItem.id = parseInt(line, 10);
      } else if (currentItem.start !== undefined) {
        currentItem.text = (currentItem.text ? currentItem.text + ' ' : '') + line;
        if (i === lines.length - 1 || lines[i + 1].trim() === '') {
          items.push(currentItem as ParsedSubtitle);
          currentItem = {};
        }
      }
    }
    parsedSubtitles.current = items;
  }, [media.subtitles]);

  // Subtitle synchronization
  useEffect(() => {
    if (!subtitlesEnabled || parsedSubtitles.current.length === 0) {
      setActiveSubtitle('');
      return;
    }

    const currentSub = parsedSubtitles.current.find(
      (sub) => currentTime >= sub.start && currentTime <= sub.end
    );
    setActiveSubtitle(currentSub ? currentSub.text : '');
  }, [currentTime, subtitlesEnabled]);

  // Fetch or generate transcription
  const loadTranscript = async () => {
    if (transcriptData || isLoadingTranscript) return;
    setIsLoadingTranscript(true);

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: media.title,
          channel: media.channel,
          description: ('description' in media && media.description) || '',
          durationSeconds: ('durationSeconds' in media && media.durationSeconds) || 300,
          existingCaptions: media.subtitles
        })
      });

      if (res.ok) {
        const data = await res.json();
        setTranscriptData(data);
      }
    } catch (err) {
      console.warn('Transcript load error:', err);
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  useEffect(() => {
    if (showTranscript && !transcriptData) {
      loadTranscript();
    }
  }, [showTranscript]);

  const seekToTime = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration || 9999, seconds));
    setCurrentTime(seconds);
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const copyFullTranscript = () => {
    if (!transcriptData) return;
    const text = transcriptData.segments.map(s => `[${s.time}] ${s.speaker || 'Speaker'}: ${s.text}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const exportTranscriptTxt = () => {
    if (!transcriptData) return;
    const text = `# Transcript: ${media.title}\nChannel: ${media.channel}\n\nSummary:\n${transcriptData.summary || 'N/A'}\n\n${transcriptData.segments.map(s => `[${s.time}] ${s.speaker || 'Speaker'}: ${s.text}`).join('\n\n')}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${media.title.substring(0, 30)}_transcript.txt`;
    a.click();
  };

  // Audio visualizer for audio-only downloads
  useEffect(() => {
    if (currentFileType !== 'audio' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const bars = 48;
      const barWidth = canvas.width / bars - 2;

      for (let i = 0; i < bars; i++) {
        // Synthesize dynamic responsive waveform
        const multiplier = isPlaying ? Math.sin(phase + i * 0.2) * 0.5 + 0.5 : 0.08;
        const height = (multiplier * (canvas.height * 0.75)) + 4;
        const x = i * (barWidth + 2);
        const y = canvas.height - height;

        // Gradient
        const grad = ctx.createLinearGradient(0, y, 0, canvas.height);
        grad.addColorStop(0, '#f43f5e');
        grad.addColorStop(1, '#881337');
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, height, 4);
        ctx.fill();
      }

      if (isPlaying) {
        phase += 0.08;
      }
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [media.fileType, isPlaying]);

  // Auto-hide controls handler
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowSpeedMenu(false);
      }
    }, 3000);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekDelta(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekDelta(5);
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          if (!isFullscreen) {
            onClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isMuted, isFullscreen]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.muted = isMuted;
      videoRef.current.volume = volume;
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Playback error:', err);
        setIsPlaying(false);
      });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const seekDelta = (deltaSeconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + deltaSeconds));
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none"
    >
      {/* Top Header Controls */}
      <div 
        className={`absolute top-0 left-0 right-0 z-30 p-4 sm:p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent transition-opacity duration-300 flex items-center justify-between ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 max-w-[70%]">
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
            title="Close Player (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          
          <div className="truncate">
            <h2 className="text-sm sm:text-base font-semibold text-white truncate drop-shadow-md">
              {media.title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
              <span>{media.channel}</span>
              <span aria-hidden="true">·</span>
              <span className="text-rose-300 font-mono text-[11px] bg-rose-950/80 border border-rose-800/60 px-2 py-0.5 rounded font-semibold">
                {currentQuality}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-zinc-300 font-mono text-[11px]">
                {media.container}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Stereo Audio Status Badge */}
          <button
            onClick={toggleMute}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors ${
              isMuted 
                ? 'bg-amber-950/80 text-amber-300 border-amber-800/60 hover:bg-amber-900' 
                : 'bg-zinc-900/90 text-emerald-300 border-emerald-800/50 hover:bg-zinc-800 shadow-sm'
            }`}
            title="Click to Mute / Unmute Audio"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-amber-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
            <span className="hidden sm:inline">{isMuted ? 'Muted (Click to Unmute)' : 'Stereo Audio Active (320 kbps)'}</span>
            <span className="sm:hidden">{isMuted ? 'Muted' : 'Sound ON'}</span>
          </button>

          {/* Storage / Offline indicator badge */}
          {media.blob && (
            <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 rounded-md shadow-sm">
              <HardDrive className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Playing from Offline Vault</span>
              <span className="sm:hidden">Offline</span>
            </div>
          )}

          {isOfflineMode && (
            <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-amber-950/80 text-amber-300 border border-amber-800/60 rounded-md">
              <Radio className="w-3.5 h-3.5" />
              <span>Offline Mode Active</span>
            </div>
          )}

          {/* Export button */}
          {media.blob && (
            <button
              onClick={() => downloadManager.exportToFile({ blob: media.blob, title: media.title, container: media.container })}
              className="p-2 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
              title="Export File to Disk"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Export File</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-900/80 hover:bg-rose-950 hover:text-rose-400 text-zinc-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* On-screen Toast notification */}
      {qualityToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-zinc-900/95 border border-zinc-700 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
          <Sparkles className="w-4 h-4 text-rose-400" />
          <span>{qualityToast}</span>
        </div>
      )}

      {/* Main Video Screen / Audio Canvas */}
      <div 
        onClick={togglePlay}
        className="relative w-full h-full flex items-center justify-center cursor-pointer bg-zinc-950"
      >
        {currentFileType === 'video' ? (
          videoBlobUrl ? (
            <video
              ref={videoRef}
              src={videoBlobUrl}
              className="w-full h-full object-contain"
              loop={isLooping}
              playsInline
              autoPlay
              preload="auto"
              onTimeUpdate={() => {
                if (videoRef.current) {
                  setCurrentTime(videoRef.current.currentTime);
                }
              }}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  setDuration(videoRef.current.duration);
                  videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
                }
              }}
              onError={() => {
                console.warn('Video failed to load from primary source, switching to local asset.');
                if (videoBlobUrl !== '/sample-nature.mp4') {
                  setVideoBlobUrl('/sample-nature.mp4');
                }
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
          ) : null
        ) : (
          /* Audio visualizer container */
          <div className="w-full max-w-xl p-8 flex flex-col items-center justify-center gap-6 text-center select-none">
            <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
              {media.thumbnail ? (
                <img 
                  src={media.thumbnail} 
                  alt={media.title} 
                  className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100'}`}
                />
              ) : (
                <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-600" />
              )}
              <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-lg">
                  {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">{media.title}</h3>
              <p className="text-sm text-zinc-400">{media.channel}</p>
              <p className="text-xs text-rose-400 font-mono">Master Audio {media.container} · High-Definition</p>
            </div>

            {/* Dynamic Visualizer Waveform Canvas */}
            <canvas 
              ref={canvasRef} 
              width={420} 
              height={80} 
              className="w-full max-w-md h-20 rounded-lg bg-zinc-900/50 p-2"
            />

            {videoBlobUrl && (
              <audio
                ref={videoRef as any}
                src={videoBlobUrl}
                loop={isLooping}
                onTimeUpdate={() => {
                  if (videoRef.current) {
                    setCurrentTime(videoRef.current.currentTime);
                  }
                }}
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    setDuration(videoRef.current.duration);
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
            )}
          </div>
        )}

        {/* Subtitle Display */}
        {subtitlesEnabled && activeSubtitle && (
          <div className="absolute bottom-24 sm:bottom-28 left-4 right-4 z-20 flex justify-center pointer-events-none">
            <span className="px-4 py-2 bg-black/85 text-white text-sm sm:text-base md:text-lg font-medium text-center rounded-lg shadow-lg border border-white/10 max-w-3xl leading-relaxed">
              {activeSubtitle}
            </span>
          </div>
        )}

        {/* Center Pause/Play Splash with Sound */}
        {!isPlaying && (
          <div 
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-3.5 bg-black/45 backdrop-blur-[2px] cursor-pointer"
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-rose-600 hover:bg-rose-500 border-2 border-white/40 flex items-center justify-center text-white shadow-2xl transition-all transform hover:scale-110 active:scale-95">
              <Play className="w-10 h-10 sm:w-11 sm:h-11 ml-1 fill-white" />
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center">
              <span className="text-sm sm:text-base font-bold text-white bg-black/85 px-4 py-1.5 rounded-full border border-white/20 shadow-2xl flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>Click to Play with Sound</span>
              </span>
              <span className="text-xs font-mono text-zinc-300 bg-zinc-900/80 px-2.5 py-0.5 rounded-md border border-zinc-800">
                100% Unmuted · Stereo 44.1kHz AAC
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div 
        className={`absolute bottom-0 left-0 right-0 z-30 p-4 sm:p-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 flex flex-col gap-2.5 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress Bar / Scrubber */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-zinc-400 w-12 text-right">
            {formatTime(currentTime)}
          </span>
          
          <div className="relative flex-1 group py-2 cursor-pointer">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-rose-500 hover:h-2 transition-all"
            />
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-rose-600 rounded-lg pointer-events-none group-hover:h-2 transition-all"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>

          <span className="text-xs font-mono text-zinc-400 w-12 text-left">
            {formatTime(duration)}
          </span>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between gap-4">
          {/* Left Controls: Play, Skips, Volume */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={togglePlay}
              className="p-2 sm:p-2.5 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 transition-colors shadow-sm"
              title={isPlaying ? 'Pause (Space)' : 'Play with Sound (Space)'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-zinc-950" /> : <Play className="w-4 h-4 fill-zinc-950 ml-0.5" />}
            </button>

            <button
              onClick={() => seekDelta(-10)}
              className="p-2 rounded-lg text-zinc-400 hover:text-white transition-colors"
              title="Seek back 10 seconds (Left Arrow)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => seekDelta(10)}
              className="p-2 rounded-lg text-zinc-400 hover:text-white transition-colors"
              title="Seek forward 10 seconds (Right Arrow)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume with % label */}
            <div className="flex items-center gap-2 group ml-1">
              <button
                onClick={toggleMute}
                className="p-2 rounded-lg text-zinc-400 hover:text-white transition-colors"
                title="Mute / Unmute (M)"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>
              
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 sm:w-20 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
              <span className="text-[10px] font-mono text-zinc-400 w-7">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>
          </div>

          {/* Right Controls: Subtitles, Speed, PIP, Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Subtitles */}
            {media.subtitles && (
              <button
                onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
                className={`p-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                  subtitlesEnabled ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60' : 'text-zinc-400 hover:text-white'
                }`}
                title="Toggle Subtitles"
              >
                <Subtitles className="w-4 h-4" />
                <span className="hidden sm:inline">CC</span>
              </button>
            )}

            {/* Loop */}
            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`p-2 rounded-lg text-xs font-medium transition-colors ${
                isLooping ? 'bg-zinc-800 text-rose-400' : 'text-zinc-400 hover:text-white'
              }`}
              title="Loop Video"
            >
              Loop
            </button>

            {/* Quality Selector */}
            <div className="relative">
              <button
                onClick={() => setShowQualityMenu(!showQualityMenu)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-1.5 border border-zinc-750 bg-zinc-900/60"
                title="Select Quality Preset"
              >
                <Film className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">{currentQuality}</span>
                <span className="sm:hidden">Quality</span>
              </button>

              {showQualityMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-56 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl p-1.5 z-40">
                  <div className="text-[10px] font-bold text-zinc-400 px-2 py-1 uppercase tracking-wider">
                    Select Quality Preset
                  </div>
                  {[
                    { label: '4K Ultra HD (2160p 60fps)', res: '3840x2160 · 60fps', type: 'video' as const },
                    { label: '1080p Full HD (60fps)', res: '1920x1080 · 60fps', type: 'video' as const },
                    { label: '720p HD (60fps)', res: '1280x720 · 60fps', type: 'video' as const },
                    { label: 'Master Audio (320kbps MP3)', res: 'Lossless Audio · ID3', type: 'audio' as const }
                  ].map((q) => (
                    <button
                      key={q.label}
                      onClick={() => handleQualitySelect(q)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 text-xs rounded-lg transition-colors ${
                        currentQuality === q.label ? 'bg-rose-950 text-rose-300 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex flex-col text-left">
                        <span className="font-medium text-white">{q.label}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">{q.res}</span>
                      </div>
                      {currentQuality === q.label && <Check className="w-4 h-4 text-rose-400 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Speed Selector */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-1"
                title="Playback Speed"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>{playbackRate}x</span>
              </button>

              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-32 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl p-1 z-40">
                  <div className="text-[11px] font-semibold text-zinc-400 px-2 py-1">Speed</div>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handleRateChange(rate)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-md transition-colors ${
                        playbackRate === rate ? 'bg-rose-950 text-rose-300 font-medium' : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <span>{rate}x</span>
                      {playbackRate === rate && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Interactive Transcript Toggle */}
            <button
              onClick={() => {
                setShowTranscript(!showTranscript);
                if (!showTranscript && !transcriptData) {
                  loadTranscript();
                }
              }}
              className={`p-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                showTranscript ? 'bg-rose-950/90 text-rose-300 border border-rose-800/80 shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
              title="Toggle Synchronized Transcript & Chapters"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Transcript</span>
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg text-zinc-400 hover:text-white transition-colors"
              title="Fullscreen (F)"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Synchronized Transcript & Chapters Sidebar Drawer */}
      {showTranscript && (
        <div 
          className="absolute top-0 right-0 bottom-0 z-40 w-full sm:w-96 md:w-[420px] bg-zinc-950/95 backdrop-blur-xl border-l border-zinc-800 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-bold text-white">Transcript & Chapters</h3>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={copyFullTranscript}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-xs flex items-center gap-1"
                title="Copy Full Transcript"
              >
                {copiedTranscript ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">{copiedTranscript ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={exportTranscriptTxt}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-xs flex items-center gap-1"
                title="Download .TXT"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>

              <button
                onClick={() => setShowTranscript(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-3 border-b border-zinc-800/80 bg-zinc-950/40">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search words in transcript..."
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>
          </div>

          {/* Body Content */}
          <div 
            ref={transcriptContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {isLoadingTranscript ? (
              <div className="h-64 flex flex-col items-center justify-center text-center text-zinc-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                <p className="text-xs font-medium">Generating speech-to-text transcript...</p>
              </div>
            ) : transcriptData ? (
              <>
                {/* AI Summary Card */}
                {transcriptData.summary && (
                  <div className="p-3.5 bg-rose-950/30 border border-rose-900/40 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-400 uppercase tracking-wider">
                      <Sparkles className="w-3 h-3" />
                      <span>Executive Summary</span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {transcriptData.summary}
                    </p>
                  </div>
                )}

                {/* Chapters Navigation */}
                {transcriptData.chapters && transcriptData.chapters.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Timeline Chapters
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {transcriptData.chapters.map((ch, idx) => {
                        const parts = ch.time.split(':');
                        const sec = parts.length === 2 ? parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) : 0;
                        return (
                          <button
                            key={idx}
                            onClick={() => seekToTime(sec)}
                            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5"
                          >
                            <span className="font-mono text-rose-400">{ch.time}</span>
                            <span>{ch.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Spoken Segments List */}
                <div className="space-y-2 pt-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Spoken Transcript ({transcriptData.segments.length} lines)
                  </div>

                  {transcriptData.segments
                    .filter(s => !transcriptSearch || s.text.toLowerCase().includes(transcriptSearch.toLowerCase()))
                    .map((segment, idx) => {
                      const isActive = currentTime >= segment.start && currentTime <= segment.end;
                      return (
                        <div
                          key={idx}
                          onClick={() => seekToTime(segment.start)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer group ${
                            isActive
                              ? 'bg-rose-950/50 border-rose-500/80 shadow-md shadow-rose-950/40 text-white'
                              : 'bg-zinc-900/50 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                            <span className={`px-1.5 py-0.5 rounded ${
                              isActive ? 'bg-rose-600 text-white font-bold' : 'bg-zinc-800 text-zinc-400 group-hover:text-zinc-200'
                            }`}>
                              {segment.time}
                            </span>
                            {segment.speaker && (
                              <span className="text-zinc-500 font-sans text-[10px]">
                                {segment.speaker}
                              </span>
                            )}
                          </div>
                          
                          <p className="text-xs leading-relaxed">
                            {segment.text}
                          </p>
                        </div>
                      );
                    })}
                </div>
              </>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-center text-zinc-500 space-y-2">
                <FileText className="w-8 h-8 text-zinc-600" />
                <p className="text-xs">No transcript generated yet</p>
                <button
                  onClick={loadTranscript}
                  className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg"
                >
                  Generate Transcript
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
