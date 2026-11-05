import React, { useState, useEffect } from 'react';
import { 
  HardDrive, Play, Download, Trash2, Search, Filter, 
  Film, Music, Sparkles, CheckCircle2, AlertTriangle, Radio
} from 'lucide-react';
import { 
  OfflineMediaItem, getAllOfflineMedia, deleteOfflineMedia, 
  getStorageQuota, formatBytes 
} from '../utils/db';
import { downloadManager } from '../utils/downloadEngine';
import { PLATFORMS, SocialPlatform } from '../utils/platformHelper';

interface OfflineVaultProps {
  onPlayMedia: (item: OfflineMediaItem) => void;
  onExploreSamples: () => void;
  isOfflineSimulated: boolean;
  onToggleOfflineSimulation: () => void;
}

export const OfflineVault: React.FC<OfflineVaultProps> = ({
  onPlayMedia,
  onExploreSamples,
  isOfflineSimulated,
  onToggleOfflineSimulation
}) => {
  const [items, setItems] = useState<OfflineMediaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<'all' | 'video' | 'audio'>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [storageInfo, setStorageInfo] = useState<{
    usedFormatted: string;
    quotaFormatted: string;
    percentUsed: number;
  }>({
    usedFormatted: '0 MB',
    quotaFormatted: '10 GB',
    percentUsed: 0
  });

  const loadVaultData = async () => {
    try {
      setLoading(true);
      const mediaList = await getAllOfflineMedia();
      setItems(mediaList);
      const quota = await getStorageQuota();
      setStorageInfo({
        usedFormatted: quota.usedFormatted,
        quotaFormatted: quota.quotaFormatted,
        percentUsed: quota.percentUsed
      });
    } catch (err) {
      console.error('Failed to load vault items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVaultData();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this offline video from your local vault?')) {
      await deleteOfflineMedia(id);
      await loadVaultData();
    }
  };

  const handleExport = (item: OfflineMediaItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.blob) {
      downloadManager.exportToFile({
        blob: item.blob,
        title: item.title,
        container: item.container
      });
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesType = filterType === 'all' || item.fileType === filterType;
    const itemPlatform = item.platform || 'youtube';
    const matchesPlatform = selectedPlatform === 'all' || itemPlatform === selectedPlatform;
    const matchesSearch = 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.channel.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesPlatform && matchesSearch;
  });

  const totalVaultBytes = items.reduce((sum, item) => sum + (item.sizeBytes || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Storage Bar */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-950/80 border border-rose-800/60 rounded-xl text-rose-400">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Offline Media Vault</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  High-definition videos and master audio cached in browser storage for zero-data playback
                </p>
              </div>
            </div>
          </div>

          {/* Offline Mode Simulation Switcher */}
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleOfflineSimulation}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                isOfflineSimulated
                  ? 'bg-amber-950/80 text-amber-300 border-amber-700/80 shadow-md shadow-amber-950/40'
                  : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${isOfflineSimulated ? 'animate-pulse text-amber-400' : ''}`} />
              <span>{isOfflineSimulated ? 'Simulated Offline Mode: ON' : 'Test Offline Mode'}</span>
            </button>

            <button
              onClick={loadVaultData}
              className="text-xs text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-zinc-800"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Storage stats metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3">
            <div className="text-[11px] text-zinc-400 font-medium">Vault Items</div>
            <div className="text-lg font-bold text-white mt-1">
              {items.length} <span className="text-xs text-zinc-500 font-normal">files stored</span>
            </div>
          </div>

          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3">
            <div className="text-[11px] text-zinc-400 font-medium">Vault Storage</div>
            <div className="text-lg font-bold text-rose-400 mt-1">
              {formatBytes(totalVaultBytes)}
            </div>
          </div>

          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium">
              <span>Device Disk Quota</span>
              <span className="font-mono text-zinc-300">{storageInfo.usedFormatted} / {storageInfo.quotaFormatted}</span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-2">
              <div 
                className="bg-rose-500 h-full rounded-full transition-all"
                style={{ width: `${Math.max(2, storageInfo.percentUsed)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Interactive Segmented Filter Tabs */}
        <div className="flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filterType === 'all'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All Media ({items.length})
          </button>
          <button
            onClick={() => setFilterType('video')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              filterType === 'video'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Videos ({items.filter(i => i.fileType === 'video').length})</span>
          </button>
          <button
            onClick={() => setFilterType('audio')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              filterType === 'audio'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Audio ({items.filter(i => i.fileType === 'audio').length})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search saved videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
          />
        </div>
      </div>

      {/* Platform Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setSelectedPlatform('all')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
            selectedPlatform === 'all'
              ? 'bg-zinc-800 text-white border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/60 border border-zinc-800/80'
          }`}
        >
          <span>All Platforms ({items.length})</span>
        </button>

        {(['youtube', 'tiktok', 'instagram', 'facebook', 'pinterest'] as SocialPlatform[]).map((plat) => {
          const cfg = PLATFORMS[plat];
          const count = items.filter((i) => (i.platform || 'youtube') === plat).length;
          const isActive = selectedPlatform === plat;
          return (
            <button
              key={plat}
              onClick={() => setSelectedPlatform(plat)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                isActive
                  ? `${cfg.bgClass} ${cfg.accentClass} ${cfg.borderClass} border`
                  : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/60 border border-zinc-800/80'
              }`}
            >
              {cfg.icon({ className: 'w-3.5 h-3.5' })}
              <span>{cfg.name}</span>
              <span className="text-[10px] opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Media Grid */}
      {loading ? (
        <div className="h-64 flex items-center justify-center text-zinc-500">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-rose-500 border-t-transparent" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-zinc-900/40 border border-dashed border-zinc-800 rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 flex items-center justify-center mx-auto text-zinc-400">
            <HardDrive className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">No media found</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
              {searchQuery || selectedPlatform !== 'all' || filterType !== 'all'
                ? 'Try clearing the search query or platform filter to see your downloaded videos.'
                : 'Download high-definition videos from YouTube, TikTok, Instagram, Facebook, or Pinterest to access offline anytime.'}
            </p>
          </div>
          <button
            onClick={onExploreSamples}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white rounded-xl transition-colors shadow-lg shadow-rose-950/30"
          >
            <Download className="w-4 h-4" />
            <span>Go to Video Downloader</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => {
            const itemPlatform = item.platform || 'youtube';
            const platConfig = PLATFORMS[itemPlatform];
            return (
              <div
                key={item.id}
                onClick={() => onPlayMedia(item)}
                className="group bg-zinc-900/60 border border-zinc-800/90 hover:border-zinc-700 rounded-2xl overflow-hidden flex flex-col cursor-pointer transition-all hover:shadow-xl hover:shadow-black/50"
              >
                {/* Thumbnail Container */}
                <div className="relative aspect-video bg-zinc-950 overflow-hidden">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-700" />
                  )}
                  
                  {/* Duration badge */}
                  <div className="absolute bottom-2 right-2 bg-black/85 backdrop-blur-sm text-[11px] font-mono text-white px-2 py-0.5 rounded-md">
                    {item.duration}
                  </div>

                  {/* Quality badge */}
                  <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm text-[10px] font-semibold text-rose-400 px-2 py-0.5 rounded-md border border-rose-900/40">
                    {item.qualityLabel}
                  </div>

                  {/* Platform badge */}
                  {platConfig && (
                    <div className="absolute top-2 right-2 bg-black/85 backdrop-blur-sm text-[10px] font-medium px-2 py-0.5 rounded-md border border-zinc-800 text-zinc-200 flex items-center gap-1.5 shadow-sm">
                      {platConfig.icon({ className: `w-3 h-3 ${platConfig.accentClass}` })}
                      <span>{platConfig.name}</span>
                    </div>
                  )}

                  {/* Hover Play Splash */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                      <Play className="w-5 h-5 ml-0.5 fill-white" />
                    </div>
                  </div>
                </div>

              {/* Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug group-hover:text-rose-400 transition-colors">
                    {item.title}
                  </h3>
                  
                  {/* Clean unboxed metadata with separators */}
                  <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1.5">
                    <span className="truncate max-w-[130px]">{item.channel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-zinc-300">{item.sizeFormatted}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-[11px]">{item.container}</span>
                  </div>
                </div>

                {/* Actions row */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                  <button
                    onClick={() => onPlayMedia(item)}
                    className="text-xs font-semibold text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Watch Offline</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleExport(item, e)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                      title="Export to Disk"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                      title="Delete from Offline Vault"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
};
