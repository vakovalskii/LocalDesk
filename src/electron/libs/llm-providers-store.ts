import { app } from "electron";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import type { LLMProviderSettings } from "../types.js";

const SETTINGS_FILE = "llm-providers-settings.json";

function getSettingsPath(): string {
  const userDataPath = app.getPath("userData");
  return join(userDataPath, SETTINGS_FILE);
}

export function loadLLMProviderSettings(): LLMProviderSettings | null {
  try {
    const settingsPath = getSettingsPath();
    if (!existsSync(settingsPath)) {
      return { providers: [], models: [] };
    }

    const raw = readFileSync(settingsPath, "utf8");

    // Check if file is empty or contains only whitespace
    if (!raw || raw.trim() === '') {
      return { providers: [], models: [] };
    }

    const settings = JSON.parse(raw) as LLMProviderSettings;

    // Validate structure
    if (!settings.providers || !Array.isArray(settings.providers)) {
      return { providers: [], models: [] };
    }

    if (!settings.models || !Array.isArray(settings.models)) {
      return { providers: settings.providers || [], models: [] };
    }

    return settings;
  } catch (error) {
    console.error("[LLM Providers] Failed to load settings:", error);
    return { providers: [], models: [] };
  }
}

export function saveLLMProviderSettings(settings: LLMProviderSettings): void {
  try {
    const settingsPath = getSettingsPath();
    const dir = dirname(settingsPath);

    // Ensure directory exists
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
    console.log(`[LLM Providers] Saved ${settings.providers.length} providers and ${settings.models.length} models`);
  } catch (error) {
    console.error("[LLM Providers] Failed to save settings:", error);
    throw new Error("Failed to save LLM provider settings");
  }
}
