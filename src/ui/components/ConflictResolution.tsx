import { useState } from "react";

export interface FileConflict {
  filePath: string;
  threads: Array<{
    threadId: string;
    model: string;
    linesAdded: number;
    linesRemoved: number;
    contentNew: string;
  }>;
}

export interface ConflictResolutionProps {
  conflicts: FileConflict[];
  onResolveConflict: (filePath: string, selectedThreadId: string) => void;
  onRejectAll: () => void;
}

export function ConflictResolution({ conflicts, onResolveConflict, onRejectAll }: ConflictResolutionProps) {
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(new Set());

  if (!conflicts || conflicts.length === 0) {
    return null;
  }

  const toggleConflict = (filePath: string) => {
    const newExpanded = new Set(expandedConflicts);
    if (newExpanded.has(filePath)) {
      newExpanded.delete(filePath);
    } else {
      newExpanded.add(filePath);
    }
    setExpandedConflicts(newExpanded);
  };

  return (
    <div className="rounded-xl border border-error/30 bg-error/5 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-error/10 border-b border-error/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h4 className="text-sm font-medium text-error">
              File Conflicts ({conflicts.length})
            </h4>
          </div>
          <button
            onClick={onRejectAll}
            className="text-xs font-medium text-error hover:text-error/80 px-3 py-1.5 rounded-md border border-error/30 hover:bg-error/10 transition-colors"
          >
            Reject All Changes
          </button>
        </div>
        <p className="text-xs text-error/70 mt-1">
          These files were modified by multiple threads. Choose which version to apply.
        </p>
      </div>

      {/* Conflicts list */}
      <div className="divide-y divide-error/10">
        {conflicts.map((conflict) => {
          const isExpanded = expandedConflicts.has(conflict.filePath);
          return (
            <div key={conflict.filePath} className="px-4 py-3">
              <div
                className="flex items-center justify-between cursor-pointer hover:bg-error/5 -mx-4 px-4 py-3 transition-colors"
                onClick={() => toggleConflict(conflict.filePath)}
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-error flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-ink-800 font-mono truncate max-w-md">
                      {conflict.filePath}
                    </div>
                    <div className="text-xs text-error/70">
                      Modified by {conflict.threads.length} thread{conflict.threads.length > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <svg
                  className={`w-4 h-4 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {isExpanded && (
                <div className="mt-3 pl-8">
                  <div className="space-y-2">
                    {conflict.threads.map((thread) => (
                      <div
                        key={thread.threadId}
                        className="flex items-start gap-3 p-3 rounded-lg bg-white border border-error/20 hover:border-error/40 transition-colors"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <input
                            type="radio"
                            name={`conflict-${conflict.filePath}`}
                            id={`thread-${thread.threadId}`}
                            onChange={() => onResolveConflict(conflict.filePath, thread.threadId)}
                            className="w-4 h-4 text-accent border-ink-300 focus:ring-accent focus:ring-offset-0"
                          />
                        </div>
                        <label
                          htmlFor={`thread-${thread.threadId}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-ink-800">
                              {thread.model}
                            </span>
                            <span className="text-xs text-muted">({thread.threadId})</span>
                          </div>
                          <div className="flex gap-3 text-xs">
                            <span className="text-success font-medium">+{thread.linesAdded} lines</span>
                            <span className="text-error font-medium">-{thread.linesRemoved} lines</span>
                          </div>
                          <div className="mt-2 p-2 rounded bg-surface-tertiary max-h-32 overflow-y-auto">
                            <pre className="text-xs text-ink-600 whitespace-pre-wrap font-mono">
                              {thread.contentNew.slice(0, 200)}
                              {thread.contentNew.length > 200 ? '...' : ''}
                            </pre>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
