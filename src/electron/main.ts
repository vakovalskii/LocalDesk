import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from "electron";
import { ipcMainHandle, isDev, DEV_PORT } from "./util.js";
import { getPreloadPath, getUIPath, getIconPath } from "./pathResolver.js";
import { getStaticData, pollResources } from "./test.js";
import {
  handleClientEvent,
  sessions,
  startScheduler,
  stopScheduler,
} from "./ipc-handlers.js";
import { sessionManager } from "./session-manager.js";
import {
  sendNotification,
  setNotificationClickHandler,
  // Enable context menu (right-click) with copy/paste/cut and spell check suggestions
  mainWindow.webContents.on("context-menu", (_, params) => {
    const menuTemplate: any[] = [];

    // Add spelling suggestions if there's a misspelled word
    if (params.misspelledWord) {
      params.dictionarySuggestions.slice(0, 5).forEach((suggestion) => {
        menuTemplate.push({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion),
        });
      });

      if (params.dictionarySuggestions.length > 0) {
        menuTemplate.push({ type: "separator" });
      }

      // Add "Add to dictionary" option
      menuTemplate.push({
        label: "Add to Dictionary",
        click: () =>
          mainWindow.webContents.session.addWordToSpellCheckerDictionary(
            params.misspelledWord,
          ),
      });

      menuTemplate.push({ type: "separator" });
    }

    // Standard edit menu items
    menuTemplate.push(
      { label: "Copy", role: "copy", enabled: params.selectionText.length > 0 },
      {
        label: "Cut",
        role: "cut",
        enabled: params.isEditable && params.selectionText.length > 0,
      },
      { label: "Paste", role: "paste", enabled: params.isEditable },
      { type: "separator" },
      { label: "Select All", role: "selectAll" },
    );

    const menu = Menu.buildFromTemplate(menuTemplate);
    menu.popup();
  });
            // Sort: directories first, then files, both alphabetically
            const sorted = files.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            });
            
            console.log(`[FileBrowser] Returning ${sorted.length} items`);
            return sorted;
        } catch (error) {
            console.error('[FileBrowser] Failed to list directory:', error);
            return [];
        }
    });

    // Handle session title generation
    ipcMainHandle("generate-session-title", async (_: any, userInput: string | null) => {
        return await generateSessionTitle(userInput);
    });

    // Handle recent cwds request
    ipcMainHandle("get-recent-cwds", (_: any, limit?: number) => {
        const boundedLimit = limit ? Math.min(Math.max(limit, 1), 20) : 8;
        return sessions.listRecentCwds(boundedLimit);
    });

    // Handle directory selection
    ipcMainHandle("select-directory", async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
>>>>>>> origin/main
        });
      });

      if (params.dictionarySuggestions.length > 0) {
        menuTemplate.push({ type: "separator" });
      }

      // Add "Add to dictionary" option
      menuTemplate.push({
        label: "Add to Dictionary",
        click: () =>
          mainWindow.webContents.session.addWordToSpellCheckerDictionary(
            params.misspelledWord,
          ),
      });

      menuTemplate.push({ type: "separator" });
    }

    // Standard edit menu items
    menuTemplate.push(
      { label: "Copy", role: "copy", enabled: params.selectionText.length > 0 },
      {
        label: "Cut",
        role: "cut",
        enabled: params.isEditable && params.selectionText.length > 0,
      },
      { label: "Paste", role: "paste", enabled: params.isEditable },
      { type: "separator" },
      { label: "Select All", role: "selectAll" },
    );

    const menu = Menu.buildFromTemplate(menuTemplate);
    menu.popup();
  });

  pollResources(mainWindow);

  // Route notification clicks to focus the main window and forward metadata to renderer
  setNotificationClickHandler((meta?: any) => {
    try {
      if (mainWindow) {
        try {
          mainWindow.show();
          mainWindow.focus();
        } catch {}
        if (meta)
          mainWindow.webContents.send(
            "server-event",
            JSON.stringify({ type: "notification.click", payload: meta }),
          );
      }
    } catch (err) {
      console.error("[Main] notification click handler error", err);
    }
  });

  ipcMainHandle("getStaticData", () => {
    return getStaticData();
  });

  // Handle client events
  ipcMain.on("client-event", (event, data: ClientEvent) => {
    // Get window ID from sender's webContents
    const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
    if (windowId === undefined) {
      console.error("[Main] Unable to determine window ID for client event");
      return;
    }
    handleClientEvent(data, windowId);
  });

  // Handle open directory in Finder/Explorer
  ipcMain.on("open-directory", (_, dirPath: string) => {
    shell.openPath(dirPath);
  });

  // Handle open file in system default app
  ipcMain.on("open-file", (_, filePath: string) => {
    shell.openPath(filePath);
  });

  // Handle list directory contents
  ipcMainHandle("list-directory", async (_, dirPath: string) => {
    try {
      console.log("[FileBrowser] Listing directory:", dirPath);

      // Security: Only allow listing directories within the current session's cwd
      // Get all sessions and find one with matching cwd
      const allSessions = sessions.listSessions();
      const sessionCwd = allSessions.find((s) =>
        dirPath.startsWith(s.cwd || ""),
      )?.cwd;

      if (!sessionCwd) {
        console.error("[FileBrowser] No active session cwd found");
        return [];
      }

      // Normalize paths and check if dirPath is within sessionCwd
      const normalizedDirPath = resolve(dirPath);
      const normalizedCwd = resolve(sessionCwd);

      if (!normalizedDirPath.startsWith(normalizedCwd)) {
        console.error(
          "[FileBrowser] Access denied: Path is outside session cwd",
          {
            requested: normalizedDirPath,
            allowed: normalizedCwd,
          },
        );
        return [];
      }

      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      console.log(`[FileBrowser] Found ${entries.length} entries`);

      const files = await Promise.all(
        entries.map(async (entry: any) => {
          const fullPath = join(dirPath, entry.name);
          let size = undefined;

          if (!entry.isDirectory()) {
            try {
              const stats = await fs.stat(fullPath);
              size = stats.size;
            } catch (e) {
              // Ignore stat errors
            }
          }

          return {
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            size,
          };
        }),
      );

      // Sort: directories first, then files, both alphabetically
      const sorted = files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      console.log(`[FileBrowser] Returning ${sorted.length} items`);
      return sorted;
    } catch (error) {
      console.error("[FileBrowser] Failed to list directory:", error);
      return [];
    }
  });

  // Handle session title generation
  ipcMainHandle(
    "generate-session-title",
    async (_: any, userInput: string | null) => {
      return await generateSessionTitle(userInput);
    },
  );

  // Handle recent cwds request
  ipcMainHandle("get-recent-cwds", (_: any, limit?: number) => {
    const boundedLimit = limit ? Math.min(Math.max(limit, 1), 20) : 8;
    return sessions.listRecentCwds(boundedLimit);
  });

  // Handle directory selection
  ipcMainHandle("select-directory", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });

    if (result.canceled) {
      return null;
    }

    return result.filePaths[0];
  });

  // Handle opening path in file manager (Finder/Explorer/etc)
  // Handle read memory
  ipcMainHandle("read-memory", async () => {
    try {
      const { homedir } = await import("os");
      const memoryPath = join(homedir(), ".localdesk", "memory.md");

      try {
        const content = await fs.readFile(memoryPath, "utf-8");
        return content;
      } catch (error: any) {
        if (error.code === "ENOENT") {
          return ""; // File doesn't exist yet
        }
        throw error;
      }
    } catch (error: any) {
      console.error("[Main] Failed to read memory:", error);
      throw error;
    }
  });

  // Handle write memory
  ipcMainHandle("write-memory", async (_, content: string) => {
    try {
      const { homedir } = await import("os");
      const memoryDir = join(homedir(), ".localdesk");
      const memoryPath = join(memoryDir, "memory.md");

      // Ensure directory exists
      await fs.mkdir(memoryDir, { recursive: true });

      // Write content
      await fs.writeFile(memoryPath, content, "utf-8");
      console.log("[Main] Memory saved to:", memoryPath);
    } catch (error: any) {
      console.error("[Main] Failed to write memory:", error);
      throw error;
    }
  });

  ipcMainHandle("open-path-in-finder", async (_, pathToOpen: string) => {
    try {
      console.log("[Main] Opening path in file manager:", pathToOpen);
      // shell.openPath works on all platforms (macOS, Windows, Linux)
      // It opens the path in the default file manager
      const result = await shell.openPath(pathToOpen);
      if (result) {
        console.error("[Main] Failed to open path:", result);
        return { success: false, error: result };
      }
      return { success: true };
    } catch (error: any) {
      console.error("[Main] Error opening path:", error);
      return { success: false, error: error.message };
    }
  });

  // Handle get build info
  ipcMainHandle("get-build-info", async () => {
    try {
      const buildInfoPath = join(
        app.getAppPath(),
        "dist-electron",
        "build-info.json",
      );
      const buildInfo = JSON.parse(await fs.readFile(buildInfoPath, "utf-8"));
      return buildInfo;
    } catch (error: any) {
      console.error("[Main] Failed to read build info:", error);
      // Fallback to package.json version if build-info.json is missing
      const packageJsonPath = join(app.getAppPath(), "package.json");
      try {
        const packageJson = JSON.parse(
          await fs.readFile(packageJsonPath, "utf-8"),
        );
        return {
          version: packageJson.version,
          commit: "unknown",
          commitShort: "dev",
          buildTime: "unknown",
        };
      } catch {
        return {
          version: "0.0.0",
          commit: "unknown",
          commitShort: "dev",
          buildTime: "unknown",
        };
      }
    }
  });

  // Handle opening external URLs in default browser
  ipcMainHandle("open-external-url", async (_, url: string) => {
    try {
      console.log("[Main] Opening external URL:", url);
      await shell.openExternal(url);
      return { success: true };
    } catch (error: any) {
      console.error("[Main] Error opening URL:", error);
      return { success: false, error: error.message };
    }
  });

  // Allow renderer to request a desktop notification (typed via EventPayloadMapping)
  ipcMainHandle(
    "send-notification",
    async (_: any, payload: { title: string; body: string; meta?: any }) => {
      return await sendNotification(payload.title, payload.body, payload.meta);
    },
  );
});
// Stop scheduler on app quit
app.on("will-quit", () => {
  stopScheduler();
});
