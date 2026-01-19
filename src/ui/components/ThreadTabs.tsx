import { useMemo } from "react";

export interface ThreadInfo {
  id: string;
  model: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  messageCount: number;
  hasChanges: boolean;
}

export interface ThreadTabsProps {
  threads: ThreadInfo[];
  activeThreadId: string;
  onThreadSelect: (threadId: string) => void;
  layout?: 'tabs' | 'columns';
}

export function ThreadTabs({ threads, activeThreadId, onThreadSelect, layout = 'tabs' }: ThreadTabsProps) {
  const sortedThreads = useMemo(() => {
    return [...threads].sort((a, b) => {
      if (a.status === 'running') return -1;
      if (b.status === 'running') return 1;
      return 0;
    });
  }, [threads]);

  const getStatusColor = (status: ThreadInfo['status']) => {
    switch (status) {
      case 'running': return 'text-info bg-info/10 border-info/30';
      case 'completed': return 'text-success bg-success/10 border-success/30';
      case 'error': return 'text-error bg-error/10 border-error/30';
      default: return 'text-ink-600 bg-ink-100 border-ink-200';
    }
  };

  const getStatusDot = (status: ThreadInfo['status']) => {
    const colors = {
      running: 'bg-info animate-pulse',
      completed: 'bg-success',
      error: 'bg-error',
      idle: 'bg-ink-400'
    };
    return colors[status];
  };

  if (layout === 'columns') {
    // Multi-column layout for comparing multiple threads side by side
    return (
      <div className="flex gap-4 overflow-x-auto pb-2">
        {sortedThreads.map((thread) => (
          <div
            key={thread.id}
            onClick={() => onThreadSelect(thread.id)}
            className={`flex-shrink-0 w-80 rounded-xl border p-3 cursor-pointer transition-all ${
              activeThreadId === thread.id
                ? 'border-accent/50 bg-accent/5 ring-1 ring-accent/20'
                : 'border-ink-900/10 bg-surface hover:border-ink-900/20'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${getStatusDot(thread.status)}`} />
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${getStatusColor(thread.status)}`}>
                {thread.status}
              </span>
            </div>
            <div className="text-sm font-medium text-ink-800 truncate">{thread.model}</div>
            <div className="text-xs text-muted mt-1">{thread.messageCount} messages</div>
            {thread.hasChanges && (
              <div className="text-xs text-accent mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Has file changes
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Tabs layout (default)
  return (
    <div className="flex gap-1 bg-ink-100 p-1 rounded-lg">
      {sortedThreads.map((thread) => (
        <button
          key={thread.id}
          onClick={() => onThreadSelect(thread.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeThreadId === thread.id
              ? 'bg-white text-ink-800 shadow-sm'
              : 'text-ink-600 hover:bg-white/50 hover:text-ink-800'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${getStatusDot(thread.status)}`} />
          <span className="truncate max-w-[150px]">{thread.model}</span>
          <span className="text-xs text-muted">({thread.messageCount})</span>
          {thread.hasChanges && (
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          )}
        </button>
      ))}
    </div>
  );
}
