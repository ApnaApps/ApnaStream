import React, { useState, useEffect } from 'react';
import { 
  HardDrive, Play, Download, Trash2, Search, 
  Film, Music, Radio
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
    await deleteOfflineMedia(id);
    await loadVaultData();
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
    <div className="space-y-5">
      {/* Compact Vault Header & Storage Summary */}
      <div className="bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
              Offline Vault
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              Saved videos and audio ready for zero-data offline playback
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleOfflineSimulation}
              className={`min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isOfflineSimulated
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/80'
                  : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{isOfflineSimulated ? 'Offline Mode: ON' : 'Test Offline'}</span>
            </button>
          </div>
        </div>

        {/* Clean 3-column metrics */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 pt-1">
          <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-3">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Saved Files</div>
            <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-zinc-900 dark:text-white mt-0.5">
              {items.length}
            </div>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-3">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Vault Size</div>
            <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-0.5">
              {formatBytes(totalVaultBytes)}
            </div>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-3 flex flex-col justify-between">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">Quota Used</div>
            <div className="text-xs sm:text-sm font-bold font-mono tabular-nums text-zinc-800 dark:text-zinc-200 mt-1 truncate">
              {storageInfo.usedFormatted}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center p-1 bg-zinc-200/70 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <button
            onClick={() => setFilterType('all')}
            className={`flex-1 sm:flex-initial min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filterType === 'all'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            All ({items.length})
          </button>
          <button
            onClick={() => setFilterType('video')}
            className={`flex-1 sm:flex-initial min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              filterType === 'video'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Video</span>
          </button>
          <button
            onClick={() => setFilterType('audio')}
            className={`flex-1 sm:flex-initial min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              filterType === 'audio'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Audio</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search saved media..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[38px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* Media Grid */}
      {loading ? (
        <div className="h-52 flex items-center justify-center text-zinc-500">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-rose-500 border-t-transparent" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900/40 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 flex items-center justify-center mx-auto text-zinc-500 dark:text-zinc-400">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">No saved media yet</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto mt-1">
              Paste a video link in the Downloader to save videos for offline playback.
            </p>
          </div>
          <button
            onClick={onExploreSamples}
            className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Go to Downloader</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const itemPlatform = item.platform || 'youtube';
            const platConfig = PLATFORMS[itemPlatform];
            return (
              <div
                key={item.id}
                onClick={() => onPlayMedia(item)}
                className="group bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/90 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl overflow-hidden flex flex-col cursor-pointer transition-all shadow-sm"
              >
                <div className="relative aspect-video bg-zinc-900 overflow-hidden">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-800" />
                  )}
                  
                  <div className="absolute bottom-2 right-2 bg-black/85 text-[11px] font-mono tabular-nums text-white px-2 py-0.5 rounded-md">
                    {item.duration}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white line-clamp-2 leading-snug group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                      {item.title}
                    </h3>
                    
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
                      {platConfig && (
                        <>
                          <span className={`font-semibold ${platConfig.accentClass}`}>{platConfig.name}</span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span className="truncate max-w-[110px]">{item.channel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{item.sizeFormatted}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                    <button
                      onClick={() => onPlayMedia(item)}
                      className="min-h-[38px] text-xs font-semibold text-zinc-900 dark:text-white bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleExport(item, e)}
                        className="min-h-[38px] min-w-[38px] p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center"
                        title="Export File"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => handleDelete(item.id, e)}
                        className="min-h-[38px] min-w-[38px] p-2 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center"
                        title="Delete"
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
