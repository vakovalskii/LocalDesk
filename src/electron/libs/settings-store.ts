import { app } from "electron";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import type { ApiSettings } from "../types.js";

const SETTINGS_FILE = "api-settings.json";

function getSettingsPath(): string {
  const userDataPath = app.getPath("userData");
  return join(userDataPath, SETTINGS_FILE);
}

export function loadApiSettings(): ApiSettings | null {
  try {
    const settingsPath = getSettingsPath();
    if (!existsSync(settingsPath)) {
      return null;
    }
    
    const raw = readFileSync(settingsPath, "utf8");
    
    // Check if file is empty or contains only whitespace
    if (!raw || raw.trim() === '') {
      return null;
    }
    
    const settings = JSON.parse(raw) as ApiSettings;
    
    // Set default permissionMode to 'ask' if not specified
    if (!settings.permissionMode) {
      settings.permissionMode = 'ask';
    }
    
    // Return settings even if apiKey is empty (we now use LLM providers)
    return settings;
  } catch (error) {
    console.error("[Settings] Failed to load API settings:", error);
    return null;
  }
}

export function saveApiSettings(settings: ApiSettings): void {
  try {
    const settingsPath = getSettingsPath();
    const dir = dirname(settingsPath);
    
    // Ensure directory exists
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    console.log(`[Settings] Saving to: ${settingsPath}`);
    console.log(`[Settings] tavilyApiKey: ${settings.tavilyApiKey ? 'set' : 'empty'}`);
    console.log(`[Settings] webSearchProvider: ${settings.webSearchProvider}`);
    
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
    console.log(`[Settings] Saved successfully`);
  } catch (error) {
    console.error("Failed to save API settings:", error);
    throw new Error("Failed to save settings");
  }
}
