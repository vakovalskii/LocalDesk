import { useCallback, useEffect, useRef } from "react";
import type { ClientEvent } from "../types";
import { useAppStore } from "../store/useAppStore";

const DEFAULT_ALLOWED_TOOLS = "Read,Edit,Bash";
const MAX_ROWS = 12;
const LINE_HEIGHT = 21;
const MAX_HEIGHT = MAX_ROWS * LINE_HEIGHT;

interface PromptInputProps {
  sendEvent: (event: ClientEvent) => void;
}

export function usePromptActions(sendEvent: (event: ClientEvent) => void) {
  const prompt = useAppStore((state) => state.prompt);
  const cwd = useAppStore((state) => state.cwd);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const sessions = useAppStore((state) => state.sessions);
  const setPrompt = useAppStore((state) => state.setPrompt);
  const setPendingStart = useAppStore((state) => state.setPendingStart);
  const setGlobalError = useAppStore((state) => state.setGlobalError);
  const selectedModel = useAppStore((state) => state.selectedModel);
  const setSelectedModel = useAppStore((state) => state.setSelectedModel);
  const selectedTemperature = useAppStore((state) => state.selectedTemperature);
  const sendTemperature = useAppStore((state) => state.sendTemperature);
  const pendingAttachments = useAppStore((state) => state.pendingAttachments);
  const clearAttachments = useAppStore((state) => state.clearAttachments);

  const activeSession = activeSessionId ? sessions[activeSessionId] : undefined;
  const isRunning = activeSession?.status === "running";

  const handleSend = useCallback(async () => {
    const trimmedPrompt = prompt.trim();
    const hasAttachments = pendingAttachments.length > 0;

    // For existing sessions, require a prompt
    if (activeSessionId && !trimmedPrompt && !hasAttachments) return;

    if (!activeSessionId) {
      // Starting new session - can be empty for chat-only mode
      setPendingStart(true);
      
      // Generate title from first 3 words of prompt
      let title = "New Chat";
      if (trimmedPrompt) {
        const words = trimmedPrompt.split(/\s+/).slice(0, 3);
        title = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
      }
      sendEvent({
        type: "session.start",
        payload: {
          title,
          prompt: trimmedPrompt, // Can be empty string
          cwd: cwd.trim() || undefined,
          allowedTools: DEFAULT_ALLOWED_TOOLS,
          model: selectedModel || undefined,
          temperature: sendTemperature ? selectedTemperature : undefined,
          attachments: hasAttachments ? pendingAttachments : undefined
        }
      });
      // Clear selected model after starting session
      setSelectedModel(null);
    } else {
      if (activeSession?.status === "running") {
        setGlobalError("Session is still running. Please wait for it to finish.");
        return;
      }
      sendEvent({ type: "session.continue", payload: { sessionId: activeSessionId, prompt: trimmedPrompt, attachments: hasAttachments ? pendingAttachments : undefined } });
    }
    setPrompt("");
    clearAttachments();
  }, [activeSession, activeSessionId, cwd, pendingAttachments, clearAttachments, prompt, sendEvent, setGlobalError, setPendingStart, setPrompt, selectedModel, setSelectedModel, selectedTemperature, sendTemperature]);

  const handleStop = useCallback(() => {
    if (!activeSessionId) return;
    sendEvent({ type: "session.stop", payload: { sessionId: activeSessionId } });
  }, [activeSessionId, sendEvent]);

  const handleStartFromModal = useCallback(() => {
    // Allow starting chat without cwd or prompt
    // If no cwd, file operations will be blocked by tools-executor
    handleSend();
  }, [handleSend]);

  return { prompt, setPrompt, isRunning, handleSend, handleStop, handleStartFromModal };
}

export function PromptInput({ sendEvent }: PromptInputProps) {
  const { prompt, setPrompt, isRunning, handleSend, handleStop } = usePromptActions(sendEvent);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingAttachments = useAppStore((state) => state.pendingAttachments);
  const attachmentPreviews = useAppStore((state) => state.attachmentPreviews);
  const addAttachment = useAppStore((state) => state.addAttachment);
  const removeAttachment = useAppStore((state) => state.removeAttachment);
  const removeAttachmentPreview = useAppStore((state) => state.removeAttachmentPreview);
  const setAttachmentPreview = useAppStore((state) => state.setAttachmentPreview);
  const setGlobalError = useAppStore((state) => state.setGlobalError);
  const cwd = useAppStore((state) => state.cwd);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const sessions = useAppStore((state) => state.sessions);
  const activeSession = activeSessionId ? sessions[activeSessionId] : undefined;
  const attachmentCwd = activeSession?.cwd || cwd;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isRunning) { handleStop(); return; }
      handleSend();
      return;
    }
    
    // Shift+Enter - allow multiline (default behavior)
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = "auto";
    const scrollHeight = target.scrollHeight;
    if (scrollHeight > MAX_HEIGHT) {
      target.style.height = `${MAX_HEIGHT}px`;
      target.style.overflowY = "auto";
    } else {
      target.style.height = `${scrollHeight}px`;
      target.style.overflowY = "hidden";
    }
  };

  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItems = items.filter((item) => item.type.startsWith("image/"));
    if (imageItems.length === 0) return;

    const hasText = e.clipboardData?.types?.includes("text/plain");
    if (!hasText) {
      e.preventDefault();
    }

    if (!attachmentCwd || !attachmentCwd.trim()) {
      setGlobalError("Select a workspace folder before pasting images.");
      return;
    }

    for (const item of imageItems) {
      const file = item.getAsFile();
      if (!file) continue;
      try {
        const dataUrl = await fileToDataUrl(file);
        // Show preview immediately while saving to disk
        const result = await window.electron.savePastedImage({
          dataUrl,
          cwd: attachmentCwd,
          fileName: file.name || undefined
        });
        if (result?.path) {
          addAttachment({
            path: result.path,
            name: result.name || file.name || undefined,
            mime: result.mime || file.type || undefined,
            size: typeof result.size === "number" ? result.size : file.size
          });
          setAttachmentPreview(result.path, dataUrl);
          try {
            const preview = await window.electron.getImagePreview({ cwd: attachmentCwd, path: result.path });
            if (preview?.dataUrl) {
              setAttachmentPreview(result.path, preview.dataUrl);
            }
          } catch (previewError) {
            console.warn("Failed to load image preview:", previewError);
          }
        }
      } catch (error: any) {
        console.error("Failed to save pasted image:", error);
        setGlobalError(error?.message || "Failed to paste image.");
      }
    }
  }, [addAttachment, attachmentCwd, setAttachmentPreview, setGlobalError]);

  useEffect(() => {
    if (!promptRef.current) return;
    promptRef.current.style.height = "auto";
    const scrollHeight = promptRef.current.scrollHeight;
    if (scrollHeight > MAX_HEIGHT) {
      promptRef.current.style.height = `${MAX_HEIGHT}px`;
      promptRef.current.style.overflowY = "auto";
    } else {
      promptRef.current.style.height = `${scrollHeight}px`;
      promptRef.current.style.overflowY = "hidden";
    }
  }, [prompt]);

  return (
    <section className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-surface via-surface to-transparent pb-6 px-2 lg:pb-8 pt-8 lg:ml-[280px]">
      <div className="mx-auto w-full max-w-full">
        <div className="flex w-full items-end gap-3 rounded-2xl border border-ink-900/10 bg-surface px-4 py-3 shadow-card">
          <div className="flex-1">
            {pendingAttachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {pendingAttachments.map((attachment) => (
                  <div
                    key={attachment.path}
                    className="flex items-center gap-2 rounded-lg border border-ink-900/10 bg-surface-secondary px-2.5 py-1.5 text-xs text-ink-700"
                  >
                    {attachmentPreviews[attachment.path] ? (
                      <img
                        src={attachmentPreviews[attachment.path]}
                        alt={attachment.name || "attachment preview"}
                        className="h-9 w-9 rounded-md object-cover border border-ink-900/10"
                      />
                    ) : (
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-surface-tertiary text-[10px] text-muted">
                        IMG
                      </span>
                    )}
                    <span className="font-medium">Image</span>
                    <span className="truncate max-w-[220px]">{attachment.name || attachment.path}</span>
                    <button
                      type="button"
                      onClick={() => {
                        removeAttachment(attachment.path);
                        removeAttachmentPreview(attachment.path);
                      }}
                      className="text-ink-400 hover:text-error transition-colors"
                      aria-label="Remove attachment"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <textarea
              rows={1}
              className="w-full resize-none bg-transparent py-1.5 text-sm text-ink-800 placeholder:text-muted focus:outline-none"
              placeholder="Describe what you want agent to handle..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onInput={handleInput}
              ref={promptRef}
            />
          </div>
          <button
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${isRunning ? "bg-error text-white hover:bg-error/90" : "bg-accent text-white hover:bg-accent-hover"}`}
            onClick={isRunning ? handleStop : handleSend}
            aria-label={isRunning ? "Stop session" : "Send prompt"}
          >
            {isRunning ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="M3.4 20.6 21 12 3.4 3.4l2.8 7.2L16 12l-9.8 1.4-2.8 7.2Z" fill="currentColor" /></svg>
            )}
          </button>
        </div>
        <div className="mt-2 px-2 text-xs text-muted text-center">
          Press <span className="font-medium text-ink-700">Enter</span> to send • <span className="font-medium text-ink-700">Shift + Enter</span> for new line
        </div>
      </div>
    </section>
  );
}
