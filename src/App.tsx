import React, { useState, useEffect } from 'react';
import { 
  Play, Download, HardDrive, Sparkles, Search, 
  Film, Music, Layers, Radio, CheckCircle2, AlertCircle, 
  Loader2, ArrowRight, Clipboard, RefreshCw, Smartphone, ShieldCheck
} from 'lucide-react';
import { downloadManager, DownloadTask } from './utils/downloadEngine';
import { OfflineMediaItem, getAllOfflineMedia, getStorageQuota } from './utils/db';
import { CinemaPlayer } from './components/CinemaPlayer';
import { OfflineVault } from './components/OfflineVault';
import { FormatSelectorModal, VideoInfo, VideoFormat } from './components/FormatSelectorModal';
import { QueueDrawer } from './components/QueueDrawer';
import { BatchDownloadModal } from './components/BatchDownloadModal';
import { PLATFORMS, detectPlatform, inspectMediaUrl, SocialPlatform } from './utils/platformHelper';

export default function App() {
  const [activeTab, setActiveTab] = useState<'downloader' | 'vault'>('downloader');
  const [urlInput, setUrlInput] = useState<string>('');
  const [selectedPlatformTab, setSelectedPlatformTab] = useState<SocialPlatform | 'all'>('all');
  const [isLoadingInfo, setIsLoadingInfo] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Video inspection state
  const [inspectedVideo, setInspectedVideo] = useState<VideoInfo | null>(null);
  const [isFormatModalOpen, setIsFormatModalOpen] = useState<boolean>(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  
  // Media Player state
  const [playingMedia, setPlayingMedia] = useState<any | null>(null);
  
  // Queue state
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [isQueueOpen, setIsQueueOpen] = useState<boolean>(false);
  
  // Offline simulation state
  const [isOfflineSimulated, setIsOfflineSimulated] = useState<boolean>(false);

  // Storage info
  const [storageInfo, setStorageInfo] = useState<{ usedFormatted: string; quotaFormatted: string; percentUsed: number }>({
    usedFormatted: '0 MB',
    quotaFormatted: '10 GB',
    percentUsed: 0
  });

  // Vault count
  const [vaultCount, setVaultCount] = useState<number>(0);

  // PWA Install prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setIsInstallModalOpen(true);
    }
  };

  // Subscribe to download manager tasks
  useEffect(() => {
    const unsubscribe = downloadManager.subscribe((updatedTasks) => {
      setTasks([...updatedTasks]);
    });
    return () => unsubscribe();
  }, []);

  // Update vault count & storage quota
  const refreshVaultStats = async () => {
    try {
      const items = await getAllOfflineMedia();
      setVaultCount(items.length);
      const quota = await getStorageQuota();
      setStorageInfo({
        usedFormatted: quota.usedFormatted,
        quotaFormatted: quota.quotaFormatted,
        percentUsed: quota.percentUsed
      });
    } catch (e) {
      console.warn('Storage stats refresh error:', e);
    }
  };

  useEffect(() => {
    refreshVaultStats();
  }, [tasks]);

  // Inspect Social Media URL (YouTube, TikTok, Instagram, Facebook, Pinterest)
  const handleInspectUrl = async (targetUrl?: string) => {
    const rawUrl = (targetUrl || urlInput).trim();
    if (!rawUrl) {
      setErrorMessage('Please enter a video URL from YouTube, TikTok, Instagram, Facebook, or Pinterest.');
      return;
    }

    setErrorMessage('');
    setIsLoadingInfo(true);

    try {
      const videoData: VideoInfo = await inspectMediaUrl(rawUrl);
      setInspectedVideo(videoData);
      setIsFormatModalOpen(true);
    } catch (err: any) {
      console.error('Inspection error:', err);
      setErrorMessage(err.message || 'Unable to inspect media. Please check the URL or verify your network connection.');
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text);
        handleInspectUrl(text);
      }
    } catch (e) {
      // Fallback
    }
  };

  // Start Download from Format Selector
  const handleStartDownload = (format: VideoFormat, target: 'vault' | 'device', includeSubtitles: boolean) => {
    if (!inspectedVideo) return;

    // Build task
    const durationParts = inspectedVideo.duration.split(':');
    let durSec = inspectedVideo.durationSeconds || 300;
    if (durationParts.length === 2) {
      durSec = parseInt(durationParts[0], 10) * 60 + parseInt(durationParts[1], 10);
    }

    const subtitlesText = includeSubtitles && inspectedVideo.captions && inspectedVideo.captions.length > 0
      ? inspectedVideo.captions[0].content
      : undefined;

    const targetStream = format.downloadUrl || inspectedVideo.sampleVideoUrl || '/sample-nature.mp4';

    const plat = inspectedVideo.platform || detectPlatform(inspectedVideo.url) || 'youtube';

    const taskId = downloadManager.addTask({
      videoId: inspectedVideo.id,
      title: inspectedVideo.title,
      channel: inspectedVideo.channel,
      thumbnail: inspectedVideo.thumbnail,
      formatId: format.id,
      qualityLabel: format.quality,
      resolution: format.resolution,
      container: format.container,
      fileType: format.type,
      totalBytes: format.approxSizeMb * 1024 * 1024,
      sampleVideoUrl: targetStream,
      duration: inspectedVideo.duration,
      durationSeconds: durSec,
      subtitles: subtitlesText,
      fps: format.fps,
      platform: plat
    });

    setIsFormatModalOpen(false);
    setIsQueueOpen(true);

    // If target is direct device export, trigger listener when completed
    if (target === 'device') {
      const checkInterval = setInterval(() => {
        const currentTask = downloadManager.getTask(taskId);
        if (currentTask && currentTask.status === 'completed' && currentTask.blob) {
          downloadManager.exportToFile({
            blob: currentTask.blob,
            title: currentTask.title,
            container: currentTask.container
          });
          clearInterval(checkInterval);
        } else if (currentTask && (currentTask.status === 'error' || !currentTask)) {
          clearInterval(checkInterval);
        }
      }, 500);
    }
  };

  const handlePreview = (video: VideoInfo, format: VideoFormat) => {
    setIsFormatModalOpen(false);

    const targetStream = format.downloadUrl || video.sampleVideoUrl || '/sample-nature.mp4';

    setPlayingMedia({
      title: video.title,
      channel: video.channel,
      thumbnail: video.thumbnail,
      qualityLabel: format.quality,
      resolution: format.resolution,
      container: format.container,
      fileType: format.type,
      duration: video.duration,
      durationSeconds: video.durationSeconds || 300,
      description: video.description,
      sampleVideoUrl: targetStream,
      subtitles: video.captions?.[0]?.content
    });
  };

  const handlePlayOfflineItem = (item: OfflineMediaItem | DownloadTask) => {
    setPlayingMedia(item);
  };

  const activeDownloadsCount = tasks.filter(t => t.status === 'downloading' || t.status === 'queued' || t.status === 'processing').length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-rose-600 selection:text-white">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-zinc-950/85 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-600 to-red-700 flex items-center justify-center shadow-lg shadow-rose-950/50">
            <Play className="w-4 h-4 ml-0.5 fill-white text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-white">ApnaStream</span>
              <span className="text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800/60 px-1.5 py-0.5 rounded">
                4K UHD
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 hidden sm:block">
              Universal Social Media Downloader & Offline Vault
            </div>
          </div>
        </div>

        {/* Center Mode Switcher Tabs */}
        <div className="flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
          <button
            onClick={() => setActiveTab('downloader')}
            className={`px-3.5 sm:px-5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'downloader'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Downloader</span>
          </button>

          <button
            onClick={() => setActiveTab('vault')}
            className={`px-3.5 sm:px-5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'vault'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Offline Vault</span>
            {vaultCount > 0 && (
              <span className="text-[10px] font-mono bg-zinc-700 text-white px-1.5 py-0.2 rounded-full">
                {vaultCount}
              </span>
            )}
          </button>
        </div>

        {/* Right Controls: Install Button, Queue Button, Airplane Mode */}
        <div className="flex items-center gap-2.5">
          {/* Install App Button */}
          <button
            onClick={handleInstallClick}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
            title="Install ApnaStream as an app on your device"
          >
            <Smartphone className="w-3.5 h-3.5 text-rose-500" />
            <span>Install App</span>
          </button>

          {/* Simulated Offline Mode indicator button */}
          <button
            onClick={() => setIsOfflineSimulated(!isOfflineSimulated)}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              isOfflineSimulated 
                ? 'bg-amber-950/80 text-amber-300 border-amber-700' 
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
            }`}
            title="Simulate offline airplane mode"
          >
            <Radio className={`w-3.5 h-3.5 ${isOfflineSimulated ? 'animate-pulse text-amber-400' : ''}`} />
            <span>{isOfflineSimulated ? 'Airplane Mode' : 'Online'}</span>
          </button>

          {/* Queue Drawer Button */}
          <button
            onClick={() => setIsQueueOpen(true)}
            className="relative px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-colors flex items-center gap-2"
          >
            <Layers className="w-4 h-4 text-zinc-400" />
            <span className="hidden sm:inline">Queue</span>
            {activeDownloadsCount > 0 && (
              <span className="text-[10px] font-mono bg-rose-600 text-white px-1.5 py-0.2 rounded-full animate-pulse">
                {activeDownloadsCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Offline Mode Alert Banner */}
      {isOfflineSimulated && (
        <div className="bg-amber-950/90 border-b border-amber-800/80 px-4 py-2 text-xs font-medium text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <Radio className="w-4 h-4 text-amber-400 animate-pulse flex-shrink-0" />
            <span>
              Simulated Offline Mode is ACTIVE. Network is disconnected — test your saved videos in the Offline Vault to verify smooth zero-data playback!
            </span>
          </div>
          <button
            onClick={() => setIsOfflineSimulated(false)}
            className="text-amber-300 hover:text-white text-xs underline font-semibold ml-4"
          >
            Turn Off
          </button>
        </div>
      )}

      {/* Main Body */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8 space-y-8">
        {activeTab === 'downloader' ? (
          <>
            {/* Hero Input Section */}
            <div className="bg-gradient-to-b from-zinc-900/90 to-zinc-900/40 border border-zinc-800/80 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="max-w-4xl space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      Multi-Platform Suite
                    </span>
                    <span className="text-xs text-zinc-500 hidden sm:inline">· YouTube · TikTok · Instagram · Facebook · Pinterest</span>
                  </div>
                  <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                    Universal Social Media Video & Audio Downloader
                  </h1>
                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-2xl">
                    Download videos and master audio tracks from YouTube, TikTok (No-Watermark), Instagram Reels, Facebook Watch, and Pinterest. Store permanently in your browser vault for data-free offline viewing.
                  </p>
                </div>

                {/* Platform Selector Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 text-xs">
                  <button
                    onClick={() => {
                      setSelectedPlatformTab('all');
                    }}
                    className={`px-3.5 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      selectedPlatformTab === 'all'
                        ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                        : 'text-zinc-400 hover:text-zinc-200 bg-zinc-950/60 border border-zinc-800/70'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                    <span>All Supported</span>
                  </button>

                  {(['youtube', 'tiktok', 'instagram', 'facebook', 'pinterest'] as SocialPlatform[]).map((plat) => {
                    const cfg = PLATFORMS[plat];
                    const isSelected = selectedPlatformTab === plat;
                    return (
                      <button
                        key={plat}
                        onClick={() => {
                          setSelectedPlatformTab(plat);
                        }}
                        className={`px-3.5 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                          isSelected
                            ? `${cfg.bgClass} ${cfg.accentClass} ${cfg.borderClass} border shadow-sm`
                            : 'text-zinc-400 hover:text-zinc-200 bg-zinc-950/60 border border-zinc-800/70'
                        }`}
                      >
                        {cfg.icon({ className: 'w-3.5 h-3.5' })}
                        <span>{cfg.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* URL Input Bar */}
                <div className="pt-1">
                  <div className="flex flex-col sm:flex-row items-stretch gap-2 bg-zinc-950 border border-zinc-800 focus-within:border-rose-500 rounded-2xl p-2 transition-colors shadow-inner">
                    <div className="flex items-center gap-2.5 px-3 flex-1">
                      <Search className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                      <input
                        type="text"
                        placeholder={
                          selectedPlatformTab === 'tiktok'
                            ? 'Paste TikTok video link (e.g. https://www.tiktok.com/@user/video/...)'
                            : selectedPlatformTab === 'instagram'
                            ? 'Paste Instagram Reel or Post link (e.g. https://www.instagram.com/reel/...)'
                            : selectedPlatformTab === 'facebook'
                            ? 'Paste Facebook Video or Watch link (e.g. https://fb.watch/...)'
                            : selectedPlatformTab === 'pinterest'
                            ? 'Paste Pinterest Pin link (e.g. https://www.pinterest.com/pin/...)'
                            : selectedPlatformTab === 'youtube'
                            ? 'Paste YouTube video or Shorts link (e.g. https://www.youtube.com/watch?v=...)'
                            : 'Paste link from YouTube, TikTok, Instagram, Facebook, or Pinterest...'
                        }
                        value={urlInput}
                        onChange={(e) => {
                          setUrlInput(e.target.value);
                          if (errorMessage) setErrorMessage('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleInspectUrl();
                        }}
                        className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
                      />

                      {/* Live Auto-detected Platform Indicator */}
                      {(() => {
                        const detected = detectPlatform(urlInput);
                        if (!detected) return null;
                        const cfg = PLATFORMS[detected];
                        return (
                          <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold ${cfg.bgClass} ${cfg.borderClass} border ${cfg.accentClass} flex-shrink-0 animate-in fade-in`}>
                            {cfg.icon({ className: 'w-3 h-3' })}
                            <span>{cfg.name}</span>
                          </div>
                        );
                      })()}

                      {urlInput && (
                        <button
                          onClick={() => setUrlInput('')}
                          className="text-xs text-zinc-500 hover:text-zinc-300 px-1"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePasteClipboard}
                        className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                        title="Paste URL from clipboard"
                      >
                        <Clipboard className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Paste</span>
                      </button>

                      <button
                        onClick={() => setIsBatchModalOpen(true)}
                        className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                        title="Download multiple URLs in batch"
                      >
                        <Layers className="w-3.5 h-3.5 text-rose-500" />
                        <span className="hidden sm:inline">Batch Download</span>
                      </button>

                      <button
                        onClick={() => handleInspectUrl()}
                        disabled={isLoadingInfo}
                        className="flex-1 sm:flex-initial px-6 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2"
                      >
                        {isLoadingInfo ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Inspecting...</span>
                          </>
                        ) : (
                          <>
                            <span>Inspect Formats</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Helper tip */}
                  <div className="flex items-center justify-between pt-2 px-1 text-xs text-zinc-500">
                    <span className="text-[11px]">Tip: Paste any public video, reel, post, or pin link to inspect</span>
                  </div>

                  {/* Error Notification */}
                  {errorMessage && (
                    <div className="mt-3 p-3 bg-red-950/50 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                </div>

                {/* Feature spec indicators */}
                <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>4K 60FPS & 1080p Ultra HD</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>TikTok No-Watermark MP4</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-pink-400" />
                    <span>Instagram Reels & Stories</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Facebook HD & Reels</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-red-500" />
                    <span>Pinterest Video Pins</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Supported Social Media Platforms Grid */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    <Radio className="w-4 h-4 text-rose-500" />
                    <span>Supported Social Platforms</span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    High-speed stream extraction, custom resolutions, and audio conversion for all top platforms
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {(['youtube', 'tiktok', 'instagram', 'facebook', 'pinterest'] as SocialPlatform[]).map((platKey) => {
                  const cfg = PLATFORMS[platKey];
                  return (
                    <div
                      key={platKey}
                      className="bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 rounded-2xl p-4 flex flex-col justify-between transition-all group hover:shadow-xl hover:shadow-black/40"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className={`p-2.5 rounded-xl ${cfg.bgClass} ${cfg.borderClass} border ${cfg.accentClass}`}>
                            {cfg.icon({ className: 'w-5 h-5' })}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${cfg.bgClass} ${cfg.accentClass} border ${cfg.borderClass}`}>
                            {cfg.badgeLabel}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-sm font-bold text-white group-hover:text-rose-400 transition-colors">
                            {cfg.name}
                          </h3>
                          <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                            {cfg.tagline}
                          </p>
                        </div>

                        <div className="space-y-1.5 pt-1">
                          {cfg.supportedFormats.map((fmt, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                              <div className={`w-1 h-1 rounded-full ${cfg.accentClass} bg-current`} />
                              <span>{fmt}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Simple Step-by-Step Guide */}
            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <span>How to Download</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Fast video streaming and lossless audio extraction in 3 easy steps
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-zinc-800/60 border border-zinc-700/50 rounded-full text-[11px] text-zinc-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                  <span>No Ads · Local Processing</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-zinc-950/60 border border-zinc-800/70 rounded-xl p-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-center justify-center">1</span>
                      <Search className="w-4 h-4 text-zinc-500" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Paste Media URL</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Copy any video, reel, post, or pin link from <strong>YouTube, TikTok, Instagram, Facebook, or Pinterest</strong> and paste it above.
                    </p>
                  </div>
                </div>

                <div className="bg-zinc-950/60 border border-zinc-800/70 rounded-xl p-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-center justify-center">2</span>
                      <Layers className="w-4 h-4 text-zinc-500" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Choose Quality & Container</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Select resolutions from <strong>4K/1080p Ultra HD</strong>, TikTok without watermark, or extract studio-grade <strong>320kbps MP3 / WAV</strong>.
                    </p>
                  </div>
                </div>

                <div className="bg-zinc-950/60 border border-zinc-800/70 rounded-xl p-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-center justify-center">3</span>
                      <HardDrive className="w-4 h-4 text-zinc-500" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Save to Vault or Device</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Save into your browser's persistent <strong>Offline Vault</strong> for offline playback without data, or export directly to your device disk.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Architecture Highlights & Information Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-rose-400">
                  <Film className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">Ultra HD 4K & High Frame Rate</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Multiplex high-bitrate video streams up to 60fps with AV1 and H.264 codecs in MP4 container format.
                </p>
              </div>

              <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-rose-400">
                  <HardDrive className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">Zero-Data Offline Vault</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Videos and songs from all social platforms are saved inside local browser IndexedDB storage for seamless offline access.
                </p>
              </div>

              <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-rose-400">
                  <Music className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">Master Audio Extraction</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Extract crystal-clear 320kbps MP3s, Apple AAC, and uncompressed WAV audio tracks equipped with visualizer waveform playback.
                </p>
              </div>
            </div>
          </>
        ) : (
          /* Offline Vault View */
          <OfflineVault
            onPlayMedia={(item) => handlePlayOfflineItem(item)}
            onExploreSamples={() => setActiveTab('downloader')}
            isOfflineSimulated={isOfflineSimulated}
            onToggleOfflineSimulation={() => setIsOfflineSimulated(!isOfflineSimulated)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-6 px-4 sm:px-8 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-400">ApnaStream Downloader</span>
            <span aria-hidden="true">·</span>
            <span>Local Browser Storage & Cinema Playback</span>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-400">
            <span>Storage: {storageInfo.usedFormatted} cached</span>
            <span aria-hidden="true">·</span>
            <span className="text-rose-400 font-semibold">{vaultCount} Saved Offline</span>
          </div>
        </div>
      </footer>

      {/* Format Selector Modal */}
      {inspectedVideo && (
        <FormatSelectorModal
          video={inspectedVideo}
          isOpen={isFormatModalOpen}
          onClose={() => setIsFormatModalOpen(false)}
          onStartDownload={handleStartDownload}
          onPreview={handlePreview}
        />
      )}

      {/* Cinema Player (Fullscreen/Overlay Modal) */}
      {playingMedia && (
        <CinemaPlayer
          media={playingMedia}
          onClose={() => setPlayingMedia(null)}
          isOfflineMode={isOfflineSimulated}
        />
      )}

      {/* Download Queue Slide-over Drawer */}
      <QueueDrawer
        tasks={tasks}
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        onPlayItem={(task) => {
          setIsQueueOpen(false);
          handlePlayOfflineItem(task);
        }}
      />

      {/* Platform Install Guide Modal */}
      {isInstallModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setIsInstallModalOpen(false)}
        >
          <div 
            className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-rose-500" />
                  <span>Install ApnaStream on Any Device</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Install as a standalone application on your Desktop or Mobile device for full-screen offline playback.
                </p>
              </div>
              <button
                onClick={() => setIsInstallModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-1.5">
                <div className="font-semibold text-white flex items-center gap-2">
                  <span>💻 Chrome / Edge / Brave (Windows, Mac, Linux)</span>
                </div>
                <p className="text-zinc-400">
                  Click the <strong>Install</strong> icon in the address bar (right side of the URL) or open the browser menu (⋮) and select <strong>"Install ApnaStream"</strong>.
                </p>
              </div>

              <div className="p-3.5 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-1.5">
                <div className="font-semibold text-white flex items-center gap-2">
                  <span>📱 Android (Chrome / Samsung Internet)</span>
                </div>
                <p className="text-zinc-400">
                  Tap the three dots menu (⋮) in the top-right corner, then tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                </p>
              </div>

              <div className="p-3.5 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-1.5">
                <div className="font-semibold text-white flex items-center gap-2">
                  <span>🍏 iPhone & iPad (Safari)</span>
                </div>
                <p className="text-zinc-400">
                  Tap the <strong>Share</strong> button (box with an arrow pointing up), scroll down, and tap <strong>"Add to Home Screen"</strong>.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsInstallModalOpen(false)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white rounded-xl transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Download Modal */}
      <BatchDownloadModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        onQueueStarted={() => setIsQueueOpen(true)}
      />
    </div>
  );
}
