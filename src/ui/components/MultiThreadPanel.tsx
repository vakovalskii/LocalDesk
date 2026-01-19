import { useMemo } from "react";
import type { MultiThreadTask, SessionInfo } from "../types";

interface MultiThreadPanelProps {
  multiThreadTasks: Record<string, MultiThreadTask>;
  sessions: Record<string, SessionInfo>;
  onSelectSession: (sessionId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

export function MultiThreadPanel({
  multiThreadTasks,
  sessions,
  onSelectSession,
  onDeleteTask
}: MultiThreadPanelProps) {
  const sortedTasks = useMemo(() => {
    return Object.values(multiThreadTasks).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [multiThreadTasks]);

  if (sortedTasks.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 px-4 py-3 border-b border-ink-900/10 bg-ink-50/30">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-ink-700">🚀 Multi-Thread Tasks</span>
        <span className="text-xs text-muted">({sortedTasks.length})</span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {sortedTasks.map((task) => {
          const threads = task.threadIds.map(id => sessions[id]).filter(Boolean);
          const runningCount = threads.filter(t => t?.status === "running").length;
          const completedCount = threads.filter(t => t?.status === "completed").length;
          const errorCount = threads.filter(t => t?.status === "error").length;
          const totalCount = threads.length;

          const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
          const isRunning = runningCount > 0;
          const isCompleted = completedCount === totalCount && totalCount > 0;

          return (
            <div
              key={task.id}
              className={`flex-shrink-0 w-72 rounded-xl border p-3 transition-all ${
                isCompleted
                  ? 'border-success/30 bg-success/5'
                  : isRunning
                    ? 'border-info/30 bg-info/5'
                    : 'border-ink-900/10 bg-surface'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isRunning && (
                    <span className="w-2 h-2 rounded-full bg-info animate-pulse" />
                  )}
                  <span className="text-xs font-semibold text-ink-700 truncate">
                    {task.title}
                  </span>
                </div>
                <button
                  onClick={() => onDeleteTask(task.id)}
                  className="text-muted hover:text-error transition-colors flex-shrink-0"
                  title="Remove task"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Mode badge */}
              <div className="flex items-center gap-1 mb-2">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-accent/10 text-accent">
                  {task.mode === 'consensus' ? 'Consensus' : 'Different Tasks'}
                </span>
                {task.shareWebCache && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-ink-100 text-ink-600">
                    Shared Cache
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isCompleted
                      ? 'bg-success'
                      : isRunning
                        ? 'bg-info'
                        : 'bg-ink-300'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Status */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">
                  {completedCount}/{totalCount} threads done
                </span>
                {isRunning && (
                  <span className="text-info font-medium">
                    {runningCount} running...
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="text-error font-medium">
                    {errorCount} errors
                  </span>
                )}
              </div>

              {/* Thread list - mini */}
              <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                {threads.map((thread, idx) => (
                  <button
                    key={thread.id}
                    onClick={() => onSelectSession(thread.id)}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-ink-50 transition-colors text-left"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        thread.status === 'running'
                          ? 'bg-info animate-pulse'
                          : thread.status === 'completed'
                            ? 'bg-success'
                            : thread.status === 'error'
                              ? 'bg-error'
                              : 'bg-ink-300'
                      }`}
                    />
                    <span className="text-xs text-ink-600 truncate flex-1">
                      {thread.model || 'Unknown'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
