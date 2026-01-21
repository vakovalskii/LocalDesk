import { BrowserWindow } from "electron";
import { sendNotification } from "./libs/notification-service.js";
import {
  buildNotificationBody,
  extractResponseText,
} from "./libs/notification-preview.js";
import { shouldNotifyForSession } from "./libs/notification-routing.js";
import type { ServerEvent } from "./types.js";

/**
 * Represents a subscription of a window to a session
 */
export interface SessionSubscription {
  windowId: number;
  webContents: Electron.WebContents;
  sessionId: string | null; // null = окно не привязано к сессии
}

/**
 * SessionManager manages the relationship between windows and sessions.
 * Each window can be subscribed to one session at a time.
 * Events are routed only to windows that are subscribed to the session.
 */
class SessionManager {
  private subscriptions = new Map<number, SessionSubscription>();
  private latestResponses = new Map<string, string>();

  private rememberLatestResponse(sessionId: string, message: unknown) {
    const text = extractResponseText(message as any);
    if (!text) return;
    this.latestResponses.set(sessionId, text);
  }

  private getFocusedSessionId(): string | null {
    const focusedWindow = BrowserWindow.getAllWindows().find((w) =>
      w.isFocused(),
    );
    if (!focusedWindow) return null;
    const sub = this.subscriptions.get(focusedWindow.id);
    return sub?.sessionId ?? null;
  }

  /**
   * Register a window and create its subscription
   * @param win The BrowserWindow to register
   * @returns The window ID
   */
  registerWindow(win: BrowserWindow): number {
    const subscription: SessionSubscription = {
      windowId: win.id,
      webContents: win.webContents,
      sessionId: null,
    };
    this.subscriptions.set(win.id, subscription);

    // Cleanup when window is closed
    win.on("closed", () => {
      this.subscriptions.delete(win.id);
    });

    console.log(`[SessionManager] Registered window ${win.id}`);
    return win.id;
  }

  /**
   * Set the active session for a window
   * @param windowId The window ID
   * @param sessionId The session ID to subscribe to, or null to unsubscribe
   */
  setWindowSession(windowId: number, sessionId: string | null) {
    const sub = this.subscriptions.get(windowId);
    if (sub) {
      const oldSessionId = sub.sessionId;
      sub.sessionId = sessionId;
      console.log(
        `[SessionManager] Window ${windowId} subscribed to session ${sessionId}` +
          (oldSessionId ? ` (was: ${oldSessionId})` : ""),
      );
    }
  }

  /**
   * Get all windows subscribed to a specific session
   * @param sessionId The session ID
   * @returns Array of window IDs
   */
  getSessionWindows(sessionId: string): number[] {
    const windowIds: number[] = [];
    for (const sub of this.subscriptions.values()) {
      if (sub.sessionId === sessionId) {
        windowIds.push(sub.windowId);
      }
    }
    return windowIds;
  }

  /**
   * Extract sessionId from an event payload
   * @param event The server event
   * @returns The session ID or null if not found
   */
  private getSessionId(event: ServerEvent): string | null {
    if ("sessionId" in event.payload) {
      return (event.payload as any).sessionId;
    }
    return null;
  }

  /**
   * Emit an event to ALL windows (for global updates like session.status)
   * @param event The server event to emit
   */
  emitToAll(event: ServerEvent) {
    for (const sub of this.subscriptions.values()) {
      sub.webContents.send("server-event", JSON.stringify(event));
    }
  }

  /**
   * Emit an event to appropriate windows based on sessionId
   * @param event The server event to emit
   * @param broadcastFunc Fallback broadcast function for events without sessionId
   */
  emit(event: ServerEvent, broadcastFunc: (e: ServerEvent) => void) {
    const sessionId = this.getSessionId(event);

    if (event.type === "stream.message") {
      this.rememberLatestResponse(
        event.payload.sessionId,
        event.payload.message,
      );
    }

    if (event.type === "session.deleted") {
      this.latestResponses.delete(event.payload.sessionId);
    }

    // session.status should go to ALL windows so sidebar can update
    if (event.type === "session.status") {
      this.emitToAll(event);

      try {
        const status = (event.payload as any).status;
        const title = (event.payload as any).title || "Session";
        const payloadSessionId = (event.payload as any).sessionId;

        // Notify when session completes/errors and the focused window isn't on that session
        if (
          shouldNotifyForSession(
            status,
            payloadSessionId,
            this.getFocusedSessionId(),
          )
        ) {
          if (payloadSessionId) {
            const body = buildNotificationBody(
              this.latestResponses.get(payloadSessionId) || "",
            );
            void sendNotification(title, body, { sessionId: payloadSessionId });
          }
        }
      } catch (e) {
        // ignore notification errors
      }
      return;
    }

    if (!sessionId) {
      // Events without sessionId go to all windows (session.list, models.loaded, etc.)
      broadcastFunc(event);
      return;
    }

    // Send only to windows subscribed to this session
    const targetWindows = this.getSessionWindows(sessionId);
    if (targetWindows.length === 0) {
      // No windows subscribed to this session
      console.warn(
        `[SessionManager] No windows subscribed to session ${sessionId}, event ${event.type} not delivered`,
      );
      return;
    }

    for (const windowId of targetWindows) {
      this.emitToWindow(windowId, event);
    }
  }

  /**
   * Emit an event to a specific window
   * @param windowId The target window ID
   * @param event The server event to send
   */
  emitToWindow(windowId: number, event: ServerEvent) {
    const sub = this.subscriptions.get(windowId);
    if (!sub) {
      console.warn(
        `[SessionManager] No subscription found for window ${windowId}`,
      );
      return;
    }
    sub.webContents.send("server-event", JSON.stringify(event));
  }

  /**
   * Get statistics about current subscriptions
   * @returns Object with subscription counts
   */
  getStats() {
    const totalWindows = this.subscriptions.size;
    const subscribedWindows = Array.from(this.subscriptions.values()).filter(
      (s) => s.sessionId !== null,
    ).length;
    const sessions = new Set(
      Array.from(this.subscriptions.values())
        .map((s) => s.sessionId)
        .filter((id): id is string => id !== null),
    );
    return {
      totalWindows,
      subscribedWindows,
      totalSessions: sessions.size,
    };
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
