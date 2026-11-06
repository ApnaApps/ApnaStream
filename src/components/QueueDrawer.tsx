import React from 'react';
import { 
  Download, Pause, Play, Trash2, CheckCircle2, X 
} from 'lucide-react';
import { DownloadTask, downloadManager } from '../utils/downloadEngine';
import { formatBytes } from '../utils/db';
import { PLATFORMS } from '../utils/platformHelper';

interface QueueDrawerProps {
  tasks: DownloadTask[];
  isOpen: boolean;
  onClose: () => void;
  onPlayItem: (task: DownloadTask) => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  tasks,
  isOpen,
  onClose,
  onPlayItem
}) => {
  if (!isOpen) return null;

  const activeCount = tasks.filter(t => t.status === 'downloading' || t.status === 'queued' || t.status === 'processing').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  return (
    <div 
      className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Download Queue</h2>
              {activeCount > 0 && (
                <span className="text-xs font-mono tabular-nums text-rose-600 dark:text-rose-400 font-semibold">
                  ({activeCount} active)
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tasks.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-zinc-500">
              <Download className="w-9 h-9 stroke-[1.5] mb-2 text-zinc-400 dark:text-zinc-600" />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No active downloads</p>
              <p className="text-xs text-zinc-500 max-w-xs mt-1">
                Paste a video link and tap Fetch to start downloading.
              </p>
            </div>
          ) : (
            tasks.map((task) => (
              <div 
                key={task.id}
                className="bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-3.5 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0 border border-zinc-200 dark:border-zinc-800">
                    {task.thumbnail ? (
                      <img 
                        src={task.thumbnail} 
                        alt="" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-800" />
                    )}
                    <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[10px] font-mono tabular-nums px-1 rounded text-white">
                      {task.duration}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {task.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                      {task.platform && PLATFORMS[task.platform] && (
                        <>
                          <span className={`font-semibold ${PLATFORMS[task.platform].accentClass}`}>
                            {PLATFORMS[task.platform].name}
                          </span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span className="font-mono text-rose-600 dark:text-rose-400 font-medium truncate">
                        {task.qualityLabel}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {task.status === 'downloading' && (
                      <button
                        onClick={() => downloadManager.pauseTask(task.id)}
                        className="min-h-[34px] min-w-[34px] p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center"
                        title="Pause"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    )}

                    {task.status === 'paused' && (
                      <button
                        onClick={() => downloadManager.resumeTask(task.id)}
                        className="min-h-[34px] min-w-[34px] p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center"
                        title="Resume"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => downloadManager.removeTask(task.id)}
                      className="min-h-[34px] min-w-[34px] p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-200 ${
                        task.status === 'completed' 
                          ? 'bg-emerald-500' 
                          : task.status === 'error'
                          ? 'bg-red-500'
                          : task.status === 'paused'
                          ? 'bg-amber-500'
                          : 'bg-rose-600'
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                    <span className="truncate max-w-[65%] text-zinc-700 dark:text-zinc-300">
                      {task.currentStage}
                    </span>
                    <div className="flex items-center gap-2">
                      {task.status === 'downloading' && (
                        <span className="text-rose-600 dark:text-rose-400">{task.speedFormatted}</span>
                      )}
                      <span className="font-semibold text-zinc-900 dark:text-zinc-200">{task.progress}%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono tabular-nums">
                    <span>{formatBytes(task.downloadedBytes)} / {formatBytes(task.totalBytes)}</span>
                    {task.status === 'completed' && (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-sans font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Saved
                      </span>
                    )}
                  </div>
                </div>

                {task.status === 'completed' && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => onPlayItem(task)}
                      className="flex-1 min-h-[38px] py-1.5 px-3 rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play</span>
                    </button>

                    <button
                      onClick={() => downloadManager.exportToFile({ blob: task.blob, title: task.title, container: task.container })}
                      className="min-h-[38px] py-1.5 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Save File</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {tasks.length > 0 && (
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between text-xs text-zinc-500">
            <span>{completedCount} of {tasks.length} completed</span>
          </div>
        )}
      </div>
    </div>
  );
};
