import React, { useState, useEffect } from 'react';
import { 
  Play, Download, HardDrive, Search, 
  Layers, Radio, AlertCircle, 
  Loader2, Clipboard, Smartphone, Sun, Moon
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
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('apnastream_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('apnastream_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

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
      setErrorMessage('Please paste a valid link from YouTube, TikTok, Instagram, Facebook, or Pinterest.');
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
      setErrorMessage(err.message || 'Unable to fetch media. Please check the link and try again.');
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

    const durationParts = inspectedVideo.duration.split(':');
    let durSec = inspectedVideo.durationSeconds || 300;
    if (durationParts.length === 2) {
      durSec = parseInt(durationParts[0], 10) * 60 + parseInt(durationParts[1], 10);
    }

    const subtitlesText = includeSubtitles && inspectedVideo.captions && inspectedVideo.captions.length > 0
      ? inspectedVideo.captions[0].content
      : undefined;

    const targetStream = format.downloadUrl || inspectedVideo.sampleVideoUrl || '';
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
    const targetStream = format.downloadUrl || video.sampleVideoUrl || '';

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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-rose-600 selection:text-white transition-colors duration-200 pb-16 sm:pb-0">
      {/* Compact Sticky Top Navigation */}
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/80 px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-rose-600 to-red-700 flex items-center justify-center shadow-md shadow-rose-600/20">
            <Play className="w-4 h-4 ml-0.5 fill-white text-white" />
          </div>
          <span className="text-base sm:text-lg font-extrabold tracking-tight text-zinc-900 dark:text-white whitespace-nowrap">
            ApnaStream
          </span>
        </div>

        {/* Zone 2: Desktop Mode Switcher (Hidden on Mobile, replaced by thumb-friendly bottom bar) */}
        <div className="hidden sm:flex items-center p-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <button
            onClick={() => setActiveTab('downloader')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'downloader'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Downloader</span>
          </button>

          <button
            onClick={() => setActiveTab('vault')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'vault'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Offline Vault</span>
            {vaultCount > 0 && (
              <span className="text-[11px] font-mono tabular-nums text-rose-600 dark:text-rose-400 font-bold">
                ({vaultCount})
              </span>
            )}
          </button>
        </div>

        {/* Zone 3: Right Utility Actions (Theme Toggle, Install, Queue) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            className="min-h-[40px] min-w-[40px] px-2.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden md:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-zinc-700" />
                <span className="hidden md:inline">Dark</span>
              </>
            )}
          </button>

          {/* Install App Button */}
          <button
            onClick={handleInstallClick}
            className="min-h-[40px] min-w-[40px] px-2.5 sm:px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors flex items-center justify-center gap-1.5"
            title="Install ApnaStream App"
          >
            <Smartphone className="w-4 h-4 text-rose-500" />
            <span className="hidden md:inline whitespace-nowrap">Install</span>
          </button>

          {/* Queue Drawer Button */}
          <button
            onClick={() => setIsQueueOpen(true)}
            className="relative min-h-[40px] px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors flex items-center gap-1.5"
          >
            <Layers className="w-4 h-4 text-rose-500" />
            <span className="hidden sm:inline whitespace-nowrap">Queue</span>
            {activeDownloadsCount > 0 && (
              <span className="text-[11px] font-mono tabular-nums bg-rose-600 text-white px-1.5 py-0.2 rounded-full">
                {activeDownloadsCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Offline Mode Alert Banner */}
      {isOfflineSimulated && (
        <div className="bg-amber-100 dark:bg-amber-950/90 border-b border-amber-300 dark:border-amber-800/80 px-4 py-2 text-xs font-medium text-amber-900 dark:text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <Radio className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>
              Offline Mode is active. Test your saved videos in the Offline Vault for zero-data playback.
            </span>
          </div>
          <button
            onClick={() => setIsOfflineSimulated(false)}
            className="text-amber-800 dark:text-amber-300 hover:underline text-xs font-semibold ml-4 whitespace-nowrap"
          >
            Turn Off
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-5 sm:p-8 space-y-6 sm:space-y-8">
        {activeTab === 'downloader' ? (
          <>
            {/* Hero Downloader Card */}
            <div className="bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800/90 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm relative overflow-hidden">
              <div className="space-y-4 sm:space-y-5">
                <div className="space-y-1.5">
                  <h1 className="text-xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-snug">
                    Social Media Video & Audio Downloader
                  </h1>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                    Save HD videos and MP3 audio from YouTube, TikTok, Instagram, Facebook, and Pinterest.
                  </p>
                </div>

                {/* Single Clean Platform Selector Bar (No duplicate platform cards below) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                  <button
                    onClick={() => setSelectedPlatformTab('all')}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                      selectedPlatformTab === 'all'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <span>All</span>
                  </button>

                  {(['youtube', 'tiktok', 'instagram', 'facebook', 'pinterest'] as SocialPlatform[]).map((plat) => {
                    const cfg = PLATFORMS[plat];
                    const isSelected = selectedPlatformTab === plat;
                    return (
                      <button
                        key={plat}
                        onClick={() => setSelectedPlatformTab(plat)}
                        className={`min-h-[38px] px-3.5 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                          isSelected
                            ? `${cfg.bgClass} ${cfg.accentClass} ${cfg.borderClass} border shadow-sm`
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800'
                        }`}
                      >
                        {cfg.icon({ className: 'w-3.5 h-3.5' })}
                        <span>{cfg.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Mobile-Optimized URL Input & Action Bar */}
                <div className="space-y-2.5">
                  <div className="flex flex-col sm:flex-row items-stretch gap-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus-within:border-rose-500 dark:focus-within:border-rose-500 rounded-2xl p-2 transition-colors">
                    {/* Input Field Row */}
                    <div className="flex items-center gap-2.5 px-2.5 py-1.5 sm:py-0 flex-1 min-h-[42px]">
                      <Search className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400 flex-shrink-0" />
                      <input
                        type="url"
                        placeholder={
                          selectedPlatformTab === 'tiktok'
                            ? 'Paste TikTok video link...'
                            : selectedPlatformTab === 'instagram'
                            ? 'Paste Instagram Reel or Post link...'
                            : selectedPlatformTab === 'facebook'
                            ? 'Paste Facebook Video or Reel link...'
                            : selectedPlatformTab === 'pinterest'
                            ? 'Paste Pinterest Video Pin link...'
                            : selectedPlatformTab === 'youtube'
                            ? 'Paste YouTube video or Shorts link...'
                            : 'Paste video link here...'
                        }
                        value={urlInput}
                        onChange={(e) => {
                          setUrlInput(e.target.value);
                          if (errorMessage) setErrorMessage('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleInspectUrl();
                        }}
                        className="w-full bg-transparent text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
                      />

                      {/* Auto-detected Platform Indicator */}
                      {(() => {
                        const detected = detectPlatform(urlInput);
                        if (!detected) return null;
                        const cfg = PLATFORMS[detected];
                        return (
                          <div className={`hidden md:flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${cfg.accentClass} flex-shrink-0`}>
                            {cfg.icon({ className: 'w-3.5 h-3.5' })}
                            <span>{cfg.name}</span>
                          </div>
                        );
                      })()}

                      {urlInput && (
                        <button
                          onClick={() => setUrlInput('')}
                          className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 px-1.5 py-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Buttons Row: Ergonomic 44px touch targets on mobile */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePasteClipboard}
                        className="min-h-[44px] px-3.5 py-2 bg-zinc-200/80 hover:bg-zinc-300/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                        title="Paste link from clipboard"
                      >
                        <Clipboard className="w-3.5 h-3.5" />
                        <span>Paste</span>
                      </button>

                      <button
                        onClick={() => setIsBatchModalOpen(true)}
                        className="min-h-[44px] px-3.5 py-2 bg-zinc-200/80 hover:bg-zinc-300/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                        title="Batch download multiple links"
                      >
                        <Layers className="w-3.5 h-3.5 text-rose-500" />
                        <span>Batch</span>
                      </button>

                      <button
                        onClick={() => handleInspectUrl()}
                        disabled={isLoadingInfo}
                        className="flex-1 sm:flex-initial min-h-[44px] px-6 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-rose-600/25 flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        {isLoadingInfo ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Fetching...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            <span>Fetch</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Error Notification */}
                  {errorMessage && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 rounded-xl text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Single Concise 3-Step Workflow (Eliminated redundant platform & feature card walls) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
              <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-1.5">
                <div className="text-xs font-bold text-rose-600 dark:text-rose-400">01. Paste Link</div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Any Public Video or Reel</h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Copy a link from YouTube, TikTok, Instagram, Facebook, or Pinterest and tap <strong>Fetch</strong>.
                </p>
              </div>

              <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-1.5">
                <div className="text-xs font-bold text-rose-600 dark:text-rose-400">02. Select Format</div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">HD Video or MP3 Audio</h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Choose original HD MP4 (watermark-free on TikTok) or extract 320kbps MP3 audio tracks.
                </p>
              </div>

              <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-1.5">
                <div className="text-xs font-bold text-rose-600 dark:text-rose-400">03. Save or Watch</div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Device Export & Offline Vault</h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Export directly to your phone/PC gallery or store in the Offline Vault for zero-data playback.
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

      {/* Mobile Fixed Bottom Navigation Bar (Thumb-Zone Ergonomics) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-3 h-14 px-2">
        <button
          onClick={() => setActiveTab('downloader')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
            activeTab === 'downloader'
              ? 'text-rose-600 dark:text-rose-500'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Downloader</span>
        </button>

        <button
          onClick={() => setActiveTab('vault')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
            activeTab === 'vault'
              ? 'text-rose-600 dark:text-rose-500'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Vault {vaultCount > 0 ? `(${vaultCount})` : ''}</span>
        </button>

        <button
          onClick={() => setIsQueueOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400"
        >
          <Layers className="w-4 h-4" />
          <span>Queue {activeDownloadsCount > 0 ? `(${activeDownloadsCount})` : ''}</span>
        </button>
      </nav>

      {/* Quiet Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800/80 py-5 px-4 sm:px-8 text-center text-xs text-zinc-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-700 dark:text-zinc-400">ApnaStream</span>
            <span aria-hidden="true">·</span>
            <span>Social Media Video & Audio Downloader</span>
          </div>

          <div className="flex items-center gap-2 font-mono tabular-nums text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>Vault: {storageInfo.usedFormatted}</span>
            <span aria-hidden="true">·</span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold">{vaultCount} Saved</span>
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setIsInstallModalOpen(false)}
        >
          <div 
            className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-rose-500" />
                  <span>Install ApnaStream</span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Add ApnaStream to your home screen for quick access and offline playback.
                </p>
              </div>
              <button
                onClick={() => setIsInstallModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1">
                <div className="font-semibold text-zinc-900 dark:text-white">Android (Chrome)</div>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Tap the browser menu (⋮) and select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                </p>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1">
                <div className="font-semibold text-zinc-900 dark:text-white">iPhone & iPad (Safari)</div>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Tap the <strong>Share</strong> button and select <strong>"Add to Home Screen"</strong>.
                </p>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1">
                <div className="font-semibold text-zinc-900 dark:text-white">Desktop (Chrome / Edge)</div>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Click the <strong>Install</strong> icon on the right side of the address bar.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setIsInstallModalOpen(false)}
                className="min-h-[40px] px-5 py-2 bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white rounded-xl transition-colors"
              >
                Done
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
